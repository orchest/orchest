import { PipelineData } from "@/types";
import { memoizeFor, MemoizePending } from "@/utils/promise";
import create from "zustand";
import { pipelinesApi } from "./pipelinesApi";

export type PipelinesApi = {
  pipelines: PipelineData[] | undefined;
  get: (projectUuid: string, pipelineUuid: string) => PipelineData | undefined;
  fetchAll: MemoizePending<() => Promise<void>>;
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
    get: (projectUuid: string, pipelineUuid: string) => {
      return get().pipelines?.find(
        ({ uuid, project_uuid }) =>
          uuid === pipelineUuid && project_uuid === projectUuid
      );
    },
    fetchAll: memoizeFor(500, async () => {
      const pipelines = await pipelinesApi.fetchAll();

      set({ pipelines });
    }),
    fetchOne: memoizeFor(500, async (projectUuid, pipelineUuid) => {
      const pipeline = await pipelinesApi.fetchOne(projectUuid, pipelineUuid);

      set({ pipelines: replaceOrAddPipeline(pipeline) });
    }),
  };
});
