import { useJobsApi } from "@/api/jobs/useJobsApi";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import { useGlobalContext } from "@/contexts/GlobalContext";
import {
  fetchParamConfig,
  generateStrategyJsonFromParamJsonFile,
} from "@/edit-job-view/common";
import { LoadParametersDialog } from "@/edit-job-view/LoadParametersDialog";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { Json, PipelineJson, StrategyJson } from "@/types";
import {
  generateStrategyJson,
  pipelinePathToJsonLocation,
} from "@/utils/webserver-utils";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import { hasValue } from "@orchest/lib-utils";
import cloneDeep from "lodash.clonedeep";
import React from "react";
import {
  flattenStrategyJson,
  generatePipelineRunParamCombinations,
  generatePipelineRunRows,
  PipelineRunColumn,
  PipelineRunRow,
} from "../common";
import { useEditJob } from "../stores/useEditJob";
import { AutoCleanUpToggle } from "./AutoCleanUpToggle";
import { EditJobSchedule } from "./EditJobSchedule";

const generatePipelineRuns = (strategyJSON: StrategyJson) => {
  const flatParameters = flattenStrategyJson(strategyJSON);
  const pipelineRuns: Record<
    string,
    Json
  >[] = generatePipelineRunParamCombinations(flatParameters, [], []);

  return pipelineRuns;
};

const fetchStrategyJson = async (
  projectUuid: string | undefined,
  pipelineUuid: string | undefined,
  jobUuid: string | undefined,
  paramPath: string | undefined,
  pipelineJson: PipelineJson | undefined,
  reservedKey: string | undefined
) => {
  if (
    !projectUuid ||
    !pipelineUuid ||
    !jobUuid ||
    !paramPath ||
    !pipelineJson ||
    !reservedKey
  )
    return;
  try {
    const paramConfig = await fetchParamConfig({
      paramPath,
      pipelineUuid,
      projectUuid,
      jobUuid,
    });

    const strategyJson = generateStrategyJsonFromParamJsonFile(
      paramConfig,
      pipelineJson,
      reservedKey
    );

    return strategyJson;
  } catch (error) {
    if (error.status !== 404) {
      console.error(error);
    }
  }
};

const generateJobParameters = (
  generatedPipelineRuns: Record<string, Json>[],
  selectedIndices: string[]
) => {
  return selectedIndices.map((index) => {
    const runParameters = generatedPipelineRuns[index];
    return Object.entries(runParameters).reduce((all, [key, value]) => {
      // key is formatted: <stepUUID>#<parameterKey>
      let keySplit = key.split("#");
      let stepUUID = keySplit[0];
      let parameterKey = keySplit.slice(1).join("#");

      // check if step already exists,
      const parameter = all[stepUUID] || {};
      parameter[parameterKey] = value;

      return { ...all, [stepUUID]: parameter };
    }, {});
  });
};

const findParameterization = (
  parameterization: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  parameters: Record<string, Json>[]
) => {
  let JSONstring = JSON.stringify(parameterization);
  for (let x = 0; x < parameters.length; x++) {
    if (JSON.stringify(parameters[x]) === JSONstring) {
      return x;
    }
  }
  return -1;
};

const parseParameters = (
  parameters: Record<string, Json>[],
  generatedPipelineRuns: Record<string, Json>[]
): string[] => {
  const _parameters = cloneDeep(parameters);
  const selectedIndices = new Set<string>();
  generatedPipelineRuns.forEach((run, index) => {
    const encodedParameterization = generateJobParameters([run], ["0"])[0];

    const needleIndex = findParameterization(
      encodedParameterization,
      _parameters
    );
    if (needleIndex >= 0) {
      selectedIndices.add(index.toString());
      // remove found parameterization from _parameters, as to not count duplicates
      _parameters.splice(needleIndex, 1);
    } else {
      selectedIndices.delete(index.toString());
    }
  });

  return Array.from(selectedIndices);
};

export const JobRunConfig = () => {
  const { config } = useGlobalContext();

  const reservedKey = config?.PIPELINE_PARAMETERS_RESERVED_KEY;

  const jobUuid = useEditJob((state) => state.jobChanges?.uuid);
  const pipelineUuid = useEditJob((state) => state.jobChanges?.pipeline_uuid);
  const projectUuid = useEditJob((state) => state.jobChanges?.project_uuid);
  const isDraft = useEditJob((state) => state.jobChanges?.status === "DRAFT");

  const jobData = useJobsApi((state) => {
    return state.jobs?.find((job) => job.uuid === jobUuid);
  });

  const pipelinePath = jobData?.pipeline_run_spec.run_config.pipeline_path;

  const pipelineJson = jobData?.pipeline_definition;

  const [strategyJson, setStrategyJson] = React.useState<StrategyJson>();
  const [selectedRuns, setSelectedRuns] = React.useState<string[]>([]);

  const pipelineRuns = React.useMemo(() => {
    return strategyJson ? generatePipelineRuns(strategyJson) : undefined;
  }, [strategyJson]);

  const [
    isLoadParametersDialogOpen,
    setIsLoadParametersDialogOpen,
  ] = React.useState<boolean>(false);

  const showLoadParametersDialog = () => {
    setIsLoadParametersDialogOpen(true);
  };

  const closeLoadParametersDialog = () => {
    setIsLoadParametersDialogOpen(false);
  };

  const {
    projectUuid: projectUuidFromRoute,
    jobUuid: jobUuidFromRoute,
  } = useCustomRoute();

  const isRequiredDataLoaded =
    projectUuid === projectUuidFromRoute &&
    jobUuidFromRoute === jobUuid &&
    hasValue(reservedKey);

  const columns: DataTableColumn<
    PipelineRunRow,
    PipelineRunColumn
  >[] = React.useMemo(
    () => [
      {
        id: "spec",
        label: "Pipeline runs",
        render: function Params(row) {
          return row.spec === "Parameterless run" ? (
            <i>{row.spec}</i>
          ) : (
            row.spec
          );
        },
      },
      {
        id: "toggle",
        label: "Include?",
        render: function IncludeToggle(row) {
          return (
            <Switch
              checked={selectedRuns.some((run) => row.uuid === run)}
              onChange={(_, checked) =>
                setSelectedRuns((current) =>
                  checked
                    ? [...current, row.uuid]
                    : current.filter((selected) => selected !== row.uuid)
                )
              }
              size="small"
              inputProps={{ "aria-label": "Include this run" }}
            />
          );
        },
      },
    ],
    [selectedRuns]
  );

  const pipelineRunRows = React.useMemo(() => {
    if (!pipelineJson?.name || !pipelineRuns) return [];
    return generatePipelineRunRows(pipelineJson.name, pipelineRuns);
  }, [pipelineRuns, pipelineJson?.name]);

  const loadDefaultOrExistingParameterStrategy = React.useCallback(() => {
    if (!jobData || !pipelineJson) return;
    // Do not generate another strategy_json if it has been defined
    // already.
    const strategyJson =
      isDraft && Object.keys(jobData.strategy_json).length === 0
        ? generateStrategyJson(pipelineJson, reservedKey)
        : jobData?.strategy_json;

    setStrategyJson(strategyJson);
  }, [reservedKey, jobData, isDraft, pipelineJson]);

  const loadParamConfig = React.useCallback(
    async (paramConfigFilePath: string) => {
      closeLoadParametersDialog();

      const response = await fetchStrategyJson(
        projectUuid,
        pipelineJson?.uuid,
        jobUuid,
        paramConfigFilePath,
        pipelineJson,
        reservedKey
      );

      if (response) {
        setStrategyJson(response);
      } else {
        loadDefaultOrExistingParameterStrategy();
      }
    },
    [
      jobUuid,
      pipelineJson,
      projectUuid,
      reservedKey,
      loadDefaultOrExistingParameterStrategy,
    ]
  );

  React.useLayoutEffect(() => {
    if (!jobData?.parameters || !pipelineRuns) return;
    setSelectedRuns(
      jobData.parameters.length > 0
        ? parseParameters(jobData.parameters, pipelineRuns)
        : pipelineRunRows.map((row) => row.uuid)
    );
  }, [jobData?.parameters, pipelineRunRows, pipelineRuns]);

  const paramConfigFilePath = React.useMemo(() => {
    if (pipelinePath) return pipelinePathToJsonLocation(pipelinePath);
  }, [pipelinePath]);

  React.useEffect(() => {
    if (!paramConfigFilePath || !isRequiredDataLoaded) return;
    if (isDraft) {
      loadParamConfig(paramConfigFilePath);
    } else {
      loadDefaultOrExistingParameterStrategy();
    }
  }, [
    paramConfigFilePath,
    isDraft,
    isRequiredDataLoaded,
    loadParamConfig,
    loadDefaultOrExistingParameterStrategy,
  ]);

  return (
    <>
      {pipelineUuid && (
        <LoadParametersDialog
          isOpen={isLoadParametersDialogOpen}
          onClose={closeLoadParametersDialog}
          onSubmit={loadParamConfig}
          pipelineUuid={pipelineUuid}
        />
      )}
      <Stack
        direction="column"
        alignItems="flex-start"
        spacing={3}
        sx={{ paddingTop: (theme) => theme.spacing(4) }}
      >
        <EditJobSchedule />
        {hasValue(strategyJson) && (
          <DataTable<PipelineRunRow, PipelineRunColumn>
            hideSearch
            id="job-edit-pipeline-runs"
            columns={columns}
            sx={{
              border: (theme) => `1px solid ${theme.borderColor}`,
              borderRadius: (theme) => theme.spacing(0.5),
              overflow: "hidden",
            }}
            rows={pipelineRunRows}
            retainSelectionsOnPageChange
            data-test-id="job-edit-pipeline-runs"
          />
        )}
        <AutoCleanUpToggle selectedRuns={selectedRuns} />
      </Stack>
    </>
  );
};
