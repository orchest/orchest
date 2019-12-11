from flask import Flask
from flask_socketio import SocketIO

from apis import blueprint as api
from settings import app_config


app = Flask(__name__)
app.config.update(app_config)
app.register_blueprint(api, url_prefix='/api')

# Use SocketIO to be able to start jupyter server in a subprocess.
socketio = SocketIO(app)


if __name__ == '__main__':
    socketio.run(app)
