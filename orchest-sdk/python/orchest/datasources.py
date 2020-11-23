import os
from typing import Optional
import warnings

from requests.exceptions import HTTPError
from sqlalchemy import create_engine
import boto3
import requests

from orchest.config import Config
from orchest.errors import OrchestNetworkError, OrchestInternalDataSourceError


class _DB:
    """Database datasource.

    Args:
        data: Data containing `connection_details` to format the
            `connection_string` (see `Attributes` section).
        **kwargs: Passed to the ``sqlalchemy.create_engine`` method.

    Attributes:
        connection_string (str): Format for the connection string.
            SQLAlchemy calls this the URL (that indicates database
            dialect). It is passed to ``sqlalchemy.create_engine`` as
            the first positional argument.
        engine (sqlalchemy.engine.Engine): Underlying engine instance
            to connect to the database.

    """

    connection_string: Optional[str] = None

    # Settings that are passed to `create_engine` in __init__.
    _connection_timeout = 5

    def __init__(self, data, **kwargs):
        connection_details = data["connection_details"]

        self._connection_string = self.connection_string.format(
            username=connection_details["username"],
            password=connection_details["password"],
            host=connection_details["host"],
            db_name=connection_details["database_name"],
        )

        self.engine = create_engine(
            self._connection_string,
            connect_args={"connect_timeout": self._connection_timeout},
            **kwargs,
        )

    def connect(self, **kwargs):
        """Returns a new ``sqlalchemy.engine.Connection`` object.

        Directly wraps ``sqlalchemy.engine.Engine.connect``.

        For transactions, look into ``Connection.begin()`` and
        ``Engine.begin()`` in the SQLAlchemy docs.

        Examples:
            In the example below ``DB`` should be substituted with the
            name of this class.

            >>> db = DB(data)
            >>> with db.connect() as conn:
            ...     result = conn.execute('SELECT * FROM users')

            Alternatively.

            >>> conn = db.connect()

        """
        return self.engine.connect(**kwargs)


class MySQL(_DB):
    """MySQL database datasource.

    Args:
        data: Data containing `connection_details` to format the
            `connection_string` (see `Attributes` section).
        **kwargs: Passed to the ``sqlalchemy.create_engine`` method.

    Attributes:
        connection_string (str): Format for the connection string.
            SQLAlchemy calls this the URL (that indicates database
            dialect). It is passed to ``sqlalchemy.create_engine`` as
            the first positional argument.
        engine (sqlalchemy.engine.Engine): Underlying engine instance
            to connect to the database.

    """

    connection_string = "mysql://{username}:{password}@{host}/{db_name}"


class PostgreSQL(_DB):
    """PostgreSQL database datasource.

    Args:
        data: Data containing `connection_details` to format the
            `connection_string` (see `Attributes` section).
        **kwargs: Passed to the ``sqlalchemy.create_engine`` method.

    Attributes:
        connection_string (str): Format for the connection string.
            SQLAlchemy calls this the URL (that indicates database
            dialect). It is passed to ``sqlalchemy.create_engine`` as
            the first positional argument.
        engine (sqlalchemy.engine.Engine): Underlying engine instance
            to connect to the database.

    """

    connection_string = "postgresql://{username}:{password}@{host}/{db_name}"


class AWSRedshift(_DB):
    """AWSRedshift database datasource.

    Args:
        data: Data containing `connection_details` to format the
            `connection_string` (see `Attributes` section).
        **kwargs: Passed to the ``sqlalchemy.create_engine`` method.

    Attributes:
        connection_string (str): Format for the connection string.
            SQLAlchemy calls this the URL (that indicates database
            dialect). It is passed to ``sqlalchemy.create_engine`` as
            the first positional argument.
        engine (sqlalchemy.engine.Engine): Underlying engine instance
            to connect to the database.

    """

    connection_string = "redshift+psycopg2://{username}:{password}@{host}/{db_name}"


class HostDirectory:
    """Host directory data source.

    A path from the host that is mounted onto a specific path so it can
    be accessed from within the pipeline steps.

    Args:
        data: Connection information to use the data source. Example::

            {
                'name': '<datasource-name>',
                'connection_details': {
                    'absolute_host_path': '<path>'
                },
                'source_type': 'host-directory'
            }

    Attributes:
        path (str): Path at which the host directory data source is
            mounted.

    Example:
        List files inside the mounted datasource.

        >>> datasource = HostDirectory(data)
        >>> os.listdir(datasource.path)
        ['image-1.png', 'file-1.txt']

    """

    def __init__(self, data):
        self._path = "/mounts/" + data["name"]

    @property
    def path(self):
        if not os.listdir(self._path):
            msg = (
                "This directory appears to be empty, are you sure you have not"
                " mistyped the absolute host directory path when creating this"
                " data source? If so, please ignore this warning."
            )
            warnings.warn(msg, category=UserWarning)

        return self._path


# TODO: could extend this class. Could create multiple classes that
#       manage AWS resources. Can all be done via `boto3`
class AWSObjectStorageS3:
    """Amazon S3 Storage Service datasource.

    Args:
        data: Data containing `connection_details` to format the
            `connection_string` (see `Attributes` section).

    Attributes:
        s3: An "s3" resource service client.
            `boto3.resource docs
            <https://boto3.amazonaws.com/v1/documentation/api/latest/reference/core/session.html#boto3.session.Session.resource>`_.
        client: A low-level client representing Amazon Simple Storage
            Service (S3).
            `boto3.client docs
            <https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/s3.html#client>`_.
        bucket: A resource representing an Amazon Simple Storage Service
            (S3) Bucket.
            `s3.bucket docs
            <https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/s3.html#bucket>`_.

    Example:
        Print all the objects inside a bucket on S3.

        >>> object_storage = AWSObjectStorageS3(data)
        >>> for obj in object_storage.bucket.objects.all():
        ...     print(obj)
        s3.ObjectSummary(bucket_name='orchest-s3', key='some-key')

    """

    def __init__(self, data):
        self.s3 = boto3.resource(
            "s3",
            aws_access_key_id=data["connection_details"]["access_key"],
            aws_secret_access_key=data["connection_details"]["secret_key"],
        )

        self.client = boto3.client(
            "s3",
            aws_access_key_id=data["connection_details"]["access_key"],
            aws_secret_access_key=data["connection_details"]["secret_key"],
        )

        self.bucket = self.s3.Bucket(data["connection_details"]["bucket"])


# TODO: put the name as attribute in the class.
# TODO: set a return type, maybe use Union[..., ...]
def get_datasource(name: str):
    """Gets a datasource by name.

    The name coincides with the datasource name as defined in the UI on
    the Orchest platform.

    Args:
        name: The name of the datasource.

    Returns:
        A datasource object.

    """

    if name in Config.INTERNAL_DATASOURCES:
        raise OrchestInternalDataSourceError(
            f"Cannot request internal data source {name}."
        )

    try:
        # TODO: A user should only EVER be able to get credentials to
        # his/her own configured datasources. Even then it is debetable,
        # since someone could just copy paste this requests line and
        # request whatever.
        response = requests.get("http://orchest-webserver/store/datasources/%s" % name)
        response.raise_for_status()

    except HTTPError as http_err:
        raise OrchestNetworkError(
            f"Could not get the datasource from the webserver: {http_err}"
        )

    datasources = {
        "host-directory": HostDirectory,
        "database-mysql": MySQL,
        "database-postgresql": PostgreSQL,
        "database-aws-redshift": AWSRedshift,
        "objectstorage-aws-s3": AWSObjectStorageS3,
    }

    datasource_spec = response.json()
    source_type = datasource_spec["source_type"]
    datasource = datasources[source_type]
    return datasource(datasource_spec)
