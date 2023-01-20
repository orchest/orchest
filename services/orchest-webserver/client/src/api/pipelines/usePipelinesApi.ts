import { PipelineMetaData } from "@/types";
import { join } from "@/utils/path";
import { memoized, MemoizePending } from "@/utils/promise";
import create from "zustand";
import { pipelinesApi } from "./pipelinesApi";

export type PipelinesApi = {
  pipelines: PipelineMetaData[] | undefined;
  /**
   * Finds the pipeline matching the `projectUuid` and `pipelineUuid`
   * Note: Both UUIDs are required as pipeline UUIDs are only unique within a project.
   */
  find: (
    projectUuid: string,
    pipelineUuid: string
  ) => PipelineMetaData | undefined;
  /** Fetches all pipelines for all projects. */
  fetchAll: MemoizePending<() => Promise<void>>;
  /**
   * Fetches pipelines for a specific project.
   * Note: This function is no-op if the project UUID is undefined.
   */
  fetchForProject: MemoizePending<
    (projectUuid: string | undefined) => Promise<void>
  >;
  /** Deletes a pipeline from the project */
  delete: MemoizePending<
    (
      projectUuid: string | undefined,
      pipelineUuid: string | undefined
    ) => Promise<void>
  >;
};

export const usePipelinesApi = create<PipelinesApi>((set, get) => {
  const mergePipelines = (newPipelines: PipelineMetaData[]) => {
    const allPipelines = [...(get().pipelines ?? []), ...newPipelines];
    const unique: Record<string, PipelineMetaData> = {};

    for (const pipeline of allPipelines) {
      unique[join(pipeline.project_uuid, pipeline.uuid)] = pipeline;
    }

    return Object.values(unique);
  };

  return {
    pipelines: undefined,
    find: (projectUuid: string, pipelineUuid: string) => {
      return get().pipelines?.find(
        ({ uuid, project_uuid }) =>
          uuid === pipelineUuid && project_uuid === projectUuid
      );
    },
    fetchAll: memoized(async () => {
      const pipelines = await pipelinesApi.fetchAll();

      set({ pipelines });
    }),
    fetchForProject: memoized(async (projectUuid) => {
      if (!projectUuid) return;

      const pipelines = await pipelinesApi.fetchForProject(projectUuid);

      set({ pipelines: mergePipelines(pipelines) });
    }),
    delete: memoized(async (projectUuid, pipelineUuid) => {
      if (!projectUuid || !pipelineUuid) return;

      await pipelinesApi.deletePipeline(projectUuid, pipelineUuid);

      set(({ pipelines }) => ({
        pipelines: pipelines?.filter(
          (pipeline) =>
            !(
              pipeline.project_uuid === projectUuid &&
              pipeline.uuid === pipelineUuid
            )
        ),
      }));
    }),
  };
});
