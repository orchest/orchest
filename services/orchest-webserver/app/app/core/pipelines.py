import contextlib
import json
import os
import uuid

import requests
from flask.globals import current_app

from _orchest.internals.two_phase_executor import TwoPhaseFunction
from app.connections import db
from app.models import Pipeline
from app.utils import get_pipeline_directory, get_pipeline_path


class CreatePipeline(TwoPhaseFunction):
    def _transaction(self, project_uuid: str, pipeline_name: str, pipeline_path: str):

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

    def _collateral(
        self, project_uuid: str, pipeline_uuid: str, pipeline_name: str, **kwargs
    ):
        pipeline_dir = get_pipeline_directory(pipeline_uuid, project_uuid)
        pipeline_json_path = get_pipeline_path(pipeline_uuid, project_uuid)

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

    def _transaction(self, project_uuid: str, pipeline_uuid: str):
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

    def _collateral(
        self, project_uuid: str, pipeline_uuid: str, pipeline_json_path: str
    ):
        """Remove a pipeline from the FS and the orchest-api"""

        # CleanupPipelineFromOrchest can be used when deleting a
        # pipeline through Orchest or when cleaning up a pipeline that
        # was deleted through the filesystem by the user, so the file
        # might not be there.
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

            # If the pipeline has its own uuid and the uuid is not in
            # the db already then the pipeline does not need to have a
            # new uuid assigned and written to disk.
            if (
                file_pipeline_uuid
                and Pipeline.query.filter(Pipeline.uuid == file_pipeline_uuid)
                .filter(Pipeline.project_uuid == project_uuid)
                .count()
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
