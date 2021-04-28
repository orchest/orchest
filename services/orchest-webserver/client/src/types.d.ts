import React from "react";

type TOrchestFetchStatus =
  | "IDLE"
  | "FETCHING"
  | "SUCCESS"
  | "ERROR"
  | ({} & string);

export interface IOrchestSessionUuid {
  project_uuid: string;
  pipeline_uuid: string;
}

export interface IOrchestSession extends IOrchestSessionUuid {
  project_uuid: string;
  pipeline_uuid: string;
  status: "RUNNING" | "LAUNCHING" | "STOPPED" | "STOPPING";
  baseUrl: string;
}

interface IOrchestSessionToggle {
  operation: "LAUNCH" | "READ" | "DELETE" | ({} & string);
  session: Partial<IOrchestSessionUuid>;
}

export interface IOrchestState
  extends Pick<IOrchestSession, "project_uuid" | "pipeline_uuid"> {
  alert?: string[];
  isLoading: boolean;
  drawerIsOpen: boolean;
  pipelineName?: string;
  pipelineFetchHash?: string;
  pipelineIsReadOnly: boolean;
  viewCurrent: "pipeline" | "jupyter" | ({} & string);
  pipelineSaveStatus: "saved" | "saving" | ({} & string);
  _useSessionsUuids?: IOrchestSessionUuid[] | [];
  _useSessionsToggle?: IOrchestSessionUuid;
}

export type TOrchestAction =
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
  | { type: "viewUpdateCurrent"; payload: IOrchestState["viewCurrent"] }
  | {
      type: "pipelineUpdateReadOnlyState";
      payload: IOrchestState["pipelineIsReadOnly"];
    }
  | { type: "drawerToggle" }
  | { type: "sessionFetch"; payload: IOrchestSessionUuid }
  | {
      type: "sessionToggle";
      payload: IOrchestSessionUuid;
    };

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
