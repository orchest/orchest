import { useAppContext } from "@/contexts/AppContext";
import { useAsync } from "@/hooks/useAsync";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchEnvironments } from "@/hooks/useFetchEnvironments";
import { usePoller } from "@/hooks/usePoller";
import { siteMap } from "@/routingConfig";
import { DefaultEnvironment, IOrchestSession } from "@/types";
import AddIcon from "@mui/icons-material/Add";
import LensIcon from "@mui/icons-material/Lens";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { fetcher, HEADER } from "@orchest/lib-utils";
import React from "react";
import { BoldText } from "./common/BoldText";
import { PageTitle } from "./common/PageTitle";
import { DataTable, DataTableColumn } from "./DataTable";
import { TStatus } from "./Status";

export interface IEnvironmentListProps {
  projectUuid: string | undefined;
}

type Environment = {
  base_image: string;
  gpu_support: boolean;
  language: string;
  name: string;
  project_uuid: string;
  setup_script: string;
  uuid: string;
};

type EnvironmentImageBuild = {
  environment_uuid: string;
  finished_time: string;
  project_path: string;
  project_uuid: string;
  requested_time: string;
  started_time: string;
  status: TStatus;
  uuid: string;
};

type EnvironmentRow = {
  uuid: string;
  name: string;
  language: string;
  gpu_support: boolean;
  status: string;
};

const columns: DataTableColumn<EnvironmentRow>[] = [
  { id: "name", label: "Environment" },
  { id: "language", label: "Language" },
  {
    id: "gpu_support",
    label: "GPU Support",
    sx: { margin: (theme) => theme.spacing(-0.5, 0) },
    render: function GpuSupport({ gpu_support }) {
      return (
        <Stack direction="row" alignItems="center" justifyContent="center">
          <LensIcon
            color={gpu_support ? "success" : "disabled"}
            sx={{
              margin: (theme) => theme.spacing(1.25, 1, 1.25, 0), // so the row height will be 63
              fontSize: 10,
            }}
          />
          {gpu_support ? "Enabled" : "Disabled"}
        </Stack>
      );
    },
  },
  { id: "status", label: "Build status" },
];

const BUILD_POLL_FREQUENCY = 3000;

const requestToRemoveEnvironment = (
  projectUuid: string | undefined,
  environmentUuid: string | undefined
) => {
  if (!projectUuid || !environmentUuid) return Promise.reject();
  // ultimately remove Image
  return fetcher<void>(
    `/store/environments/${projectUuid}/${environmentUuid}`,
    { method: "DELETE" }
  );
};

const fetchSessionsInProject = async (projectUuid: string) => {
  const sessionData = await fetcher<{ sessions: IOrchestSession[] }>(
    `/catch/api-proxy/api/sessions/?project_uuid=${projectUuid}`
  );
  return sessionData.sessions;
};

const fetchMostRecentEnvironmentBuilds = async (
  projectUuid: string,
  environmentUuid?: string
) => {
  const buildData = await fetcher<{
    environment_image_builds: EnvironmentImageBuild[];
  }>(
    `/catch/api-proxy/api/environment-builds/most-recent/${projectUuid}${
      environmentUuid ? `/${environmentUuid}` : ""
    }`
  );
  const { environment_image_builds } = buildData;
  return environment_image_builds;
};

const hasSuccessfulBuild = async (
  projectUuid: string,
  environmentUuid: string
) => {
  const builds = await fetchMostRecentEnvironmentBuilds(
    projectUuid,
    environmentUuid
  );
  // No successful build; safe to remove this environment.
  return builds.some((x) => x.status === "SUCCESS");
};

const getNewEnvironmentName = (
  defaultName: string,
  environments: Environment[]
) => {
  let count = 0;
  let finalName = defaultName;
  const allNames = new Set(environments.map((e) => e.name));
  while (count < 100) {
    const newName = `${finalName}${count === 0 ? "" : ` (${count})`}`;
    if (!allNames.has(newName)) {
      finalName = newName;
      break;
    }
    count += 1;
  }
  return finalName;
};

const requestToCreateEnvironment = (
  projectUuid: string,
  environmentName: string,
  defaultEnvironments: DefaultEnvironment
) =>
  fetcher<Environment>(`/store/environments/${projectUuid}/new`, {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify({
      environment: {
        ...defaultEnvironments,
        uuid: "new",
        name: environmentName,
      },
    }),
  });

const useMostRecentEnvironmentBuilds = ({
  projectUuid,
  environmentUuid,
  refreshInterval,
}: {
  projectUuid: string | undefined;
  environmentUuid?: string | undefined;
  refreshInterval?: undefined | number;
}) => {
  const { run, data, error } = useAsync<EnvironmentImageBuild[]>();

  const sendRequest = React.useCallback(() => {
    if (!projectUuid) return Promise.reject();
    return run(fetchMostRecentEnvironmentBuilds(projectUuid, environmentUuid));
  }, [environmentUuid, projectUuid, run]);

  usePoller(sendRequest, refreshInterval);

  React.useEffect(() => {
    sendRequest();
  }, [sendRequest]);

  return {
    environmentBuilds: data,
    error,
  };
};

const useEnvironmentList = (
  projectUuid: string | undefined,
  navigateToProject: () => void
) => {
  const { setAlert } = useAppContext();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedNavigateToProject = React.useCallback(navigateToProject, []);

  const {
    environments = [],
    isFetchingEnvironments,
    setEnvironments,
    error: fetchEnvironmentsError,
  } = useFetchEnvironments(projectUuid);

  React.useEffect(() => {
    if (fetchEnvironmentsError) {
      setAlert("Error", "Error fetching Environments");
      memoizedNavigateToProject();
    }
  }, [fetchEnvironmentsError, memoizedNavigateToProject, setAlert]);
  const {
    environmentBuilds = [],
    error: fetchBuildsError,
  } = useMostRecentEnvironmentBuilds({
    projectUuid,
    refreshInterval: BUILD_POLL_FREQUENCY,
  });

  React.useEffect(() => {
    if (fetchBuildsError)
      setAlert(
        "Error",
        "Failed to fetch the latests build of the environment."
      );
  }, [fetchBuildsError, setAlert]);

  const environmentRows = React.useMemo(() => {
    const statusObject = environmentBuilds.reduce((obj, build) => {
      return {
        ...obj,
        [`${build.project_uuid}-${build.environment_uuid}`]: build.status,
      };
    }, {} as Record<string, TStatus>);
    return environments.map((env) => ({
      ...env,
      status: statusObject[`${env.project_uuid}-${env.uuid}`] || "NOT BUILT",
    }));
  }, [environments, environmentBuilds]);

  return {
    environmentRows,
    environments,
    isFetchingEnvironments,
    setEnvironments,
  };
};

const EnvironmentList: React.FC<IEnvironmentListProps> = ({ projectUuid }) => {
  const { navigateTo } = useCustomRoute();
  const { setAlert, setConfirm, config } = useAppContext();

  const navigateToProject = () => navigateTo(siteMap.projects.path);
  const {
    setEnvironments,
    environmentRows,
    environments,
    isFetchingEnvironments,
  } = useEnvironmentList(projectUuid, navigateToProject);

  const doRemoveEnvironment = async (environmentUuid: string) => {
    if (!projectUuid) return Promise.reject();
    await requestToRemoveEnvironment(projectUuid, environmentUuid);
    setEnvironments((current) =>
      current
        ? current.filter((current) => current.uuid !== environmentUuid)
        : current
    );
  };

  const onRowClick = (e: React.MouseEvent, environmentUuid: string) => {
    navigateTo(
      siteMap.environment.path,
      { query: { projectUuid, environmentUuid } },
      e
    );
  };

  const [isCreatingEnvironment, setIsCreatingEnvironment] = React.useState(
    false
  );

  const onCreateClick = async (e: React.MouseEvent) => {
    if (isCreatingEnvironment || !config?.ENVIRONMENT_DEFAULTS || !projectUuid)
      return;
    try {
      setIsCreatingEnvironment(true);
      const defaultEnvironments = config?.ENVIRONMENT_DEFAULTS;
      const response = await requestToCreateEnvironment(
        projectUuid,
        getNewEnvironmentName(defaultEnvironments.name, environments),
        defaultEnvironments
      );
      navigateTo(
        siteMap.environment.path,
        {
          query: {
            projectUuid,
            environmentUuid: response.uuid,
          },
        },
        e
      );
      setIsCreatingEnvironment(false);
    } catch (error) {
      setAlert("Error", `Failed to create new environment. ${error}`);
    }
  };

  const removeEnvironment = async (
    projectUuid: string,
    environmentUuid: string,
    environmentName: string
  ) => {
    if (!projectUuid) return false;

    const sessions = await fetchSessionsInProject(projectUuid);
    if (sessions.length > 0) {
      if (await hasSuccessfulBuild(projectUuid, environmentUuid)) {
        setAlert(
          "Error",
          <>
            {`Environment [ `}
            <BoldText>{environmentName}</BoldText>
            {` ] cannot be deleted with a running interactive session.`}
          </>
        );
        return false;
      }

      return doRemoveEnvironment(environmentUuid);
    }

    const imageData = await fetcher<{ in_use: boolean }>(
      `/catch/api-proxy/api/environments/in-use/${projectUuid}/${environmentUuid}`
    );

    if (imageData.in_use) {
      return setConfirm(
        "Warning",
        <>
          {`The environment you're trying to delete ( `}
          <BoldText>environmentName</BoldText>
          {` ) is in use. Are you sure you want to delete it? This will abort all jobs that are using it.`}
        </>,
        async (resolve) => {
          doRemoveEnvironment(environmentUuid)
            .then(() => {
              resolve(true);
            })
            .catch((error) => {
              setAlert(
                "Error",
                `Deleting environment '${environmentName}' failed. ${error.message}`
              );
              resolve(false);
            });
          return true;
        }
      );
    }
    return doRemoveEnvironment(environmentUuid);
  };

  const onDeleteClick = async (environmentUuids: string[]) => {
    return setConfirm(
      "Warning",
      "Are you certain that you want to delete the selected environments?",
      async (resolve) => {
        const environmentsDict = environments.reduce((all, curr) => {
          return { ...all, [curr.uuid]: curr };
        }, {});
        try {
          Promise.all(
            environmentUuids.map((environmentUuid) => {
              const { project_uuid, uuid, name } = environmentsDict[
                environmentUuid
              ] as Environment;
              return removeEnvironment(project_uuid, uuid, name);
            })
          )
            .then(() => {
              resolve(true);
            })
            .catch(() => {
              resolve(false); // no need to setAlert here, will be handled by removeEnvironment
            });
          return true;
        } catch (error) {
          return false;
        }
      }
    );
  };

  return (
    <div className={"environments-page"}>
      <PageTitle>Environments</PageTitle>
      {!environments ? (
        <LinearProgress />
      ) : (
        <>
          <Box sx={{ margin: (theme) => theme.spacing(2, 0) }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onCreateClick}
              onAuxClick={onCreateClick}
              disabled={isCreatingEnvironment}
              data-test-id="environments-create"
            >
              Create environment
            </Button>
          </Box>
          <DataTable<EnvironmentRow>
            selectable
            hideSearch
            isLoading={isFetchingEnvironments}
            id="environment-list"
            columns={columns}
            rows={environmentRows}
            onRowClick={onRowClick}
            deleteSelectedRows={onDeleteClick}
            data-test-id="environments"
          />
        </>
      )}
    </div>
  );
};

export default EnvironmentList;
