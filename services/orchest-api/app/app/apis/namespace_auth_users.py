"""API endpoints to track references to auth-users."""

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
