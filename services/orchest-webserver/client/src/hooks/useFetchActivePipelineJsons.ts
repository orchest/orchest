import { createPipelineState } from "@/api/pipeline-json/pipelineJsonApi";
import { usePipelineJsonApi } from "@/api/pipeline-json/usePipelineJsonApi";
import { useSnapshotsApi } from "@/api/snapshots/useSnapshotsApi";
import { PipelineState } from "@/types";
import React from "react";
import { useAsync } from "./useAsync";
import { useCurrentQuery } from "./useCustomRoute";
import { useFetchActiveJob } from "./useFetchActiveJob";
import { useFetchActivePipelines } from "./useFetchActivePipelines";

/** Returns all pipeline definitions within the active project or snapshot. */
export const useFetchActivePipelineJsons = () => {
  const {
    projectUuid,
    snapshotUuid: snapshotUuidFromQuery,
  } = useCurrentQuery();
  const definitions = usePipelineJsonApi((api) => api.pipelines);
  const fetchOne = usePipelineJsonApi((api) => api.fetchOne);
  const pipelines = useFetchActivePipelines();
  const snapshots = useSnapshotsApi((api) => api.snapshots);
  const fetchSnapshot = useSnapshotsApi((api) => api.fetchOne);
  const activeJob = useFetchActiveJob();
  const snapshotUuid = snapshotUuidFromQuery ?? activeJob?.snapshot_uuid;
  const { run, status } = useAsync();

  const snapshot = React.useMemo(() => {
    if (!snapshotUuid) return undefined;
    else return snapshots?.find((snapshot) => snapshot.uuid === snapshotUuid);
  }, [snapshotUuid, snapshots]);

  const refresh = React.useCallback(() => {
    if (!projectUuid) return;

    if (snapshotUuid && !snapshot) {
      run(fetchSnapshot(snapshotUuid));
    } else if (!snapshotUuid) {
      const promises = pipelines?.map(({ uuid }) =>
        fetchOne({ projectUuid, pipelineUuid: uuid })
      );

      if (promises?.length) run(Promise.all(promises));
    }
  }, [
    fetchOne,
    fetchSnapshot,
    pipelines,
    projectUuid,
    run,
    snapshot,
    snapshotUuid,
  ]);

  React.useEffect(() => {
    if (status === "IDLE") refresh();
  }, [refresh, status]);

  const result: Record<string, PipelineState> = React.useMemo(() => {
    if (snapshot?.pipelines) {
      return Object.fromEntries(
        Object.values(snapshot?.pipelines).map(({ path, definition }) => [
          path,
          createPipelineState(definition),
        ])
      );
    } else if (pipelines) {
      return Object.fromEntries(
        pipelines
          .filter(({ uuid }) => definitions[uuid])
          .map((pipeline) => [pipeline.path, definitions[pipeline.uuid]])
      );
    } else {
      return {};
    }
  }, [definitions, pipelines, snapshot]);

  return { definitions: result, refresh };
};
