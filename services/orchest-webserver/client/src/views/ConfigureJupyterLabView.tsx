import * as React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import "codemirror/mode/shell/shell";
import {
  uuidv4,
  makeRequest,
  makeCancelable,
  PromiseManager,
} from "@orchest/lib-utils";
import { MDCButtonReact, MDCLinearProgressReact } from "@orchest/lib-mdc";
import { OrchestSessionsConsumer, useOrchest } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import ImageBuildLog from "@/components/ImageBuildLog";

const CANCELABLE_STATUSES = ["PENDING", "STARTED"];

const ConfigureJupyterLabView: React.FC = () => {
  const context = useOrchest();

  const { orchest } = window;

  const [state, setState] = React.useState({
    unsavedChanges: false,
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
    orchest.jupyter.unload();

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
                orchest.confirm(
                  "Warning",
                  "You must stop all active sessions in order to build a new JupyerLab image. \n\n" +
                    "Are you sure you want to stop all sessions? All running Jupyter kernels and interactive pipeline runs will be stopped.",
                  () => {
                    context.dispatch({ type: "sessionsKillAll" });
                    setState((prevState) => ({
                      ...prevState,
                      sessionKillStatus: "WAITING",
                    }));
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
      orchest.alert(
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
    setState((prevState) => ({
      ...prevState,
      unsavedChanges: false,
    }));

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
    context.dispatch({
      type: "setUnsavedChanges",
      payload: state.unsavedChanges,
    });
  }, [state.unsavedChanges]);

  React.useEffect(() => {
    if (
      context.state.sessionsKillAllInProgress &&
      state.sessionKillStatus === "WAITING"
    ) {
      setState((prevState) => ({
        ...prevState,
        sessionKillStatus: "VALIDATING",
      }));
    }

    if (
      !context.state.sessionsKillAllInProgress &&
      state.sessionKillStatus === "VALIDATING"
    ) {
      const hasActiveSessions = context.state?.sessions
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
    context.state.sessions,
    context.state.sessionsKillAllInProgress,
    state.sessionKillStatus,
  ]);

  return (
    <OrchestSessionsConsumer>
      <Layout>
        <div className={"view-page jupyterlab-config-page"}>
          {state.jupyterSetupScript !== undefined ? (
            <>
              <h2>Configure JupyterLab</h2>
              <p className="push-down">
                You can install JupyterLab extensions using the bash script
                below.
              </p>
              <p className="push-down">
                For example, you can install the Jupyterlab Code Formatter
                extension by executing{" "}
                <span className="code">
                  pip install jupyterlab_code_formatter
                </span>
                .
              </p>

              <p className="push-down">
                In addition, you can configure the JupyterLab environment to
                include settings such as your <span className="code">git</span>{" "}
                username and email.
                <br />
                <br />
                <span className="code">
                  git config --global user.name "John Doe"
                </span>
                <br />
                <span className="code">
                  git config --global user.email "john@example.org"
                </span>
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
                      unsavedChanges: true,
                    }));
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
                  context.state?.config
                    .ORCHEST_SOCKETIO_JUPYTER_BUILDING_NAMESPACE
                }
                streamIdentity={"jupyter"}
                onUpdateBuild={onUpdateBuild.bind(this)}
                onBuildStart={onBuildStart.bind(this)}
                ignoreIncomingLogs={state.ignoreIncomingLogs}
                build={state.jupyterBuild}
                building={state.building}
              />

              <MDCButtonReact
                label={state.unsavedChanges ? "Save*" : "Save"}
                icon="save"
                classNames={[
                  "mdc-button--raised",
                  "themed-secondary",
                  "push-right",
                ]}
                submitButton
                onClick={save.bind(this, undefined)}
              />

              {!state.building ? (
                <MDCButtonReact
                  label="Build"
                  disabled={
                    state.buildRequestInProgress ||
                    typeof state.sessionKillStatus !== "undefined"
                  }
                  icon="memory"
                  classNames={["mdc-button--raised"]}
                  onClick={buildImage.bind(this)}
                />
              ) : (
                <MDCButtonReact
                  label="Cancel build"
                  disabled={state.cancelBuildRequestInProgress}
                  icon="close"
                  classNames={["mdc-button--raised"]}
                  onClick={cancelImageBuild.bind(this)}
                />
              )}
            </>
          ) : (
            <MDCLinearProgressReact />
          )}
        </div>
      </Layout>
    </OrchestSessionsConsumer>
  );
};

export default ConfigureJupyterLabView;
