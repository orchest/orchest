import { useRequireRestart } from "@/api/system-config/useOrchestConfigsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useHasChanged } from "@/hooks/useHasChanged";
import { checkHeartbeat, fetcher } from "@orchest/lib-utils";
import React from "react";

type DisplayStatus = "..." | "online" | "offline" | "restarting";

/**
 * A state hook that indicates the state of Orchest, e.g. online, restarting.
 * Also returns a `restart` function to restart Orchest.
 */
export const useOrchestStatus = () => {
  const [status, setStatus] = useDisplayStatus();
  useReloadAfterRestart(status);

  const resetRequireRestart = useRequireRestart(
    (state) => state.resetRequireRestart
  );

  const { setAlert, setConfirm } = useGlobalContext();
  const restart = React.useCallback(() => {
    return setConfirm(
      "Warning",
      "Are you sure you want to restart Orchest? This will terminate all running Orchest containers (including kernels/pipelines).",
      async (resolve) => {
        setStatus("restarting");
        resetRequireRestart();

        try {
          await fetcher("/async/restart", { method: "POST" });
          resolve(true);

          setTimeout(() => {
            checkHeartbeat("/heartbeat")
              .then(() => {
                console.log("Orchest available");
                setStatus("online");
              })
              .catch((retries) => {
                console.log(
                  "Update service heartbeat checking timed out after " +
                    retries +
                    " retries."
                );
              });
          }, 5000); // allow 5 seconds for orchest-controller to stop orchest
          return true;
        } catch (error) {
          console.error(error);
          resolve(false);
          setAlert("Error", "Could not trigger restart. Please try again.");
          return false;
        }
      }
    );
  }, [resetRequireRestart, setAlert, setConfirm, setStatus]);

  return { status, restart };
};

const useDisplayStatus = () => {
  const [status, setStatus] = React.useState<DisplayStatus>("...");
  React.useEffect(() => {
    fetcher("/heartbeat")
      .then(() => setStatus("online"))
      .catch(() => setStatus("offline"));
  }, []);
  return [status, setStatus] as const;
};

/** Reload the page after restarting */
const useReloadAfterRestart = (status: DisplayStatus) => {
  const hasRestarted = useHasChanged(
    status,
    (prev, curr) => prev === "restarting" && curr === "online"
  );

  React.useEffect(() => {
    if (hasRestarted) window.location.reload();
  }, [hasRestarted]);
};
