from docker.client import DockerClient
from flask_sqlalchemy import SQLAlchemy


# Stores running recourses information.
db = SQLAlchemy()

# Manage docker containers.
docker_client = DockerClient.from_env()
