from flask import Flask, send_from_directory

app = Flask(__name__)


# static file serving
@app.route('/static/<path:path>')
def send_js(path):
    return send_from_directory('static', path)


from databoost.views import index
