import { PipelineJsonState } from "@/types";
import { memoizeFor, MemoizePending } from "@/utils/promise";
import create from "zustand";
import { FetchPipelineJsonParams, pipelineJsonApi } from "./pipelineJsonApi";

export type PipelineMap = { [pipelineUuid: string]: PipelineJsonState };

export type PipelineJsonApi = {
  pipelines: PipelineMap;
  fetchOne: MemoizePending<(params: FetchPipelineJsonParams) => Promise<void>>;
};

/** Acts as the primary store for pipeline definitions. */
export const usePipelineJsonApi = create<PipelineJsonApi>((set) => {
  return {
    pipelines: {},
    fetchOne: memoizeFor(500, async (params) => {
      const data = await pipelineJsonApi.fetchOne(params);

      set((api) => ({
        pipelines: { ...api.pipelines, [params.pipelineUuid]: data },
      }));
    }),
  };
});
