import { fetcher } from "@orchest/lib-utils";
import useSWR from "swr";

type HostInfo = {
  disk_info: {
    used_GB: number;
    avail_GB: number;
    used_pcent: number;
  };
};

export const useHostInfo = (shouldFetch?: boolean) => {
  const { data } = useSWR<HostInfo>(
    shouldFetch ? "/async/host-info" : null,
    fetcher
  );
  return data;
};
