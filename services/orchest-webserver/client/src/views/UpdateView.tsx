import * as React from "react";
import { MDCButtonReact, MDCLinearProgressReact } from "@orchest/lib-mdc";
import {
  checkHeartbeat,
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import { Layout } from "@/components/Layout";
import { useInterval } from "@/hooks/use-interval";

const UpdateView: React.FC<null> = () => {
  const { orchest } = window;

  const [state, setState] = React.useState((prevState) => ({
    ...prevState,
    updating: false,
    updateOutput: "",
  }));
  const [updatePollInterval, setUpdatePollInterval] = React.useState(null);

  const [promiseManager] = React.useState(new PromiseManager());

  const startUpdateTrigger = () => {
    orchest.confirm(
      "Warning",
      "Are you sure you want to update Orchest? This will kill all active sessions and ongoing runs.",
      () => {
        setState({
          updating: true,
          updateOutput: "",
        });

        makeRequest("GET", "/async/spawn-update-server", {})
          .then(() => {
            console.log("Spawned update-server, start polling update-server.");

            checkHeartbeat("/update-server/heartbeat")
              .then(() => {
                console.log("Update service available");
                requestUpdate();
              })
              .catch((retries) => {
                console.log(
                  "Update service heartbeat checking timed out after " +
                    retries +
                    " retries."
                );
              });
          })
          .catch((e) => {
            console.log("Failed to trigger update", e);
          });
      }
    );
  };

  const startUpdatePolling = () => {
    setUpdatePollInterval(1000);
  };

  const requestUpdate = () => {
    let updateUrl = "/update-server/update";

    let updatePromise = makeCancelable(
      makeRequest("POST", updateUrl),
      promiseManager
    );
    updatePromise.promise
      .then(() => {
        startUpdatePolling();
      })
      .catch((e) => {
        console.error(e);
      });
  };

  useInterval(() => {
    let updateStatusPromise = makeCancelable(
      makeRequest("GET", "/update-server/update-status"),
      promiseManager,
      // @ts-ignore
      undefined,
      2000
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
      <div className={"view-page update-page"}>
        <h2>Orchest updater</h2>
        <p className="push-down">Update Orchest to the latest version.</p>

        {(() => {
          let elements = [];

          if (state.updating) {
            elements.push(
              <MDCLinearProgressReact key="0" classNames={["push-down"]} />
            );
          }
          if (state.updateOutput.length > 0) {
            elements.push(
              <div key="1" className="console-output">
                {updateOutputLines.join("\n")}
              </div>
            );
          }

          return (
            <React.Fragment>
              <MDCButtonReact
                classNames={["push-down"]}
                label="Start update"
                icon="system_update_alt"
                disabled={state.updating}
                onClick={startUpdateTrigger.bind(this)}
              />

              {elements}
            </React.Fragment>
          );
        })()}
      </div>
    </Layout>
  );
};

export default UpdateView;
