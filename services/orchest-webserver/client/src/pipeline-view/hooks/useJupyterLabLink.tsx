import { useRouteLink } from "@/hooks/useCustomRoute";
import { usePipelineDataContext } from "@/pipeline-view/contexts/PipelineDataContext";
import { StepData } from "@/types";
import { join } from "@/utils/path";

export const useJupyterLabLink = (step: StepData | undefined) => {
  const { pipelineCwd } = usePipelineDataContext();

  return useRouteLink({
    route: "jupyterLab",
    query: {
      filePath:
        pipelineCwd && step?.file_path
          ? join(pipelineCwd, step.file_path)
          : undefined,
    },
  });
};
