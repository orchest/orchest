import os
import subprocess
import uuid
from typing import Optional

import requests
from flask.globals import current_app

from _orchest.internals.two_phase_executor import TwoPhaseFunction
from app.connections import db
from app.core.pipelines import AddPipelineFromFS, DeletePipeline
from app.kernel_manager import populate_kernels
from app.models import BackgroundTask, Pipeline, Project
from app.utils import (
    find_pipelines_in_dir,
    get_environments,
    populate_default_environments,
    project_uuid_to_path,
    remove_project_jobs_directories,
    rmtree,
)
from app.views.orchest_api import api_proxy_environment_builds


class CreateProject(TwoPhaseFunction):
    """Init an orchest project."""

    def _transaction(self, project_path: str) -> str:
        """Add a project to the db.

        Args:
            project_path (str): [description]

        Returns:
            UUID of the newly initialized project.
        """
        # The collateral effect will later make use of this.
        project_uuid = str(uuid.uuid4())
        new_project = Project(
            uuid=project_uuid, path=project_path, status="INITIALIZING"
        )
        db.session.add(new_project)

        self.collateral_kwargs["project_uuid"] = project_uuid
        self.collateral_kwargs["project_path"] = project_path
        return project_uuid

    def _collateral(self, project_uuid: str, project_path: str):
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
        full_project_path = os.path.join(
            current_app.config["PROJECTS_DIR"], project_path
        )
        # exist_ok=True is there so that this function can be used both
        # when initializing a project that was discovered through the
        # filesystem or initializing a project from scratch.
        os.makedirs(full_project_path, exist_ok=True)

        # This would actually be created as a collateral effect when
        # populating with default environments, do not rely on that.
        expected_internal_dir = os.path.join(full_project_path, ".orchest")
        if os.path.isfile(expected_internal_dir):
            raise NotADirectoryError(
                "The expected internal directory (.orchest) is a file."
            )
        elif not os.path.isdir(expected_internal_dir):
            os.makedirs(expected_internal_dir, exist_ok=True)

        # Init the .gitignore file if it is not there already.
        expected_git_ignore_file = os.path.join(
            full_project_path, ".orchest", ".gitignore"
        )
        if os.path.isdir(expected_git_ignore_file):
            raise FileExistsError(".orchest/.gitignore is a directory")
        elif not os.path.isfile(expected_git_ignore_file):
            with open(expected_git_ignore_file, "w") as ign_file:
                ign_file.write(current_app.config["PROJECT_ORCHEST_GIT_IGNORE_CONTENT"])

        # Initialize with default environments only if the project has
        # no environments directory.
        expected_env_dir = os.path.join(full_project_path, ".orchest", "environments")
        if os.path.isfile(expected_env_dir):
            raise NotADirectoryError(
                "The expected environments directory (.orchest/environments) "
                "is a file."
            )
        elif not os.path.isdir(expected_env_dir):
            populate_default_environments(project_uuid)

        # Initialize .git directory
        expected_git_dir = os.path.join(full_project_path, ".git")

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
            json={"uuid": project_uuid},
        )
        if resp.status_code != 201:
            raise Exception("Orchest-api project creation failed.")

        # Build environments on project creation.
        build_environments_for_project(project_uuid)

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
        full_project_path = os.path.join(
            current_app.config["PROJECTS_DIR"], project_path
        )
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
        project_dir = os.path.join(
            current_app.config["USER_DIR"], "projects", project_path
        )

        if not os.path.isdir(project_dir):
            raise FileNotFoundError("Project directory not found")

        # Find all pipelines in the project directory.
        pipeline_paths = find_pipelines_in_dir(project_dir, project_dir)
        # Cleanup pipelines that have been manually removed.
        fs_removed_pipelines = [
            pipeline
            for pipeline in Pipeline.query.filter(Pipeline.path.notin_(pipeline_paths))
            .filter(Pipeline.project_uuid == project_uuid)
            .all()
        ]
        for pip in fs_removed_pipelines:
            DeletePipeline(self.tpe).transaction(pip.project_uuid, pip.uuid)

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
            AddPipelineFromFS(self.tpe).transaction(project_uuid, path)

    def _collateral(self):
        pass


class ImportGitProject(TwoPhaseFunction):
    def _transaction(self, url: str, project_name: Optional[str] = None):
        n_uuid = str(uuid.uuid4())
        new_task = BackgroundTask(
            uuid=n_uuid, task_type="GIT_CLONE_PROJECT", status="PENDING"
        )
        db.session.add(new_task)

        # To be later used by the collateral function.
        self.collateral_kwargs["n_uuid"] = n_uuid
        self.collateral_kwargs["url"] = url
        self.collateral_kwargs["project_name"] = project_name
        return new_task

    def _collateral(self, n_uuid: str, url: str, project_name: str):
        # Start the background process in charge of cloning.
        file_dir = os.path.dirname(os.path.realpath(__file__))
        args = [
            "python3",
            "-m",
            "scripts.background_tasks",
            "--type",
            "git_clone_project",
            "--uuid",
            n_uuid,
            "--url",
            url,
        ]

        if project_name:
            args.append("--path")
            args.append(str(project_name))

        subprocess.Popen(
            args, cwd=os.path.join(file_dir, "../.."), stderr=subprocess.STDOUT
        )

    def _revert(self):
        BackgroundTask.query.filter_by(uuid=self.collateral_kwargs["n_uuid"]).delete()


# Need to have these two functions here because of circular imports.
# TODO: fix this.
def build_environments(environment_uuids, project_uuid):
    project_path = project_uuid_to_path(project_uuid)

    environment_build_requests = [
        {
            "project_uuid": project_uuid,
            "project_path": project_path,
            "environment_uuid": environment_uuid,
        }
        for environment_uuid in environment_uuids
    ]

    return api_proxy_environment_builds(
        environment_build_requests, current_app.config["ORCHEST_API_ADDRESS"]
    )


def build_environments_for_project(project_uuid):
    environments = get_environments(project_uuid)

    return build_environments(
        [environment.uuid for environment in environments], project_uuid
    )
