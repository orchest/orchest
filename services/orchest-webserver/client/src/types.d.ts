import { Point2D } from "./utils/geometry";

declare module "react" {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    // extends React's HTMLAttributes
    directory?: string;
    webkitdirectory?: string;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunction = (...args: any[]) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAsyncFunction = (...args: any[]) => Promise<any>;
/** Returns the type of the promise result for an asynchronous function */
export type ResolutionOf<F extends AnyAsyncFunction> = ReturnType<
  F
> extends PromiseLike<infer R>
  ? R
  : never;

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

export type ExtractStringLiteralType<T, U extends T> = U;

export type ReducerActionWithCallback<ReducerState, ActionType> =
  | ActionType
  | ((previousState: ReducerState) => ActionType);

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

export type EnvironmentSpec = Omit<EnvironmentData, "uuid" | "project_uuid">;

export type OrchestConfig = {
  CLOUD: boolean;
  CLOUD_UNMODIFIABLE_CONFIG_VALUES?: (keyof OrchestUserConfig)[] | null;
  ENVIRONMENT_DEFAULTS: EnvironmentSpec;
  FLASK_ENV: string;
  GPU_ENABLED_INSTANCE: boolean;
  OPENREPLAY_PROJECT_KEY: string;
  OPENREPLAY_INGEST_POINT: string;
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
  MAX_BUILDS_PARALLELISM: number;
  MAX_INTERACTIVE_RUNS_PARALLELISM: number;
  MAX_JOB_RUNS_PARALLELISM: number;
  TELEMETRY_DISABLED: boolean;
  TELEMETRY_UUID: string;
}

export interface OrchestConfigs {
  config: OrchestConfig;
  user_config: OrchestUserConfig;
}

export interface OrchestSession {
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

export type ScopeParameters = {
  jobUuid: string;
  runUuid: string;
  snapshotUuid: string;
  projectUuid: string;
  pipelineUuid: string;
  environmentUuid: string;
  stepUuid: string;
  filePath: string;
  fileRoot: string;
  tab: string;
};

export type ScopeParameter = keyof ScopeParameters;

export type TViewPropsWithRequiredQueryArgs<K extends keyof IQueryArgs> = {
  queryArgs?: Omit<IQueryArgs, K> & Required<Pick<IQueryArgs, K>>;
};

export type GitImportStatus =
  | "STARTED"
  | "SUCCESS"
  | "FAILURE"
  | "ABORTED"
  | "PENDING";

export type GitImportError =
  | "GitImportError"
  | "GitCloneFailed"
  | "ProjectWithSameNameExists"
  | "ProjectNotDiscoveredByWebServer"
  | "NoAccessRightsOrRepoDoesNotExists";

export type GitImportOperation = {
  uuid: string;
  url: string;
  project_uuid?: string;
  requested_name: string;
  result: { error?: GitImportError };
  status: GitImportStatus;
};

export type GitConfig = {
  uuid?: string;
  name: string;
  email: string;
};

export type SshKey = {
  uuid: string;
  name: string;
  created_time: string;
};

export type Project = {
  path: string;
  uuid: string;
  pipeline_count: number;
  active_job_count: number | undefined;
  environment_count: number;
  project_snapshot_size: number;
  env_variables: Record<string, string>;
  status: "READY" | string;
  session_count?: number;
};

export type Language = "python" | "r" | "julia" | "javascript";

export type EnvironmentData = {
  uuid: string;
  project_uuid: string;
  base_image: string;
  gpu_support: boolean;
  language: Language;
  name: string;
  setup_script: string;
};

export type EnvironmentState = EnvironmentData & {
  action?: EnvironmentAction;
  latestBuild?: EnvironmentImageBuild;
};

export type CustomImage = Pick<
  EnvironmentData,
  "base_image" | "language" | "gpu_support"
>;

export type ImageBuildStatus =
  | "IDLE"
  | "STARTED"
  | "SUCCESS"
  | "FAILURE"
  | "ABORTED"
  | "PENDING";

export type EnvironmentImageBuild = {
  uuid: null; // TODO: clean this up on BE
  environment_uuid: string;
  finished_time: string;
  project_path: string;
  project_uuid: string;
  image_tag: string;
  requested_time: string;
  started_time: string;
  status: ImageBuildStatus;
  celery_task_uuid: string;
};

export type JupyterImageBuild = {
  finished_time: null | string;
  requested_time: string;
  started_time: null | string;
  status: ImageBuildStatus;
  uuid: null;
};

export type PipelineStepStatus =
  | "IDLE"
  | "STARTED"
  | "SUCCESS"
  | "FAILURE"
  | "ABORTED"
  | "PENDING";

export type JobStatus =
  | "DRAFT"
  | "PENDING"
  | "STARTED"
  | "PAUSED"
  | "SUCCESS"
  | "ABORTED"
  | "FAILURE";

export type PipelineRunStep = {
  run_uuid: string;
  step_uuid: string;
  status: PipelineStepStatus;
  started_time: string;
  finished_time: string;
};

export type PipelineRunStatus =
  | "PENDING"
  | "STARTED"
  | "SUCCESS"
  | "FAILURE"
  | "ABORTED";

export type PipelineRun = {
  uuid: string;
  project_uuid: string;
  pipeline_uuid: string;
  status: PipelineRunStatus;
  server_time: string;
  started_time?: string;
  finished_time: string | null;
  pipeline_steps: PipelineRunStep[];
  env_variables: Record<string, string>;
  parameters: Record<string, Json>;
};

export type JobRun = PipelineRun & {
  job_uuid: string;
  job_run_index: number;
  job_run_pipeline_run_index: number;
  pipeline_run_index: number;
};

export type JobRunsPage = {
  pipeline_runs: JobRun[];
  pagination_data: Pagination;
};

export type StrategyJsonValue = {
  parameters: Record<string, string>;
  key: string;
  title?: string;
};

export type StrategyJson = Record<string, StrategyJsonValue>;

export type JobData = {
  uuid: string;
  pipeline_uuid: string;
  project_uuid: string;
  total_scheduled_executions: number;
  total_scheduled_pipeline_runs: number;
  pipeline_definition: PipelineJson;
  next_scheduled_time: string | null;
  last_scheduled_time: string;
  parameters: Record<string, Json>[];
  schedule: string | null;
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
  snapshot_uuid: string;
};

export type JobChangesData = {
  confirm_draft?: true; // If provided, the submitted job will no longer be a draft.
  next_scheduled_time?: string | null; // For scheduled jobs.
  schedule?: string | null; // For cron jobs.
} & Pick<
  JobData,
  | "uuid"
  | "name"
  | "parameters"
  | "strategy_json"
  | "env_variables"
  | "max_retained_pipeline_runs"
>;

export type JobChanges = JobChangesData & {
  project_uuid: string;
  pipeline_uuid: string;
  status: JobStatus;
  snapshot_uuid: string;
  pipeline_path: string;
  pipeline_definition: PipelineJson;
  loadedStrategyFilePath?: string | undefined;
};

export type DraftJobData = Omit<
  JobChangesData,
  "status" | "project_uuid" | "pipeline_uuid"
> & { confirm_draft: true };

export type UnidirectionalStepNode = {
  uuid: string;
  incoming_connections: string[];
  outgoing_connections?: string[];
};

export type StepNode = UnidirectionalStepNode & {
  outgoing_connections: string[];
};

export type StepMetaData = {
  hidden: boolean;
  position: Point2D;
};

export type StepState = StepNode & {
  title: string;
  environment: string;
  /** The file path relative to the project file. */
  file_path: string;
  parameters: Record<string, any>;
  meta_data: StepMetaData;
  kernel: {
    display_name?: string;
    name?: string;
  };
};

export type StepData = Omit<StepState, "outgoing_connections">;

export type StepsDict = Record<string, StepState>;

export type Connection = {
  startNodeUUID: string;
  endNodeUUID?: string;
};

export type NewConnection = Connection & {
  end?: Point2D;
};

export type LogType = "step" | "service";

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

export type PipelineMetaData = {
  /**
   * An identifier for the pipeline.
   * This identifier is only unique within its project.
   */
  uuid: string;
  /**
   * The UUID of the project which the pipeline belongs to.
   * Used together with the pipeline UUID to uniquely identify the pipeline.
   */
  project_uuid: string;
  /** The path to the project, relative to the project directory. */
  path: string;
  /** A human-readable name for the pipeline (usage is discouraged in favor of `path`). */
  name: string;
};

export type PipelineStatus = "READY" | PipelineRunStatus;

/** Contains pipeline metadata plus additional state information. */
export type PipelineState = PipelineMetaData & {
  env_variables: Record<string, string>;
  status: PipelineStatus;
};

export type PipelineSettings = {
  auto_eviction?: boolean;
  data_passing_memory_size?: string;
  max_steps_parallelism?: integer;
};

export type PipelineJson = {
  name: string;
  parameters: Record<string, Json>;
  settings: PipelineSettings;
  steps: Record<string, StepData>;
  uuid: string;
  version: string;
  services?: Record<string, Service>;
  hash?: string;
};

export type PipelineJsonState = PipelineJson & {
  steps: Record<string, StepState>;
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
  version: string;
};

export type PipelineDataInSnapshot = {
  path: string;
  definition: PipelineJson;
};

export type SnapshotData = {
  uuid: string;
  project_uuid: string;
  pipelines: Record<string, PipelineDataInSnapshot>;
  timestamp: string;
};

export type ValidatedPipelineInSnapshot = PipelineDataInSnapshot & {
  valid: boolean;
};
