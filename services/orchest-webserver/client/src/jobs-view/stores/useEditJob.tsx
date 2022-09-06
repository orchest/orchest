import { JobChanges } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import create from "zustand";

export type EditJobType = "draft" | "active-cronjob" | "uneditable";

export const getEditJobType = (jobChanges: JobChanges | undefined) => {
  if (!jobChanges) return undefined;

  const isDraft = jobChanges?.status === "DRAFT";
  if (isDraft) return "draft";

  const jobFinished =
    jobChanges?.status === "ABORTED" ||
    jobChanges?.status === "FAILURE" ||
    jobChanges?.status === "SUCCESS";

  if (jobFinished) return "uneditable";

  const isActiveCronJob =
    !jobFinished && !isDraft && hasValue(jobChanges?.schedule);

  if (isActiveCronJob) return "active-cronjob";
};

export type JobChangesState = {
  isEditing: boolean;
  startEditingActiveCronJob: () => void;
  discardActiveCronJobChanges: () => void;
  saveActiveCronJobChanges: () => void;
  jobChanges?: JobChanges;
  cronJobChanges?: JobChanges;
  initJobChanges: (payload: JobChanges | undefined) => void;
  setJobChanges: (
    payload: Partial<JobChanges> | ((state: JobChanges) => Partial<JobChanges>)
  ) => void;
  resetJobChanges: () => void;
};

export const useEditJob = create<JobChangesState>((set) => ({
  isEditing: false,
  startEditingActiveCronJob: () => {
    set((state) => {
      const jobChanges = state.jobChanges;
      if (!jobChanges) return state;
      const editJobType = getEditJobType(jobChanges);
      return { isEditing: editJobType !== "uneditable" };
    });
  },
  discardActiveCronJobChanges: () => {
    set({
      cronJobChanges: undefined,
      isEditing: false,
    });
  },
  saveActiveCronJobChanges: () => {
    set((state) => {
      return {
        jobChanges: state.cronJobChanges,
        cronJobChanges: undefined,
        isEditing: false,
      };
    });
  },
  initJobChanges: (value) => {
    set({ jobChanges: value });
  },
  setJobChanges: (value) => {
    set((state) => {
      if (!state.jobChanges) return state;

      const editJobType = getEditJobType(state.jobChanges);

      const isEditingActiveCronJob =
        state.isEditing && editJobType === "active-cronjob";

      if (isEditingActiveCronJob) {
        const cronJobChanges =
          value instanceof Function
            ? value(state.cronJobChanges || state.jobChanges)
            : value;
        return {
          cronJobChanges: {
            ...state.cronJobChanges,
            ...cronJobChanges,
          } as JobChanges,
        };
      }

      const changes =
        value instanceof Function ? value(state.jobChanges) : value;
      return {
        jobChanges: { ...state.jobChanges, ...changes },
      };
    });
  },
  resetJobChanges: () => set({ jobChanges: undefined }),
}));
