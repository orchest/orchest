import contextlib
import copy
import json
import os
import uuid

import requests
from flask.globals import current_app

from _orchest.internals import compat as _compat
from _orchest.internals.two_phase_executor import TwoPhaseFunction
from app import error
from app.connections import db
from app.models import Pipeline
from app.utils import (
    check_pipeline_correctness,
    get_pipeline_directory,
    get_pipeline_path,
    has_active_sessions,
    is_valid_pipeline_relative_path,
    is_valid_project_relative_path,
    normalize_project_relative_path,
)


class CreatePipeline(TwoPhaseFunction):
    def _transaction(self, project_uuid: str, pipeline_name: str, pipeline_path: str):

        # It is important to normalize the path because
        # find_pipelines_in_dir will return normalized paths as well,
        # which are used to detect pipelines that were deleted through
        # the file system in SyncProjectPipelinesDBState.
        pipeline_path = normalize_project_relative_path(pipeline_path)

        # Reject creation if a pipeline with this path exists already.
        if (
            Pipeline.query.filter(Pipeline.project_uuid == project_uuid)
            .filter(Pipeline.path == pipeline_path)
            .count()
            > 0
        ):
            raise FileExistsError(f"Pipeline already exists at path {pipeline_path}.")

        pipeline_uuid = str(uuid.uuid4())
        pipeline = Pipeline(
            path=pipeline_path, uuid=pipeline_uuid, project_uuid=project_uuid
        )
        db.session.add(pipeline)

        # To be used by the collateral and revert functions.
        self.collateral_kwargs["project_uuid"] = project_uuid
        self.collateral_kwargs["pipeline_uuid"] = pipeline_uuid
        self.collateral_kwargs["pipeline_name"] = pipeline_name
        self.collateral_kwargs["pipeline_path"] = pipeline_path

        return pipeline_uuid

    def _collateral(
        self,
        project_uuid: str,
        pipeline_uuid: str,
        pipeline_name: str,
        pipeline_path: str,
        **kwargs,
    ):
        pipeline_dir = get_pipeline_directory(pipeline_uuid, project_uuid)
        pipeline_json_path = get_pipeline_path(pipeline_uuid, project_uuid)

        if not is_valid_project_relative_path(project_uuid, pipeline_path):
            raise error.OutOfProjectError(
                "New pipeline path points outside of the project directory."
            )

        os.makedirs(pipeline_dir, exist_ok=True)

        # Generate clean pipeline.json.
        pipeline_json = {
            "name": pipeline_name,
            "version": "1.0.0",
            "uuid": pipeline_uuid,
            "settings": {
                "auto_eviction": False,
                "data_passing_memory_size": "1GB",
            },
            "steps": {},
            "parameters": {},
        }

        resp = requests.post(
            f'http://{current_app.config["ORCHEST_API_ADDRESS"]}/api/pipelines/',
            json={"project_uuid": project_uuid, "uuid": pipeline_uuid},
        )
        if resp.status_code != 201:
            raise Exception("Orchest-api pipeline creation failed.")

        with open(pipeline_json_path, "w") as pipeline_json_file:
            json.dump(pipeline_json, pipeline_json_file, indent=4, sort_keys=True)

    def _revert(self):
        Pipeline.query.filter_by(
            project_uuid=self.collateral_kwargs["project_uuid"],
            uuid=self.collateral_kwargs["pipeline_uuid"],
            path=self.collateral_kwargs["pipeline_path"],
        ).delete()
        db.session.commit()


class DeletePipeline(TwoPhaseFunction):
    """Cleanup a pipeline from Orchest."""

    def _transaction(
        self, project_uuid: str, pipeline_uuid: str, remove_file: bool = True
    ):
        """Remove a pipeline from the db"""
        # Necessary because get_pipeline_path is going to query the db
        # entry, but the db entry does not exist anymore because it has
        # been deleted.
        pipeline_json_path = get_pipeline_path(pipeline_uuid, project_uuid)

        # Will delete cascade job -> pipeline run.
        Pipeline.query.filter_by(project_uuid=project_uuid, uuid=pipeline_uuid).delete()

        self.collateral_kwargs["project_uuid"] = project_uuid
        self.collateral_kwargs["pipeline_uuid"] = pipeline_uuid
        self.collateral_kwargs["pipeline_json_path"] = pipeline_json_path
        self.collateral_kwargs["remove_file"] = remove_file

    def _collateral(
        self,
        project_uuid: str,
        pipeline_uuid: str,
        pipeline_json_path: str,
        remove_file: bool,
    ):
        """Remove a pipeline from the FS and the orchest-api"""

        if remove_file:
            with contextlib.suppress(FileNotFoundError):
                os.remove(pipeline_json_path)

        # Orchest-api deletion.
        url = (
            f"http://{current_app.config['ORCHEST_API_ADDRESS']}/api/pipelines/"
            f"{project_uuid}/{pipeline_uuid}"
        )
        current_app.config["SCHEDULER"].add_job(requests.delete, args=[url])


class AddPipelineFromFS(TwoPhaseFunction):
    """Add a pipeline from the FS to Orchest.

    To be used when a pipeline is "discovered" through the FS, e.g. the
    user has manually added it.
    """

    def _transaction(self, project_uuid: str, pipeline_path: str):

        pipeline_json_path = get_pipeline_path(
            None, project_uuid, pipeline_path=pipeline_path
        )

        # Check the uuid of the pipeline. If the uuid is taken by
        # another pipeline in the project then generate a new uuid for
        # the pipeline.
        with open(pipeline_json_path, "r") as json_file:
            pipeline_json = json.load(json_file)
            file_pipeline_uuid = pipeline_json.get("uuid")

            self.collateral_kwargs["new_uuid"] = None
            self.collateral_kwargs["project_uuid"] = None
            self.collateral_kwargs["pipeline_uuid"] = None
            self.collateral_kwargs["pipeline_path"] = None
            self.collateral_kwargs["pipeline_json"] = None

            # If the pipeline has its own uuid and the uuid is not in
            # the DB already then the pipeline does not need to have a
            # new uuid assigned and written to disk.
            if (
                file_pipeline_uuid is not None
                and Pipeline.query.filter_by(
                    project_uuid=project_uuid, uuid=file_pipeline_uuid, status="READY"
                ).count()
                == 0
            ):
                self.collateral_kwargs["new_uuid"] = False

            else:
                self.collateral_kwargs["new_uuid"] = True
                # Generate a new uuid for the pipeline.
                file_pipeline_uuid = str(uuid.uuid4())

            self.collateral_kwargs["project_uuid"] = project_uuid
            self.collateral_kwargs["pipeline_uuid"] = file_pipeline_uuid
            self.collateral_kwargs["pipeline_path"] = pipeline_path
            self.collateral_kwargs["pipeline_json"] = pipeline_json

            # Add the pipeline to the db.
            new_pipeline = Pipeline(
                uuid=file_pipeline_uuid,
                path=pipeline_path,
                project_uuid=project_uuid,
            )
            db.session.add(new_pipeline)

    def _collateral(
        self,
        new_uuid: bool,
        project_uuid: str,
        pipeline_uuid: str,
        pipeline_path: str,
        pipeline_json: str,
    ):
        # At the project level, pipeline files with the same UUID are
        # considered to be the same pipeline. If we are "replacing" the
        # pipeline it's because the previous pipeline was deleted and
        # this new pipeline has been discovered through the FS. DELETEs
        # of a pipeline to the orchest-api don't actually delete the
        # pipeline, so we don't need to POST, since the old entry will
        # still be there. Currently, we don't need to PUT since no field
        # of the pipeline entry in the orchest-api needs to be updated
        # when replacing.
        resp = requests.get(
            f'http://{current_app.config["ORCHEST_API_ADDRESS"]}/api/pipelines/'
            f"{project_uuid}/{pipeline_uuid}",
        )
        if resp.status_code == 404:
            resp = requests.post(
                f'http://{current_app.config["ORCHEST_API_ADDRESS"]}/api/pipelines/',
                json={"project_uuid": project_uuid, "uuid": pipeline_uuid},
            )
            if resp.status_code != 201:
                raise Exception("Orchest-api pipeline creation failed.")

        if new_uuid:
            pipeline_json_path = get_pipeline_path(
                None, project_uuid, pipeline_path=pipeline_path
            )

            with open(pipeline_json_path, "w") as json_file:
                pipeline_json["uuid"] = pipeline_uuid
                json.dump(pipeline_json, json_file, indent=4, sort_keys=True)

    def _revert(self):
        Pipeline.query.filter_by(
            project_uuid=self.collateral_kwargs["project_uuid"],
            uuid=self.collateral_kwargs["pipeline_uuid"],
            path=self.collateral_kwargs["pipeline_path"],
        ).delete()
        db.session.commit()


class MovePipeline(TwoPhaseFunction):
    """Move a pipeline.

    Moves a pipeline, moving it to another path.
    """

    def _transaction(
        self, project_uuid: str, pipeline_uuid: str, new_project_relative_path: str
    ):

        pipeline = (
            Pipeline.query.with_for_update()
            .filter(
                Pipeline.project_uuid == project_uuid,
                Pipeline.uuid == pipeline_uuid,
                Pipeline.status == "READY"
                # Raises sqlalchemy.orm.exc.NoResultFound if the query
                # selects no rows.
            )
            .one()
        )

        # Note the with_for_update in the query, that is used to avoid
        # race conditions with the session POST endpoint.
        if has_active_sessions(project_uuid, pipeline_uuid):
            raise error.ActiveSession()

        if not new_project_relative_path.endswith(".orchest"):
            raise ValueError('Path must end with ".orchest".')

        # It is important to normalize the path because
        # find_pipelines_in_dir will return normalized paths as well,
        # which are used to detect pipelines that were deleted through
        # the file system in SyncProjectPipelinesDBState.
        new_project_relative_path = normalize_project_relative_path(
            new_project_relative_path
        )

        old_path = pipeline.path
        # This way it's not considered as if it was deleted on the FS.
        # Pipeline discovery might think that the still not moved file
        # is a new pipeline, but that is taken care of in the discovery
        # logic.
        pipeline.status = "MOVING"
        pipeline.path = new_project_relative_path

        # To be used by the collateral effect.
        self.collateral_kwargs["project_uuid"] = project_uuid
        self.collateral_kwargs["pipeline_uuid"] = pipeline_uuid
        self.collateral_kwargs["old_path"] = old_path
        self.collateral_kwargs["new_path"] = new_project_relative_path

    def _collateral(
        self,
        project_uuid: str,
        pipeline_uuid: str,
        old_path: str,
        new_path: str,
    ):
        """Move a pipeline to another path, i.e. rename it."""

        if not is_valid_project_relative_path(project_uuid, new_path):
            raise error.OutOfProjectError(
                "New pipeline path points outside of the project directory."
            )

        old_path = get_pipeline_path(None, project_uuid, pipeline_path=old_path)
        new_path = get_pipeline_path(None, project_uuid, pipeline_path=new_path)

        if not os.path.exists(old_path):
            raise error.PipelineFileDoesNotExist()

        if os.path.exists(new_path) and old_path != new_path:
            raise error.PipelineFileExists()

        # Update the pipeline definition by adjusting the step file
        # paths, since they should be relative to the pipeline file.
        rel_path = os.path.relpath(
            os.path.split(old_path)[0], os.path.split(new_path)[0]
        )
        if rel_path != ".":
            with open(old_path, "r") as json_file:
                pipeline_def = json.load(json_file)
                # Ensures that pipeline_def applies the right schema
                _compat.migrate_pipeline(pipeline_def)
                self.collateral_kwargs["pipeline_def_backup"] = copy.deepcopy(
                    pipeline_def
                )
            for step in pipeline_def["steps"].values():
                step_f_prefix, step_f_name = os.path.split(step["file_path"])
                file_path = os.path.normpath(
                    # Get to the "previous" position + use the relative
                    # path of the notebook w.r.t. the previous position,
                    # then normalize to cleanup paths such as
                    # 1/2/3/../../2 , that would become 1/2.
                    os.path.join(rel_path, step_f_prefix, step_f_name)
                )
                step["file_path"] = file_path
                if not is_valid_pipeline_relative_path(
                    project_uuid, pipeline_uuid, file_path
                ):
                    raise error.OutOfProjectError(
                        "Step path points outside of the project directory."
                    )

            with open(old_path, "w") as json_file:
                errors = check_pipeline_correctness(pipeline_def)
                if errors:
                    raise Exception("Incorrect pipeline.")
                json.dump(pipeline_def, json_file, indent=4, sort_keys=True)

        # Create the parent directories if needed.
        directories, _ = os.path.split(new_path)
        if directories:
            os.makedirs(directories, exist_ok=True)
        os.rename(old_path, new_path)

        # So that the moving can be reverted in case of failure of the
        # rest of the collateral.
        self.collateral_kwargs["moved"] = True

        Pipeline.query.filter_by(
            project_uuid=project_uuid,
            uuid=pipeline_uuid,
        ).update({"status": "READY"})
        db.session.commit()

    def _revert(self):
        project_uuid = self.collateral_kwargs["project_uuid"]
        pipeline_uuid = self.collateral_kwargs["pipeline_uuid"]

        old_path = get_pipeline_path(
            None, project_uuid, pipeline_path=self.collateral_kwargs["old_path"]
        )

        # Move it back if necessary. This avoids the pipeline being
        # discovered as a new one.
        if self.collateral_kwargs.get("moved", False):
            new_path = get_pipeline_path(
                None, project_uuid, pipeline_path=self.collateral_kwargs["new_path"]
            )
            try:
                os.rename(new_path, old_path)
            except Exception as e:
                current_app.logger.error(f"Error while reverting pipeline move: {e}")

        # Restore the original pipeline step relative paths.
        pp_bk = self.collateral_kwargs.get("pipeline_def_backup")
        if pp_bk is not None:
            with open(old_path, "w") as json_file:
                json.dump(pp_bk, json_file, indent=4, sort_keys=True)

        Pipeline.query.filter_by(
            project_uuid=project_uuid,
            uuid=pipeline_uuid,
        ).update({"status": "READY", "path": self.collateral_kwargs["old_path"]})
        db.session.commit()
