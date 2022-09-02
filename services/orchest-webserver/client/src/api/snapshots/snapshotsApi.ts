import { SnapshotData } from "@/types";
import { queryArgs } from "@/utils/text";
import { fetcher } from "@orchest/lib-utils";

const BASE_URL = "/catch/api-proxy/api/snapshots";

const fetchAll = async (projectUuid: string): Promise<SnapshotData[]> => {
  return fetcher<{ snapshots: SnapshotData[] }>(
    `${BASE_URL}?${queryArgs({ projectUuid })}`
  ).then((response) => response.snapshots);
};

const fetchOne = async (snapshotUuid: string): Promise<SnapshotData> => {
  const snapshot = await fetcher<SnapshotData>(`${BASE_URL}/${snapshotUuid}`);

  return snapshot;
};

export const snapshotsApi = {
  fetchAll,
  fetchOne,
};
