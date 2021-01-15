import uuid

import requests
from flask.globals import current_app

from _orchest.internals.two_phase_executor import TwoPhaseFunction
from app.connections import db
from app.models import Experiment
from app.utils import (
    create_experiment_directory,
    pipeline_uuid_to_path,
    remove_experiment_directory,
)


class CreateExperiment(TwoPhaseFunction):
    def transaction(
        self,
        project_uuid: str,
        pipeline_uuid: str,
        pipeline_name: str,
        experiment_name: str,
        draft: bool,
    ) -> Experiment:

        experiment_uuid = str(uuid.uuid4())
        pipeline_path = pipeline_uuid_to_path(pipeline_uuid, project_uuid)

        new_ex = Experiment(
            uuid=experiment_uuid,
            name=experiment_name,
            pipeline_uuid=pipeline_uuid,
            project_uuid=project_uuid,
            pipeline_name=pipeline_name,
            pipeline_path=pipeline_path,
            strategy_json="{}",
            draft=draft,
        )

        db.session.add(new_ex)

        self.collateral_kwargs["experiment_uuid"] = experiment_uuid
        self.collateral_kwargs["pipeline_uuid"] = pipeline_uuid
        self.collateral_kwargs["project_uuid"] = project_uuid

        return new_ex

    def collateral(self, experiment_uuid: str, pipeline_uuid: str, project_uuid: str):
        create_experiment_directory(experiment_uuid, pipeline_uuid, project_uuid)

    def revert(self):
        Experiment.query.filter_by(
            experiment_uuid=self.collateral_kwargs["experiment_uuid"]
        ).delete()


class DeleteExperiment(TwoPhaseFunction):
    def transaction(self, experiment_uuid: str):

        # If the experiment does not exist this is a no op.
        exp = Experiment.query.filter(Experiment.uuid == experiment_uuid).first()
        if exp is None:
            self.collateral_kwargs["exp_uuid"] = None
            self.collateral_kwargs["pipeline_uuid"] = None
            self.collateral_kwargs["project_uuid"] = None
        else:
            self.collateral_kwargs["exp_uuid"] = exp.uuid
            self.collateral_kwargs["pipeline_uuid"] = exp.pipeline_uuid
            self.collateral_kwargs["project_uuid"] = exp.project_uuid
            db.session.delete(exp)

    def collateral(self, exp_uuid: str, pipeline_uuid: str, project_uuid: str):
        if exp_uuid:
            # Tell the orchest-api that the experiment does not exist
            # anymore, will be stopped if necessary then cleaned up from
            # the orchest-api db.
            url = (
                f"http://{current_app.config['ORCHEST_API_ADDRESS']}/api/"
                f"experiments/cleanup/{exp_uuid}"
            )
            current_app.config["SCHEDULER"].add_job(requests.delete, args=[url])

            # Remove from the filesystem.
            remove_experiment_directory(exp_uuid, pipeline_uuid, project_uuid)
