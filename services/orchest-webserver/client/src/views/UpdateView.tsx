import { ConsoleOutput } from "@/components/ConsoleOutput";
import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useInterval } from "@/hooks/use-interval";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import {
  checkHeartbeat,
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import React from "react";

const UpdateView: React.FC = () => {
  const { setConfirm, setAlert } = useAppContext();
  useSendAnalyticEvent("view load", { name: siteMap.update.path });

  const [state, setState] = React.useState((prevState) => ({
    ...prevState,
    updating: false,
    updateOutput: "",
    token: "",
  }));
  const [updatePollInterval, setUpdatePollInterval] = React.useState<
    number | null
  >(null);

  const [promiseManager] = React.useState(new PromiseManager());

  const startUpdateTrigger = () => {
    return setConfirm(
      "Warning",
      "Are you sure you want to update Orchest? This will kill all active sessions and ongoing runs.",
      async (resolve) => {
        setState({
          updating: true,
          updateOutput: "",
          token: "",
        });
        console.log("Starting update.");

        try {
          makeRequest("POST", "/async/start-update", {}).then((response) => {
            let json = JSON.parse(response);
            setState((prevState) => ({
              ...prevState,
              token: json.token,
            }));
            console.log("Update started, polling update-sidecar.");

            checkHeartbeat("/update-sidecar/heartbeat")
              .then(() => {
                console.log("Heartbeat successful.");
                resolve(true);
                startUpdatePolling();
              })
              .catch((retries) => {
                console.error(
                  "Update sidecar heartbeat checking timed out after " +
                    retries +
                    " retries."
                );
              });
          });

          return true;
        } catch (error) {
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
    let updateStatusPromise = makeCancelable(
      makeRequest("GET", `/update-sidecar/update-status?token=${state.token}`),
      promiseManager
    );

    updateStatusPromise.promise
      .then((response) => {
        let json = JSON.parse(response);
        if (json.updating === false) {
          setState((prevState) => ({
            ...prevState,
            updating: false,
          }));
          setUpdatePollInterval(null);
        }
        setState((prevState) => ({
          ...prevState,
          updateOutput: json.update_output,
        }));
      })
      .catch((e) => {
        if (!e.isCanceled) {
          console.error(e);
        }
      });
  }, updatePollInterval);

  React.useEffect(() => {
    return () => promiseManager.cancelCancelablePromises();
  }, []);

  let updateOutputLines = state.updateOutput.split("\n").reverse();
  updateOutputLines =
    updateOutputLines[0] == "" ? updateOutputLines.slice(1) : updateOutputLines;

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
