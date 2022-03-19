import { Code } from "@/components/common/Code";
import { PageTitle } from "@/components/common/PageTitle";
import ImageBuildLog from "@/components/ImageBuildLog";
import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/Routes";
import CloseIcon from "@mui/icons-material/Close";
import MemoryIcon from "@mui/icons-material/Memory";
import SaveIcon from "@mui/icons-material/Save";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
  uuidv4,
} from "@orchest/lib-utils";
import "codemirror/mode/shell/shell";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";

const CANCELABLE_STATUSES = ["PENDING", "STARTED"];

const ConfigureJupyterLabView: React.FC = () => {
  // global
  const appContext = useAppContext();
  const { setAlert, setConfirm, setAsSaved } = appContext;
  const {
    deleteAllSessions,
    state: { sessionsKillAllInProgress, sessions },
  } = useSessionsContext();

  useSendAnalyticEvent("view load", { name: siteMap.configureJupyterLab.path });

  // local states
  const [ignoreIncomingLogs, setIgnoreIncomingLogs] = React.useState(false);
  const [jupyterBuild, setJupyterBuild] = React.useState(null);

  const [state, setState] = React.useState({
    sessionKillStatus: undefined,
    buildRequestInProgress: false,
    cancelBuildRequestInProgress: false,
    buildFetchHash: uuidv4(),
    jupyterSetupScript: undefined,
  });

  const building = React.useMemo(() => {
    return jupyterBuild
      ? CANCELABLE_STATUSES.includes(jupyterBuild.status)
      : false;
  }, [jupyterBuild]);

  const [promiseManager] = React.useState(new PromiseManager());

  const buildImage = async () => {
    window.orchest.jupyter.unload();

    setState((prevState) => ({
      ...prevState,
      buildRequestInProgress: true,
    }));
    setIgnoreIncomingLogs(true);

    try {
      await save();
      let response = await makeCancelable(
        makeRequest("POST", "/catch/api-proxy/api/jupyter-builds"),
        promiseManager
      ).promise;

      setJupyterBuild(JSON.parse(response)["jupyter_build"]);
    } catch (error) {
      if (!error.isCanceled) {
        setIgnoreIncomingLogs(false);

        let resp = JSON.parse(error.body);

        if (resp.message === "SessionInProgressException") {
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
              setState((prevState) => ({
                ...prevState,
                sessionKillStatus: "WAITING",
              }));
              return true;
            }
          );
        }
      }
    }
    setState((prevState) => ({
      ...prevState,
      buildRequestInProgress: false,
    }));
  };

  const cancelImageBuild = () => {
    // send DELETE to cancel ongoing build
    if (
      jupyterBuild &&
      CANCELABLE_STATUSES.indexOf(jupyterBuild.status) !== -1
    ) {
      setState((prevState) => ({
        ...prevState,
        cancelBuildRequestInProgress: true,
      }));

      makeRequest(
        "DELETE",
        `/catch/api-proxy/api/jupyter-builds/${jupyterBuild.uuid}`
      )
        .then(() => {
          // immediately fetch latest status
          // NOTE: this DELETE call doesn't actually destroy the resource, that's
          // why we're querying it again.
          setState((prevState) => ({
            ...prevState,
            buildFetchHash: uuidv4(),
          }));
        })
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          setState((prevState) => ({
            ...prevState,
            cancelBuildRequestInProgress: false,
          }));
        });
    } else {
      setAlert(
        "Error",
        "Could not cancel build, please try again in a few seconds."
      );
    }
  };

  const getSetupScript = () => {
    let getSetupScriptPromise = makeCancelable(
      makeRequest("GET", "/async/jupyter-setup-script"),
      promiseManager
    );
    getSetupScriptPromise.promise.then((response) => {
      setState((prevState) => ({
        ...prevState,
        jupyterSetupScript: response,
      }));
    });
  };

  const save = async () => {
    setAsSaved();

    // auto save the bash script
    let formData = new FormData();

    formData.append("setup_script", state.jupyterSetupScript);
    return makeRequest("POST", "/async/jupyter-setup-script", {
      type: "FormData",
      content: formData,
    }).catch((e) => {
      console.error(e);
    });
  };

  React.useEffect(() => {
    getSetupScript();
    return () => promiseManager.cancelCancelablePromises();
  }, []);

  React.useEffect(() => {
    const isAllSessionsDeletedForBuildingImage =
      state.sessionKillStatus === "WAITING" && // an attempt to delete all sessions was initiated
      !sessionsKillAllInProgress && // the operation of deleting sessions was started
      sessions.length === 0; // all sessions are finally cleaned up;

    if (isAllSessionsDeletedForBuildingImage) {
      setState((prevState) => ({
        ...prevState,
        sessionKillStatus: undefined,
      }));
      buildImage();
    }
  }, [sessions, sessionsKillAllInProgress, state.sessionKillStatus]);

  return (
    <Layout>
      <div className={"view-page jupyterlab-config-page"}>
        {state.jupyterSetupScript !== undefined ? (
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
                value={state.jupyterSetupScript}
                options={{
                  mode: "application/x-sh",
                  theme: "dracula",
                  lineNumbers: true,
                  viewportMargin: Infinity,
                  readOnly: building,
                }}
                onBeforeChange={(editor, data, value) => {
                  setState((prevState) => ({
                    ...prevState,
                    jupyterSetupScript: value,
                  }));
                  setAsSaved(false);
                }}
              />
            </div>

            <ImageBuildLog
              buildRequestEndpoint={
                "/catch/api-proxy/api/jupyter-builds/most-recent"
              }
              buildsKey="jupyter_builds"
              socketIONamespace={
                appContext.state?.config
                  .ORCHEST_SOCKETIO_JUPYTER_BUILDING_NAMESPACE
              }
              streamIdentity={"jupyter"}
              onUpdateBuild={setJupyterBuild}
              ignoreIncomingLogs={ignoreIncomingLogs}
              build={jupyterBuild}
              buildFetchHash={state.buildFetchHash}
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
                {appContext.state.hasUnsavedChanges ? "Save*" : "Save"}
              </Button>
              {!building ? (
                <Button
                  disabled={
                    state.buildRequestInProgress ||
                    typeof state.sessionKillStatus !== "undefined"
                  }
                  startIcon={<MemoryIcon />}
                  color="secondary"
                  variant="contained"
                  onClick={buildImage}
                >
                  Build
                </Button>
              ) : (
                <Button
                  disabled={state.cancelBuildRequestInProgress}
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
