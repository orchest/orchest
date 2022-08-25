import { PipelineJson } from "@/types";
import { FetchError } from "@orchest/lib-utils";
import create from "zustand";
import { pipelineJsonApi } from "./pipelineJsonApi";

export type PipelineJsonApi = {
  projectUuid?: string;
  pipelineJson?: PipelineJson;
  isFetching: boolean;
  fetch: (
    projectUuid: string,
    pipelineUuid: string,
    jobUuid?: string | undefined,
    pipelineRunUuid?: string | undefined
  ) => Promise<PipelineJson | undefined>;
  put: (
    pipelineUuid: string,
    payload: Partial<PipelineJson>
  ) => Promise<PipelineJson | undefined>;
  error?: FetchError;
  clearError: () => void;
};

export const usePipelineJsonApi = create<PipelineJsonApi>((set, get) => {
  const getProjectUuid = (): string => {
    const projectUuid = get().projectUuid;
    if (!projectUuid) {
      throw new Error("projectUuid unavailable");
    }
    return projectUuid;
  };
  const getPipelineJson = (): PipelineJson => {
    const pipelineJson = get().pipelineJson;
    if (!pipelineJson) {
      throw new Error("pipelineJson unavailable");
    }
    return pipelineJson;
  };
  return {
    isFetching: false,
    fetch: async (
      projectUuid: string,
      pipelineUuid: string,
      jobUuid?: string | undefined,
      pipelineRunUuid?: string | undefined
    ) => {
      try {
        set({ projectUuid, isFetching: true, error: undefined });
        const pipelineJson = await pipelineJsonApi.fetch(
          projectUuid,
          pipelineUuid,
          jobUuid,
          pipelineRunUuid
        );

        set({ projectUuid, pipelineJson, isFetching: false });
        return pipelineJson;
      } catch (error) {
        if (!error?.isCanceled) set({ error, isFetching: false });
      }
    },
    put: async (pipelineUuid, changes) => {
      try {
        const projectUuid = getProjectUuid();
        const pipelineJson = getPipelineJson();

        const updatedPipelineJson = { ...pipelineJson, ...changes };

        await pipelineJsonApi.put(
          projectUuid,
          pipelineUuid,
          updatedPipelineJson
        );
        return updatedPipelineJson;
      } catch (error) {
        set({ error });
      }
    },
    clearError: () => {
      set({ error: undefined });
    },
  };
});
