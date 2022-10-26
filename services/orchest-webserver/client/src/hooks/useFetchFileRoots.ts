import { FileApiOverrides, useFileApi } from "@/api/files/useFileApi";
import React from "react";

export const useFetchFileRoots = ({
  pipelineUuid,
  jobUuid,
  runUuid,
}: FileApiOverrides = {}) => {
  const roots = useFileApi((api) => api.roots);
  const init = useFileApi((api) => api.init);

  React.useEffect(() => {
    if (Object.keys(roots).length === 0) init();
  }, [init, roots]);

  React.useEffect(() => {
    init(2, { pipelineUuid, jobUuid, runUuid });
  }, [init, pipelineUuid, jobUuid, runUuid]);

  return roots;
};
