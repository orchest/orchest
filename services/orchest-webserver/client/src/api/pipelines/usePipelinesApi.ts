import { PipelineData, PipelineJson, PipelineState } from "@/types";
import { prune } from "@/utils/record";
import { FetchError } from "@orchest/lib-utils";
import create from "zustand";
import { pipelineJsonApi } from "./pipelineJsonApi";
import { pipelinesApi } from "./pipelinesApi";

export type PipelinesApi = {
  projectUuid?: string;
  pipelines?: PipelineState[];
  isFetching: boolean;
  fetchAllInProject: (projectUuid: string) => Promise<void>;
  fetch: (
    projectUuid: string,
    pipelineUuid: string
  ) => Promise<[PipelineData, PipelineJson] | undefined>;
  fetchPipelineJson: (
    projectUuid: string,
    pipelineUuid: string
  ) => Promise<PipelineJson | undefined>;
  fetchSnapshot: (
    projectUuid: string,
    pipelineUuid: string,
    jobUuid: string,
    pipelineRunUuid: string
  ) => Promise<PipelineJson | undefined>;
  post: (projectUuid: string, path: string, name?: string) => Promise<string>;
  put: (
    projectUuid: string,
    pipelineUuid: string,
    changes: Partial<PipelineState>
  ) => Promise<void>;
  isDeleting: boolean;
  delete: (projectUuid: string, pipelineUuid: string) => Promise<void>;
  error?: FetchError;
  clearError: () => void;
};

export const usePipelinesApi = create<PipelinesApi>((set, get) => {
  return {
    isFetching: false,
    fetchAllInProject: async (projectUuid) => {
      set({ projectUuid, isFetching: true, error: undefined });
      try {
        const fetchedPipelines = await pipelinesApi.fetchAllInProject(
          projectUuid
        );
        if (!get().projectUuid || projectUuid !== get().projectUuid) {
          set({ projectUuid, pipelines: fetchedPipelines, isFetching: false });
        } else {
          set((state) => {
            const pipelinesMap = new Map(
              (state.pipelines || []).map((p) => [p.uuid, p])
            );
            fetchedPipelines.forEach((fetchedPipeline) => {
              const pipeline = pipelinesMap.get(fetchedPipeline.uuid);
              pipelinesMap.set(fetchedPipeline.uuid, {
                ...pipeline,
                ...fetchedPipeline,
              });
            });
            return {
              pipelines: Array.from(pipelinesMap.values()),
              isFetching: false,
            };
          });
        }
      } catch (error) {
        if (!error?.isCanceled) set({ error, isFetching: false });
      }
    },
    fetch: async (projectUuid: string, pipelineUuid: string) => {
      set({ isFetching: true, error: undefined });

      try {
        if (projectUuid !== get().projectUuid) return;
        const [pipelineData, pipelineJson] = await Promise.all([
          pipelinesApi.fetch(projectUuid, pipelineUuid),
          pipelineJsonApi.fetch(projectUuid, pipelineUuid),
        ]);

        const pipelines = (get().pipelines || []).map((pipeline) =>
          pipeline.uuid === pipelineUuid
            ? { ...pipeline, ...pipelineData, definition: pipelineJson }
            : pipeline
        );

        set({ projectUuid, pipelines, isFetching: false });
        return [pipelineData, pipelineJson];
      } catch (error) {
        if (!error?.isCanceled) set({ error, isFetching: false });
      }
    },
    fetchPipelineJson: async (projectUuid: string, pipelineUuid: string) => {
      set({ isFetching: true, error: undefined });

      try {
        if (projectUuid !== get().projectUuid) return;
        const pipelineJson = await pipelineJsonApi.fetch(
          projectUuid,
          pipelineUuid
        );

        const pipelines = (get().pipelines || []).map((pipeline) =>
          pipeline.uuid === pipelineUuid
            ? { ...pipeline, definition: pipelineJson }
            : pipeline
        );

        set({ projectUuid, pipelines, isFetching: false });
        return pipelineJson;
      } catch (error) {
        if (!error?.isCanceled) set({ error, isFetching: false });
      }
    },
    fetchSnapshot: async (
      projectUuid: string,
      pipelineUuid: string,
      jobUuid: string,
      pipelineRunUuid: string
    ) => {
      set({ isFetching: true, error: undefined });

      try {
        if (projectUuid !== get().projectUuid) return;

        const snapshot = await pipelineJsonApi.fetch(
          projectUuid,
          pipelineUuid,
          jobUuid,
          pipelineRunUuid
        );

        const pipelines = (get().pipelines || []).map((pipeline) =>
          pipeline.uuid === pipelineUuid ? { ...pipeline, snapshot } : pipeline
        );

        set({ projectUuid, pipelines, isFetching: false });
        return snapshot;
      } catch (error) {
        if (!error?.isCanceled) set({ error, isFetching: false });
      }
    },
    post: async (projectUuid, path, name) => {
      const uuid = await pipelinesApi.post(projectUuid, path, name);

      set((state) => {
        const existingPipelines = state.pipelines || [];
        return {
          pipelines: [
            ...existingPipelines,
            { uuid, path, name, project_uuid: projectUuid },
          ],
        };
      });

      return uuid;
    },
    put: async (projectUuid, pipelineUuid, changes) => {
      try {
        if (projectUuid !== get().projectUuid) return;

        const { definition, ...pipelineChanges } = changes;
        const prunedPipelineChanges = prune(
          pipelineChanges as Partial<Omit<PipelineState, "definition">>
        );

        set((state) => {
          return {
            pipelines: (state.pipelines || []).map((pipeline) =>
              pipeline.uuid === pipelineUuid
                ? { ...pipeline, ...changes }
                : pipeline
            ),
          };
        });

        const putPipeline =
          Object.keys(prunedPipelineChanges).length > 0
            ? pipelinesApi.put(projectUuid, pipelineUuid, prunedPipelineChanges)
            : undefined;

        const putPipelineJson = definition
          ? pipelineJsonApi.put(projectUuid, pipelineUuid, definition)
          : undefined;

        await Promise.all([putPipeline, putPipelineJson].filter(Boolean));
      } catch (error) {
        set({ error });
      }
    },
    isDeleting: false,
    delete: async (projectUuid, pipelineUuid) => {
      if (projectUuid !== get().projectUuid) return;

      set({ isDeleting: true, error: undefined });
      try {
        await pipelinesApi.delete(projectUuid, pipelineUuid);
        set((state) => ({
          pipelines: (state.pipelines || []).filter(
            (pipeline) => pipeline.uuid !== pipelineUuid
          ),
        }));
      } catch (error) {
        if (!error?.isCanceled) set({ error, isDeleting: false });
      }
    },
    clearError: () => {
      set({ isDeleting: false, error: undefined });
    },
  };
});
