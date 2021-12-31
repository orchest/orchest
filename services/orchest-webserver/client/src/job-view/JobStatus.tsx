import { StatusGroup, TStatus } from "@/components/Status";
import theme from "@/theme";
import { PipelineRun } from "@/types";
import { commaSeparatedString } from "@/utils/text";
import React from "react";
import { PieChart } from "react-minimal-pie-chart";

export const JobStatus: React.FC<{
  status?: TStatus;
  pipeline_runs?: PipelineRun[];
}> = ({ status, pipeline_runs = [] }) => {
  const count = pipeline_runs.reduce(
    (acc, cv, i) =>
      cv && {
        ...acc,
        [cv.status]: acc[cv.status] + 1,
        total: i + 1,
      },
    {
      ABORTED: 0,
      PENDING: 0,
      STARTED: 0,
      SUCCESS: 0,
      FAILURE: 0,
      total: 0,
    }
  );

  const getJobStatusVariant = () => {
    if (["STARTED", "PAUSED", "SUCCESS", "ABORTED"].includes(status))
      return status;

    if (
      ["PENDING"].includes(status) &&
      count.PENDING + count.STARTED === count.total
    )
      return "PENDING";

    if (status === "FAILURE" && count.ABORTED + count.FAILURE === count.total)
      return "FAILURE";

    if (status === "FAILURE") return "MIXED_FAILURE";
    if (status === "PENDING") return "MIXED_PENDING";

    return status;
  };

  const variant = getJobStatusVariant();
  return (
    <StatusGroup
      status={status}
      icon={
        ["MIXED_FAILURE", "MIXED_PENDING"].includes(variant) && (
          <PieChart
            startAngle={270}
            background={theme.palette.background.default}
            lineWidth={40}
            animate={true}
            data={[
              {
                title: "Pending",
                color: theme.palette.warning.main,
                value: count.PENDING + count.STARTED,
              },
              {
                title: "Failed",
                color: theme.palette.error.main,
                value: count.FAILURE + count.ABORTED,
              },
              {
                title: "Success",
                color: theme.palette.success.main,
                value: count.SUCCESS,
              },
            ]}
          />
        )
      }
      title={
        {
          ABORTED: "This job was cancelled",
          PENDING: "Some pipeline runs haven't completed yet",
          FAILURE: "All pipeline runs were unsuccessful",
          STARTED: "This job is running",
          PAUSED: "This job is paused",
          SUCCESS: "All pipeline runs were successful",
          MIXED_PENDING: "Some pipeline runs haven't completed yet",
          MIXED_FAILURE: "Some pipeline runs were unsuccessful",
        }[variant]
      }
      description={
        ["MIXED_FAILURE", "MIXED_PENDING"].includes(variant) &&
        [
          commaSeparatedString(
            [
              count.PENDING && [count.PENDING, "pending"].join(" "),
              count.FAILURE && [count.FAILURE, "failed"].join(" "),
              count.SUCCESS && [count.SUCCESS, "successful"].join(" "),
            ].filter(Boolean)
          ),
          count.total > 1 ? "pipeline runs" : "pipeline run",
        ].join(" ")
      }
      data-test-id="job-status"
    />
  );
};
