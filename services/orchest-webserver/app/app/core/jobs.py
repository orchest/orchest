import uuid

import requests
from flask.globals import current_app

from _orchest.internals.two_phase_executor import TwoPhaseFunction
from app.connections import db
from app.models import Job
from app.utils import create_job_directory, pipeline_uuid_to_path, remove_job_directory


class CreateJob(TwoPhaseFunction):
    def _transaction(
        self,
        project_uuid: str,
        pipeline_uuid: str,
        pipeline_name: str,
        job_name: str,
        draft: bool,
    ) -> Job:

        job_uuid = str(uuid.uuid4())
        pipeline_path = pipeline_uuid_to_path(pipeline_uuid, project_uuid)

        new_ex = Job(
            uuid=job_uuid,
            name=job_name,
            pipeline_uuid=pipeline_uuid,
            project_uuid=project_uuid,
            pipeline_name=pipeline_name,
            pipeline_path=pipeline_path,
            strategy_json="{}",
            draft=draft,
        )

        db.session.add(new_ex)

        self.collateral_kwargs["job_uuid"] = job_uuid
        self.collateral_kwargs["pipeline_uuid"] = pipeline_uuid
        self.collateral_kwargs["project_uuid"] = project_uuid

        return new_ex

    def _collateral(self, job_uuid: str, pipeline_uuid: str, project_uuid: str):
        create_job_directory(job_uuid, pipeline_uuid, project_uuid)

    def _revert(self):
        Job.query.filter_by(job_uuid=self.collateral_kwargs["job_uuid"]).delete()


class DeleteJob(TwoPhaseFunction):
    def _transaction(self, job_uuid: str):

        # If the job does not exist this is a no op.
        exp = Job.query.filter(Job.uuid == job_uuid).first()
        if exp is None:
            self.collateral_kwargs["exp_uuid"] = None
            self.collateral_kwargs["pipeline_uuid"] = None
            self.collateral_kwargs["project_uuid"] = None
        else:
            self.collateral_kwargs["exp_uuid"] = exp.uuid
            self.collateral_kwargs["pipeline_uuid"] = exp.pipeline_uuid
            self.collateral_kwargs["project_uuid"] = exp.project_uuid
            db.session.delete(exp)

    def _collateral(self, exp_uuid: str, pipeline_uuid: str, project_uuid: str):
        if exp_uuid:
            # Tell the orchest-api that the job does not exist
            # anymore, will be stopped if necessary then cleaned up from
            # the orchest-api db.
            url = (
                f"http://{current_app.config['ORCHEST_API_ADDRESS']}/api/"
                f"jobs/cleanup/{exp_uuid}"
            )
            current_app.config["SCHEDULER"].add_job(requests.delete, args=[url])

            # Remove from the filesystem.
            remove_job_directory(exp_uuid, pipeline_uuid, project_uuid)
