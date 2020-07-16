from typing import Optional

from requests.exceptions import HTTPError
from sqlalchemy import create_engine
import boto3
import requests

from orchest.errors import (
    OrchestNetworkError,
)


class DataSource:
    connection_string: Optional[str] = None
    connection_timeout = 5

    # TODO: Actually connecting might not be best inside the __init__.
    #       Could give some properties or maybe convert into
    #       ContextManager. Otherwise the connection will be left open
    #       and the user is explicetely responsible for closing it.
    def __init__(self, data):
        connection_details = data["connection_details"]

        self._connection_string = self.connection_string.format(
            username=connection_details["username"],
            password=connection_details["password"],
            host=connection_details["host"],
            db_name=connection_details["database_name"]
        )

        # TODO: seems like this is already connecting to the db
        # https://docs.sqlalchemy.org/en/13/core/connections.html#sqlalchemy.engine.Engine
        self.engine = create_engine(
            self._connection_string,
            connect_args={'connect_timeout': self.connection_timeout}
        )

    @property
    def connection(self):
        if self._connection is None:
            self._connection = self.engine.connect()

        return self._connection

    # TODO: Doesn't seem to be the correct way to me. Since the childs
    #       also get this classmethod due to inheritance. But then it
    #       doesn't make a lot of sense since an S3 then can create a
    #       HostDirectory datasource.
    @classmethod
    def from_json(cls, datasource_json):
        if datasource_json["source_type"] == "host-directory":
            return HostDirectoryDataSource(datasource_json)
        elif datasource_json["source_type"] == "database-mysql":
            return MySQLDataSource(datasource_json)
        elif datasource_json["source_type"] == "database-postgresql":
            return PostgreSQLDataSource(datasource_json)
        elif datasource_json["source_type"] == "database-aws-redshift":
            return AWSRedshiftDataSource(datasource_json)
        elif datasource_json["source_type"] == "objectstorage-aws-s3":
            return AWSObjectStorageS3(datasource_json)

    def __del__(self):
        try:
            self.connection.close()
        except Exception as e:
            print(e)


class HostDirectoryDataSource(DataSource):

    def __init__(self, data):
        self.path = "/data/" + data["name"]

    # TODO: Should maybe not inherit from DataSource. Now we have to
    #       overwrite its __del__ method to not do anything. Doesn't
    #       seem like a "proper" child.
    def __del__(self):
        pass


# TODO: Even though different datasources all inherit from the
#       parent DataSource class, they have different attributes.
#       This is confusing.
class MySQLDataSource(DataSource):
    connection_string = "mysql://{username}:{password}@{host}/{db_name}"


class PostgreSQLDataSource(DataSource):
    connection_string = "postgresql://{username}:{password}@{host}/{db_name}"


class AWSRedshiftDataSource(DataSource):
    connection_string = "redshift+psycopg2://{username}:{password}@{host}/{db_name}"


class AWSObjectStorageS3(DataSource):

    def __init__(self, data):
        self.s3 = boto3.resource(
            's3',
            aws_access_key_id=data["connection_details"]["access_key"],
            aws_secret_access_key=data["connection_details"]["secret_key"],
        )

        self.client = boto3.client(
            's3',
            aws_access_key_id=data["connection_details"]["access_key"],
            aws_secret_access_key=data["connection_details"]["secret_key"],
        )

        self.bucket = self.s3.Bucket(data["connection_details"]["bucket"])

    def __del__(self):
        pass


def get_datasource(name: str) -> DataSource:
    """Gets a datasource by name.

    The name coincides with the datasource name as defined in the UI on
    the Orchest platform.

    Args:
        name: The name of the datasource.

    Returns:
        A DataSource object.

    """
    try:
        response = requests.get("http://orchest-webserver/store/datasources/%s" % name)
        response.raise_for_status()

        datasource = response.json()

        return DataSource.from_json(datasource)

    # TODO: These should be improved since they are directly user
    #       facing.
    except HTTPError as http_err:
        raise OrchestNetworkError(f'HTTP error occurred: {http_err}')
    except Exception as err:
        print(f'Other error occurred: {err}')
