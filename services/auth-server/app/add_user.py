import argparse
import uuid

from werkzeug.security import generate_password_hash

from app import create_app
from app.connections import db
from app.models import User
from config import CONFIG_CLASS

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Add a user to Orchest.")
    parser.add_argument(
        "username",
        nargs=1,
    )
    parser.add_argument(
        "password",
        nargs=1,
    )
    parser.add_argument("-t", "--token", required=False, default=None)
    parser.add_argument(
        "--is_admin", required=False, default=False, action="store_true"
    )

    args = parser.parse_args()

    app = create_app(config_class=CONFIG_CLASS)

    username = args.username[0]
    password = args.password[0]
    token = args.token

    with app.app_context():
        user = User.query.filter(User.username == username).first()
        if user is not None:
            print("A user with this name already exists.")
            exit(1)
        if password == "":
            print("Password cannot be empty.")
            exit(1)

        user = User(
            uuid=str(uuid.uuid4()),
            username=username,
            password_hash=generate_password_hash(password),
            is_admin=args.is_admin,
        )

        if token is not None:
            if token == "":
                print("Token cannot be empty.")
                exit(1)
            else:
                user.token_hash = (generate_password_hash(token),)

        db.session.add(user)
        db.session.commit()
