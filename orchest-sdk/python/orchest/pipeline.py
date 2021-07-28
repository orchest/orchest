from typing import Any, Dict, List, Optional

from orchest import error


# NOTE: the TypedDict from the typing module is support only >=3.8
class TypedDict(dict):
    pass


# TODO: this class is not extensive yet. The Other Dicts can be typed
#       with a TypedDict also.
class PipelineStepProperties(TypedDict):
    name: str
    uuid: str
    incoming_connections: List[str]  # list of UUIDs
    file_path: str
    environment: str
    parameters: dict
    meta_data: Dict[str, List[int]]


class PipelineDefinition(TypedDict):
    name: str
    uuid: str
    steps: Dict[str, PipelineStepProperties]
    parameters: Dict[str, Any]


class PipelineStep:
    """A step of a pipeline.

    It can also be thought of as a node of a graph.

    Args:
        properties: properties of the step used for execution.
        parents: the parents/incoming steps of the current step.

    Attributes:
        properties: see ``Args`` section.
        parents: see ``Args`` section.
    """

    def __init__(
        self,
        properties: PipelineStepProperties,
        parents: Optional[List["PipelineStep"]] = None,
    ) -> None:
        self.properties = properties
        self.parents = parents if parents is not None else []
        self.children: List["PipelineStep"] = []

    def get_params(self) -> Dict[str, Any]:
        return self.properties.get("parameters", {})

    def update_params(self, params) -> None:
        for param in params:
            if not isinstance(param, str):
                raise TypeError(
                    (
                        f"Parameter keys can only be of type string. Key {param} "
                        f"of type {type(param)} is invalid."
                    )
                )
        try:
            self.properties["parameters"].update(params)
        except KeyError:
            self.properties["parameters"] = params

        return

    def __str__(self) -> str:
        if self.properties:
            return f'<PipelineStep: {self.properties["name"]}>'

        return "<Pipelinestep: None>"

    def __repr__(self) -> str:
        # TODO: This is actually not correct:
        # it should be self.properties.
        # But this just look ugly as hell (so maybe for later).
        # And strictly, should also include its parents.
        if self.properties:
            return f'PipelineStep({self.properties["name"]!r})'

        return "Pipelinestep(None)"


class Pipeline:
    def __init__(self, steps: List[PipelineStep], properties: Dict[str, Any]) -> None:
        self.steps = steps
        self.properties = properties

    @classmethod
    def from_json(cls, description: PipelineDefinition) -> "Pipeline":
        """Constructs a pipeline from a json description.

        This is an alternative constructur.

        Args:
            description: json description of Pipeline.

        Returns:
            A pipeline object defined by the given description.
        """
        # Create a mapping for all the steps from UUID to object.
        steps = {
            uuid: PipelineStep(properties)
            for uuid, properties in description["steps"].items()
        }

        # For every step populate its parents and _children attributes.
        for step in steps.values():
            for uuid in step.properties["incoming_connections"]:
                step.parents.append(steps[uuid])
                steps[uuid].children.append(step)

        properties = {
            "name": description["name"],
            "uuid": description["uuid"],
            "settings": description.get("settings"),
            "parameters": description.get("parameters", {}),
            "services": description.get("services", []),
        }
        return cls(list(steps.values()), properties)

    def to_dict(self) -> PipelineDefinition:
        description: PipelineDefinition = {"steps": {}}
        for step in self.steps:
            description["steps"][step.properties["uuid"]] = step.properties

        description.update(self.properties)
        return description

    def get_step_by_uuid(self, uuid: str) -> PipelineStep:
        """Get pipeline step object by its UUID.

        Raises:
            StepUUIDResolveError: The step's UUID cannot be resolved and
                thus it cannot determine where to output data to.

        """
        for step in self.steps:
            if step.properties["uuid"] == uuid:
                return step

        raise error.StepUUIDResolveError(
            f"Step does not exist in the pipeline with UUID: {uuid}."
        )

    def get_params(self) -> Dict[str, Any]:
        return self.properties.get("parameters", {})

    def update_params(self, params) -> None:
        for param in params:
            if not isinstance(param, str):
                raise TypeError(
                    (
                        f"Parameter keys can only be of type string. Key {param} "
                        f"of type {type(param)} is invalid."
                    )
                )
        try:
            self.properties["parameters"].update(params)
        except KeyError:
            self.properties["parameters"] = params

        return

    def __repr__(self) -> str:
        return f"Pipeline({self.steps!r})"
