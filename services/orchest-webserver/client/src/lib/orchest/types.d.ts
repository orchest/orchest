export type TOrchestState = {
  isLoading: boolean;
  isDrawerOpen: boolean;
  pipelineName?: string;
  pipelineFetchHash?: string;
  pipeline_uuid: string;
  project_uuid: string;
  sessionActive: boolean;
  readOnlyPipeline: boolean;
  viewShowing: "pipeline" | "jupyter" | ({} & string);
  pipelineSaveStatus: "saved" | "saving" | ({} & string);
  onSessionStateChange?: (
    working?: boolean,
    running?: boolean,
    session_details?: any
  ) => void;
  onSessionFetch?: (session_details?: any) => void;
  onSessionShutdown?: () => void;
};

export type TOrchestAction =
  | { type: "isLoaded" }
  | { type: "clearPipeline" }
  | {
      type: "setPipeline";
      payload: Partial<
        Pick<TOrchestState, "pipeline_uuid" | "project_uuid" | "pipelineName">
      >;
    }
  | {
      type: "setPipelineSaveStatus";
      payload: TOrchestState["pipelineSaveStatus"];
    }
  | { type: "updateCurrentView"; payload: TOrchestState["viewShowing"] }
  | {
      type: "setSessionListeners";
      payload: Partial<
        Pick<
          TOrchestState,
          "onSessionStateChange" | "onSessionFetch" | "onSessionShutdown"
        >
      >;
    }
  | { type: "clearSessionListeners" }
  | { type: "toggleSession" }
  | { type: "toggleDrawer" };
