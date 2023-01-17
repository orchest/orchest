"""API endpoints to track references to auth-users and related data."""

import base64
import uuid

import sqlalchemy
from flask import request
from flask_restx import Namespace, Resource
from kubernetes import client

from _orchest.internals import config as _config
from app import models, schema, utils
from app.connections import db, k8s_core_api

api = Namespace(
    "auth-users", description="Manage references to auth-users and related data."
)
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
        for ssh_key in models.SSHKey.query.filter(
            models.SSHKey.auth_user_uuid == auth_user_uuid
        ).all():
            _delete_ssh_key(ssh_key.uuid)
        models.AuthUser.query.filter(models.AuthUser.uuid == auth_user_uuid).delete()
        db.session.commit()
        return {}, 200


@api.route("/<string:auth_user_uuid>/git-configs")
class GitConfigList(Resource):
    @api.marshal_with(schema.git_configs, code=200)
    def get(self, auth_user_uuid: str):
        utils.upsert_auth_user_uuid(auth_user_uuid)

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
        utils.upsert_auth_user_uuid(auth_user_uuid)
        data = request.get_json()
        if not isinstance(data.get("name"), str):
            return {"message": "Name is not a string."}, 400
        if not isinstance(data.get("email"), str):
            return {"message": "Email is not a string."}, 400

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
        utils.upsert_auth_user_uuid(auth_user_uuid)
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
        utils.upsert_auth_user_uuid(auth_user_uuid)
        data = request.get_json()
        if data is None:
            return {"message": "Invalid git config"}, 400

        name = data.get("name")
        email = data.get("email")

        if not isinstance(name, str):
            return {"message": "Name is not a string."}, 400
        if not isinstance(email, str):
            return {"message": "Email is not a string."}, 400

        git_config = models.GitConfig.query.get_or_404(
            git_config_uuid, description=f"No git config {git_config_uuid}."
        )
        git_config.name = name
        git_config.email = email
        db.session.commit()
        return {
            "uuid": git_config_uuid,
            "name": name,
            "email": email,
        }, 200

    def delete(self, auth_user_uuid: str, git_config_uuid: str):
        models.AuthUser.query.get_or_404(
            auth_user_uuid, description=f"No user {auth_user_uuid}."
        )
        models.GitConfig.query.filter(models.GitConfig.uuid == git_config_uuid).delete()
        db.session.commit()
        return {}, 200


@api.route("/<string:auth_user_uuid>/ssh-keys")
class SSHKeyList(Resource):
    @api.marshal_with(schema.ssh_keys, code=200)
    def get(self, auth_user_uuid: str):
        utils.upsert_auth_user_uuid(auth_user_uuid)

        ssh_keys = models.SSHKey.query.filter(
            models.SSHKey.auth_user_uuid == auth_user_uuid
        ).all()
        return {"ssh_keys": ssh_keys}, 200

    @api.expect(schema.ssh_key_request)
    @api.marshal_with(schema.ssh_key, code=201)
    def post(self, auth_user_uuid: str):
        utils.upsert_auth_user_uuid(auth_user_uuid)
        """Allows to set a new SSHKey for a user.

        Note: the "name" and "key" fields are only verified to be of
        the string type, no other check is currently done.
        """
        data = request.get_json()
        if not isinstance(data.get("name"), str):
            return {"message": "Name is not a string."}, 400
        if not isinstance(data.get("key"), str):
            return {"message": "Key is not a string."}, 400

        ssh_key = models.SSHKey(
            uuid=str(uuid.uuid4()),
            auth_user_uuid=auth_user_uuid,
            name=data["name"],
        )
        db.session.add(ssh_key)
        db.session.commit()
        # Do it after committing so if anything fails there is still a
        # reference in the DB against which a DELETE can be called.
        _create_ssh_secret(f"ssh-key-{ssh_key.uuid}", f'{data["key"].strip()}\n')

        return ssh_key, 201


@api.route("/<string:auth_user_uuid>/ssh-keys/<string:ssh_key_uuid>")
class SSHKey(Resource):
    def delete(self, auth_user_uuid: str, ssh_key_uuid: str):
        utils.upsert_auth_user_uuid(auth_user_uuid)
        _delete_ssh_key(ssh_key_uuid)
        db.session.commit()
        return {}, 200


def _create_ssh_secret(name: str, secret: str) -> None:
    secret_b64 = base64.b64encode(secret.encode()).decode()
    manifest = {
        "apiVersion": "v1",
        "kind": "Secret",
        "metadata": {"name": name},
        "type": "kubernetes.io/ssh-auth",
        "data": {"ssh-privatekey": secret_b64},
    }
    k8s_core_api.create_namespaced_secret(
        namespace=_config.ORCHEST_NAMESPACE, body=manifest
    )


def _delete_ssh_key(ssh_key_uuid: str) -> None:
    # Delete from k8s before committing so that the secret removal must
    # have succeeded for the reference from the db to be deleted.
    _delete_secret_from_k8s(f"ssh-key-{ssh_key_uuid}")
    models.SSHKey.query.filter(models.SSHKey.uuid == ssh_key_uuid).delete()


def _delete_secret_from_k8s(name: str) -> None:
    try:
        k8s_core_api.delete_namespaced_secret(
            namespace=_config.ORCHEST_NAMESPACE, name=name
        )
    except client.rest.ApiException as e:
        if e.status != 404:
            raise e
