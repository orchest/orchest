import { useAppContext } from "@/contexts/AppContext";
import { useCancelablePromise } from "@/hooks/useCancelablePromise";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import AddIcon from "@mui/icons-material/Add";
import LensIcon from "@mui/icons-material/Lens";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import { BoldText } from "../components/common/BoldText";
import { PageTitle } from "../components/common/PageTitle";
import { DataTable, DataTableColumn } from "../components/DataTable";
import {
  fetchSessionsInProject,
  getNewEnvironmentName,
  hasSuccessfulBuild,
  postEnvironment,
} from "./common";
import { useEnvironmentList } from "./hooks/useEnvironmentList";

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

const EnvironmentList: React.FC<IEnvironmentListProps> = ({ projectUuid }) => {
  const { navigateTo } = useCustomRoute();
  const { setAlert, setConfirm, config } = useAppContext();

  const navigateToProjects = () => navigateTo(siteMap.projects.path);
  const {
    environmentRows,
    environments,
    isFetchingEnvironments,
    doRemoveEnvironment,
  } = useEnvironmentList(projectUuid, navigateToProjects);

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

  const { makeCancelable } = useCancelablePromise();

  const onCreateClick = async (e: React.MouseEvent) => {
    if (isCreatingEnvironment || !config?.ENVIRONMENT_DEFAULTS || !projectUuid)
      return;
    try {
      setIsCreatingEnvironment(true);
      const defaultEnvironments = config?.ENVIRONMENT_DEFAULTS;
      const response = await makeCancelable(
        postEnvironment(
          projectUuid,
          getNewEnvironmentName(defaultEnvironments.name, environments) ||
            "New environment",
          defaultEnvironments
        )
      );
      setIsCreatingEnvironment(false);
      navigateTo(
        siteMap.environment.path,
        { query: { projectUuid, environmentUuid: response.uuid } },
        e
      );
    } catch (error) {
      if (!error.isCanceled) {
        setAlert("Error", `Failed to create new environment. ${String(error)}`);
      }
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
        }, {} as Record<string, Environment>);
        try {
          Promise.all(
            environmentUuids
              .map((environmentUuid) => {
                if (!environmentsDict[environmentUuid]) return null;
                const { project_uuid, uuid, name } = environmentsDict[
                  environmentUuid
                ];

                return removeEnvironment(project_uuid, uuid, name);
              })
              .filter((value) => value)
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
