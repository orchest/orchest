import datetime
import os
import secrets
import uuid

from flask import jsonify, redirect, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash

from _orchest.internals.utils import _proxy
from app.connections import db
from app.models import Token, User
from app.utils import get_user_conf


def register_views(app):

    # NOTE! This is an unprotected route for config for client
    # side initialization.
    @app.route("/login/server-config", methods=["GET"])
    def server_config():
        return jsonify(
            {
                "CLOUD": app.config.get("CLOUD"),
                "CLOUD_URL": app.config.get("CLOUD_URL"),
            }
        )

    # static file serving
    @app.route("/login", defaults={"path": ""}, methods=["GET"])
    @app.route("/login/<path:path>", methods=["GET"])
    def login_static(path):
        # in Debug mode proxy to CLIENT_DEV_SERVER_URL
        if os.environ.get("FLASK_ENV") == "development":
            # Dev mode requires trailing slash
            if path == "" and not request.url.endswith("/"):
                request.url = request.url + "/"

            return _proxy(request, app.config["CLIENT_DEV_SERVER_URL"] + "/")
        else:
            file_path = os.path.join(app.config["STATIC_DIR"], path)
            if os.path.isfile(file_path):
                return send_from_directory(app.config["STATIC_DIR"], path)
            else:
                return send_from_directory(app.config["STATIC_DIR"], "index.html")

    def is_authenticated(request):

        # if auth_enabled request is always authenticated
        config_data = get_user_conf()
        if not config_data["AUTH_ENABLED"]:
            return True

        cookie_token = request.cookies.get("auth_token")
        username = request.cookies.get("auth_username")

        user = User.query.filter(User.username == username).first()

        if user is None:
            return False

        token = (
            Token.query.filter(Token.token == cookie_token)
            .filter(Token.user == user.uuid)
            .first()
        )

        if token is None:
            return False
        else:

            token_creation_limit = datetime.datetime.utcnow() - datetime.timedelta(
                days=app.config["TOKEN_DURATION_HOURS"]
            )

            if token.created > token_creation_limit:
                return True
            else:
                return False

    @app.route("/auth", methods=["GET"])
    def index():
        # validate authentication through token
        if is_authenticated(request):
            return "", 200
        else:
            return "", 401

    @app.route("/login/clear", methods=["GET"])
    def logout():
        resp = redirect_response("/")
        resp.set_cookie("auth_token", "")
        resp.set_cookie("auth_username", "")
        return resp

    def redirect_response(url, redirect_type="server"):
        if redirect_type == "client":
            return jsonify({"redirect": url})
        elif redirect_type == "server":
            return redirect(url)

    @app.route("/login/submit", methods=["POST"])
    def login():
        return handle_login()

    @app.route("/login", methods=["POST"])
    def login_post():
        return handle_login(redirect_type="server")

    def handle_login(redirect_type="client"):

        config_data = get_user_conf()

        if not config_data["AUTH_ENABLED"]:
            return redirect_response("/", redirect_type)

        if request.method == "POST":

            username = request.form.get("username")
            password = request.form.get("password")
            token = request.form.get("token")

            user = User.query.filter(User.username == username).first()

            if user is None:
                return jsonify({"error": "User does not exist."}), 401
            else:
                if password is not None:
                    can_login = check_password_hash(user.password_hash, password)
                elif token is not None and user.token_hash is not None:
                    can_login = check_password_hash(user.token_hash, token)
                else:
                    can_login = False

                if can_login:

                    # remove old token if it exists
                    Token.query.filter(Token.user == user.uuid).delete()

                    token = Token(user=user.uuid, token=str(secrets.token_hex(16)))

                    db.session.add(token)
                    db.session.commit()

                    # Returns a shallow mutable copy of the immutable
                    # multi dict.
                    request_args = request.args.copy()
                    redirect_url = request_args.pop("redirect_url", "/")
                    query_args = "&".join(
                        [arg + "=" + value for arg, value in request_args.items()]
                    )
                    if query_args:
                        redirect_url += "?" + query_args

                    resp = redirect_response(redirect_url, redirect_type)
                    resp.set_cookie("auth_token", token.token)
                    resp.set_cookie("auth_username", username)

                    return resp

                else:
                    return jsonify({"error": "Invalid credentials."}), 401

    @app.route("/login/users", methods=["DELETE"])
    def delete_user():
        if not is_authenticated(request):
            return "", 401

        if "username" in request.form:
            username = request.form.get("username")

            user = User.query.filter(User.username == username).first()
            if user is not None:
                if user.is_admin:
                    return jsonify({"error": "Admins cannot be deleted."}), 500
                else:
                    db.session.delete(user)
                    db.session.commit()
                    return ""
            else:
                return jsonify({"error": "User does not exist."}), 500
        else:
            return jsonify({"error": "No username supplied."}), 500

    @app.route("/login/users", methods=["POST"])
    def add_user():
        if not is_authenticated(request):
            return "", 401

        if "username" in request.form:

            username = request.form.get("username")
            password = request.form.get("password")

            user = User.query.filter(User.username == username).first()
            if user is not None:
                return jsonify({"error": "User already exists."}), 409
            elif len(password) == 0:
                return jsonify({"error": "Password cannot be empty."}), 500
            else:
                user = User(
                    username=username,
                    password_hash=generate_password_hash(password),
                    uuid=str(uuid.uuid4()),
                )

                db.session.add(user)
                db.session.commit()

                return ""
        else:
            return jsonify({"error": "No username supplied."}), 500

    @app.route("/login/users", methods=["GET"])
    def get_users():
        if not is_authenticated(request):
            return "", 401

        data_json = {"users": []}
        users = User.query.all()
        for user in users:
            data_json["users"].append({"username": user.username})

        return jsonify(data_json), 200
