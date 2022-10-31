import { FileApiOverrides, useFileApi } from "@/api/files/useFileApi";
import React from "react";
import { useScopeParameters } from "./useScopeParameters";

export const useFetchFileRoots = ({
  pipelineUuid,
  jobUuid,
  runUuid,
}: FileApiOverrides = {}) => {
  const scope = useScopeParameters();
  const roots = useFileApi((api) => api.roots);
  const init = useFileApi((api) => api.init);

  React.useEffect(
    function reload() {
      const hasPipeline = Boolean(pipelineUuid ?? scope.pipelineUuid);

      const overrides = {
        pipelineUuid: pipelineUuid ?? scope.pipelineUuid,
        jobUuid: hasPipeline ? jobUuid ?? scope.jobUuid : undefined,
        runUuid: hasPipeline ? runUuid ?? scope.runUuid : undefined,
      };

      init(2, overrides);
    },
    [
      init,
      scope.jobUuid,
      scope.runUuid,
      scope.pipelineUuid,
      pipelineUuid,
      jobUuid,
      runUuid,
    ]
  );

  return roots;
};
