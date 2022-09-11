import { useSnapshotsApi } from "@/api/snapshots/useSnapshotsApi";
import { useAsync } from "@/hooks/useAsync";
import React from "react";

export const useSnapshot = (snapshotUuid: string) => {
  const fetchSnapshot = useSnapshotsApi((api) => api.fetchOne);
  const snapshots = useSnapshotsApi((api) => api.snapshots);
  const { run, error, status } = useAsync();

  const snapshot = React.useMemo(
    () => snapshots?.find((snap) => snap.uuid === snapshotUuid),
    [snapshotUuid, snapshots]
  );

  React.useEffect(() => {
    if (!snapshot) run(fetchSnapshot(snapshotUuid)).catch();
  }, [snapshot, fetchSnapshot, run, snapshotUuid]);

  return { snapshot, error, isFetching: status === "PENDING" };
};
