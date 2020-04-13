import json

class Pipeline:

    def __init__(self):

        # try to read pipeline.json from current working director
        # error if not available
        with open("pipeline.json", "r") as file:
            json_obj = json.loads(file.read())
            self.json = json_obj


    def __str__(self):
        return "This is a Pipeline object: BOY"