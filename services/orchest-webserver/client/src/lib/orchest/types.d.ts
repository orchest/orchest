type TFetchStatus = "IDLE" | "FETCHING" | "SUCCESS" | "ERROR";

export type TOrchestState = {
  alert?: string[];
  isLoading: boolean;
  drawerIsOpen: boolean;
  pipelineName?: string;
  pipelineFetchHash?: string;
  pipeline_uuid: string;
  project_uuid: string;
  sessionLaunchStatus?: TFetchStatus;
  sessionDeleteStatus?: TFetchStatus;
  sessionFetchStatus?: TFetchStatus;
  sessions?:
    | [
        {
          // id
          // concatenated uuid : project_uuid + pipeline_uuid
          project_uuid: TOrchestState["project_uuid"];
          pipeline_uuid: TOrchestState["pipeline_uuid"];
          status: "RUNNING" | "LAUNCHING" | "STOPPED" | "STOPPING";
          baseUrl: string;
        }
      ]
    | [];
  pipelineIsReadOnly: boolean;
  viewCurrent: "pipeline" | "jupyter" | ({} & string);
  pipelineSaveStatus: "saved" | "saving" | ({} & string);
};

export type TOrchestAction =
  | { type: "isLoaded" }
  | { type: "pipelineClear" }
  | {
      type: "pipelineSet";
      payload: Partial<
        Pick<TOrchestState, "pipeline_uuid" | "project_uuid" | "pipelineName">
      >;
    }
  | {
      type: "pipelineSetSaveStatus";
      payload: TOrchestState["pipelineSaveStatus"];
    }
  | { type: "viewUpdateCurrent"; payload: TOrchestState["viewCurrent"] }
  | {
      type: "sessionSetListeners";
      payload: Partial<
        Pick<
          TOrchestState,
          "onSessionStateChange" | "onSessionFetch" | "onSessionShutdown"
        >
      >;
    }
  | { type: "sessionClearListeners" }
  | {
      type: "pipelineUpdateReadOnlyState";
      payload: TOrchestState["pipelineIsReadOnly"];
    }
  | { type: "drawerToggle" }
  | { type: "sessionFetch" }
  | {
      type: "sessionUpdate";
      payload: Pick<
        TOrchestState,
        "sessionDeleteStatus" | "sessionFetchStatus" | "sessionLaunchStatus"
      > & {
        session?: Omit<
          Partial<TOrchestState["sessions"][number]>,
          "pipeline_uuid" | "project_uuid"
        >;
      };
    }
  | {
      type: "sessionToggle";
    };
