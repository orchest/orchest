import React from "react";
import { Link } from "react-router-dom";

import {
  makeRequest,
  makeCancelable,
  PromiseManager,
} from "@orchest/lib-utils";
import { MDCButtonReact, MDCLinearProgressReact } from "@orchest/lib-mdc";
import type { TViewProps } from "@/types";
import { useOrchest } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import EnvVarList from "@/components/EnvVarList";
import {
  envVariablesArrayToDict,
  envVariablesDictToArray,
  OverflowListener,
  isValidEnvironmentVariableName,
} from "@/utils/webserver-utils";
import { generatePathFromRoute, siteMap } from "@/Routes";
import { useCustomRoute } from "@/hooks/useCustomRoute";

const ProjectSettingsView: React.FC<TViewProps> = (props) => {
  // global states
  const { orchest } = window;
  const context = useOrchest();

  // data from route
  const { history, projectId } = useCustomRoute();

  // local states
  const [state, setState] = React.useState({
    envVariables: null,
    pipeline_count: null,
    job_count: null,
    environment_count: null,
    projectName: null,
  });

  const [promiseManager] = React.useState(new PromiseManager());
  const [overflowListener] = React.useState(new OverflowListener());

  const attachResizeListener = () => {
    overflowListener.attach();
  };

  const fetchSettings = () => {
    let projectPromise = makeCancelable(
      makeRequest("GET", "/async/projects/" + projectId),
      promiseManager
    );

    projectPromise.promise
      .then((response) => {
        let result = JSON.parse(response);

        setState((prevState) => ({
          ...prevState,
          envVariables: envVariablesDictToArray(result["env_variables"]),
          pipeline_count: result["pipeline_count"],
          job_count: result["job_count"],
          environment_count: result["environment_count"],
          projectName: result["path"],
        }));
      })
      .catch(console.log);
  };

  const returnToProjects = () => {
    history.push(siteMap.projects.path);
  };

  const saveGeneralForm = (e) => {
    e.preventDefault();

    let envVariables = envVariablesArrayToDict(state.envVariables);
    // Do not go through if env variables are not correctly defined.
    if (envVariables === undefined) {
      return;
    }

    // Validate environment variable names
    for (let envVariableName of Object.keys(envVariables)) {
      if (!isValidEnvironmentVariableName(envVariableName)) {
        orchest.alert(
          "Error",
          'Invalid environment variable name: "' + envVariableName + '".'
        );
        return;
      }
    }

    // perform PUT to update
    makeRequest("PUT", "/async/projects/" + projectId, {
      type: "json",
      content: { env_variables: envVariables },
    })
      .then(() => {
        context.dispatch({
          type: "setUnsavedChanges",
          payload: false,
        });
      })
      .catch((response) => {
        console.error(response);
      });
  };

  const handleChange = (value, idx, type) => {
    const envVariables = state.envVariables.slice();
    envVariables[idx][type] = value;

    setState((prevState) => ({
      ...prevState,
      envVariables: envVariables,
    }));
    context.dispatch({
      type: "setUnsavedChanges",
      payload: true,
    });
  };

  const addEnvPair = (e) => {
    e.preventDefault();

    const envVariables = state.envVariables.slice();
    setState((prevState) => ({
      ...prevState,
      envVariables: envVariables.concat([
        {
          name: null,
          value: null,
        },
      ]),
    }));
  };

  const onDelete = (idx) => {
    const envVariables = state.envVariables.slice();
    envVariables.splice(idx, 1);
    setState((prevState) => ({
      ...prevState,
      envVariables: envVariables,
    }));
    context.dispatch({
      type: "setUnsavedChanges",
      payload: true,
    });
  };

  React.useEffect(() => {
    fetchSettings();
    attachResizeListener();

    return () => promiseManager.cancelCancelablePromises();
  }, []);

  React.useEffect(() => {
    attachResizeListener();
  }, [props, state]);

  return (
    <Layout>
      <div className={"view-page view-project-settings"}>
        <form
          className="project-settings-form"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div className="push-down">
            <MDCButtonReact
              label="Back to projects"
              icon="arrow_back"
              onClick={returnToProjects}
            />
          </div>

          <h2>Project settings</h2>

          {state?.envVariables ? (
            <>
              <div className="project-settings trigger-overflow">
                <div className="columns four push-down top-labels">
                  <div className="column">
                    <label>Project</label>
                    <h3>{state.projectName}</h3>
                  </div>
                  <div className="column">
                    <br />
                    <h3>
                      <Link
                        to={generatePathFromRoute(siteMap.pipelines.path, {
                          projectId,
                        })}
                        className="text-button"
                      >
                        {state.pipeline_count +
                          " " +
                          (state.pipeline_count == 1
                            ? "pipeline"
                            : "pipelines")}
                      </Link>
                    </h3>
                  </div>
                  <div className="column">
                    <br />
                    <h3>
                      <Link
                        to={generatePathFromRoute(siteMap.jobs.path, {
                          projectId,
                        })}
                        className="text-button"
                      >
                        {state.job_count +
                          " " +
                          (state.job_count == 1 ? "job" : "jobs")}
                      </Link>
                    </h3>
                  </div>
                  <div className="column">
                    <br />
                    <h3>
                      <Link
                        to={generatePathFromRoute(siteMap.environments.path, {
                          projectId,
                        })}
                        className="text-button"
                      >
                        {state.environment_count +
                          " " +
                          (state.environment_count == 1
                            ? "environment"
                            : "environments")}
                      </Link>
                    </h3>
                  </div>
                  <div className="clear"></div>
                </div>

                <h3 className="push-down">Project environment variables</h3>

                <EnvVarList
                  value={state.envVariables}
                  onChange={(e, idx, type) => handleChange(e, idx, type)}
                  onDelete={(idx) => onDelete(idx)}
                  readOnly={false}
                  onAdd={addEnvPair}
                  data-test-id="project"
                />
              </div>
              <div className="bottom-buttons observe-overflow">
                <MDCButtonReact
                  label={context.state.unsavedChanges ? "SAVE*" : "SAVE"}
                  classNames={["mdc-button--raised", "themed-secondary"]}
                  onClick={saveGeneralForm}
                  icon="save"
                  data-test-id="project-settings-save"
                />
              </div>
            </>
          ) : (
            <MDCLinearProgressReact />
          )}
        </form>
      </div>
    </Layout>
  );
};

export default ProjectSettingsView;
