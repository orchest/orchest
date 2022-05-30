import { Code } from "@/components/common/Code";
import { PageTitle } from "@/components/common/PageTitle";
import { ImageBuildLog } from "@/components/ImageBuildLog";
import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useCancelableFetch } from "@/hooks/useCancelablePromise";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import { EnvironmentImageBuild } from "@/types";
import CloseIcon from "@mui/icons-material/Close";
import MemoryIcon from "@mui/icons-material/Memory";
import SaveIcon from "@mui/icons-material/Save";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { hasValue, uuidv4 } from "@orchest/lib-utils";
import "codemirror/mode/shell/shell";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";

const CANCELABLE_STATUSES = ["PENDING", "STARTED"];

const ConfigureJupyterLabView: React.FC = () => {
  // global
  const {
    state: { hasUnsavedChanges },
    setAlert,
    setConfirm,
    setAsSaved,
    config,
  } = useAppContext();
  const {
    deleteAllSessions,
    state: { sessionsKillAllInProgress, sessions },
  } = useSessionsContext();

  useSendAnalyticEvent("view load", { name: siteMap.configureJupyterLab.path });
  const { cancelableFetch } = useCancelableFetch();

  // local states
  const [ignoreIncomingLogs, setIgnoreIncomingLogs] = React.useState(false);
  const [jupyterBuild, setJupyterEnvironmentBuild] = React.useState<
    EnvironmentImageBuild | undefined
  >(undefined);

  const [isBuildingImage, setIsBuildingImage] = React.useState(false);
  const [isCancellingBuild, setIsCancellingBuild] = React.useState(false);
  const [jupyterSetupScript, setJupyterSetupScript] = React.useState<
    string | undefined
  >(undefined);

  const [
    hasStartedKillingSessions,
    setHasStartedKillingSessions,
  ] = React.useState(false);

  const [buildFetchHash, setBuildFetchHash] = React.useState(uuidv4());

  const building = React.useMemo(() => {
    return jupyterBuild
      ? CANCELABLE_STATUSES.includes(jupyterBuild.status)
      : false;
  }, [jupyterBuild]);

  const save = React.useCallback(async () => {
    if (!hasValue(jupyterSetupScript)) return;

    let formData = new FormData();
    formData.append("setup_script", jupyterSetupScript);

    try {
      await cancelableFetch("/async/jupyter-setup-script", {
        method: "POST",
        body: formData,
      });
      setAsSaved();
    } catch (e) {
      setAsSaved(false);
      console.error(e);
    }
  }, [jupyterSetupScript, setAsSaved, cancelableFetch]);

  const buildImage = React.useCallback(async () => {
    window.orchest.jupyter?.unload();

    setIsBuildingImage(true);
    setIgnoreIncomingLogs(true);

    try {
      await save();
      let response = await cancelableFetch<{ jupyter_image_build: any }>(
        "/catch/api-proxy/api/jupyter-builds",
        { method: "POST" }
      );

      setJupyterEnvironmentBuild(response["jupyter_image_build"]);
    } catch (error) {
      if (!error.isCanceled) {
        setIgnoreIncomingLogs(false);

        if (error.message === "SessionInProgressException") {
          setConfirm(
            "Warning",
            <>
              <Typography>
                You must stop all active sessions in order to build a new
                JupyerLab image.
              </Typography>
              <Typography sx={{ marginTop: (theme) => theme.spacing(1) }}>
                Are you sure you want to stop all sessions? All running Jupyter
                kernels and interactive pipeline runs will be stopped.
              </Typography>
            </>,
            async (resolve) => {
              deleteAllSessions()
                .then(() => {
                  resolve(true);
                })
                .catch((error) => {
                  setAlert("Error", "Unable to stop all sessions.");
                  console.error(error);
                  resolve(false);
                });
              setHasStartedKillingSessions(true);

              return true;
            }
          );
        }
      }
    }
    setIsBuildingImage(false);
  }, [deleteAllSessions, save, setAlert, setConfirm]);

  const cancelImageBuild = async () => {
    // send DELETE to cancel ongoing build
    if (
      jupyterBuild &&
      CANCELABLE_STATUSES.includes(jupyterBuild.status) &&
      jupyterBuild?.uuid
    ) {
      setIsCancellingBuild(true);

      try {
        await cancelableFetch(
          `/catch/api-proxy/api/jupyter-builds/${jupyterBuild.uuid}`,
          { method: "DELETE" }
        );

        // immediately fetch latest status
        // NOTE: this DELETE call doesn't actually destroy the resource, that's
        // why we're querying it again.
        setBuildFetchHash(uuidv4());
      } catch (e) {
        console.error(e);
      }
      setIsCancellingBuild(false);
    } else {
      setAlert(
        "Error",
        "Could not cancel build, please try again in a few seconds."
      );
    }
  };

  const getSetupScript = React.useCallback(async () => {
    try {
      const { script } = await cancelableFetch<{ script: string }>(
        "/async/jupyter-setup-script"
      );
      setJupyterSetupScript(script || "");
    } catch (e) {
      setAlert("Error", `Failed to fetch setup script. ${e}`);
    }
  }, [setAlert]);

  React.useEffect(() => {
    getSetupScript();
  }, [getSetupScript]);

  React.useEffect(() => {
    const isAllSessionsDeletedForBuildingImage =
      hasStartedKillingSessions && // attempted to build image but got stuck, so started to kill sessions
      !sessionsKillAllInProgress && // the operation of deleting sessions is done
      sessions &&
      sessions.length === 0; // all sessions are finally cleaned up;

    if (isAllSessionsDeletedForBuildingImage) {
      setHasStartedKillingSessions(false);
      buildImage();
    }
  }, [
    sessions,
    sessionsKillAllInProgress,
    hasStartedKillingSessions,
    buildImage,
  ]);

  return (
    <Layout>
      <div className={"view-page jupyterlab-config-page"}>
        {hasValue(jupyterSetupScript) ? (
          <>
            <PageTitle>Configure JupyterLab</PageTitle>
            <p className="push-down">
              You can install JupyterLab extensions using the bash script below.
            </p>
            <p className="push-down">
              For example, you can install the Jupyterlab Code Formatter
              extension by executing{" "}
              <Code>pip install jupyterlab_code_formatter</Code>.
            </p>

            <p className="push-down">
              In addition, you can configure the JupyterLab environment to
              include settings such as your <Code>git</Code> username and email.
              <br />
              <br />
              <Code>{`git config --global user.name "John Doe"`}</Code>
              <br />
              <Code>{`git config --global user.email "john@example.org"`}</Code>
            </p>

            <div className="push-down">
              <CodeMirror
                value={jupyterSetupScript}
                options={{
                  mode: "application/x-sh",
                  theme: "dracula",
                  lineNumbers: true,
                  viewportMargin: Infinity,
                  readOnly: building,
                }}
                onBeforeChange={(editor, data, value) => {
                  setJupyterSetupScript(value);
                  setAsSaved(false);
                }}
              />
            </div>

            <ImageBuildLog
              buildRequestEndpoint={
                "/catch/api-proxy/api/jupyter-builds/most-recent"
              }
              buildsKey="jupyter_image_builds"
              socketIONamespace={
                config?.ORCHEST_SOCKETIO_JUPYTER_IMG_BUILDING_NAMESPACE
              }
              streamIdentity={"jupyter"}
              onUpdateBuild={setJupyterEnvironmentBuild}
              ignoreIncomingLogs={ignoreIncomingLogs}
              build={jupyterBuild}
              buildFetchHash={buildFetchHash}
            />

            <Stack
              sx={{ marginTop: (theme) => theme.spacing(2) }}
              direction="row"
              spacing={2}
            >
              <Button
                startIcon={<SaveIcon />}
                variant="contained"
                onClick={save}
              >
                {hasUnsavedChanges ? "Save*" : "Save"}
              </Button>
              {!building ? (
                <Button
                  disabled={isBuildingImage || hasStartedKillingSessions}
                  startIcon={<MemoryIcon />}
                  color="secondary"
                  variant="contained"
                  onClick={buildImage}
                >
                  Build
                </Button>
              ) : (
                <Button
                  disabled={isCancellingBuild}
                  startIcon={<CloseIcon />}
                  color="secondary"
                  variant="contained"
                  onClick={cancelImageBuild}
                >
                  Cancel build
                </Button>
              )}
            </Stack>
          </>
        ) : (
          <LinearProgress />
        )}
      </div>
    </Layout>
  );
};

export default ConfigureJupyterLabView;
