import { DataTable, DataTableColumn } from "@/components/DataTable";
import { NoParameterAlert } from "@/components/ParamTree";
import { StatusInline } from "@/components/Status";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/Routes";
import { Job, PipelineRun } from "@/types";
import { formatServerDateTime } from "@/utils/webserver-utils";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { formatPipelineParams, PARAMETERLESS_RUN } from "./commons";

const columns: DataTableColumn<PipelineRun>[] = [
  { id: "pipeline_run_index", label: "ID" },
  {
    id: "parameters",
    label: "Parameters",
    render: function RunParameters(row) {
      const formattedParams = formatPipelineParams(row.parameters);
      return formattedParams.length === 0 ? (
        <i>{PARAMETERLESS_RUN}</i>
      ) : (
        formattedParams.join(", ")
      );
    },
  },
  {
    id: "status",
    label: "Status",
    render: function RunStatus(row) {
      return <StatusInline status={row.status} />;
    },
  },
  {
    id: "started_time",
    label: "Started at",
    render: function RunStartedTime(row) {
      return row.started_time ? (
        formatServerDateTime(row.started_time)
      ) : (
        <i>Not yet started</i>
      );
    },
  },
];

export const PipelineRunTable: React.FC<{ job: Job }> = ({ job }) => {
  const { setAlert } = useAppContext();
  const { navigateTo } = useCustomRoute();

  const onDetailPipelineView = (pipelineRun) => {
    if (pipelineRun.status == "PENDING") {
      setAlert(
        "Error",
        "This pipeline is still pending. Please wait until pipeline run has started."
      );

      return;
    }

    navigateTo(siteMap.pipeline.path, {
      query: {
        projectUuid: pipelineRun.project_uuid,
        pipelineUuid: pipelineRun.pipeline_uuid,
        jobUuid: pipelineRun.job_uuid,
        runUuid: pipelineRun.uuid,
      },
      state: { isReadOnly: true },
    });
  };

  return (
    <DataTable<PipelineRun>
      id="job-pipeline-runs"
      data-test-id="job-pipeline-runs"
      rows={job.pipeline_runs.map((run) => {
        const formattedRunParams = formatPipelineParams(run.parameters);
        const hasParameters = formattedRunParams.length > 0;
        const formattedRunParamsAsString = hasParameters
          ? formattedRunParams.join(", ")
          : PARAMETERLESS_RUN;

        const paramDetails = !hasParameters ? (
          <NoParameterAlert />
        ) : (
          <>
            <Typography variant="body2">
              Pipeline: {job.pipeline_name}
            </Typography>
            {formattedRunParams.map((param, index) => (
              <Typography
                variant="caption"
                key={index}
                sx={{ paddingLeft: (theme) => theme.spacing(1) }}
              >
                {param}
              </Typography>
            ))}
          </>
        );

        return {
          ...run,
          searchIndex: `${
            run.status === "STARTED" ? "Running" : ""
          }${formattedRunParamsAsString}`,
          details: (
            <Stack
              direction="column"
              alignItems="flex-start"
              sx={{ padding: (theme) => theme.spacing(2, 1) }}
            >
              {paramDetails}
              <Button
                variant="contained"
                startIcon={<VisibilityIcon />}
                onClick={() => onDetailPipelineView(run)}
                sx={{ marginTop: (theme) => theme.spacing(2) }}
                data-test-id="job-pipeline-runs-row-view-pipeline"
              >
                View pipeline
              </Button>
            </Stack>
          ),
        };
      })}
      columns={columns}
      initialOrderBy="pipeline_run_index"
      initialOrder="desc"
    />
  );
};
