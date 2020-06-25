import requests

from requests.exceptions import HTTPError
from sqlalchemy import create_engine


class DataSource():
    def __init__(self):
        pass

    @classmethod
    def from_json(cls, datasource_json):

        if datasource_json["source_type"] == "host-directory":
            return HostDirectoryDataSource(datasource_json)
        elif datasource_json["source_type"] == "database-mysql":
            return MySQLDataSource(datasource_json)


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

        self.engine = create_engine(self.connection_string)
        self.connection = self.engine.connect()


    def __del__(self):
        try:
            self.connection.close()
        except Exception as e:
            print(e)


def get(name):

    try:
        response = requests.get("http://orchest-webserver/store/datasources/%s" % name)
        response.raise_for_status()

        datasource = response.json()
        
        return DataSource.from_json(datasource)

    except HTTPError as http_err:
        print(f'HTTP error occurred: {http_err}')
    except Exception as err:
        print(f'Other error occurred: {err}')
