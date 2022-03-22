from typing import Any, Dict, List, Optional

from orchest import error


# NOTE: the TypedDict from the typing module is support only >=3.8
class TypedDict(dict):
    pass


class PipelineStepProperties(TypedDict):
    environment: str
    file_path: str
    incoming_connections: List[str]  # list of UUIDs
    kernel: Dict[str, Any]
    meta_data: Dict[str, List[int]]  # Related to GUI displaying.
    parameters: Dict[str, Any]
    title: str
    uuid: str


class PipelineSettings(TypedDict):
    auto_eviction: bool
    data_passing_memory_size: str  # 1GB and similar.


class ServiceDefinition(TypedDict):
    binds: Optional[Dict[str, Any]]  # "/project-dir", "/data" to path
    command: Optional[str]
    args: Optional[str]
    env_variables: Optional[Dict[str, str]]
    env_variables_inherit: Optional[List[str]]
    image: str
    name: str
    ports: Optional[List[int]]
    preserve_base_path: Optional[str]
    scope: List[str]  # interactive, noninteractive
    exposed: bool
    requires_authentication: bool


class PipelineDefinition(TypedDict):
    name: str
    parameters: Dict[str, Any]
    services: Dict[str, ServiceDefinition]
    settings: PipelineSettings
    steps: Dict[str, PipelineStepProperties]
    uuid: str
    version: str


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

    def __repr__(self) -> str:
        return f"Pipeline({self.steps!r})"
