from docker.client import DockerClient
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import MetaData

from _orchest.internals import config as _config

# TODO: we should check whether it is possible for the docker client to
#       expire. Since users could have their pipeline running for several
#       hours.
# TODO: what happens to the connections when the app closes? Do they get
#       closed? Do we need to include something like a graceful shutdown?

# this will make it so that constraints and indexes follow a certain
# naming pattern
metadata = MetaData(naming_convention=_config.database_naming_convention)
db = SQLAlchemy(metadata=metadata)

# Manage docker containers.
docker_client = DockerClient.from_env()
