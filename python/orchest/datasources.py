import requests
import boto3
import os

from requests.exceptions import HTTPError
from sqlalchemy import create_engine


class DataSource():

    connection_timeout = 5

    def __init__(self):
        pass

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


class HostDirectoryDataSource(DataSource):

    def __init__(self, data):
        self.path = "/data/" + data["name"]


class MySQLDataSource(DataSource):

    def __init__(self, data):

        connection_details = data["connection_details"]

        self.connection_string = "mysql://%s:%s@%s/%s" % (
            connection_details["username"],
            connection_details["password"],
            connection_details["host"],
            connection_details["database_name"]
        )

        self.engine = create_engine(self.connection_string,
            connect_args={'connect_timeout': self.connection_timeout})

        self.connection = self.engine.connect()


    def __del__(self):
        try:
            self.connection.close()
        except Exception as e:
            print(e)


class PostgreSQLDataSource(DataSource):

    def __init__(self, data):

        connection_details = data["connection_details"]

        self.connection_string = "postgresql://%s:%s@%s/%s" % (
            connection_details["username"],
            connection_details["password"],
            connection_details["host"],
            connection_details["database_name"]
        )

        self.engine = create_engine(self.connection_string,
            connect_args={'connect_timeout': self.connection_timeout})

        self.connection = self.engine.connect()


    def __del__(self):
        try:
            self.connection.close()
        except Exception as e:
            print(e)


class AWSRedshiftDataSource(DataSource):

    def __init__(self, data):

        connection_details = data["connection_details"]

        self.connection_string = "redshift+psycopg2://%s:%s@%s/%s" % (
            connection_details["username"],
            connection_details["password"],
            connection_details["host"],
            connection_details["database_name"]
        )

        self.engine = create_engine(self.connection_string,
            connect_args={'connect_timeout': self.connection_timeout})

        self.connection = self.engine.connect()


    def __del__(self):
        try:
            self.connection.close()
        except Exception as e:
            print(e)


class AWSObjectStorageS3(DataSource):

    def __init__(self, data):

        self.s3 = boto3.resource('s3',
            aws_access_key_id=data["connection_details"]["access_key"],
            aws_secret_access_key=data["connection_details"]["secret_key"])

        self.client = boto3.client('s3',
            aws_access_key_id=data["connection_details"]["access_key"],
            aws_secret_access_key=data["connection_details"]["secret_key"])

        self.bucket = self.s3.Bucket(data["connection_details"]["bucket"])


def get_datasource(name):

    try:
        response = requests.get("http://orchest-webserver/store/datasources/%s" % name)
        response.raise_for_status()

        datasource = response.json()

        return DataSource.from_json(datasource)

    except HTTPError as http_err:
        print(f'HTTP error occurred: {http_err}')
    except Exception as err:
        print(f'Other error occurred: {err}')
