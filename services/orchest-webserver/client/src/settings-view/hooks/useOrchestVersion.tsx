import { fetcher } from "@orchest/lib-utils";
import useSWR from "swr";

export const useOrchestVersion = () => {
  const { data } = useSWR("/async/version", (url) =>
    fetcher<{ version: string }>(url).then((response) => response.version)
  );
  return data;
};
