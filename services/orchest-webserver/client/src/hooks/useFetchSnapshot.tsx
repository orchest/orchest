import { useSnapshotsApi } from "@/api/snapshots/useSnapshotsApi";
import React from "react";
import { useHydrate } from "./useHydrate";

export const useFetchSnapshot = (snapshotUuid: string | undefined) => {
  const snapshot = useSnapshotsApi((api) =>
    snapshotUuid ? api.snapshots?.[snapshotUuid] : undefined
  );
  const fetchOne = useSnapshotsApi((state) => state.fetchOne);
  const fetchSnapshot = React.useCallback(() => {
    return fetchOne(snapshotUuid);
  }, [fetchOne, snapshotUuid]);
  const state = useHydrate(fetchSnapshot, { rehydrate: true });

  return { snapshot, ...state };
};
