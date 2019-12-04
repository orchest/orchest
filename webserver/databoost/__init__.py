from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__, instance_relative_config=True)

app.config.from_object('config')
app.config.from_pyfile('config.py')


db = SQLAlchemy(app)


class Pipeline(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=False, nullable=False)

    def __repr__(self):
        return "<Pipeline %r>" % self.name


# static file serving
@app.route('/static/<path:path>')
def send_js(path):
    return send_from_directory('static', path)


from databoost.views import index
