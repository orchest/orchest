import random
import uuid
import secrets
import datetime
import os
import json

from flask import request, make_response, send_from_directory, render_template, redirect
from app.connections import db
from app.models import User, Token
from werkzeug.security import generate_password_hash, check_password_hash
from app.utils import get_hash, get_user_conf


def register_views(app):

    def static_render_context():
        js_bundle_path = os.path.join(
                app.config["STATIC_DIR"], "js", "dist", "main.bundle.js")
        css_bundle_path = os.path.join(
            app.config["STATIC_DIR"], "css", "main.css")

        context = {
            "javascript_bundle_hash": get_hash(js_bundle_path),
            "css_bundle_hash": get_hash(css_bundle_path),
        }

        return context

    # static file serving
    @app.route('/login/static/<path:path>')
    def send_files(path):
        return send_from_directory(app.config["STATIC_DIR"], path)


    def is_authenticated(request):
        cookie_token = request.cookies.get('auth_token')
        username = request.cookies.get('auth_username')

        user = User.query.filter(User.username==username).first()

        if user is None:
            return False

        token = Token.query. \
                filter(Token.token==cookie_token). \
                filter(Token.user==user.uuid).first()
        
        if token is None:
            return False
        else:

            token_creation_limit = datetime.datetime.utcnow() - \
                datetime.timedelta(days=app.config['TOKEN_DURATION_HOURS'])

            if token.created > token_creation_limit:
                return True
            else:
                return False
    

    @app.route("/auth", methods=["GET"])
    def index():

        config_data = get_user_conf()

        if not config_data['AUTH_ENABLED']:
            return '', 200
        else:
            # validate authentication through token
            if is_authenticated(request):
                return '', 200
            else:
                return '', 401


    @app.route("/login/clear", methods=["GET"])
    def logout():
        resp = make_response(render_template("client_side_redirect.html", url="/"))
        resp.set_cookie("auth_token", '')
        resp.set_cookie("auth_username", '')
        return resp


    @app.route("/login", methods=["GET", "POST"])
    def login():

        config_data = get_user_conf()

        if not config_data['AUTH_ENABLED']:
            return make_response(render_template("client_side_redirect.html", url="/"))

        if request.method == "POST":

            username = request.form.get('username')
            password = request.form.get('password')

            user = User.query.filter(User.username==username).first()

            if user is None:
                return '', 401
            else:
                if check_password_hash(user.password_hash, password):

                    # remove old token if it exists
                    Token.query.filter(Token.user==user.uuid).delete()

                    token = Token(
                        user=user.uuid,
                        token=str(secrets.token_hex(16))
                    )

                    db.session.add(token)
                    db.session.commit()

                    resp = make_response(render_template("client_side_redirect.html", url="/"))
                    resp.set_cookie("auth_token", token.token)
                    resp.set_cookie("auth_username", username)

                    return resp
                else:
                    return '', 401

        else:
            
            context = static_render_context()
            return render_template("login.html", **context)


    @app.route("/login/admin", methods=["GET","POST"])
    def admin():

        config_data = get_user_conf()

        if not is_authenticated(request) and config_data['AUTH_ENABLED']:
            return '', 401

        if request.method == "POST":

            if "username" in request.form:

                username = request.form.get('username')
                password = request.form.get('password')

                user = User.query.filter(User.username==username).first()

                if user is not None:
                    return '', 409

                user = User(
                    username=username,
                    password_hash=generate_password_hash(password),
                    uuid=str(uuid.uuid4())
                )

                db.session.add(user)
                db.session.commit()

            elif "delete_username" in request.form:
                username = request.form.get('delete_username')

                user = User.query.filter(User.username==username).first()

                if user is not None:
                    db.session.delete(user)
                    db.session.commit()

        context = static_render_context()

        data_json = {"users": []}

        users = User.query.all()

        for user in users:
            data_json["users"].append({"username": user.username})

        context["data_json"] = json.dumps(data_json)

        return render_template("admin.html", **context)
