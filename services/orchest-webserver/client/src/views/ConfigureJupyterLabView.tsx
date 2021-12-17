import { Code } from "@/components/common/Code";
import ImageBuildLog from "@/components/ImageBuildLog";
import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { useSessionsPoller } from "@/hooks/useSessionsPoller";
import { siteMap } from "@/routingConfig";
import CloseIcon from "@mui/icons-material/Close";
import MemoryIcon from "@mui/icons-material/Memory";
import SaveIcon from "@mui/icons-material/Save";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
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
  const sessionContext = useSessionsContext();
  useSessionsPoller();

  useSendAnalyticEvent("view load", { name: siteMap.configureJupyterLab.path });

  // local states
  const [state, setState] = React.useState({
    building: false,
    sessionKillStatus: undefined,
    buildRequestInProgress: false,
    cancelBuildRequestInProgress: false,
    ignoreIncomingLogs: false,
    jupyterBuild: undefined,
    buildFetchHash: uuidv4(),
    jupyterSetupScript: undefined,
  });

  const [promiseManager] = React.useState(new PromiseManager());

  const onBuildStart = () => {
    setState((prevState) => ({
      ...prevState,
      ignoreIncomingLogs: false,
    }));
  };

  const onUpdateBuild = (jupyterBuild) => {
    setState((prevState) => ({
      ...prevState,
      building: CANCELABLE_STATUSES.indexOf(jupyterBuild.status) !== -1,
      jupyterBuild,
    }));
  };

  const buildImage = () => {
    window.orchest.jupyter.unload();

    setState((prevState) => ({
      ...prevState,
      buildRequestInProgress: true,
      ignoreIncomingLogs: true,
    }));

    save(() => {
      let buildPromise = makeCancelable(
        makeRequest("POST", "/catch/api-proxy/api/jupyter-builds"),
        promiseManager
      );

      buildPromise.promise
        .then((response) => {
          try {
            let jupyterBuild = JSON.parse(response)["jupyter_build"];
            onUpdateBuild(jupyterBuild);
          } catch (error) {
            console.error(error);
          }
        })
        .catch((e) => {
          if (!e.isCanceled) {
            setState((prevState) => ({
              ...prevState,
              ignoreIncomingLogs: false,
            }));

            try {
              let resp = JSON.parse(e.body);

              if (resp.message == "SessionInProgressException") {
                setConfirm(
                  "Warning",
                  "You must stop all active sessions in order to build a new JupyerLab image. \n\n" +
                    "Are you sure you want to stop all sessions? All running Jupyter kernels and interactive pipeline runs will be stopped.",
                  async () => {
                    sessionContext.dispatch({ type: "sessionsKillAll" });
                    setState((prevState) => ({
                      ...prevState,
                      sessionKillStatus: "WAITING",
                    }));
                    return true;
                  }
                );
              }
            } catch (error) {
              console.error(error);
            }
          }
        })
        .finally(() => {
          setState((prevState) => ({
            ...prevState,
            buildRequestInProgress: false,
          }));
        });
    });
  };

  const cancelImageBuild = () => {
    // send DELETE to cancel ongoing build
    if (
      state.jupyterBuild &&
      CANCELABLE_STATUSES.indexOf(state.jupyterBuild.status) !== -1
    ) {
      setState((prevState) => ({
        ...prevState,
        cancelBuildRequestInProgress: true,
      }));

      makeRequest(
        "DELETE",
        `/catch/api-proxy/api/jupyter-builds/${state.jupyterBuild.uuid}`
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

  const save = (cb) => {
    setAsSaved();

    // auto save the bash script
    let formData = new FormData();

    formData.append("setup_script", state.jupyterSetupScript);
    makeRequest("POST", "/async/jupyter-setup-script", {
      type: "FormData",
      content: formData,
    })
      .then(() => {
        if (cb) {
          cb();
        }
      })
      .catch((e) => {
        console.error(e);
      });
  };

  React.useEffect(() => {
    getSetupScript();
    return () => promiseManager.cancelCancelablePromises();
  }, []);

  React.useEffect(() => {
    if (
      sessionContext.state.sessionsKillAllInProgress &&
      state.sessionKillStatus === "WAITING"
    ) {
      setState((prevState) => ({
        ...prevState,
        sessionKillStatus: "VALIDATING",
      }));
    }

    if (
      !sessionContext.state.sessionsKillAllInProgress &&
      state.sessionKillStatus === "VALIDATING"
    ) {
      const hasActiveSessions = sessionContext.state?.sessions
        .map((session) => (session.status ? true : false))
        .find((isActive) => isActive === true);

      if (!hasActiveSessions) {
        setState((prevState) => ({
          ...prevState,
          sessionKillStatus: undefined,
        }));
        buildImage();
      }
    }
  }, [
    sessionContext.state.sessions,
    sessionContext.state.sessionsKillAllInProgress,
    state.sessionKillStatus,
  ]);

  return (
    <Layout>
      <div className={"view-page jupyterlab-config-page"}>
        {state.jupyterSetupScript !== undefined ? (
          <>
            <h2>Configure JupyterLab</h2>
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
                  theme: "jupyter",
                  lineNumbers: true,
                  viewportMargin: Infinity,
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
              buildFetchHash={state.buildFetchHash}
              buildRequestEndpoint={
                "/catch/api-proxy/api/jupyter-builds/most-recent"
              }
              buildsKey="jupyter_builds"
              socketIONamespace={
                appContext.state?.config
                  .ORCHEST_SOCKETIO_JUPYTER_BUILDING_NAMESPACE
              }
              streamIdentity={"jupyter"}
              onUpdateBuild={onUpdateBuild}
              onBuildStart={onBuildStart}
              ignoreIncomingLogs={state.ignoreIncomingLogs}
              build={state.jupyterBuild}
              building={state.building}
            />

            <Button
              startIcon={<SaveIcon />}
              variant="contained"
              type="submit"
              onClick={() => save(undefined)}
            >
              {appContext.state.hasUnsavedChanges ? "Save*" : "Save"}
            </Button>

            {!state.building ? (
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
          </>
        ) : (
          <LinearProgress />
        )}
      </div>
    </Layout>
  );
};

export default ConfigureJupyterLabView;
