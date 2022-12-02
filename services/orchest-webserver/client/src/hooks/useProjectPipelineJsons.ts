import { createPipelineState } from "@/api/pipeline-json/pipelineJsonApi";
import { usePipelineJsonApi } from "@/api/pipeline-json/usePipelineJsonApi";
import { useSnapshotsApi } from "@/api/snapshots/useSnapshotsApi";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import React from "react";
import { useAsync } from "./useAsync";
import { useCustomRoute } from "./useCustomRoute";

/** Returns all pipeline definitions within the active project. */
export const useProjectPipelineJsons = () => {
  const definitions = usePipelineJsonApi((api) => api.pipelines);
  const fetchOne = usePipelineJsonApi((api) => api.fetchOne);
  const snapshots = useSnapshotsApi((api) => api.snapshots);
  const fetchSnapshot = useSnapshotsApi((api) => api.fetchOne);
  const { snapshotUuid, jobUuid, runUuid } = useCustomRoute();
  const { pipelines, projectUuid } = useProjectsContext().state;
  const { run, status } = useAsync();

  const snapshot = React.useMemo(() => {
    if (snapshotUuid) return undefined;
    else return snapshots?.find((snapshot) => snapshot.uuid === snapshotUuid);
  }, [snapshotUuid, snapshots]);

  React.useEffect(() => {
    if (status !== "IDLE" || !projectUuid) return;

    if (snapshotUuid && !snapshot) {
      run(fetchSnapshot(snapshotUuid));
    } else {
      const promises = pipelines
        ?.filter((pipeline) => !definitions[pipeline.uuid])
        .map((pipeline) =>
          fetchOne({
            projectUuid,
            pipelineUuid: pipeline.uuid,
            jobUuid,
            runUuid,
          })
        );

      if (promises?.length) run(Promise.all(promises));
    }
  }, [
    pipelines,
    projectUuid,
    definitions,
    fetchOne,
    status,
    run,
    snapshotUuid,
    snapshot,
    jobUuid,
    runUuid,
    fetchSnapshot,
  ]);

  return React.useMemo(
    () =>
      snapshot?.pipelines
        ? Object.values(snapshot?.pipelines).map(({ definition }) =>
            createPipelineState(definition)
          )
        : pipelines
            ?.map((pipeline) => definitions[pipeline.uuid])
            .filter(Boolean) ?? [],
    [definitions, pipelines, snapshot?.pipelines]
  );
};
