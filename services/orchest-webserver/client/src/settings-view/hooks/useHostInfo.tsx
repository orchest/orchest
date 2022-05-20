import { useAsync } from "@/hooks/useAsync";
import { fetcher } from "@orchest/lib-utils";
import React from "react";

type HostInfo = {
  disk_info: {
    used_GB: number;
    avail_GB: number;
    used_pcent: number;
  };
};

export const useHostInfo = (shouldFetch?: boolean) => {
  const { run, data } = useAsync<HostInfo>();

  React.useEffect(() => {
    if (shouldFetch) run(fetcher("/async/host-info"));
  }, [run, shouldFetch]);

  return data;
};
