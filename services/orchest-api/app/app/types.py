from enum import Enum
from typing import Any, Dict, List, Optional, TypedDict

__all__ = [
    "PipelineStepProperties",
    "PipelineProperties",
    "PipelineSettings",
    "ServiceDefinition",
    "PipelineDefinition",
    "RunConfig",
    "SessionType",
    "SessionConfig",
    "InteractiveSessionConfig",
    "NonInteractiveSessionConfig",
]


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
    max_steps_parallelism: int


class ServiceDefinition(TypedDict):
    binds: Optional[Dict[str, Any]]  # "/project-dir", "/data" to path
    command: Optional[str]
    args: Optional[str]
    env_variables: Optional[Dict[str, str]]
    env_variables_inherit: Optional[List[str]]
    exposed: bool
    requires_authentication: bool
    image: str
    name: str
    ports: Optional[List[int]]
    preserve_base_path: Optional[str]
    scope: List[str]  # interactive, noninteractive
    order: int


class PipelineProperties(TypedDict):
    name: str
    parameters: Dict[str, Any]
    services: Dict[str, ServiceDefinition]
    settings: PipelineSettings
    uuid: str
    version: str


class PipelineDefinition(PipelineProperties):
    steps: Dict[str, PipelineStepProperties]


class RunConfig(TypedDict):
    env_uuid_to_image: Dict[str, str]
    userdir_pvc: str
    pipeline_path: str
    pipeline_uuid: str
    project_dir: str
    project_uuid: str
    session_type: str  # interactive, noninteractive
    session_uuid: str
    user_env_variables: Dict[str, str]


class SessionType(Enum):
    INTERACTIVE = "interactive"
    NONINTERACTIVE = "noninteractive"


class SessionConfig(TypedDict):
    env_uuid_to_image: Dict[str, str]
    userdir_pvc: str
    pipeline_path: str
    pipeline_uuid: str
    project_dir: str
    project_uuid: str
    services: Optional[Dict[str, ServiceDefinition]]


class InteractiveSessionConfig(SessionConfig):
    auth_user_uuid: Optional[str]


class NonInteractiveSessionConfig(SessionConfig):
    # Env variables defined for the job.
    user_env_variables: Dict[str, str]


# Used for some event payloads. The "str" mixing makes it json
# serializable.
class ChangeType(str, Enum):
    CREATED = "CREATED"
    UPDATED = "UPDATED"
    DELETED = "DELETED"


class Change(TypedDict):
    type: ChangeType
    # What has changed, i.e. an env var, a given job property, etc.
    changed_object: str
    # Set them to None or don't include them at all if not applicable or
    # if you don't want to expose their value. Values should not contain
    # any sensitive data, they will be exposed to both notifications and
    # analytics.
    old_value: Optional[str]
    new_value: Optional[str]


class EntityUpdate(TypedDict):
    changes: List[Change]
