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

        self.experiment_uuid = experiment_uuid
        self.pipeline_uuid = pipeline_uuid
        self.project_uuid = project_uuid

        return new_ex

    def collateral(self):
        create_experiment_directory(
            self.experiment_uuid, self.pipeline_uuid, self.project_uuid
        )

    def revert(self):
        Experiment.query.filter_by(experiment_uuid=self.experiment_uuid).delete()


class DeleteExperiment(TwoPhaseFunction):
    def transaction(self, experiment_uuid: str):

        # If the experiment does not exist this is a no op.
        exp = Experiment.query.filter(Experiment.uuid == experiment_uuid).first()
        self.do_collateral = exp is None
        if self.do_collateral:
            return

        self.exp_uuid = exp.uuid
        self.pipeline_uuid = exp.pipeline_uuid
        self.project_uuid = exp.project_uuid
        db.session.delete(exp)

    def collateral(self):
        if self.do_collateral:
            # Tell the orchest-api that the experiment does not exist
            # anymore, will be stopped if necessary then cleaned up from
            # the orchest-api db.
            url = (
                f"http://{current_app.config['ORCHEST_API_ADDRESS']}/api/"
                f"experiments/cleanup/{self.exp_uuid}"
            )
            current_app.config["SCHEDULER"].add_job(requests.delete, args=[url])

            # Remove from the filesystem.
            remove_experiment_directory(
                self.exp_uuid, self.pipeline_uuid, self.project_uuid
            )
