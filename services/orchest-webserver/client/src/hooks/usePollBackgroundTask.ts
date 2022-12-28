import {
  BackgroundTask,
  backgroundTasksApi,
} from "@/api/background-tasks/backgroundTasksApi";
import React from "react";
import { useAsync } from "./useAsync";

const POLL_FREQUENCY = 1000;

const hasFinished = (status: BackgroundTask["status"]) =>
  status === "FAILURE" || status === "SUCCESS";

/**
 * Polls a background task with the specified UUID until it finishes.
 * @param taskUuid The UUID of the task to poll, or `undefined` if a UUID is not yet available.
 * @returns The background task if it exists, or `undefined`.
 */
export const usePollBackgroundTask = (taskUuid: string | undefined) => {
  const [backgroundTask, setBackgroundTask] = React.useState<BackgroundTask>();
  const { run } = useAsync<BackgroundTask>();

  React.useEffect(() => {
    if (!taskUuid) return;

    const handle = window.setInterval(async () => {
      const task = await run(backgroundTasksApi.fetchOne(taskUuid));
      if (!task) return;

      setBackgroundTask(task);

      if (hasFinished(task.status)) {
        clearInterval(handle);
      }
    }, POLL_FREQUENCY);

    return () => {
      window.clearInterval(handle);
    };
  }, [run, taskUuid]);

  return backgroundTask;
};
