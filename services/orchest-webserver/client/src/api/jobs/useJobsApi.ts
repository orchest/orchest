import { JobData } from "@/types";
import { FetchError } from "@orchest/lib-utils";
import create from "zustand";
import { jobsApi } from "./jobsApi";

export type JobsApi = {
  projectUuid?: string;
  jobs?: JobData[];
  setJob: (uuid: string, value: Partial<JobData>) => void;
  isFetchingAll: boolean;
  fetch: (projectUuid: string, language?: string) => Promise<void>;
  isPosting: boolean;
  post: (
    pipelineUuid: string,
    pipelineName: string,
    jobName: string
  ) => Promise<JobData | undefined>;
  error?: FetchError;
};

export const useJobsApi = create<JobsApi>((set, get) => {
  const getProjectUuid = (): string => {
    const projectUuid = get().projectUuid;
    if (!projectUuid) {
      throw new Error("projectUuid unavailable");
    }
    return projectUuid;
  };
  return {
    setJob: (uuid, payload) => {
      set((state) => {
        return {
          jobs: (state.jobs || []).map((job) =>
            job.uuid === uuid ? { ...job, ...payload } : job
          ),
        };
      });
    },
    isFetchingAll: false,
    fetch: async (projectUuid) => {
      try {
        set({ projectUuid, isFetchingAll: true, error: undefined });
        const jobs = await jobsApi.fetchAll(projectUuid);

        set({ projectUuid, jobs, isFetchingAll: false });
      } catch (error) {
        if (!error?.isCanceled) set({ error, isFetchingAll: false });
      }
    },
    isPosting: false,
    post: async (
      pipelineUuid: string,
      pipelineName: string,
      jobName: string
    ) => {
      try {
        const projectUuid = getProjectUuid();
        set({ isPosting: true, error: undefined });
        const draftJob = await jobsApi.post(
          projectUuid,
          pipelineUuid,
          pipelineName,
          jobName
        );
        set((state) => {
          const jobs = state.jobs ? [draftJob, ...state.jobs] : [draftJob];
          return {
            jobs: jobs.sort((a, b) => -1 * a.name.localeCompare(b.name)),
            isPosting: false,
          };
        });
        return draftJob;
      } catch (error) {
        set({ error, isPosting: false });
      }
    },
  };
});
