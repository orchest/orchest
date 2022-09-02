import { SnapshotData } from "@/types";
import create from "zustand";
import { snapshotsApi } from "./snapshotsApi";

export type SnapshotsApi = {
  snapshots?: SnapshotData[];
  fetchOne: (snapshotUuid: string) => Promise<SnapshotData | undefined>;
};

export const useSnapshotsApi = create<SnapshotsApi>((set) => {
  return {
    fetchOne: async (snapshotUuid) => {
      const snapshot = await snapshotsApi.fetchOne(snapshotUuid);
      set((state) => {
        const snapshots = state.snapshots?.map((existingSnapshot) =>
          existingSnapshot.uuid === snapshotUuid ? snapshot : existingSnapshot
        );
        return { snapshots };
      });
      return snapshot;
    },
  };
});
