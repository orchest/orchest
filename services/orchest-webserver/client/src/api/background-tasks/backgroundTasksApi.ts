import { join } from "@/utils/path";
import { fetcher } from "@orchest/lib-utils";

const BASE_URL = `/async/background-tasks/`;

type BackgroundTaskData = {
  uuid: string;
  task_type: string;
  code: string | null;
};

export type BackgroundTask = BackgroundTaskData &
  (
    | { status: "SUCCESS" | "FAILURE"; result: string }
    | { status: "PENDING" | "STARTED"; result: null }
  );

const fetchOne = (taskUuid: string) =>
  fetcher<BackgroundTask>(join(BASE_URL, taskUuid));

export const backgroundTasksApi = { fetchOne };
