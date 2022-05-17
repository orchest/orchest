import { StrategyJson } from "./components/ParameterEditor";
import { TStatus } from "./components/Status";

declare module "react" {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    // extends React's HTMLAttributes
    directory?: string;
    webkitdirectory?: string;
  }
}

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

type CommonColorScales =
  | "50"
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900"
  | "A100"
  | "A200"
  | "A400"
  | "A700";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PartialRecord<K extends keyof any, T> = {
  [P in K]?: T;
};

export type ColorScale = PartialRecord<
  | "50"
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900"
  | "A100"
  | "A200"
  | "A400"
  | "A700",
  string
>;

export type OrchestConfig = {
  CLOUD: boolean;
  CLOUD_UNMODIFIABLE_CONFIG_VALUES?: string[] | null;
  ENVIRONMENT_DEFAULTS: {
    base_image: string;
    gpu_support: boolean;
    language: Language;
    name: string;
    setup_script: string;
  };
  FLASK_ENV: string;
  GPU_ENABLED_INSTANCE: boolean;
  INTERCOM_APP_ID: string;
  INTERCOM_DEFAULT_SIGNUP_DATE: string;
  ORCHEST_SOCKETIO_ENV_IMG_BUILDING_NAMESPACE: string;
  ORCHEST_SOCKETIO_JUPYTER_IMG_BUILDING_NAMESPACE: string;
  ORCHEST_WEB_URLS: {
    github: string;
    readthedocs: string;
    slack: string;
    website: string;
    orchest_update_info_json: string;
    orchest_examples_repo: string;
    orchest_examples_json: string;
  };
  PIPELINE_PARAMETERS_RESERVED_KEY: string;
  TELEMETRY_DISABLED: boolean;
};

export interface OrchestUserConfig {
  AUTH_ENABLED?: boolean;
  INTERCOM_USER_EMAIL: string;
  MAX_INTERACTIVE_RUNS_PARALLELISM: number;
  MAX_JOB_RUNS_PARALLELISM: number;
  TELEMETRY_DISABLED: boolean;
  TELEMETRY_UUID: string;
}

export interface OrchestServerConfig {
  config: OrchestConfig;
  user_config: OrchestUserConfig;
}

export interface IOrchestSessionUuid {
  projectUuid: string;
  pipelineUuid: string;
}

export interface IOrchestSession extends IOrchestSessionUuid {
  status?: "RUNNING" | "LAUNCHING" | "STOPPING";
  base_url?: string;
  user_services?: {
    [key: string]: {
      name: string;
      image: string;
    };
  };
}

export interface IQueryArgs
  extends Partial<
    Record<
      | "environment_uuid"
      | "import_url"
      | "initial_tab"
      | "job_uuid"
      | "pipeline_uuid"
      | "project_uuid"
      | "run_uuid"
      | "step_uuid",
      string
    >
  > {
  read_only?: "true" | "false";
}

export type TViewPropsWithRequiredQueryArgs<K extends keyof IQueryArgs> = {
  queryArgs?: Omit<IQueryArgs, K> & Required<Pick<IQueryArgs, K>>;
};

export type Project = {
  path: string;
  uuid: string;
  pipeline_count: number;
  job_count: number | undefined;
  environment_count: number;
  project_snapshot_size: number;
  env_variables: Record<string, string>;
  status: "READY" | string;
  session_count?: number;
};

export type Language = "python" | "r" | "julia" | "javascript";

export type Environment = {
  base_image: string;
  gpu_support: boolean;
  language: Language;
  name: string;
  project_uuid: string;
  setup_script: string;
  uuid: string;
};

export type CustomImage = Pick<
  Environment,
  "base_image" | "language" | "gpu_support"
>;

export type EnvironmentImageBuild = {
  uuid: string;
  environment_uuid: string;
  finished_time: string;
  project_path: string;
  project_uuid: string;
  image_tag: string;
  requested_time: string;
  started_time: string;
  status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE" | "ABORTED";
  celery_task_uuid: string;
};

export type PipelineStepStatus =
  | "STARTED"
  | "SUCCESS"
  | "FAILURE"
  | "ABORTED"
  | "PENDING"
  | "IDLE";

export type JobStatus =
  | "PENDING"
  | "STARTED"
  | "PAUSED"
  | "SUCCESS"
  | "ABORTED"
  | "FAILURE"
  | "DRAFT";

export type PipelineRun = {
  uuid: string;
  project_uuid: string;
  pipeline_uuid: string;
  status: TStatus;
  started_time: string;
  finished_time: string;
  pipeline_steps: {
    run_uuid: string;
    step_uuid: string;
    status: PipelineStepStatus;
    started_time: string;
    finished_time: string;
  }[];
  env_variables: Record<string, string>;
  job_uuid: string;
  job_run_index: number;
  job_run_pipeline_run_index: number;
  pipeline_run_index: number;
  parameters: Record<string, Json>;
  server_time: string;
};

export type StrategyJson = Record<
  string,
  { parameters: Record<string, string> }
>;

export type Job = {
  uuid: string;
  pipeline_uuid: string;
  project_uuid: string;
  total_scheduled_executions: number;
  total_scheduled_pipeline_runs: number;
  pipeline_definition: {
    name: string;
    parameters: Record<string, Json>;
    settings: {
      auto_eviction: boolean;
      data_passing_memory_size: string;
    };
    uuid: string;
    steps: Record<string, Step>;
    version: string;
    services: Record<string, Service>;
  };
  next_scheduled_time: string;
  last_scheduled_time: string;
  parameters: Record<string, Json>[];
  schedule: string;
  pipeline_run_spec: {
    uuids: string[];
    project_uuid: string;
    run_type: string;
    run_config: {
      project_dir: string;
      pipeline_path: string;
      userdir_pvc: string;
    };
    scheduled_start: string;
  };
  status: JobStatus;
  created_time: string;
  pipeline_name: string;
  name: string;
  strategy_json: StrategyJson;
  env_variables: Record<string, string>;
  max_retained_pipeline_runs: number;
  pipeline_run_status_counts: Record<TStatus, number | undefined>;
};

export type Step = {
  uuid: string;
  title: string;
  incoming_connections: string[];
  environment: string;
  file_path: string;
  kernel: {
    display_name?: string;
    name?: string;
  };
  meta_data: { hidden: boolean; position: [number, number] };
  parameters: Record<string, any>;
};

export type MouseTracker = {
  client: Position;
  prev: Position;
  delta: Position;
  unscaledPrev: Position;
  unscaledDelta: Position;
};

export type Connection = {
  startNodeUUID: string;
  endNodeUUID?: string;
};

export type NewConnection = Connection & {
  xEnd?: number;
  yEnd?: number;
};

export type Position = { x: number; y: number };

export type LogType = "step" | "service";

export type PipelineStepMetaData = {
  hidden: boolean;
  position: [number, number];
};

export type PipelineStepState = Step & {
  outgoing_connections?: string[];
  meta_data?: PipelineStepMetaData;
};

export type StepsDict = Record<string, PipelineStepState>;

export type Offset = { top: number; left: number };

export type Service = {
  image: string;
  name: string;
  scope: ("interactive" | "noninteractive")[];
  args?: string;
  binds?: Record<string, string>;
  ports: number[];
  command?: string;
  preserve_base_path?: boolean;
  env_variables?: Record<string, string>;
  env_variables_inherit?: any[];
  exposed: boolean;
  requires_authentication?: boolean;
  order: number;
};

export type FileTree = {
  type: "directory" | "file";
  name: string;
  root?: boolean;
  // Absolute path against the root, e.g. /folder/sub/file.py, will need to check if its root is `/project-dir:/ or `/data:/`;
  // therefore, the complete absolute path would be `/project-dir:/folder/sub/file.py`
  path?: string;
  depth?: number;
  children: FileTree[];
};

export type Pipeline = {
  env_variables: Record<string, string>;
  path: string;
  project_uuid: string;
  status: "READY" | string;
  uuid: string;
};

export type PipelineMetaData = {
  uuid: string;
  path: string; // Note that this path is relative to `/project-dir:`, i.e. it doesn't have a leading slash
  name: string;
};

export type PipelineSettings = {
  auto_eviction?: boolean;
  data_passing_memory_size?: string;
};

export type PipelineJson = {
  name: string;
  parameters: Record<string, Json>;
  settings: PipelineSettings;
  steps: Record<string, Step>;
  uuid: string;
  version: string;
  services?: Record<string, Service>;
};

export type Example = {
  description: string; // 280 characters
  forks_count: number;
  owner: "orchest" | string;
  stargazers_count: number;
  tags: string[];
  title: string;
  url: string;
};

export type EnvironmentAction = "BUILD" | "WAIT" | "RETRY";
export type EnvironmentValidationData = {
  actions: EnvironmentAction[];
  fail: string[];
  pass: string[];
  validation: "fail" | "pass";
};

export type BuildRequest = {
  projectUuid: string;
  environmentValidationData: EnvironmentValidationData;
  requestedFromView: string;
  onBuildComplete: () => void;
  onCancel?: () => void;
};

export type Pagination = {
  has_next_page: boolean;
  has_prev_page: boolean;
  next_page_num: number | null;
  prev_page_num: number | null;
  items_per_page: number;
  items_in_this_page: number;
  total_items: number;
  total_pages: number;
};

export type UpdateInfo = {
  latest_version: string | null;
};

export type OrchestVersion = {
  version: string | null | undefined;
};
