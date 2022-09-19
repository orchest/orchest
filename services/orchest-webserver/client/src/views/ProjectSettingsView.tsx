import { projectsApi } from "@/api/projects/projectsApi";
import { PageTitle } from "@/components/common/PageTitle";
import EnvVarList, { EnvVarPair } from "@/components/EnvVarList";
import { Layout } from "@/components/Layout";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
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
import { SaveOutlined } from "@mui/icons-material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
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
    setConfirm,
    state: { hasUnsavedChanges },
  } = useGlobalContext();
  const {
    dispatch,
    state: { projects },
  } = useProjectsContext();
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

  const requestDeleteProject = React.useCallback(
    async (toBeDeletedId: string) => {
      if (projectUuid === toBeDeletedId) {
        dispatch({ type: "SET_PROJECT", payload: undefined });
      }

      try {
        await projectsApi.delete(toBeDeletedId);

        dispatch((current) => {
          const updatedProjects = (current.projects || []).filter(
            (project) => project.uuid !== toBeDeletedId
          );
          return { type: "SET_PROJECTS", payload: updatedProjects };
        });
      } catch (error) {
        setAlert("Error", `Could not delete project. ${error.message}`);
      }
    },
    [dispatch, projectUuid, setAlert]
  );

  const deleteProject = React.useCallback(() => {
    if (!projectUuid) return;

    const projectName = projects?.find((p) => p.uuid === projectUuid)?.path;

    if (!projectName) return;

    return setConfirm(
      `Delete "${projectName}"?`,
      "Warning: Deleting a Project is permanent. All associated Jobs and resources will be deleted and unrecoverable.",
      {
        onConfirm: async (resolve) => {
          setAsSaved(true);
          requestDeleteProject(projectUuid);
          navigateTo(siteMap.projects.path);
          resolve(true);
          return true;
        },
        cancelLabel: "Keep project",
        confirmLabel: "Delete project",
        confirmButtonColor: "error",
      }
    );
  }, [
    navigateTo,
    projectUuid,
    projects,
    requestDeleteProject,
    setAsSaved,
    setConfirm,
  ]);

  const saveGeneralForm = (event: React.MouseEvent) => {
    event.preventDefault();

    if (!projectUuid) return;

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

    projectsApi
      .put(projectUuid, { env_variables: envVariablesObj.value })
      .then(() => setAsSaved())
      .catch((error) => console.error(error));
  };

  React.useEffect(() => {
    if (!projectUuid) return;

    projectsApi
      .fetchOne(projectUuid)
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
      <Stack className="view-project-settings" sx={{ height: "100%" }}>
        <form onSubmit={(event) => event.preventDefault()}>
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
                  startIcon={<SaveOutlined />}
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
        <Box marginTop="auto" paddingTop={(theme) => theme.spacing(4)}>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteProject()}
            startIcon={<DeleteOutline />}
          >
            Delete Project
          </Button>
        </Box>
      </Stack>
    </Layout>
  );
};

export default ProjectSettingsView;
