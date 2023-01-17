"""API endpoints to initiate and track git imports."""
import os
import uuid
from typing import Optional

import validators
from flask import current_app, request
from flask_restx import Namespace, Resource

from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import models, schema, utils
from app.connections import db

api = Namespace("git-imports", description="Initiate and track git imports.")
api = schema.register_schema(api)


@api.route("/")
class GitImportList(Resource):
    @api.doc("initiate_import")
    @api.expect(schema.git_import_request)
    @api.marshal_with(schema.git_import, code=200)
    def post(self):
        """Initiates a git import.

        If auth_user_uuid is passed and the user exists the pull will
        be done using the ssh keys that the user has set.
        """
        data = request.get_json()
        project_name = data.get("project_name")
        if project_name is not None and (
            os.path.sep in project_name or len(project_name) > 255
        ):
            return {"message": f"Invalid project name {project_name}."}, 400

        auth_user_uuid = data.get("auth_user_uuid")
        if auth_user_uuid is not None:
            if not isinstance(auth_user_uuid, str):
                return {"message": f"Invalid auth_user_uuid {auth_user_uuid}."}, 400
            utils.upsert_auth_user_uuid(auth_user_uuid)

        repo_url = data.get("url", "")
        if not validators.url(repo_url) and not utils.is_valid_ssh_destination(
            repo_url
        ):
            return {"message": f"Invalid repository url {repo_url}."}, 400

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                git_import = ImportGitProject(tpe).transaction(
                    data["url"], project_name, auth_user_uuid
                )
        except Exception as e:
            return ({"message": str(e)}), 500

        return git_import, 200


@api.route("/<string:git_import_uuid>")
@api.param("git_import_uuid", "")
@api.response(404, "Git import not found.")
class GitImport(Resource):
    @api.doc("get_git_import")
    @api.marshal_with(schema.git_import, code=200)
    def get(self, git_import_uuid: str):
        git_import = models.GitImport.query.get_or_404(
            ident=git_import_uuid,
            description="GitImport not found.",
        )
        return git_import, 200


class ImportGitProject(TwoPhaseFunction):
    def _transaction(
        self,
        url: str,
        project_name: Optional[str] = None,
        auth_user_uuid: Optional[str] = None,
    ):
        git_import = models.GitImport(
            uuid=str(uuid.uuid4()),
            url=url,
            requested_name=project_name,
            status="PENDING",
        )
        db.session.add(git_import)

        # To be later used by the collateral function.
        self.collateral_kwargs["git_import_uuid"] = git_import.uuid
        self.collateral_kwargs["url"] = git_import.url
        self.collateral_kwargs["project_name"] = git_import.requested_name
        self.collateral_kwargs["auth_user_uuid"] = auth_user_uuid
        return git_import

    def _collateral(
        self,
        git_import_uuid: str,
        url: str,
        project_name: Optional[str],
        auth_user_uuid: Optional[str],
    ):
        celery = current_app.config["CELERY"]
        celery.send_task(
            "app.core.tasks.git_import",
            kwargs={
                "url": url,
                "project_name": project_name,
                "auth_user_uuid": auth_user_uuid,
            },
            task_id=git_import_uuid,
        )

    def _revert(self):
        models.GitImport.query.filter(
            models.GitImport.uuid == self.collateral_kwargs["git_import_uuid"]
        ).update({"status": "FAILURE"})
        db.session.commit()
