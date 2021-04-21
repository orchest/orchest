export type TOrchestState = {
  isLoading: boolean;
  drawerIsOpen: boolean;
  pipelineName?: string;
  pipelineFetchHash?: string;
  pipeline_uuid: string;
  project_uuid: string;
  sessionActive: boolean;
  sessionWorking?: boolean;
  sessionRunning?: boolean;
  onSessionStateChange?: (
    working?: boolean,
    running?: boolean,
    session_details?: any
  ) => void;
  onSessionFetch?: (session_details?: any) => void;
  onSessionShutdown?: () => void;
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
  | { type: "sessionCancelPromises" }
  | {
      type: "sessionToggle";
    };
