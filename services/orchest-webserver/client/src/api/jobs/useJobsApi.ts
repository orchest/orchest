import { JobChangesData, JobData } from "@/types";
import { FetchError } from "@orchest/lib-utils";
import create from "zustand";
import { jobsApi } from "./jobsApi";

export type JobsApi = {
  projectUuid?: string;
  jobs?: JobData[];
  setJobs: (value: JobData[] | ((jobs: JobData[]) => JobData[])) => void;
  setJob: (uuid: string, value: JobData | ((job: JobData) => JobData)) => void;
  isFetching: boolean;
  fetchAll: (projectUuid: string, language?: string) => Promise<void>;
  fetch: (
    jobUuid: string,
    aggregateRunStatuses?: boolean
  ) => Promise<JobData | undefined>;
  updateStatus: () => Promise<void>;
  isPosting: boolean;
  post: (
    pipelineUuid: string,
    pipelineName: string,
    jobName: string
  ) => Promise<JobData | undefined>;
  put: (changes: JobChangesData) => Promise<void>;
  isDeleting: boolean;
  delete: (jobUuid: string) => Promise<void>;
  cancel: (jobUuid: string) => Promise<void>;
  duplicate: (jobUuid: string) => Promise<JobData>;
  resumeCronJob: (jobUuid: string) => Promise<void>;
  pauseCronJob: (jobUuid: string) => Promise<void>;
  triggerScheduledRuns: (jobUuid: string) => Promise<void>;
  hasLoadedParameterStrategyFile: boolean | undefined;
  resetHasLoadedParameterStrategyFile: () => void;
  fetchParameterStrategy: (
    jobData: JobData,
    reservedKey: string | undefined
  ) => Promise<void>;
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
    setJob: (uuid: string, value: JobData | ((job: JobData) => JobData)) => {
      set((state) => {
        return {
          jobs: (state.jobs || []).map((job) => {
            if (job.uuid === uuid) {
              const updatedJob = value instanceof Function ? value(job) : value;
              return updatedJob;
            }
            return job;
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
    fetch: async (jobUuid, aggregateRunStatuses) => {
      try {
        set({ isFetching: true, error: undefined });
        const job = await jobsApi.fetch(jobUuid, aggregateRunStatuses);

        const projectUuid = job.project_uuid;

        if (projectUuid !== get().projectUuid) {
          const jobs = await jobsApi.fetchAll(projectUuid);
          set({ projectUuid, jobs, isFetching: false });
        } else {
          set((state) => {
            const jobs = state.jobs?.map((existingJob) =>
              existingJob.uuid === jobUuid ? job : existingJob
            );
            return { jobs, isFetching: false };
          });
        }

        return job;
      } catch (error) {
        if (!error?.isCanceled) set({ error, isFetching: false });
      }
    },
    updateStatus: async () => {
      try {
        const projectUuid = getProjectUuid();
        const jobs = get().jobs;
        const fetchedJobData = await jobsApi.fetchAll(projectUuid);

        if (!jobs || fetchedJobData instanceof Error) {
          return;
        }

        const jobMap = new Map<string, JobData>(
          jobs.map((job) => [job.uuid, job])
        );

        const hasStatusChanged = fetchedJobData.some((jobData) => {
          const job = jobMap.get(jobData.uuid || "");
          return !job || job.status !== jobData.status;
        });

        if (hasStatusChanged) set({ jobs: fetchedJobData });
      } catch (error) {
        console.error(
          `Failed to fetch most recent environment builds. ${String(error)}`
        );
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
      } catch (error) {
        set({ error });
      }
    },
    isDeleting: false,
    delete: async (jobUuid) => {
      set({ isDeleting: true, error: undefined });
      try {
        await jobsApi.delete(jobUuid);
        set((state) => {
          const jobs = (state.jobs || []).filter((job) => job.uuid !== jobUuid);
          return { jobs, isDeleting: false };
        });
      } catch (error) {
        set({ error });
      }
    },
    cancel: async (jobUuid) => {
      set((state) => {
        const jobs: JobData[] = (state.jobs || []).map((job) =>
          job.uuid === jobUuid ? { ...job, status: "ABORTED" } : job
        );
        return { jobs };
      });
      await jobsApi.cancel(jobUuid);
    },
    duplicate: async (jobUuid) => {
      const duplicatedJob = await jobsApi.duplicate(jobUuid);
      set((state) => {
        const jobs = state.jobs || [];
        const originalJobIndex = jobs.findIndex((job) => job.uuid === jobUuid);
        jobs.splice(originalJobIndex + 1, 0, duplicatedJob);
        return { jobs };
      });
      return duplicatedJob;
    },
    resumeCronJob: async (jobUuid) => {
      set((state) => {
        const jobs: JobData[] = (state.jobs || []).map((job) =>
          job.uuid === jobUuid ? { ...job, status: "STARTED" } : job
        );
        return { jobs };
      });
      await jobsApi.resumeCronJob(jobUuid);
    },
    pauseCronJob: async (jobUuid) => {
      set((state) => {
        const jobs: JobData[] = (state.jobs || []).map((job) =>
          job.uuid === jobUuid ? { ...job, status: "PAUSED" } : job
        );
        return { jobs };
      });
      await jobsApi.pauseCronJob(jobUuid);
    },
    triggerScheduledRuns: async (jobUuid) => {
      set((state) => {
        const jobs: JobData[] = (state.jobs || []).map((job) =>
          job.uuid === jobUuid ? { ...job, status: "STARTED" } : job
        );
        return { jobs };
      });

      const { next_scheduled_time } = await jobsApi.triggerScheduledRuns(
        jobUuid
      );

      set((state) => {
        const jobs: JobData[] = (state.jobs || []).map((job) =>
          job.uuid === jobUuid ? { ...job, next_scheduled_time } : job
        );
        return { jobs };
      });
    },
    hasLoadedParameterStrategyFile: undefined,
    fetchParameterStrategy: async (jobData, reservedKey) => {
      const strategyJson = await jobsApi.fetchStrategyJson(
        jobData,
        reservedKey
      );
      set((state) => {
        if (strategyJson) {
          const jobs = state.jobs?.map((job) =>
            job.uuid === jobData.uuid
              ? { ...job, strategy_json: strategyJson }
              : job
          );
          return { jobs, hasLoadedParameterStrategyFile: true };
        } else {
          return { hasLoadedParameterStrategyFile: false };
        }
      });
    },
    resetHasLoadedParameterStrategyFile: () => {
      set({ hasLoadedParameterStrategyFile: undefined });
    },
    clearError: () => {
      set({ error: undefined });
    },
  };
});
