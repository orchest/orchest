import json
import os
import re
import subprocess
import uuid
from typing import List

import requests
from flask import current_app
from werkzeug.utils import safe_join

from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from _orchest.internals.utils import rmtree
from app import error
from app.connections import db
from app.core.pipelines import AddPipelineFromFS, CreatePipeline, DeletePipeline
from app.kernel_manager import populate_kernels
from app.models import Environment, Pipeline, Project
from app.utils import (
    find_pipelines_in_dir,
    get_environments,
    get_pipeline_path,
    has_active_sessions,
    populate_default_environments,
    project_uuid_to_path,
    remove_project_jobs_directories,
)
from app.views.orchest_api import api_proxy_environment_image_builds


class CreateProject(TwoPhaseFunction):
    """Init an orchest project."""

    def _transaction(self, project_path: str, skip_env_builds: bool = False) -> str:
        """Add a project to the db.

        Args:
            project_path (str): [description]

        Returns:
            UUID of the newly initialized project.
        """
        if len(project_path) > 255:
            raise error.InvalidProjectName(
                "Project name can't be longer than 255 characters."
            )

        # The collateral effect will later make use of this.
        project_uuid = str(uuid.uuid4())
        new_project = Project(
            uuid=project_uuid, path=project_path, status="INITIALIZING"
        )
        db.session.add(new_project)

        self.collateral_kwargs["project_uuid"] = project_uuid
        self.collateral_kwargs["project_path"] = project_path
        self.collateral_kwargs["skip_env_builds"] = skip_env_builds
        return project_uuid

    def _collateral(self, project_uuid: str, project_path: str, skip_env_builds: bool):
        """Create a project on the filesystem.

        Given a directory it will detect what parts are missing from the
        .orchest directory for the project to be considered initialized,
        e.g. the actual .orchest directory, .gitignore file,
        environments directory, etc. As part of process initialization
        environments are built and kernels refreshed.

        Raises:
            NotADirectoryError:
            FileExistsError:
            NotADirectoryError:
        """
        full_project_path = safe_join(current_app.config["PROJECTS_DIR"], project_path)
        # exist_ok=True is there so that this function can be used both
        # when initializing a project that was discovered through the
        # filesystem or initializing a project from scratch.
        os.makedirs(full_project_path, exist_ok=True)

        # Create top-level `.gitignore` file with sane defaults, in case
        # it not already exists.
        root_gitignore = safe_join(full_project_path, ".gitignore")
        if not os.path.exists(root_gitignore):
            with open(root_gitignore, "w") as f:
                f.write("\n".join(current_app.config["GIT_IGNORE_PROJECT_ROOT"]))

        # This would actually be created as a collateral effect when
        # populating with default environments, do not rely on that.
        expected_internal_dir = safe_join(full_project_path, ".orchest")
        if os.path.isfile(expected_internal_dir):
            raise NotADirectoryError(
                "The expected internal directory (.orchest) is a file."
            )
        elif not os.path.isdir(expected_internal_dir):
            os.makedirs(expected_internal_dir, exist_ok=True)

        # Init the `.orchest/.gitignore` file if it is not there
        # already. NOTE: This `.gitignore` file is created inside the
        # `.orchest/` directory because an existing project might be
        # added to Orchest and already contain a root-level
        # `.gitignore`, which we don't want to inject ourselves in.
        expected_git_ignore_file = safe_join(
            full_project_path, ".orchest", ".gitignore"
        )
        if os.path.isdir(expected_git_ignore_file):
            raise FileExistsError(".orchest/.gitignore is a directory")
        elif not os.path.isfile(expected_git_ignore_file):
            with open(expected_git_ignore_file, "w") as ign_file:
                ign_file.write(
                    "\n".join(current_app.config["GIT_IGNORE_PROJECT_HIDDEN_ORCHEST"])
                )

        # Initialize with default environments only if the project has
        # no environments directory.
        expected_env_dir = safe_join(full_project_path, ".orchest", "environments")
        if os.path.isfile(expected_env_dir):
            raise NotADirectoryError(
                "The expected environments directory (.orchest/environments) "
                "is a file."
            )
        elif not os.path.isdir(expected_env_dir):
            populate_default_environments(project_uuid)

        # Initialize .git directory
        expected_git_dir = safe_join(full_project_path, ".git")

        # If no git directory exists initialize git repo
        if not os.path.exists(expected_git_dir):
            p = subprocess.Popen(["git", "init"], cwd=full_project_path)
            p.wait()

        # Refresh kernels after change in environments, given that
        # either we added the default environments or the project has
        # environments of its own.
        populate_kernels(current_app, db, project_uuid)

        resp = requests.post(
            f'http://{current_app.config["ORCHEST_API_ADDRESS"]}/api/projects/',
            json={"uuid": project_uuid, "name": project_path},
        )
        if resp.status_code != 201:
            raise Exception("Orchest-api project creation failed.")

        environments = get_environments(project_uuid)
        for env in environments:
            url = (
                f'http://{current_app.config["ORCHEST_API_ADDRESS"]}'
                f"/api/environments/{project_uuid}"
            )
            requests.post(url, json={"uuid": env.uuid})

        if not skip_env_builds:
            build_environments_for_project(project_uuid, environments)

        # Create a Pipeline if none exists yet. In Orchest many actions
        # are dependent on a Pipeline existing, so let's make sure a
        # Pipeline always exists.
        pipeline_paths = find_pipelines_in_dir(
            full_project_path, relative_to=full_project_path
        )
        if not pipeline_paths:
            CreatePipeline(self.tpe).transaction(project_uuid, "Main", "main.orchest")

        Project.query.filter_by(uuid=project_uuid, path=project_path).update(
            {"status": "READY"}
        )
        db.session.commit()

    def _revert(self):
        Project.query.filter_by(
            uuid=self.collateral_kwargs["project_uuid"],
            path=self.collateral_kwargs["project_path"],
        ).delete()
        db.session.commit()


class DeleteProject(TwoPhaseFunction):
    """Cleanup a project from Orchest.

    Removes references of the project in the webserver db, and issues a
    cleanup request to the orchest-api.
    """

    def _transaction(self, project_uuid: str):
        """Remove a project from the db"""

        Project.query.filter_by(uuid=project_uuid).update({"status": "DELETING"})

        # To be used by the collateral effect.
        self.collateral_kwargs["project_uuid"] = project_uuid

    def _collateral(self, project_uuid: str):
        """Remove a project from the fs and the orchest-api"""

        # Delete the project directory.
        project_path = project_uuid_to_path(project_uuid)
        # The project has been deleted by a concurrent deletion request.
        if project_path is None:
            return
        full_project_path = safe_join(current_app.config["PROJECTS_DIR"], project_path)
        rmtree(full_project_path)

        # Remove jobs directories related to project.
        remove_project_jobs_directories(project_uuid)

        # Issue project deletion to the orchest-api.
        url = (
            f"http://{current_app.config['ORCHEST_API_ADDRESS']}/api/projects/"
            f"{project_uuid}"
        )
        current_app.config["SCHEDULER"].add_job(requests.delete, args=[url])

        # Will delete cascade pipeline, pipeline run.
        Project.query.filter_by(uuid=project_uuid).delete()
        db.session.commit()

    def _revert(self):
        Project.query.filter_by(uuid=self.collateral_kwargs["project_uuid"]).update(
            {"status": "READY"}
        )
        db.session.commit()


class RenameProject(TwoPhaseFunction):
    """Rename a project.

    Renames a project, moving it to another path.
    """

    def _transaction(self, project_uuid: str, new_name: str):
        if len(new_name) > 255:
            raise error.InvalidProjectName(
                "Project name can't be longer than 255 characters."
            )

        project = (
            Project.query.with_for_update()
            .filter(
                Project.uuid == project_uuid,
                Project.status == "READY"
                # Raises sqlalchemy.orm.exc.NoResultFound if the query
                # selects no rows.
            )
            .one()
        )

        if "/" in new_name:
            raise error.InvalidProjectName()

        # Note the with_for_update in the query, that is used to avoid
        # race conditions with the session POST endpoint.
        if has_active_sessions(project_uuid):
            raise error.ActiveSession()

        old_name = project.path
        # This way it's not considered as if it was deleted on the FS.
        # Project discovery might think that the still not moved
        # directory is a new project, but that is taken care of in the
        # discovery logic.
        project.status = "MOVING"
        project.path = new_name

        # To be used by the collateral effect.
        self.collateral_kwargs["project_uuid"] = project_uuid
        self.collateral_kwargs["old_name"] = old_name
        self.collateral_kwargs["new_name"] = new_name

    def _collateral(
        self,
        project_uuid: str,
        old_name: str,
        new_name: str,
    ):
        """Move a project to another path, i.e. rename it."""

        old_path = safe_join(current_app.config["PROJECTS_DIR"], old_name)
        new_path = safe_join(current_app.config["PROJECTS_DIR"], new_name)

        os.rename(old_path, new_path)
        # So that the moving can be reverted in case of failure of the
        # rest of the collateral.
        self.collateral_kwargs["moved"] = True

        Project.query.filter_by(uuid=project_uuid).update({"status": "READY"})
        db.session.commit()

        resp = requests.put(
            (
                f'http://{current_app.config["ORCHEST_API_ADDRESS"]}/api/projects'
                f"/{project_uuid}"
            ),
            json={"name": new_name},
        )
        if resp.status_code != 200:
            raise Exception("Orchest-api project name change failed.")

    def _revert(self):
        # Move it back if necessary. This avoids the project being
        # discovered as a new one.
        if self.collateral_kwargs.get("moved", False):
            old_path = safe_join(
                current_app.config["PROJECTS_DIR"], self.collateral_kwargs["old_name"]
            )
            new_path = safe_join(
                current_app.config["PROJECTS_DIR"], self.collateral_kwargs["new_name"]
            )
            try:
                os.rename(new_path, old_path)
            except Exception as e:
                current_app.logger.error(f"Error while reverting project move: {e}")

        Project.query.filter_by(uuid=self.collateral_kwargs["project_uuid"]).update(
            {"status": "READY", "path": self.collateral_kwargs["old_name"]}
        )
        db.session.commit()


class SyncProjectPipelinesDBState(TwoPhaseFunction):
    """Synchronizes the state of the pipelines of a project."""

    def _transaction(self, project_uuid):
        """Synchronizes the state of the pipelines of a project.

        Synchronizes the state of the filesystem with the db when it
        comes to the pipelines of a project. Pipelines removed from the
        filesystem are removed, new pipelines (or pipelines that where
        there after, for example a project import) are registered in
        the db.

        Args:
            project_uuid:

        Raises:
            FileNotFoundError: If the project directory is not found.
        """

        project_path = project_uuid_to_path(project_uuid)
        project_dir = safe_join(
            current_app.config["USER_DIR"], "projects", project_path
        )

        # Lock the project to avoid race conditions in pipeline deletion
        # or creation.
        Project.query.with_for_update().filter_by(uuid=project_uuid).one()

        if not os.path.isdir(project_dir):
            raise FileNotFoundError("Project directory not found")

        # Find all pipelines in the project directory.
        pipeline_paths = find_pipelines_in_dir(project_dir, project_dir)
        # Cleanup pipelines that have been manually removed.
        fs_removed_pipelines = [
            pipeline
            for pipeline in Pipeline.query.filter(Pipeline.path.notin_(pipeline_paths))
            .filter(
                Pipeline.project_uuid == project_uuid,
                Pipeline.status == "READY",
            )
            .all()
        ]
        for pip in fs_removed_pipelines:
            DeletePipeline(self.tpe).transaction(
                pip.project_uuid, pip.uuid, remove_file=False
            )

        # Identify all pipeline paths that are not yet a pipeline, that
        # is, pipelines that were added through the filesystem.
        existing_pipeline_paths = [
            pipeline.path
            for pipeline in Pipeline.query.filter(Pipeline.path.in_(pipeline_paths))
            .filter(Pipeline.project_uuid == project_uuid)
            .all()
        ]
        # TODO: handle existing pipeline assignments.
        new_pipelines_from_fs = set(pipeline_paths) - set(existing_pipeline_paths)

        for path in new_pipelines_from_fs:
            pipeline_json_path = get_pipeline_path(
                None, project_uuid, pipeline_path=path
            )
            with open(pipeline_json_path, "r") as json_file:
                pipeline_uuid = json.load(json_file)["uuid"]
            # This is not a new pipeline, the pipeline is being moved.
            is_moving = (
                Pipeline.query.filter_by(
                    project_uuid=project_uuid, uuid=pipeline_uuid, status="MOVING"
                ).count()
                > 0
            )
            if not is_moving:
                AddPipelineFromFS(self.tpe).transaction(project_uuid, path)

    def _collateral(self):
        pass


# Need to have these two functions here because of circular imports.
# TODO: fix this.
def build_environments(environment_uuids, project_uuid):
    project_path = project_uuid_to_path(project_uuid)

    environment_image_build_requests = [
        {
            "project_uuid": project_uuid,
            "project_path": project_path,
            "environment_uuid": environment_uuid,
        }
        for environment_uuid in environment_uuids
    ]

    return api_proxy_environment_image_builds(
        environment_image_build_requests, current_app.config["ORCHEST_API_ADDRESS"]
    )


def build_environments_for_project(project_uuid: str, environments: List[Environment]):
    return build_environments(
        [environment.uuid for environment in environments], project_uuid
    )


def discoverFSDeletedProjects():
    """Cleanup projects that were deleted from the filesystem."""

    project_paths = [
        entry.name
        for entry in os.scandir(current_app.config["PROJECTS_DIR"])
        if entry.is_dir()
    ]

    fs_removed_projects = Project.query.filter(
        Project.path.notin_(project_paths),
        # This way we do not delete a project that is already being
        # deleted twice, and avoid considering a project that is
        # being initialized as deleted from the filesystem, or that
        # it is moving.
        Project.status.in_(["READY"]),
    ).all()

    # Use a TwoPhaseExecutor for each project so that issues in one
    # project do not hinder the deletion of others.
    for proj_uuid in [project.uuid for project in fs_removed_projects]:
        try:
            with TwoPhaseExecutor(db.session) as tpe:
                DeleteProject(tpe).transaction(proj_uuid)
        except Exception as e:
            current_app.logger.error(
                ("Error during project deletion (discovery) of " f"{proj_uuid}: {e}.")
            )


def discoverFSCreatedProjects(skip_env_builds_on_discovery: bool = False) -> None:
    """Detect projects that were added through the file system.

    Args:
        skip_env_builds_on_discovery: When a project is discoverd an
        environment build is queued for every environment it has.
        This might not be desirable, so this options allows to avoid
        that.

    """

    # Detect new projects by detecting directories that were not
    # registered in the db as projects.
    existing_project_names = [project.path for project in Project.query.all()]

    fs_project_names = []
    for entry in os.scandir(current_app.config["PROJECTS_DIR"]):
        if not entry.is_dir():
            continue

        # In the UI we enforce the same naming convention, because git
        # has strict naming requirements on repository names.
        if re.search(r"[^A-Za-z0-9_.-]", entry.name) is not None:
            continue

        fs_project_names.append(entry.name)

    new_project_names = set(fs_project_names) - set(existing_project_names)

    # Do not do project discovery if a project is moving, because
    # a new_project_path could actually be a moving project. Given
    # that a project has no (persisted) uuid, we won't be able to
    # find if a new_project_path is actually a MOVING project. NOTE:
    # we could wait in this endpoint until there is no more MOVING
    # project.
    if Project.query.filter(Project.status.in_(["MOVING"])).count() > 0:
        return

    # Use a TwoPhaseExecutor for each project so that issues in one
    # project do not hinder the discovery of others.
    for new_project_name in new_project_names:
        try:
            with TwoPhaseExecutor(db.session) as tpe:
                CreateProject(tpe).transaction(
                    new_project_name, skip_env_builds=skip_env_builds_on_discovery
                )
        except Exception as e:
            current_app.logger.error(
                (
                    "Error during project initialization (discovery) of "
                    f"{new_project_name}: {e}."
                )
            )
