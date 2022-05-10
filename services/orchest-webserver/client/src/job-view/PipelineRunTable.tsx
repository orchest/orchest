import {
  DataTable,
  DataTableColumn,
  DataTableFetcherResponse,
} from "@/components/DataTable";
import { NoParameterAlert } from "@/components/ParamTree";
import { StatusInline } from "@/components/Status";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { Pagination, PipelineRun } from "@/types";
import { toQueryString } from "@/utils/routing";
import { ellipsis } from "@/utils/styles";
import { formatServerDateTime } from "@/utils/webserver-utils";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import { formatPipelineParams, PARAMETERLESS_RUN } from "./common";

const columns: DataTableColumn<PipelineRun>[] = [
  { id: "pipeline_run_index", label: "ID" },
  {
    id: "parameters",
    label: "Parameters",
    sx: { ...ellipsis("40vw"), minWidth: "40vw" },
    align: "left",
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
      return <StatusInline status={row.status} size="small" />;
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
  searchTerm,
}: {
  page: number;
  rowsPerPage: number;
  searchTerm: string;
}) =>
  toQueryString({
    page,
    page_size: rowsPerPage,
    fuzzy_filter: searchTerm,
  });

export const PipelineRunTable: React.FC<{
  jobUuid: string;
  pipelineName: string;
  setTotalCount: (count: number) => void;
  footnote: React.ReactNode;
}> = ({ jobUuid, pipelineName, setTotalCount, footnote }) => {
  const { setAlert, setConfirm } = useAppContext();
  const { navigateTo } = useCustomRoute();

  const cancelRun = React.useCallback(
    async (
      runUuid: string,
      setData: (
        callback: (
          current: DataTableFetcherResponse<PipelineRun>
        ) => DataTableFetcherResponse<PipelineRun>
      ) => void,
      fetchData: () => void
    ) => {
      return setConfirm(
        "Warning",
        "Are you sure that you want to cancel this job run?",
        async (resolve) => {
          try {
            await fetcher(`/catch/api-proxy/api/jobs/${jobUuid}/${runUuid}`, {
              method: "DELETE",
            });
            setData((current: DataTableFetcherResponse<PipelineRun>) => {
              const newRows = [...current.rows];
              const cancelled = newRows.find((row) => row.uuid === runUuid);
              if (cancelled) cancelled.status = "ABORTED";
              return { ...current, rows: newRows };
            });
            resolve(true);
          } catch (error) {
            setAlert("Error", `Failed to cancel this job run.`);
            fetchData();
            resolve(false);
          }
          return true;
        }
      );
    },
    [jobUuid, setAlert, setConfirm]
  );

  const deleteRuns = React.useCallback(
    (rows: string[]) => {
      return setConfirm(
        "Warning",
        "Are you certain that you want to delete the selected runs?",
        async (resolve) => {
          Promise.all(
            rows.map((runUuid) =>
              fetcher(
                `/catch/api-proxy/api/jobs/cleanup/${jobUuid}/${runUuid}`,
                {
                  method: "DELETE",
                }
              )
            )
          )
            .then(() => resolve(true))
            .catch(() => {
              setAlert("Error", `Failed to delete selected job runs`);
              resolve(false);
            });
          return true;
        }
      );
    },
    [jobUuid, setAlert, setConfirm]
  );

  const onDetailPipelineView = (
    e: React.MouseEvent,
    pipelineRun: PipelineRun
  ) => {
    if (pipelineRun.status == "PENDING") {
      setAlert(
        "Error",
        "This pipeline is still pending. Please wait until pipeline run has started."
      );

      return;
    }

    navigateTo(
      siteMap.jobRun.path,
      {
        query: {
          projectUuid: pipelineRun.project_uuid,
          pipelineUuid: pipelineRun.pipeline_uuid,
          jobUuid: pipelineRun.job_uuid,
          runUuid: pipelineRun.uuid,
        },
        state: { isReadOnly: true },
      },
      e
    );
  };

  return (
    <DataTable<PipelineRun>
      id="job-pipeline-runs"
      dense
      selectable
      fetcher={({ page, rowsPerPage, run, searchTerm }) => {
        const url = `/catch/api-proxy/api/jobs/${jobUuid}/pipeline_runs${getQueryString(
          { page, rowsPerPage, searchTerm }
        )}`;

        run(
          fetcher<{
            pipeline_runs: PipelineRun[];
            pagination_data: Pagination;
          }>(url).then((response) => {
            const totalCount = response.pagination_data?.total_items || 0;
            setTotalCount(totalCount);
            return { rows: response.pipeline_runs, totalCount };
          })
        );
      }}
      data-test-id="job-pipeline-runs"
      composeRow={(pipelineRun, setData, fetchData) => {
        const formattedRunParams = formatPipelineParams(pipelineRun.parameters);
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
          ...pipelineRun,
          searchIndex: `${
            pipelineRun.status === "STARTED" ? "Running" : ""
          }${formattedRunParamsAsString}`,
          details: (
            <Stack
              direction="column"
              alignItems="flex-start"
              sx={{ padding: (theme) => theme.spacing(2, 1) }}
            >
              {paramDetails}
              <Stack
                direction="row"
                sx={{ marginTop: (theme) => theme.spacing(2) }}
                spacing={2}
              >
                <Button
                  variant="contained"
                  startIcon={<VisibilityIcon />}
                  onClick={(e) => onDetailPipelineView(e, pipelineRun)}
                  onAuxClick={(e) => onDetailPipelineView(e, pipelineRun)}
                  data-test-id="job-pipeline-runs-row-view-pipeline"
                >
                  View pipeline
                </Button>
                {["STARTED", "PAUSED", "PENDING"].includes(
                  pipelineRun.status
                ) && (
                  <Button
                    variant="contained"
                    startIcon={<CloseIcon />}
                    color="secondary"
                    onClick={() =>
                      cancelRun(pipelineRun.uuid, setData, fetchData)
                    }
                    data-test-id="job-pipeline-runs-row-cancel-run"
                  >
                    Cancel
                  </Button>
                )}
              </Stack>
            </Stack>
          ),
        };
      }}
      deleteSelectedRows={(rows) => deleteRuns(rows)}
      columns={columns}
      initialOrderBy="pipeline_run_index"
      initialOrder="desc"
      initialRowsPerPage={10}
      footnote={footnote}
    />
  );
};
