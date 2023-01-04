import { useProjectJobsApi } from "@/api/jobs/useProjectJobsApi";
import { useSnapshotsApi } from "@/api/snapshots/useSnapshotsApi";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { PipelineMetaData } from "@/types";
import { basename } from "@/utils/path";
import React from "react";
import { useAsync } from "./useAsync";
import { useCurrentQuery } from "./useCustomRoute";

export const useFetchActivePipelines = (): PipelineMetaData[] => {
  const { snapshotUuid: snapshotUuidFromQuery, jobUuid } = useCurrentQuery();
  const activeJob = useProjectJobsApi((api) =>
    api.jobs?.find(({ uuid }) => uuid === jobUuid)
  );
  const snapshotUuid = snapshotUuidFromQuery ?? activeJob?.snapshot_uuid;
  const snapshot = useSnapshotsApi((api) =>
    api.snapshots?.find(({ uuid }) => uuid === snapshotUuid)
  );
  const fetchSnapshot = useSnapshotsApi((api) => api.fetchOne);
  const { pipelines: projectPipelines } = useProjectsContext().state;
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
      }));
    } else if (!jobUuid) {
      return projectPipelines ?? [];
    } else {
      return [];
    }
  }, [jobUuid, projectPipelines, snapshot]);

  return pipelines;
};
