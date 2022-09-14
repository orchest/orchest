import { JobChangesData, JobData, PipelineJson, StrategyJson } from "@/types";
import { omit } from "@/utils/record";
import create from "zustand";
import { jobsApi } from "./jobsApi";

export type JobsApi = {
  projectUuid?: string;
  jobs?: JobData[];
  setJobs: (
    value: JobData[] | undefined | ((jobs: JobData[]) => JobData[])
  ) => void;
  setJob: (uuid: string, value: JobData | ((job: JobData) => JobData)) => void;
  fetchAll: (projectUuid: string, language?: string) => Promise<JobData[]>;
  fetchOne: (
    jobUuid: string,
    aggregateRunStatuses?: boolean
  ) => Promise<JobData>;
  updateStatus: () => Promise<void>;
  post: (
    pipelineUuid: string,
    pipelineName: string,
    jobName: string
  ) => Promise<JobData | undefined>;
  put: (changes: JobChangesData) => Promise<void>;
  putJobPipelineUuid: (jobUuid: string, pipelineUuid: string) => Promise<void>;
  delete: (jobUuid: string) => Promise<void>;
  cancel: (jobUuid: string) => Promise<void>;
  duplicate: (jobUuid: string) => Promise<JobData>;
  resumeCronJob: (jobUuid: string) => Promise<void>;
  pauseCronJob: (jobUuid: string) => Promise<void>;
  triggerScheduledRuns: (jobUuid: string) => Promise<void>;
  fetchParameterStrategy: (props: {
    projectUuid: string;
    pipelineUuid: string;
    jobUuid: string;
    pipelineJson: PipelineJson;
    paramFilePath?: string;
    reservedKey: string | undefined;
  }) => Promise<StrategyJson | undefined>;
};

export const useJobsApi = create<JobsApi>((set, get) => {
  return {
    setJobs: (value) => {
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
    fetchAll: async (projectUuid) => {
      set({ projectUuid });
      const jobs = await jobsApi.fetchAll(projectUuid);

      set({ projectUuid, jobs });
      return jobs;
    },
    fetchOne: async (jobUuid, aggregateRunStatuses) => {
      const job = await jobsApi.fetchOne(jobUuid, aggregateRunStatuses);

      const projectUuid = job.project_uuid;

      if (projectUuid !== get().projectUuid) {
        const jobs = await jobsApi.fetchAll(projectUuid);
        set({ projectUuid, jobs });
      } else {
        set((state) => {
          const jobs = state.jobs?.map((existingJob) =>
            existingJob.uuid === jobUuid ? job : existingJob
          );
          return { jobs };
        });
      }

      return job;
    },
    updateStatus: async () => {
      try {
        const projectUuid = get().projectUuid;
        if (!projectUuid) return;
        const jobs = get().jobs;
        const fetchedJobData = await jobsApi.fetchAll(projectUuid);
        if (!jobs) return;

        const jobMap = new Map<string, JobData>(
          jobs.map((job) => [job.uuid, job])
        );

        const hasStatusChanged = fetchedJobData.some((jobData) => {
          const job = jobMap.get(jobData.uuid || "");
          return !job || job.status !== jobData.status;
        });

        if (hasStatusChanged) set({ jobs: fetchedJobData });
      } catch (error) {
        console.error(`Failed to fetch jobs. ${String(error)}`);
      }
    },
    post: async (
      pipelineUuid: string,
      pipelineName: string,
      jobName: string
    ) => {
      const projectUuid = get().projectUuid;
      if (!projectUuid) return;

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
        };
      });
      return draftJob;
    },
    put: async (changes: JobChangesData) => {
      try {
        await jobsApi.put(changes);
        set((state) => {
          const updatedJobs = (state.jobs || []).map((job) => {
            return job.uuid === changes.uuid
              ? {
                  ...job,
                  ...omit(changes, "confirm_draft"),
                }
              : job;
          });
          return { jobs: updatedJobs };
        });
      } catch (error) {
        if (!error?.isCanceled) console.error("Failed to put job changes.");
      }
    },
    putJobPipelineUuid: async (jobUuid: string, pipelineUuid: string) => {
      await jobsApi.putJobPipelineUuid(jobUuid, pipelineUuid);
    },
    delete: async (jobUuid) => {
      await jobsApi.delete(jobUuid);
      set((state) => {
        const jobs = (state.jobs || []).filter((job) => job.uuid !== jobUuid);
        return { jobs };
      });
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
    fetchParameterStrategy: async (props) => {
      const strategyJson = await jobsApi.fetchStrategyJson(props);
      return strategyJson;
    },
  };
});
