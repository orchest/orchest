from __future__ import annotations

import datetime
import os
import secrets
import uuid
from typing import Dict, List, Literal, Tuple, Union

import requests
from flask import (
    Flask,
    Request,
    Response,
    jsonify,
    redirect,
    request,
    send_from_directory,
)
from werkzeug.security import check_password_hash, generate_password_hash

from app.connections import db
from app.models import Token, User
from app.utils import PathType, _AuthCacheDictionary, get_auth_cache, set_auth_cache

# This auth_cache is shared between requests
# within the same Flask process
_auth_cache: _AuthCacheDictionary = {}
_auth_cache_age: int = 3  # in seconds


def register_views(app: Flask) -> None:
    @app.after_request
    def add_header(r: Response) -> Response:
        """
        Disable cache for all auth server requests
        """
        r.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        r.headers["Pragma"] = "no-cache"
        r.headers["Expires"] = "0"
        r.headers["Cache-Control"] = "public, max-age=0"
        return r

    # NOTE! This is an unprotected route for config for client
    # side initialization.
    @app.route("/login/server-config", methods=["GET"])
    def server_config() -> Response:
        return jsonify(
            {
                "CLOUD": app.config.get("CLOUD"),
                "CLOUD_URL": app.config.get("CLOUD_URL"),
                "GITHUB_URL": app.config.get("GITHUB_URL"),
                "DOCUMENTATION_URL": app.config.get("DOCUMENTATION_URL"),
                "VIDEOS_URL": app.config.get("VIDEOS_URL"),
            }
        )

    def is_authenticated(request: Request) -> bool:
        # If authentication is not enabled then the request is always
        # authenticated (by definition).
        if not app.config["AUTH_ENABLED"]:
            return True

        cookie_token = request.cookies.get("auth_token")
        username = request.cookies.get("auth_username")

        token_creation_limit = datetime.datetime.utcnow() - datetime.timedelta(
            hours=app.config["TOKEN_DURATION_HOURS"]
        )
        return db.session.query(
            db.session.query(Token)
            .join(User)
            .filter(
                Token.token == cookie_token,
                User.username == username,
                Token.created > token_creation_limit,
            )
            .exists()
        ).scalar()

    def serve_static_or_dev(path: PathType) -> Response:
        file_path = os.path.join(app.config["STATIC_DIR"], path)
        if os.path.isfile(file_path):
            return send_from_directory(app.config["STATIC_DIR"], path)
        else:
            return send_from_directory(app.config["STATIC_DIR"], "index.html")

    # static file serving
    @app.route("/login", defaults={"path": ""}, methods=["GET"])
    @app.route("/login/<path:path>", methods=["GET"])
    def login_static(path: PathType) -> Response:

        # Automatically redirect to root if request is authenticated
        if is_authenticated(request) and path == "":
            return handle_login(redirect_type="server")

        return serve_static_or_dev(path)

    @app.route("/login/admin", methods=["GET"])
    def login_admin() -> Tuple[str, int] | Response:

        if not is_authenticated(request):
            return "", 401

        return serve_static_or_dev("/admin")

    @app.route("/auth", methods=["GET"])
    def index() -> Tuple[Literal[""], Literal[200]] | Tuple[Literal[""], Literal[401]]:
        # validate authentication through token
        if is_authenticated(request):
            return "", 200
        else:
            return "", 401

    @app.route("/login/clear", methods=["GET"])
    def logout() -> Response | None:
        resp = redirect_response("/")
        resp.set_cookie("auth_token", "", samesite="Lax")
        resp.set_cookie("auth_username", samesite="Lax")
        return resp

    def redirect_response(url: str, redirect_type: str = "server") -> Response:
        if redirect_type == "client":
            return jsonify({"redirect": url})
        elif redirect_type == "server":
            return redirect(url)

    @app.route("/login/submit", methods=["POST"])
    def login() -> Response | Tuple[Response, Literal[401]] | None:
        return handle_login()

    @app.route("/login", methods=["POST"])
    def login_post() -> Response | Tuple[Response, Literal[401]] | None:
        return handle_login(redirect_type="server")

    def handle_login(
        redirect_type: str = "client",
    ) -> Response | Tuple[Response, Literal[401]] | None:

        # Returns a shallow mutable copy of the immutable
        # multi dict.
        request_args = request.args.copy()
        redirect_url = request_args.pop("redirect_url", "/")
        query_args = "&".join(
            [arg + "=" + value for arg, value in request_args.items()]
        )
        if query_args:
            redirect_url += "?" + query_args

        if is_authenticated(request):
            return redirect_response(redirect_url, redirect_type)

        if request.method == "POST":
            token_creation_limit = datetime.datetime.utcnow() - datetime.timedelta(
                hours=app.config["TOKEN_DURATION_HOURS"]
            )
            # Remove outdated tokens.
            Token.query.filter(Token.created < token_creation_limit).delete()

            username = request.form.get("username")
            password = request.form.get("password")
            token = request.form.get("token")

            # Check whether the given user exists.
            user = User.query.filter(User.username == username).first()

            invalid_login_msg = "Username password combination does not exist."
            if user is None:
                return jsonify({"error": invalid_login_msg}), 401
            else:
                if password is not None:
                    can_login = check_password_hash(user.password_hash, password)
                elif token is not None and user.token_hash is not None:
                    can_login = check_password_hash(user.token_hash, token)
                else:
                    can_login = False

                if can_login:

                    token = Token(user=user.uuid, token=str(secrets.token_hex(16)))

                    db.session.add(token)
                    db.session.commit()

                    resp = redirect_response(redirect_url, redirect_type)
                    # samesite="Lax" to avoid CSRF attacks.
                    resp.set_cookie("auth_token", token.token, samesite="Lax")
                    resp.set_cookie("auth_username", username, samesite="Lax")

                    return resp

                else:
                    return jsonify({"error": invalid_login_msg}), 401

    @app.route("/login/users", methods=["DELETE"])
    def delete_user() -> Union[
        Tuple[Literal[""], Literal[401]],
        Tuple[Response, Literal[500]],
        Tuple[Response, Literal[405]],
        Literal[""],
    ]:
        if not is_authenticated(request):
            return "", 401

        self_username = request.cookies.get("auth_username")
        if "username" in request.form:
            to_delete_username = request.form.get("username")

            user = User.query.filter(User.username == to_delete_username).first()
            if user is not None:
                if user.is_admin:
                    return jsonify({"error": "Admins cannot be deleted."}), 500
                elif self_username == to_delete_username:
                    return jsonify({"error": "Deleting own user is not allowed."}), 405
                else:
                    db.session.delete(user)
                    db.session.commit()
                    return ""
            else:
                return jsonify({"error": "User does not exist."}), 500
        else:
            return jsonify({"error": "No username supplied."}), 500

    @app.route("/login/users", methods=["POST"])
    def add_user() -> Union[
        Tuple[Literal[""], Literal[401]],
        Tuple[Response, Literal[409]],
        Tuple[Response, Literal[400]],
        Literal[""],
    ]:
        if not is_authenticated(request):
            return "", 401

        if "username" in request.form:

            username = request.form.get("username")
            password = request.form.get("password")

            if username == app.config.get("ORCHEST_CLOUD_RESERVED_USER"):
                return jsonify({"error": "User is reserved."}), 409

            if len(password) == 0:
                return jsonify({"error": "Password cannot be empty."}), 400

            user = User.query.filter(User.username == username).first()
            if user is not None:
                return jsonify({"error": "User already exists."}), 409

            user = User(
                username=username,
                password_hash=generate_password_hash(password),
                uuid=str(uuid.uuid4()),
            )

            db.session.add(user)
            db.session.commit()
            return ""
        else:
            return jsonify({"error": "No username supplied."}), 400

    @app.route("/login/users", methods=["GET"])
    def get_users() -> Tuple[Literal[""], Literal[401]] | Tuple[Response, Literal[200]]:
        if not is_authenticated(request):
            return "", 401

        data_json: Dict[
            Literal["users"],
            List[Dict[Literal["username"], str]],
        ] = {"users": []}
        users = User.query.all()
        for user in users:
            if user.username != app.config.get("ORCHEST_CLOUD_RESERVED_USER"):
                data_json["users"].append({"username": user.username})

        return jsonify(data_json), 200

    @app.route("/auth/service", methods=["GET"])
    def auth_service() -> Union[
        Tuple[Literal[""], Literal[200]],
        Tuple[Literal[""], Literal[401]],
    ]:
        global _auth_cache, _auth_cache_age

        # Bypass definition based authentication if the request
        # is authenticated
        if is_authenticated(request):
            return "", 200

        # request URI
        original_uri = request.headers.get("X-Original-URI")

        if original_uri is None:
            return "", 401

        try:
            # expected uri:
            # /pbp-service-[service-name]-
            # [pipeline_uuid_prefix]-[session_uuid_prefix]_[port]/...
            components = original_uri.split("/")[1].split("_")[-2].split("-")
            session_uuid_prefix = components[-1]
            project_uuid_prefix = components[-2]
        except Exception:
            app.logger.error("Failed to parse X-Original-URI: %s" % original_uri)
            return "", 401

        auth_check = get_auth_cache(
            project_uuid_prefix, session_uuid_prefix, _auth_cache, _auth_cache_age
        )
        if auth_check["status"] == "available":
            if auth_check["requires_authentication"] is False:
                return "", 200
            else:
                return "", 401
        else:
            # No cache available, fetch from orchest-api
            base_url = "http://%s/api/services/" % (app.config["ORCHEST_API_ADDRESS"])
            service_url = "%s?project_uuid_prefix=%s&session_uuid_prefix=%s" % (
                base_url,
                project_uuid_prefix,
                session_uuid_prefix,
            )

            try:
                r = requests.get(service_url)
                services = r.json().get("services", [])

                # No service is found for given filter
                if len(services) == 0:
                    raise Exception("No services found")

                if len(services) > 1:
                    raise Exception(
                        "Filtered /api/services endpoint "
                        "should always return a single service"
                    )

                # Always check first service that is returned,
                # should be unique
                if services[0]["service"]["requires_authentication"] is False:
                    set_auth_cache(
                        project_uuid_prefix, session_uuid_prefix, False, _auth_cache
                    )
                    return "", 200
                else:
                    set_auth_cache(
                        project_uuid_prefix, session_uuid_prefix, True, _auth_cache
                    )
                    raise Exception("'requires_authentication' is not set to False")

            except Exception as e:
                app.logger.error(e)
                return "", 401
