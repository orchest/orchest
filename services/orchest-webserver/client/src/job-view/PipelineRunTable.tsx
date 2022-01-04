import { DataTable, DataTableColumn } from "@/components/DataTable";
import { NoParameterAlert } from "@/components/ParamTree";
import { StatusInline } from "@/components/Status";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap, toQueryString } from "@/Routes";
import { Pagination, PipelineRun } from "@/types";
import { formatServerDateTime } from "@/utils/webserver-utils";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { fetcher } from "@orchest/lib-utils";
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
    sx: { width: (theme) => theme.spacing(3) },
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

const getQueryString = ({
  page,
  rowsPerPage,
}: {
  page: number;
  rowsPerPage: number;
}) => toQueryString({ page, page_size: rowsPerPage });

export const PipelineRunTable: React.FC<{
  jobUuid: string;
  pipelineName: string;
}> = ({ jobUuid, pipelineName }) => {
  const { setAlert } = useAppContext();
  const { navigateTo } = useCustomRoute();

  const onDetailPipelineView = (pipelineRun: PipelineRun) => {
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

  type Response = {
    pipeline_runs: PipelineRun[];
    pagination_data: Pagination;
  };

  return (
    <DataTable<PipelineRun>
      id="job-pipeline-runs"
      containerSx={{ maxHeight: "40vh" }}
      hideSearch // TODO: enable when BE supports it
      fetcher={({ page, rowsPerPage, run }) => {
        const url = `/catch/api-proxy/api/jobs/${jobUuid}/pipeline_runs${getQueryString(
          { page, rowsPerPage }
        )}`;
        run(
          fetcher<Response>(url).then((response) => ({
            rows: response.pipeline_runs,
            totalCount: response.pagination_data?.total_items,
          }))
        );
      }}
      data-test-id="job-pipeline-runs"
      composeRow={(run) => {
        const formattedRunParams = formatPipelineParams(run.parameters);
        const hasParameters = formattedRunParams.length > 0;
        const formattedRunParamsAsString = hasParameters
          ? formattedRunParams.join(", ")
          : PARAMETERLESS_RUN;

        const paramDetails = !hasParameters ? (
          <NoParameterAlert />
        ) : (
          <>
            <Typography variant="body2">Pipeline: {pipelineName}</Typography>
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
      }}
      columns={columns}
      initialOrderBy="pipeline_run_index"
      initialOrder="desc"
      initialRowsPerPage={5}
    />
  );
};
