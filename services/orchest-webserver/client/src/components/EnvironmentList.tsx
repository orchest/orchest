import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useMounted } from "@/hooks/useMounted";
import { siteMap } from "@/Routes";
import AddIcon from "@mui/icons-material/Add";
import LensIcon from "@mui/icons-material/Lens";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR from "swr";
import { BoldText } from "./common/BoldText";
import { DataTable, DataTableColumn } from "./DataTable";
import { TStatus } from "./Status";

export interface IEnvironmentListProps {
  projectUuid: string;
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

type EnvironmentBuild = {
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

const doRemoveEnvironment = (
  project_uuid: string,
  environment_uuid: string,
  callback?: (environmentUuid: string) => void
) => {
  // ultimately remove Image
  return fetcher(`/store/environments/${project_uuid}/${environment_uuid}`, {
    method: "DELETE",
  }).then(() => callback && callback(environment_uuid));
};

const EnvironmentList: React.FC<IEnvironmentListProps> = ({ projectUuid }) => {
  const { navigateTo } = useCustomRoute();
  const { setAlert, setConfirm } = useAppContext();
  const mounted = useMounted();

  const {
    data: fetchedEnvironments = [],
    error: fetchEnvironmentsError,
    isValidating,
    mutate: setFetchedEnvironments,
  } = useSWR<Environment[]>(
    projectUuid ? `/store/environments/${projectUuid}` : null,
    fetcher
  );

  const removeFetchedEnvironment = (uuid: string) => {
    setFetchedEnvironments(
      (current) => current.filter((current) => current.uuid !== uuid),
      false
    );
  };

  React.useEffect(() => {
    if (mounted && fetchEnvironmentsError) {
      setAlert("Error", "Error fetching Environments");
      navigateTo(siteMap.projects.path);
    }
  }, [fetchEnvironmentsError]);

  const {
    data: environmentBuilds = [],
    error: fetchBuildsError,
  } = useSWR(
    projectUuid
      ? `/catch/api-proxy/api/environment-builds/most-recent/${projectUuid}`
      : null,
    (url: string) =>
      fetcher<{ environment_builds: EnvironmentBuild[] }>(url).then(
        (response) => response.environment_builds
      ),
    { refreshInterval: BUILD_POLL_FREQUENCY }
  );

  React.useEffect(() => {
    if (mounted && fetchBuildsError)
      setAlert(
        "Error",
        "Failed to fetch the latests build of the environment."
      );
  }, [fetchBuildsError]);

  const environmentRows = React.useMemo(() => {
    const statusObject = environmentBuilds.reduce((obj, build) => {
      return {
        ...obj,
        [`${build.project_uuid}-${build.environment_uuid}`]: build.status,
      };
    }, {} as Record<string, TStatus>);
    return fetchedEnvironments.map((env) => ({
      ...env,
      status: statusObject[`${env.project_uuid}-${env.uuid}`] || "NOT BUILT",
    }));
  }, [fetchedEnvironments, environmentBuilds]);

  const onRowClick = (environmentUuid: string) => {
    navigateTo(siteMap.environment.path, {
      query: { projectUuid, environmentUuid },
    });
  };

  const onCreateClick = () => {
    navigateTo(siteMap.environment.path, {
      query: { projectUuid, environmentUuid: "create" }, // TODO: check how current implementation of create environment
    });
  };

  const removeEnvironment = async (
    projectUuid: string,
    environmentUuid: string,
    environmentName: string
  ) => {
    if (!projectUuid) return false;
    const sessionData = await fetcher<{ sessions: any[] }>(
      `/catch/api-proxy/api/sessions/?project_uuid=${projectUuid}`
    );
    if (sessionData.sessions.length > 0) {
      const buildData = await fetcher<{ environment_builds: any[] }>(
        `/catch/api-proxy/api/environment-builds/most-recent/${projectUuid}/${environmentUuid}`
      );
      if (buildData.environment_builds.some((x) => x.status == "SUCCESS")) {
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
      return doRemoveEnvironment(
        projectUuid,
        environmentUuid,
        removeFetchedEnvironment
      );
    }

    const imageData = await fetcher<{ in_use: boolean }>(
      `/catch/api-proxy/api/environment-images/in-use/${projectUuid}/${environmentUuid}`
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
          doRemoveEnvironment(
            projectUuid,
            environmentUuid,
            removeFetchedEnvironment
          )
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
    return doRemoveEnvironment(
      projectUuid,
      environmentUuid,
      removeFetchedEnvironment
    );
  };

  const onDeleteClick = async (environmentUuids: string[]) => {
    return setConfirm(
      "Warning",
      "Are you certain that you want to delete the selected environments?",
      async (resolve) => {
        const environmentsDict = fetchedEnvironments.reduce((all, curr) => {
          return { ...all, [curr.uuid]: curr };
        }, {});

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
      }
    );
  };

  return (
    <div className={"environments-page"}>
      <h2>Environments</h2>
      {!fetchedEnvironments ? (
        <LinearProgress />
      ) : (
        <>
          <Box sx={{ margin: (theme) => theme.spacing(2, 0) }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onCreateClick}
              data-test-id="environments-create"
            >
              Create environment
            </Button>
          </Box>
          <DataTable<EnvironmentRow>
            selectable
            hideSearch
            isLoading={isValidating}
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
