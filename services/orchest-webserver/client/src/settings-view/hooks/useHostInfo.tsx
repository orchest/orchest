import { useFetcher } from "@/hooks/useFetcher";

type HostInfo = {
  disk_info: {
    used_GB: number;
    avail_GB: number;
    used_pcent: number;
  };
};

export const useHostInfo = (shouldFetch?: boolean) => {
  const { data } = useFetcher<HostInfo>(
    shouldFetch ? "/async/host-info" : undefined
  );

  return data;
};
