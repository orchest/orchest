import { PageTitle } from "@/components/common/PageTitle";
import EnvVarList, { EnvVarPair } from "@/components/EnvVarList";
import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap, toQueryString } from "@/Routes";
import {
  envVariablesArrayToDict,
  envVariablesDictToArray,
  isValidEnvironmentVariableName,
  OverflowListener,
} from "@/utils/webserver-utils";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import React from "react";
import { Link } from "react-router-dom";

const ProjectSettingsView: React.FC = () => {
  // global states

  const {
    setAlert,
    setAsSaved,
    state: { hasUnsavedChanges },
  } = useAppContext();
  useSendAnalyticEvent("view load", { name: siteMap.projectSettings.path });

  // data from route
  const { navigateTo, projectUuid } = useCustomRoute();

  const [envVariables, _setEnvVariables] = React.useState<EnvVarPair[]>([]);
  const setEnvVariables = (value: React.SetStateAction<EnvVarPair[]>) => {
    _setEnvVariables(value);
    setAsSaved(false);
  };

  // local states
  const [state, setState] = React.useState({
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
      makeRequest("GET", "/async/projects/" + projectUuid),
      promiseManager
    );

    projectPromise.promise
      .then((response) => {
        let result = JSON.parse(response);

        _setEnvVariables(envVariablesDictToArray(result["env_variables"]));

        setState((prevState) => ({
          ...prevState,
          // envVariables: envVariablesDictToArray(result["env_variables"]),
          pipeline_count: result["pipeline_count"],
          job_count: result["job_count"],
          environment_count: result["environment_count"],
          projectName: result["path"],
        }));
      })
      .catch(console.log);
  };

  const returnToProjects = (e: React.MouseEvent) => {
    navigateTo(siteMap.projects.path, undefined, e);
  };

  const saveGeneralForm = (e) => {
    e.preventDefault();

    let envVariablesObj = envVariablesArrayToDict(envVariables);
    // Do not go through if env variables are not correctly defined.
    if (envVariablesObj.status === "rejected") {
      setAlert("Error", envVariablesObj.error);
      return;
    }

    // Validate environment variable names
    for (let envVariableName of Object.keys(envVariablesObj.value)) {
      if (!isValidEnvironmentVariableName(envVariableName)) {
        setAlert(
          "Error",
          `Invalid environment variable name: "${envVariableName}".`
        );
        return;
      }
    }

    // perform PUT to update
    makeRequest("PUT", "/async/projects/" + projectUuid, {
      type: "json",
      content: { env_variables: envVariablesObj.value },
    })
      .then(() => {
        setAsSaved();
      })
      .catch((response) => {
        console.error(response);
      });
  };

  React.useEffect(() => {
    fetchSettings();
    attachResizeListener();

    return () => promiseManager.cancelCancelablePromises();
  }, []);

  React.useEffect(() => {
    attachResizeListener();
  }, [state]);

  const paths = React.useMemo(
    () =>
      ["pipeline", "jobs", "environments"].reduce((all, curr) => {
        return {
          ...all,
          [curr]: `${siteMap[curr].path}${toQueryString({ projectUuid })}`,
        };
      }, {}) as Record<"pipeline" | "jobs" | "environments", string>,
    [projectUuid]
  );

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
            <Button
              color="secondary"
              startIcon={<ArrowBackIcon />}
              onClick={returnToProjects}
              onAuxClick={returnToProjects}
            >
              Back to projects
            </Button>
          </div>

          <PageTitle>Project settings</PageTitle>

          {envVariables ? (
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
                      <Link to={paths.pipeline} className="text-button">
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
                      <Link to={paths.jobs} className="text-button">
                        {state.job_count +
                          " " +
                          (state.job_count == 1 ? "job" : "jobs")}
                      </Link>
                    </h3>
                  </div>
                  <div className="column">
                    <br />
                    <h3>
                      <Link to={paths.environments} className="text-button">
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
                  value={envVariables}
                  setValue={setEnvVariables}
                  data-test-id="project"
                />
              </div>
              <div className="bottom-buttons observe-overflow">
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={saveGeneralForm}
                  data-test-id="project-settings-save"
                >
                  {hasUnsavedChanges ? "SAVE*" : "SAVE"}
                </Button>
              </div>
            </>
          ) : (
            <LinearProgress />
          )}
        </form>
      </div>
    </Layout>
  );
};

export default ProjectSettingsView;
