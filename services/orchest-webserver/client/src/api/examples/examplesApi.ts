import { Example } from "@/types";
import { fetcher } from "@orchest/lib-utils";

type FetchAllResponse = { creation_time: string; entries: Example[] };

const fetchAll = () =>
  fetcher<FetchAllResponse>("/async/orchest-examples").then(
    (data) => data.entries
  );

export const examplesApi = { fetchAll };
