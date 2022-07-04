import { useFetcher } from "@/hooks/useFetcher";

type HostInfo = {
  disk_info: {
    used_GB: number;
    avail_GB: number;
    used_pcent: number;
  };
};

export const useHostInfo = () => {
  const { data } = useFetcher<HostInfo>("/async/host-info");
  return data;
};
