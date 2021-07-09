import * as React from "react";
import ProjectsView from "./ProjectsView";
import {
  makeRequest,
  makeCancelable,
  PromiseManager,
} from "@orchest/lib-utils";
import { MDCButtonReact, MDCLinearProgressReact } from "@orchest/lib-mdc";
import { useOrchest } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import EnvVarList from "@/components/EnvVarList";
import {
  envVariablesArrayToDict,
  envVariablesDictToArray,
  OverflowListener,
} from "@/utils/webserver-utils";
import PipelinesView from "@/views/PipelinesView";
import JobsView from "@/views/JobsView";
import EnvironmentsView from "@/views/EnvironmentsView";

const ProjectSettingsView: React.FC<any> = (props) => {
  const { orchest } = window;

  const context = useOrchest();
  const [state, setState] = React.useState({
    unsavedChanges: false,
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
      makeRequest("GET", "/async/projects/" + props.queryArgs.project_uuid),
      promiseManager
    );

    projectPromise.promise.then((response) => {
      let result = JSON.parse(response);

      setState((prevState) => ({
        ...prevState,
        envVariables: envVariablesDictToArray(result["env_variables"]),
        pipeline_count: result["pipeline_count"],
        job_count: result["job_count"],
        environment_count: result["environment_count"],
        projectName: result["path"],
      }));
    });
  };

  const returnToProjects = () => {
    orchest.loadView(ProjectsView);
  };

  const saveGeneralForm = (e) => {
    e.preventDefault();

    let envVariables = envVariablesArrayToDict(state.envVariables);
    // Do not go through if env variables are not correctly defined.
    if (envVariables === undefined) {
      return;
    }

    // perform PUT to update
    makeRequest("PUT", "/async/projects/" + props.queryArgs.project_uuid, {
      type: "json",
      content: { env_variables: envVariables },
    })
      .then(() => {
        setState((prevState) => ({
          ...prevState,
          unsavedChanges: false,
        }));
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
      unsavedChanges: true,
      envVariables: envVariables,
    }));
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
      unsavedChanges: true,
    }));
  };

  const onClickProjectEntity = (view, projectUUID, e) => {
    e.preventDefault();
    context.dispatch({
      type: "projectSet",
      payload: projectUUID,
    });
    orchest.loadView(view);
  };

  React.useEffect(() => {
    fetchSettings();
    attachResizeListener();

    return () => promiseManager.cancelCancelablePromises();
  }, []);

  React.useEffect(() => {
    context.dispatch({
      type: "setUnsavedChanges",
      payload: state.unsavedChanges,
    });
  }, [state.unsavedChanges]);

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
              onClick={returnToProjects.bind(this)}
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
                      <button
                        className="text-button"
                        onClick={onClickProjectEntity.bind(
                          this,
                          PipelinesView,
                          props.queryArgs.project_uuid
                        )}
                      >
                        {state.pipeline_count +
                          " " +
                          (state.pipeline_count == 1
                            ? "pipeline"
                            : "pipelines")}
                      </button>
                    </h3>
                  </div>
                  <div className="column">
                    <br />
                    <h3>
                      <button
                        className="text-button"
                        onClick={onClickProjectEntity.bind(
                          this,
                          JobsView,
                          props.queryArgs.project_uuid
                        )}
                      >
                        {state.job_count +
                          " " +
                          (state.job_count == 1 ? "job" : "jobs")}
                      </button>
                    </h3>
                  </div>
                  <div className="column">
                    <br />
                    <h3>
                      <button
                        className="text-button"
                        onClick={onClickProjectEntity.bind(
                          this,
                          EnvironmentsView,
                          props.queryArgs.project_uuid
                        )}
                      >
                        {state.environment_count +
                          " " +
                          (state.environment_count == 1
                            ? "environment"
                            : "environments")}
                      </button>
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
                  onAdd={addEnvPair.bind(this)}
                />
              </div>
              <div className="bottom-buttons observe-overflow">
                <MDCButtonReact
                  label={state.unsavedChanges ? "SAVE*" : "SAVE"}
                  classNames={["mdc-button--raised", "themed-secondary"]}
                  onClick={saveGeneralForm.bind(this)}
                  icon="save"
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
