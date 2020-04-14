import json


class PipelineStep:

    def __init__(self, properties):
        self.properties = properties

        self.parents = []
        self.children = []

    
    def __str__(self):
        return self.properties["name"]


    def __repr__(self):
        return self.__str__()


class Pipeline:

    def __init__(self):

        # try to read pipeline.json from current working director
        # error if not available
        with open("pipeline.json", "r") as file:
            json_obj = json.loads(file.read())
            self.json = json_obj

        # populate steps
        step_keys = self.json['steps'].keys()

        self.steps = {}

        for step_key in step_keys:
            step_json = self.json['steps'][step_key]

            self.steps[step_key] = PipelineStep(step_json)

        # populate step parents/children
        for step_key in step_keys:

            step = self.steps[step_key]
            
            # populate parents
            incoming_connections = step.properties["incoming_connections"]

            for incoming_connection in incoming_connections:
                step.parents.append(self.steps[incoming_connection])
                self.steps[incoming_connection].children.append(step)


    def step_list(self):
        return [self.steps[step_key] for step_key in self.steps.keys()]


    def leafs(self):
        return [step for step in self.step_list() if len(step.children) == 0]


    def roots(self):
        return [step for step in self.step_list() if len(step.parents) == 0]


    def __str__(self):

        pipeline_descr = ["Pipeline"]

        for step in self.step_list():
            pipeline_descr.append("- " + step.properties["name"] + " (incoming connections %s)" % (step.parents,))

        return '\n'.join(pipeline_descr)
