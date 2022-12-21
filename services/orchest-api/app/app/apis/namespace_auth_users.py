"""API endpoints to track references to auth-users and related data."""

import uuid

import sqlalchemy
from flask import request
from flask_restx import Namespace, Resource

from app import models, schema
from app.connections import db

api = Namespace("auth-users", description="Manage references to auth-users.")
api = schema.register_schema(api)


@api.route("/")
class AuthUsersList(Resource):
    @api.expect(schema.auth_user_request)
    def post(self):
        db.session.add(models.AuthUser(uuid=request.get_json()["uuid"]))
        db.session.commit()
        return {}, 201


@api.route("/<string:auth_user_uuid>")
@api.param("auth_user_uuid", "")
class AuthUser(Resource):
    def delete(self, auth_user_uuid: str):
        models.AuthUser.query.filter(models.AuthUser.uuid == auth_user_uuid).delete()
        db.session.commit()
        return {}, 200


@api.route("/<string:auth_user_uuid>/git-configs")
class GitConfigList(Resource):
    @api.marshal_with(schema.git_configs, code=200)
    def get(self, auth_user_uuid: str):
        models.AuthUser.query.get_or_404(
            auth_user_uuid, description=f"No user {auth_user_uuid}."
        )
        git_configs = models.GitConfig.query.filter(
            models.GitConfig.auth_user_uuid == auth_user_uuid
        ).all()
        return {"git_configs": git_configs}, 200

    @api.expect(schema.git_config_request)
    @api.marshal_with(schema.git_config, code=201)
    def post(self, auth_user_uuid: str):
        """Adds a git config to the user.

        Note: it's currently possible to only have a single git config
        for a user, however, since it's not set in stone, the API
        endpoints around git configs have been structured in a way that
        can accommodate the change later or moving the endpoints in
        their own namespace. This also implies that getting the list of
        git configs for the user will always result in a list of 0 or 1
        item.

        The values of "name" and "email" are not checked aside for them
        being strings, to behave closely to "git config".
        """
        data = request.get_json()
        if not isinstance(data.get("name"), str):
            return {"message": "Name is not a string."}, 400
        if not isinstance(data.get("email"), str):
            return {"message": "Email is not a string."}, 400

        models.AuthUser.query.get_or_404(
            auth_user_uuid, description=f"No user {auth_user_uuid}."
        )

        try:
            git_config = models.GitConfig(
                uuid=str(uuid.uuid4()),
                auth_user_uuid=auth_user_uuid,
                name=data["name"],
                email=data["email"],
            )
            db.session.add(git_config)
            db.session.commit()
        except sqlalchemy.exc.IntegrityError as e:
            if "unique constraint" not in str(e.orig):
                raise
            else:
                return {"message": "Git config already exists for this user."}, 409

        return git_config, 201


@api.route("/<string:auth_user_uuid>/git-configs/<string:git_config_uuid>")
class GitConfig(Resource):
    @api.marshal_with(schema.git_config, code=200)
    def get(self, auth_user_uuid: str, git_config_uuid: str):
        models.AuthUser.query.get_or_404(
            auth_user_uuid, description=f"No user {auth_user_uuid}."
        )
        return (
            models.GitConfig.query.get_or_404(
                git_config_uuid, description=f"No git config {git_config_uuid}."
            ),
            200,
        )

    @api.expect(schema.git_config_request)
    def put(self, auth_user_uuid: str, git_config_uuid: str):
        """Modifies a git config.

        The values of "name" and "email" are not checked aside for them
        being strings, to behave closely to "git config".
        """
        data = request.get_json()
        if not isinstance(data.get("name"), str):
            return {"message": "Name is not a string."}, 400
        if not isinstance(data.get("email"), str):
            return {"message": "Email is not a string."}, 400

        models.AuthUser.query.get_or_404(
            auth_user_uuid, description=f"No user {auth_user_uuid}."
        )
        git_config = models.GitConfig.query.get_or_404(
            git_config_uuid, description=f"No git config {git_config_uuid}."
        )
        if data["name"] is not None:
            git_config.name = data["name"]
        if data["email"] is not None:
            git_config.email = data["email"]
        db.session.commit()
        return {}, 200

    def delete(self, auth_user_uuid: str, git_config_uuid: str):
        models.AuthUser.query.get_or_404(
            auth_user_uuid, description=f"No user {auth_user_uuid}."
        )
        models.GitConfig.query.filter(models.GitConfig.uuid == git_config_uuid).delete()
        db.session.commit()
        return {}, 200
