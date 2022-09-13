import { PipelineData } from "@/types";
import { memoizeFor, MemoizePending } from "@/utils/promise";
import create from "zustand";
import { pipelinesApi } from "./pipelinesApi";

export type PipelinesApi = {
  pipelines: PipelineData[] | undefined;
  fetchOne: MemoizePending<
    (projectUuid: string, pipelineUuid: string) => Promise<void>
  >;
};

export const usePipelinesApi = create<PipelinesApi>((set, get) => {
  const replaceOrAddPipeline = (newPipeline: PipelineData) => {
    const { pipelines = [] } = get();

    if (!pipelines.find((pipeline) => pipeline.uuid === newPipeline.uuid)) {
      return [...pipelines, newPipeline];
    } else {
      return pipelines.map((pipeline) =>
        pipeline.uuid === newPipeline.uuid ? newPipeline : pipeline
      );
    }
  };

  return {
    pipelines: undefined,
    fetchOne: memoizeFor(1000, async (projectUuid, pipelineUuid) => {
      const pipeline = await pipelinesApi.fetchOne(projectUuid, pipelineUuid);

      set({ pipelines: replaceOrAddPipeline(pipeline) });
    }),
  };
});
