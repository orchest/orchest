import { ConsoleOutput } from "@/components/ConsoleOutput";
import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useInterval } from "@/hooks/use-interval";
import {
  useCancelableFetch,
  useCancelablePromise,
} from "@/hooks/useCancelablePromise";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { checkHeartbeat, fetcher } from "@orchest/lib-utils";
import React from "react";

const UpdateView: React.FC = () => {
  const { setConfirm, setAlert } = useAppContext();
  useSendAnalyticEvent("view load", { name: siteMap.update.path });

  const { cancelableFetch } = useCancelableFetch();
  const { makeCancelable } = useCancelablePromise();

  const [state, setState] = React.useState((prevState) => ({
    ...prevState,
    updating: false,
    updateOutput: [],
    clusterName: undefined,
    namespace: undefined,
  }));
  const [updatePollInterval, setUpdatePollInterval] = React.useState<
    number | null
  >(null);

  const startUpdateTrigger = () => {
    return setConfirm(
      "Warning",
      "Are you sure you want to update Orchest? This will kill all active sessions and ongoing runs.",
      async (resolve) => {
        setState({
          updating: true,
          updateOutput: [],
        });
        console.log("Starting update.");

        try {
          fetcher<{ namespace: string; cluster_name: string }>(
            "/async/start-update",
            {
              method: "POST",
            }
          )
            .then((json) => {
              setState((prevState) => ({
                ...prevState,
                clusterName: json.cluster_name,
                namespace: json.namespace,
              }));
              console.log("Update started, polling controller.");

              const namespace = json.namespace;
              const clusterName = json.cluster_name;
              makeCancelable(
                checkHeartbeat(
                  `/controller/namespaces/${namespace}/clusters/${clusterName}/status`
                )
              )
                .then(() => {
                  console.log("Heartbeat successful.");
                  resolve(true);
                  startUpdatePolling();
                })
                .catch((retries) => {
                  console.error(
                    "Controller heartbeat checking timed out after " +
                      retries +
                      " retries."
                  );
                });
            })
            .catch((error) => {
              // This is a form of technical debt since we can't
              // distinguish if an update fails because there is no
              // newer version of a "real" failure.
              setState((prevState) => ({
                ...prevState,
                updating: false,
              }));
              resolve(false);
              setAlert("Error", "Orchest is already at the latest version.");
              console.error("Failed to trigger update", error);
            });

          return true;
        } catch (error) {
          setState((prevState) => ({
            ...prevState,
            updating: false,
          }));
          resolve(false);
          setAlert("Error", "Failed to trigger update");
          console.error("Failed to trigger update", error);
          return false;
        }
      }
    );
  };

  const startUpdatePolling = () => {
    setUpdatePollInterval(1000);
  };

  useInterval(() => {
    cancelableFetch<{
      state: string;
      conditions: { lastHeartbeatTime: string }[];
    }>(
      `/controller/namespaces/${state.namespace}/clusters/${state.clusterName}/status`
    )
      .then((json) => {
        if (json.state === "Running") {
          setState((prevState) => ({
            ...prevState,
            updating: false,
          }));
          setUpdatePollInterval(null);
        } else {
          setState((prevState) => ({
            ...prevState,
            updateOutput: json.conditions.sort(function (a, b) {
              let dateA = new Date(a.lastHeartbeatTime);
              let dateB = new Date(b.lastHeartbeatTime);
              // sort in descending order -> most recent messages first
              if (dateA < dateB) return -1;
              if (dateA > dateB) return 1;
              return 0;
            }),
          }));
        }
      })
      .catch((e) => {
        if (!e.isCanceled) {
          console.error(e);
        }
      });
  }, updatePollInterval);

  let updateOutputLines = [];
  state.updateOutput.forEach((element) =>
    updateOutputLines.push(element.event)
  );

  return (
    <Layout>
      <Paper
        sx={{
          padding: (theme) => theme.spacing(3),
        }}
        className={"view-page update-page"}
      >
        <Typography variant="h5">Orchest updater</Typography>
        <Typography sx={{ marginTop: 3, marginBottom: 3 }}>
          Update Orchest to the latest version.
        </Typography>
        <Button
          sx={{ marginBottom: 3 }}
          startIcon={<SystemUpdateAltIcon />}
          disabled={state.updating}
          onClick={startUpdateTrigger}
        >
          Start update
        </Button>
        {state.updating && <LinearProgress sx={{ marginBottom: 3 }} />}
        {state.updateOutput.length > 0 && (
          <ConsoleOutput>{updateOutputLines.join("\n")}</ConsoleOutput>
        )}
      </Paper>
    </Layout>
  );
};

export default UpdateView;
