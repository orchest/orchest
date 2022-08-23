import { PageTitle } from "@/components/common/PageTitle";
import EnvVarList, { EnvVarPair } from "@/components/EnvVarList";
import { Layout } from "@/components/Layout";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useCancelableFetch } from "@/hooks/useCancelablePromise";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { RouteName, siteMap } from "@/routingConfig";
import { Project } from "@/types";
import { pick } from "@/utils/record";
import { toQueryString } from "@/utils/routing";
import {
  envVariablesArrayToDict,
  envVariablesDictToArray,
  isValidEnvironmentVariableName,
} from "@/utils/webserver-utils";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import { fetcher, HEADER } from "@orchest/lib-utils";
import React from "react";
import { Link } from "react-router-dom";

type RoutePath = Extract<RouteName, "pipeline" | "jobs" | "environments">;

type ProjectSettingsState = Readonly<
  Pick<Project, "pipeline_count" | "environment_count" | "path">
>;

const initialState: ProjectSettingsState = {
  pipeline_count: 0,
  environment_count: 0,
  path: "",
};

const ProjectSettingsView: React.FC = () => {
  const {
    setAlert,
    setAsSaved,
    state: { hasUnsavedChanges },
  } = useGlobalContext();
  useSendAnalyticEvent("view:loaded", { name: siteMap.projectSettings.path });
  const { cancelableFetch } = useCancelableFetch();
  const { navigateTo, projectUuid } = useCustomRoute();
  const [envVariables, setEnvVariables] = React.useState<EnvVarPair[]>();

  const setUnsavedEnvVariables = React.useCallback(
    (value: React.SetStateAction<EnvVarPair[] | undefined>) => {
      setEnvVariables(value);
      setAsSaved(false);
    },
    [setAsSaved]
  );
  const [state, setState] = React.useState<ProjectSettingsState>(initialState);

  const returnToProjects = (event: React.MouseEvent) =>
    navigateTo(siteMap.projects.path, undefined, event);

  const saveGeneralForm = (event: React.MouseEvent) => {
    event.preventDefault();

    const envVariablesObj = envVariablesArrayToDict(envVariables ?? []);

    if (envVariablesObj.status === "rejected") {
      setAlert("Error", envVariablesObj.error);
      return;
    }

    for (const name of Object.keys(envVariablesObj.value)) {
      if (!isValidEnvironmentVariableName(name)) {
        setAlert("Error", `Invalid environment variable name: "${name}".`);
        return;
      }
    }

    fetcher(`/async/projects/${projectUuid}`, {
      method: "PUT",
      headers: HEADER.JSON,
      body: JSON.stringify({ env_variables: envVariablesObj.value }),
    })
      .then(() => setAsSaved())
      .catch((response) => {
        console.error(response);
      });
  };

  React.useEffect(() => {
    cancelableFetch<Project>(`/async/projects/${projectUuid}`)
      .then((result) => {
        const { env_variables, ...newState } = pick(
          result,
          "env_variables",
          "pipeline_count",
          "environment_count",
          "path"
        );

        setEnvVariables(envVariablesDictToArray(env_variables));
        setState((prevState) => ({ ...prevState, ...newState }));
      })
      .catch((error) => console.error(error));
  }, [cancelableFetch, projectUuid]);

  const paths = React.useMemo(() => {
    const routes = ["pipeline", "jobs", "environments"] as RoutePath[];

    return Object.fromEntries(
      routes.map((route) => [
        route,
        `${siteMap[route].path}${toQueryString({ projectUuid })}`,
      ])
    );
  }, [projectUuid]);

  return (
    <Layout>
      <div className={"view-page view-project-settings"}>
        <form
          className="project-settings-form"
          onSubmit={(event) => event.preventDefault()}
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
                    <h3>{state.path}</h3>
                  </div>
                  <div className="column">
                    <br />
                    <h3>
                      <Link to={paths.pipeline} className="text-button">
                        {state.pipeline_count +
                          " " +
                          (state.pipeline_count === 1
                            ? "pipeline"
                            : "pipelines")}
                      </Link>
                    </h3>
                  </div>
                  <div className="column">
                    <br />
                    <h3>
                      <Link to={paths.environments} className="text-button">
                        {state.environment_count +
                          " " +
                          (state.environment_count === 1
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
                  setValue={setUnsavedEnvVariables}
                  data-test-id="project"
                />
              </div>
              <div className="bottom-buttons">
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
