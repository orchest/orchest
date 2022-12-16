import { FileScope, useFileApi } from "@/api/files/useFileApi";
import { equalsShallow } from "@/utils/record";
import React from "react";
import { useAsync } from "./useAsync";
import { useCurrentQuery } from "./useCustomRoute";

const START_DEPTH = 2;

export const useFetchFileRoots = ({
  projectUuid,
  pipelineUuid,
  snapshotUuid,
  jobUuid,
  runUuid,
}: FileScope = {}) => {
  const scope = useCurrentQuery();
  const currentScope = useFileApi((api) => api.scope);
  const roots = useFileApi((api) => api.roots);
  const init = useFileApi((api) => api.init);
  const { run, status } = useAsync();

  React.useEffect(() => {
    // We allow this effect to run on each render.
    // Since we manually compare the scopes below.
    const hasPipeline = Boolean(pipelineUuid ?? scope.pipelineUuid);
    const hasJob = Boolean(jobUuid ?? scope.jobUuid);
    const hasRun = Boolean(runUuid ?? scope.runUuid);
    const newScope: FileScope = {
      projectUuid: projectUuid ?? scope.projectUuid,
      pipelineUuid: pipelineUuid ?? scope.pipelineUuid,
      jobUuid: hasPipeline ? jobUuid ?? scope.jobUuid : undefined,
      runUuid: hasPipeline ? runUuid ?? scope.runUuid : undefined,
      snapshotUuid:
        hasPipeline && hasJob && !hasRun
          ? snapshotUuid ?? scope.snapshotUuid
          : undefined,
    };

    if (!equalsShallow(newScope, currentScope)) {
      run(init(START_DEPTH, newScope));
    }
  });

  return { roots, isFetching: status === "PENDING" };
};
