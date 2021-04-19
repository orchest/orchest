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
  pipelineSaveStatus: "saved" | ({} & string);
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
  | { type: "onSessionStateChange" }
  | { type: "onSessionShutdown" }
  | { type: "onSessionFetch" }
  | { type: "toggleDrawer" };
