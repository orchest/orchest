import React from "react";

export interface IOrchestConfig {
  CLOUD: boolean;
  CLOUD_UNMODIFIABLE_CONFIG_VALUES?: string[] | null;
  ENVIRONMENT_DEFAULTS: {
    base_image: string;
    gpu_support: boolean;
    language: string;
    name: string;
    setup_script: string;
  };
  FLASK_ENV: string;
  GPU_ENABLED_INSTANCE: boolean;
  GPU_REQUEST_URL: string;
  INTERCOM_APP_ID: string;
  INTERCOM_DEFAULT_SIGNUP_DATE: string;
  INTERCOM_USER_EMAIL: string;
  ORCHEST_SOCKETIO_ENV_BUILDING_NAMESPACE: string;
  ORCHEST_SOCKETIO_JUPYTER_BUILDING_NAMESPACE: string;
  ORCHEST_WEB_URLS: {
    github: string;
    readthedocs: string;
    slack: string;
    website: string;
  };
  PIPELINE_PARAMETERS_RESERVED_KEY: string;
  TELEMETRY_DISABLED: boolean;
}

export interface IOrchestUserConfig {
  AUTH_ENABLED?: boolean;
  TELEMETRY_UUID: string;
}

export interface IOrchestSessionUuid {
  project_uuid: string;
  pipeline_uuid: string;
}

export interface IOrchestSession extends IOrchestSessionUuid {
  project_uuid: string;
  pipeline_uuid: string;
  status?: "RUNNING" | "LAUNCHING" | "STOPPING";
  jupyter_server_ip?: string;
  notebook_server_info?: {
    port: number;
    base_url: string;
  };
  user_services?: {
    [key: string]: {
      name: string;
      image: string;
    };
  };
}

export interface IOrchestState
  extends Pick<IOrchestSession, "project_uuid" | "pipeline_uuid"> {
  alert?: string[];
  isLoading: boolean;
  drawerIsOpen: boolean;
  pipelineName?: string;
  pipelineFetchHash?: string;
  pipelineIsReadOnly: boolean;
  view:
    | "pipeline"
    | "jupyter"
    | "jobs"
    | "environments"
    | "pipelines"
    | ({} & string);
  pipelineSaveStatus: "saved" | "saving" | ({} & string);
  sessions?: IOrchestSession[] | [];
  sessionsIsLoading?: boolean;
  sessionsKillAllInProgress?: boolean;
  config: IOrchestConfig;
  user_config: IOrchestUserConfig;
  unsavedChanges: boolean;
  _sessionsToFetch?: IOrchestSessionUuid[] | [];
  _sessionsToggle?: IOrchestSessionUuid;
  _sessionsIsPolling?: boolean;
}

export type TOrchestAction =
  | { type: "alert"; payload: IOrchestState["alert"] }
  | { type: "isLoaded" }
  | { type: "pipelineClear" }
  | {
      type: "pipelineSet";
      payload: Partial<
        Pick<IOrchestState, "pipeline_uuid" | "project_uuid" | "pipelineName">
      >;
    }
  | {
      type: "pipelineSetSaveStatus";
      payload: IOrchestState["pipelineSaveStatus"];
    }
  | {
      type: "projectSet";
      payload: IOrchestState["project_uuid"];
    }
  | { type: "setView"; payload: IOrchestState["view"] }
  | { type: "clearView" }
  | {
      type: "pipelineUpdateReadOnlyState";
      payload: IOrchestState["pipelineIsReadOnly"];
    }
  | { type: "drawerToggle" }
  | {
      type: "sessionToggle";
      payload: IOrchestSessionUuid;
    }
  | { type: "setUnsavedChanges"; payload: IOrchestState["unsavedChanges"] }
  | { type: "_sessionsToggleClear" }
  | {
      type: "_sessionsSet";
      payload: Pick<IOrchestState, "sessions" | "sessionsIsLoading">;
    }
  | { type: "sessionsKillAll" }
  | { type: "_sessionsKillAllClear" }
  | { type: "_sessionsPollingStart" }
  | { type: "_sessionsPollingClear" };

export interface IOrchestGet {
  currentSession: IOrchestSession;
  session: (
    session: Pick<IOrchestSession, "pipeline_uuid" | "project_uuid">
  ) => IOrchestSession;
}

export interface IOrchestContext {
  state: IOrchestState;
  dispatch: React.Dispatch<TOrchestAction>;
  get: IOrchestGet;
}
