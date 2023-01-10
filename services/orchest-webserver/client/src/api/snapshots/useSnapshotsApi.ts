import { SnapshotData } from "@/types";
import { memoizeFor, MemoizePending } from "@/utils/promise";
import create from "zustand";
import { snapshotsApi } from "./snapshotsApi";

export type SnapshotMap = { [snapshotUuid: string]: SnapshotData };

export type SnapshotsApi = {
  snapshots?: SnapshotMap;
  fetchOne: MemoizePending<
    (snapshotUuid: string | undefined) => Promise<SnapshotData | undefined>
  >;
};

export const useSnapshotsApi = create<SnapshotsApi>((set) => {
  return {
    snapshots: undefined,
    fetchOne: memoizeFor(1000, async (snapshotUuid) => {
      if (!snapshotUuid) return;

      const snapshot = await snapshotsApi.fetchOne(snapshotUuid);

      set(({ snapshots }) => ({
        snapshots: { ...snapshots, [snapshot.uuid]: snapshot },
      }));
      return snapshot;
    }),
  };
});
