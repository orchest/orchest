import { JobData } from "@/types";
import { memoizeFor, MemoizePending } from "@/utils/promise";
import { mapRecord } from "@/utils/record";
import create from "zustand";
import { jobsApi } from "./jobsApi";

export type JobMap = { [jobUuid: string]: JobData };

export type JobsApi = {
  jobs: JobMap | undefined;
  fetchOne: MemoizePending<(jobUuid: string) => Promise<JobData | undefined>>;
  fetchAll: MemoizePending<() => Promise<JobData[]>>;
};

export const useJobsApi = create<JobsApi>((set) => {
  return {
    jobs: undefined,
    fetchOne: memoizeFor(500, async (jobUuid) => {
      const job = await jobsApi.fetchOne(jobUuid, true);

      if (!job) return undefined;

      set(({ jobs }) => ({ jobs: { ...jobs, [job.uuid]: job } }));

      return job;
    }),
    fetchAll: memoizeFor(500, async () => {
      const jobs = await jobsApi.fetchAll();

      set({ jobs: mapRecord(jobs, "uuid") });

      return jobs;
    }),
  };
});
