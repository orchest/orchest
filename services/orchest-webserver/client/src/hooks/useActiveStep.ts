import { usePipelineDataContext } from "@/pipeline-view/contexts/PipelineDataContext";
import { useCustomRoute } from "./useCustomRoute";

export const useActiveStep = () => {
  const { pipelineJson } = usePipelineDataContext();
  const { stepUuid } = useCustomRoute();

  return stepUuid ? pipelineJson?.steps[stepUuid] : undefined;
};
