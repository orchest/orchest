import { shallowEqualByKey } from "@/environments-view/common";
import { useAutoSave } from "@/hooks/useAutoSave";
import type { JobChangesData } from "@/types";

export const isJobChanged = (prev: JobChangesData, curr: JobChangesData) =>
  !shallowEqualByKey(prev, curr, [
    "name",
    "schedule",
    "next_scheduled_time",
    "env_variables",
    "strategy_json",
    "max_retained_pipeline_runs",
    "parameters",
  ]);

export const useAutoSaveJob = (
  value: JobChangesData | undefined,
  save: () => void
) => {
  useAutoSave(value, save, (prev, curr) => {
    const isLoadingPage = !prev || !curr;
    if (isLoadingPage) return false;
    const isRedirectingToAnotherJob = prev.uuid !== curr.uuid;
    if (isRedirectingToAnotherJob) return false;
    return isJobChanged(prev, curr);
  });
};
