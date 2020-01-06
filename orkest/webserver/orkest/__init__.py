from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__, instance_relative_config=True)

app.config.from_pyfile('config.py')

db = SQLAlchemy(app)


# static file serving
@app.route('/static/<path:path>')
def send_js(path):
    return send_from_directory('static', path)



from orkest.views import index