"""Module about pipeline definition/de-serialization.

Essentially, it covers transforming a pipeline definition, e.g. obtained
by the pipeline json, into an instance of the Pipeline class, which adds
some nice to have logic.

As a client of this module you are most likely interested in how to get
a pipeline json to a Pipeline instance.

"""
import copy
from typing import Any, Dict, Iterable, List, Optional, Set

from _orchest.internals import config as _config
from app.types import PipelineDefinition, PipelineProperties, PipelineStepProperties


def construct_pipeline(
    uuids: Iterable[str],
    run_type: str,
    pipeline_definition: PipelineDefinition,
    **kwargs,
) -> "Pipeline":
    """Constructs a pipeline from a description with selection criteria.

    Based on the run type and selection of UUIDs, constructs the
    appropriate Pipeline.

    TODO:
        Include config options to be based to methods. This can be done
        via the **kwargs option.

        Example: waiting on container completion, or inclusive or
            exclusive of the selection for "incoming" `run_type`.

        All options for the config should be documented somewhere.

    Args:
        uuids: a selection/sequence of pipeline step UUIDs. If
            `run_type` equals "full", then this argument is ignored.
        run_type: one of ("full", "selection", "incoming").
        pipeline_definition: a json description of the pipeline.
        config: configuration for the `run_type`.

    Returns:
        Always returns a Pipeline. Depending on the `run_type` the
        Pipeline is constructed as follows from the given
        `pipeline_definition`:
            * "full" -> entire pipeline from description
            * "selection" -> induced subgraph based on selection.
            * "incoming" -> all incoming steps of the selection. In
                other words: all ancestors of the steps of the
                selection.

        As of now, the selection itself is NOT included in the Pipeline
        if `run_type` equals "incoming".

    Raises:
        ValueError if the `run_type` is incorrectly specified.
    """
    # Create a pipeline from the pipeline_definition. And run the
    # appropriate method based on the run_type.
    pipeline = Pipeline.from_json(pipeline_definition)

    if run_type == "full":
        return pipeline

    if run_type == "selection":
        return pipeline.get_induced_subgraph(uuids)

    if run_type == "incoming":
        return pipeline.incoming(uuids, inclusive=False)

    raise ValueError("Function not defined for specified run_type")


class PipelineStep:
    """A step of a pipeline.

    It can also be thought of as a node of a graph.

    Args:
        properties: properties of the step used for execution.
        parents: the parents/incoming steps of the current step.

    Attributes:
        properties: see "Args" section.
        parents: see "Args" section.
    """

    def __init__(
        self,
        properties: PipelineStepProperties,
        parents: Optional[List["PipelineStep"]] = None,
    ) -> None:
        self.properties = properties
        self.parents = parents if parents is not None else []

        # Keeping a list of children allows us to traverse the pipeline
        # also in the other direction. This is helpful for certain
        # Pipeline methods.
        self._children: List["PipelineStep"] = []

    def __eq__(self, other) -> bool:
        return self.properties["uuid"] == other.properties["uuid"]

    def __hash__(self) -> int:
        return hash(self.properties["uuid"])

    def __str__(self) -> str:
        if self.properties:
            return f'<PipelineStep: {self.properties["title"]}>'

        return "<Pipelinestep: None>"

    def __repr__(self) -> str:
        # TODO: This is actually not correct: it should be
        #       self.properties. But this just look ugly as hell
        #       (so maybe for later). And strictly, should also include
        #       its parents.
        if self.properties:
            return f'PipelineStep({self.properties["title"]!r})'

        return "Pipelinestep(None)"


class Pipeline:
    def __init__(
        self, steps: List[PipelineStep], properties: PipelineProperties
    ) -> None:
        self.steps = steps

        # We want to be able to serialize a Pipeline back to a json
        # file. Therefore we would need to store the Pipeline name and
        # UUID from the json first.
        self.properties: PipelineProperties = properties  # type: ignore

        # See the sentinel property for explanation.
        self._sentinel: Optional[PipelineStep] = None

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
                steps[uuid]._children.append(step)

        properties: PipelineProperties = {
            "name": description["name"],
            "uuid": description["uuid"],
            "settings": description["settings"],
            "parameters": description.get("parameters", {}),
            "services": description.get("services", {}),
            "version": description.get("version"),
        }
        return cls(list(steps.values()), properties)

    def to_dict(self) -> PipelineDefinition:
        """Convert the Pipeline to its dictionary description."""
        description: PipelineDefinition = {"steps": {}}
        for step in self.steps:
            description["steps"][step.properties["uuid"]] = step.properties

        description.update(self.properties)
        return description

    def get_step(self, uuid: str) -> PipelineStep:
        # NOTE: This is slow, although reasonable for small/medium size
        # pipelines.
        for step in self.steps:
            if uuid == step.properties["uuid"]:
                return step
        else:
            raise ValueError(f"Step with uuid '{uuid}' not in pipeline.")

    def get_environments(self) -> Set[str]:
        """Returns the set of UUIDs of the used environments.

        Returns:
            Set of environments uuids used among the pipeline steps and
            services making use of orchest environments.

        """
        st_envs = set([step.properties["environment"] for step in self.steps])
        prefix = _config.ENVIRONMENT_AS_SERVICE_PREFIX
        sr_envs = set(
            [
                sr["image"].replace(prefix, "")
                for sr in self.properties.get("services", {}).values()
                if sr["image"].startswith(prefix)
            ]
        )

        return set.union(st_envs, sr_envs)

    def get_params(self) -> Dict[str, Any]:
        return self.properties.get("parameters", {})

    def get_induced_subgraph(self, selection: Iterable[str]) -> "Pipeline":
        """Returns a new pipeline whos set of steps equal the selection.

        Takes an induced subgraph of the pipeline formed by a subset of
        its steps given by the selection (of UUIDs).

        Example:
            When the selection consists of: a --> b. Then it is
            important that "a" is run before "b". Therefore the induced
            subgraph has to be taken to ensure the correct ordering,
            instead of executing the steps independently (and in
            parallel).

        Args:
            selection: list of UUIDs representing `PipelineStep`s.

        Returns:
            An induced pipeline by the set of steps (defined by the
            given selection).
        """
        keep_steps = [
            step for step in self.steps if step.properties["uuid"] in selection
        ]

        # Only keep connection to parents and children if these steps
        # are also included in the selection. In addition, to keep
        # consistency of the properties attributes of the steps, we
        # update the "incoming_connections" to be representative of the
        # new pipeline structure.
        new_steps = []
        for step in keep_steps:
            # Take a deepcopy such that the properties of the new and
            # original step do not point to the same object (since we
            # want to update the "incoming_connections").
            new_step = PipelineStep(copy.deepcopy(step.properties))
            new_step.parents = [s for s in step.parents if s in keep_steps]
            new_step._children = [s for s in step._children if s in keep_steps]
            new_step.properties["incoming_connections"] = [
                s.properties["uuid"] for s in new_step.parents
            ]
            new_steps.append(new_step)

        properties = copy.deepcopy(self.properties)
        return Pipeline(steps=new_steps, properties=properties)

    def convert_to_induced_subgraph(self, selection: List[str]) -> None:
        """Converts the pipeline to a subpipeline.

        NOTE:
            Exactly the same as `get_induced_subgraph` except that it
            modifies the underlying `Pipeline` object inplace.
        """
        self.steps = [
            step for step in self.steps if step.properties["uuid"] in selection
        ]

        # Removing connection from steps to "non-existing" steps, i.e.
        # steps that are not included in the selection.
        for step in self.steps:
            step.parents = [s for s in step.parents if s in self.steps]
            step._children = [s for s in step._children if s in self.steps]

    def incoming(self, selection: Iterable[str], inclusive: bool = False) -> "Pipeline":
        """Returns a new Pipeline of all ancestors of the selection.

        NOTE:
            The following can be thought of as an edge case. Lets say
            you have the pipeline: a --> b --> c and a selection of
            [b, c] with `inclusive` set to False. Then only step "a"
            would be run.

        Args:
            selection: list of UUIDs representing `PipelineStep`s.
            inclusive: if True, then the steps in the selection are also
                part of the returned `Pipeline`, else the steps will not
                be included.

        Returns:
            An induced pipeline by the set of steps (defined by the
            given selection).
        """
        # This set will be populated with all the steps that are
        # ancestors of the sets given by the selection. Depending on the
        # kwarg `inclusive` the steps from the selection itself will
        # either be included or excluded.
        steps = set()

        # Essentially a BFS where its stack gets initialized with
        # multiple root nodes.
        stack = [step for step in self.steps if step.properties["uuid"] in selection]

        while stack:
            step = stack.pop()
            if step in steps:
                continue

            # Create a new Pipeline step that is a copy of the step. For
            # consistency also update the properties attribute and make
            # it point to a new object.
            new_properties = copy.deepcopy(step.properties)
            new_properties["incoming_connections"] = [
                s.properties["uuid"] for s in step.parents
            ]
            new_step = PipelineStep(new_properties, step.parents)

            # NOTE: the childrens list has to be updated, since the
            # sentinel node uses its information to be computed. On the
            # other hand, the parents, do not change and are always all
            # included.
            new_step._children = [
                s
                for s in step._children
                if s in steps or s.properties["uuid"] in selection
            ]
            steps.add(new_step)
            stack.extend(new_step.parents)

        # Remove steps if the selection should not be included in the
        # new pipeline.
        if inclusive:
            steps_to_be_included = steps
        else:
            steps_to_be_included = steps - set(
                step for step in self.steps if step.properties["uuid"] in selection
            )

            # We have to go over the children again to make sure they
            # also do not include any steps of the selection.
            for step in steps_to_be_included:
                step._children = [
                    s for s in step._children if s in steps_to_be_included
                ]

        properties = copy.deepcopy(self.properties)
        return Pipeline(steps=list(steps_to_be_included), properties=properties)

    def __repr__(self) -> str:
        return f"Pipeline({self.steps!r})"
