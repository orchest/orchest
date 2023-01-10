import { useFetchSnapshot } from "@/hooks/useFetchSnapshot";
import { useValidJobQueryArgs } from "@/jobs-view/hooks/useValidJobQueryArgs";
import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useFetchSnapshotPipelines = () => {
  const { projectUuid, jobUuid } = useValidJobQueryArgs();
  const snapshotUuid = useEditJob((state) =>
    hasValue(projectUuid) && hasValue(jobUuid)
      ? state.jobChanges?.snapshot_uuid
      : undefined
  );
  const { snapshot } = useFetchSnapshot(snapshotUuid);

  const pipelines = React.useMemo(() => {
    return snapshot?.pipelines ? Object.values(snapshot.pipelines) : undefined;
  }, [snapshot?.pipelines]);

  return { pipelines };
};
