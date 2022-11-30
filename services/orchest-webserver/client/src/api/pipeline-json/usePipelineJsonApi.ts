import { PipelineState } from "@/types";
import { memoizeFor, MemoizePending } from "@/utils/promise";
import create from "zustand";
import { FetchPipelineJsonParams, pipelineJsonApi } from "./pipelineJsonApi";

export type DefinitionMap = { [pipelineUuid: string]: PipelineState };

export type PipelineJsonApi = {
  definitions: DefinitionMap;
  fetchOne: MemoizePending<(params: FetchPipelineJsonParams) => Promise<void>>;
};

/** Acts as the primary store for pipeline definitions. */
export const usePipelineJsonApi = create<PipelineJsonApi>((set) => {
  return {
    definitions: {},
    fetchOne: memoizeFor(500, async (params) => {
      const data = await pipelineJsonApi.fetchOne(params);

      set((api) => ({
        definitions: { ...api.definitions, [params.pipelineUuid]: data },
      }));
    }),
  };
});
