import { useSnapshotsApi } from "@/api/snapshots/useSnapshotsApi";
import { useAsync } from "@/hooks/useAsync";
import { SnapshotData } from "@/types";
import React from "react";

export const useFetchSnapshot = () => {
  const fetchOne = useSnapshotsApi((state) => state.fetchOne);
  const { run, status, data: snapshot } = useAsync<SnapshotData | undefined>();
  const isAllowedRef = React.useRef(status !== "PENDING");
  isAllowedRef.current = status !== "PENDING";

  const fetchSnapshot = React.useCallback(
    async (snapshotUuid: string) => {
      if (isAllowedRef.current) return run(fetchOne(snapshotUuid)).catch();
    },
    [run, fetchOne]
  );

  return { snapshot, fetchSnapshot, isFetching: status === "PENDING" };
};
