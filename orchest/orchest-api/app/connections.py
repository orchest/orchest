from docker.client import DockerClient
from flask_sqlalchemy import SQLAlchemy


# TODO: we should check whether it is possible for the docker client to
#       expire. Since users could have their pipeline running for several
#       hours.
# TODO: what happens to the connections when the app closes? Do they get
#       closed? Do we need to include something like a graceful shutdown?

# Stores running recourses information.
db = SQLAlchemy()

# Manage docker containers.
docker_client = DockerClient.from_env()
