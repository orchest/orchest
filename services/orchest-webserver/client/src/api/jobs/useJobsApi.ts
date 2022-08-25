import { JobChangesData, JobData, JobStatus } from "@/types";
import { omit } from "@/utils/record";
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
        changes.confirm_draft;

        const isDraftJob = changes.confirm_draft === true;

        const shouldStartDraftJobNow =
          isDraftJob && !changes.schedule && !changes.next_scheduled_time;

        const status: JobStatus = shouldStartDraftJobNow
          ? "STARTED"
          : "PENDING";

        const jobChanges = isDraftJob
          ? { ...omit(changes, "confirm_draft"), status } // Only assign status for registering a draft job.
          : changes;

        set((state) => {
          const jobs = (state.jobs || []).map((job) =>
            job.uuid === changes.uuid ? { ...job, ...jobChanges } : job
          );
          return { jobs };
        });
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
    clearError: () => {
      set({ error: undefined });
    },
  };
});
