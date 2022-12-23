import { usePollPipelineRuns } from "@/hooks/usePollPipelineRuns";

export const AllRunsTab = () => {
  const { runs: interactiveRuns } = usePollPipelineRuns(3000);

  return null;
};
