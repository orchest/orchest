from enum import Enum
from typing import Any, Dict, List, Optional, TypedDict

__all__ = [
    "PipelineStepProperties",
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


class PipelineDefinition(TypedDict):
    name: str
    parameters: Dict[str, Any]
    services: Dict[str, ServiceDefinition]
    settings: PipelineSettings
    steps: Dict[str, PipelineStepProperties]
    uuid: str
    version: str


class RunConfig(TypedDict):
    env_uuid_to_image: Dict[str, str]
    userdir_pvc: str
    pipeline_path: str
    pipeline_uuid: str
    project_dir: str
    project_uuid: str
    run_endpoint: Optional[str]
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
    pass


class NonInteractiveSessionConfig(SessionConfig):
    # Env variables defined for the job.
    user_env_variables: Dict[str, str]
