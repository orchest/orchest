import { JobChangesData, JobData } from "@/types";
import { FetchError } from "@orchest/lib-utils";
import create from "zustand";
import { jobsApi } from "./jobsApi";

export type JobsApi = {
  projectUuid?: string;
  jobs?: JobData[];
  setJobs: (value: JobData[] | ((jobs: JobData[]) => JobData[])) => void;
  setJob: (value: JobData) => void;
  isFetching: boolean;
  fetchAll: (projectUuid: string, language?: string) => Promise<void>;
  isPosting: boolean;
  post: (
    pipelineUuid: string,
    pipelineName: string,
    jobName: string
  ) => Promise<JobData | undefined>;
  error?: FetchError;
  clearError: () => void;
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
    setJobs: (value: JobData[] | ((jobs: JobData[]) => JobData[])) => {
      set((state) => {
        const updatedJobs =
          value instanceof Function ? value(state.jobs || []) : value;
        return { jobs: updatedJobs };
      });
    },
    setJob: (value: JobData) => {
      set((state) => {
        return {
          jobs: (state.jobs || []).map((job) => {
            return job.uuid === value.uuid ? value : job;
          }),
        };
      });
    },
    isFetching: false,
    fetchAll: async (projectUuid) => {
      try {
        set({ projectUuid, isFetching: true, error: undefined });
        const jobs = await jobsApi.fetchAll(projectUuid);

        set({ projectUuid, jobs, isFetching: false });
      } catch (error) {
        if (!error?.isCanceled) set({ error, isFetching: false });
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
    put: async (changes: JobChangesData) => {
      try {
        await jobsApi.put(changes);

        set((state) => {
          const jobs = (state.jobs || []).map((job) =>
            job.uuid === changes.uuid ? { ...job, ...changes } : job
          );
          return { jobs };
        });
      } catch (error) {
        set({ error });
      }
    },
    clearError: () => {
      set({ error: undefined });
    },
  };
});
