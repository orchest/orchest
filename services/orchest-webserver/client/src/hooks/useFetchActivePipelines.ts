import { useProjectJobsApi } from "@/api/jobs/useProjectJobsApi";
import { useSnapshotsApi } from "@/api/snapshots/useSnapshotsApi";
import { PipelineMetaData } from "@/types";
import { basename } from "@/utils/path";
import React from "react";
import { useAsync } from "./useAsync";
import { useCurrentQuery } from "./useCustomRoute";
import { useProjectPipelines } from "./useProjectPipelines";

export const useFetchActivePipelines = (): PipelineMetaData[] => {
  const {
    snapshotUuid: snapshotUuidFromQuery,
    jobUuid,
    projectUuid,
  } = useCurrentQuery();
  const activeJob = useProjectJobsApi((api) =>
    api.jobs?.find(({ uuid }) => uuid === jobUuid)
  );
  const snapshotUuid = snapshotUuidFromQuery ?? activeJob?.snapshot_uuid;
  const snapshot = useSnapshotsApi((api) =>
    snapshotUuid ? api.snapshots?.[snapshotUuid] : undefined
  );
  const fetchSnapshot = useSnapshotsApi((api) => api.fetchOne);
  const projectPipelines = useProjectPipelines(projectUuid);
  const { run } = useAsync();

  React.useEffect(() => {
    if (snapshotUuid && !snapshot) {
      run(fetchSnapshot(snapshotUuid));
    }
  });

  const pipelines = React.useMemo(() => {
    if (jobUuid && snapshot) {
      return Object.entries(snapshot.pipelines).map(([uuid, data]) => ({
        uuid,
        path: data.path,
        name: basename(data.path).replace(/\.orchest$/i, ""),
        project_uuid: snapshot.project_uuid,
      }));
    } else if (!jobUuid) {
      return projectPipelines ?? [];
    } else {
      return [];
    }
  }, [jobUuid, projectPipelines, snapshot]);

  return pipelines;
};
