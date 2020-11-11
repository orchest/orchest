import datetime

from app.connections import db


class User(db.Model):

    __tablename__ = "users"

    uuid = db.Column(
        db.String(36),
        primary_key=True,
    )

    username = db.Column(
        db.String(255),
        primary_key=True,
    )

    password_hash = db.Column(
        db.String(255),
        primary_key=True,
    )

    created = db.Column(
        db.DateTime, unique=False, nullable=False, default=datetime.datetime.utcnow
    )


class Token(db.Model):

    __tablename__ = "tokens"

    token = db.Column(db.String(255))

    user = db.Column(db.String(36), db.ForeignKey("users.uuid"), primary_key=True)

    created = db.Column(
        db.DateTime, unique=False, nullable=False, default=datetime.datetime.utcnow
    )
