from flask_socketio import SocketIO

from app import create_app
from config import Config


app = create_app(config_class=Config)

# Use SocketIO to be able to start Jupyter server in a subprocess.
socketio = SocketIO(app)


if __name__ == '__main__':
    socketio.run(app)
