import requests

from requests.exceptions import HTTPError


class DataSource():
    def __init__(self):
        pass

    @classmethod
    def from_json(cls, datasource_json):

        if datasource_json["source_type"] == "host-directory":
            return HostDirectoryDataSource(datasource_json)


class HostDirectoryDataSource(DataSource):

    def __init__(self, data):
        self.path = "/data/" + data["name"]


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
