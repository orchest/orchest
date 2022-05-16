import {
  RenderedJobStatus,
  StatusGroup,
  statusMapping,
  TStatus,
} from "@/components/Status";
import theme from "@/theme";
import { Job } from "@/types";
import { commaSeparatedString } from "@/utils/text";
import React from "react";
import { PieChart } from "react-minimal-pie-chart";

const getSummedCount = (
  countObj: Record<TStatus, number | undefined>,
  keys: string[]
) => {
  return keys.reduce((sum, key) => sum + (countObj[key] || 0), 0);
};

const getIcon = ({
  status,
  totalPendingCount,
  totalFailureCount,
  count,
}: {
  status: RenderedJobStatus;
  totalPendingCount: number;
  totalFailureCount: number;
  count: Record<TStatus, number>;
}) => {
  if (["MIXED_FAILURE", "MIXED_PENDING"].includes(status))
    return (
      <PieChart
        startAngle={270}
        background={theme.palette.background.default}
        lineWidth={40}
        animate={true}
        data={[
          {
            title: "Pending",
            color: theme.palette.warning.main,
            value: totalPendingCount,
          },
          {
            title: "Failed",
            color: theme.palette.error.main,
            value: totalFailureCount,
          },
          {
            title: "Success",
            color: theme.palette.success.main,
            value: count.SUCCESS || 0,
          },
        ]}
      />
    );
  return statusMapping[status].icon();
};

const statusTitleMapping: Partial<Record<RenderedJobStatus, string>> = {
  ABORTED: "This job was cancelled",
  PENDING: "Some pipeline runs haven't completed yet",
  FAILURE: "All pipeline runs were unsuccessful",
  STARTED: "This job is running",
  PAUSED: "This job is paused",
  SUCCESS: "All pipeline runs were successful",
  MIXED_PENDING: "Some pipeline runs haven't completed yet",
  MIXED_FAILURE: "Some pipeline runs were unsuccessful",
};

export const JobStatus: React.FC<
  { totalCount?: number } & Pick<Job, "status" | "pipeline_run_status_counts">
> = ({ status, totalCount, pipeline_run_status_counts: count }) => {
  const isJobDone =
    status === "SUCCESS" || status === "ABORTED" || status === "FAILURE";
  const totalPendingCount = getSummedCount(count, ["PENDING", "STARTED"]);
  const totalFailureCount = getSummedCount(count, ["ABORTED", "FAILURE"]);
  const totalSuccessCount = getSummedCount(count, ["SUCCESS"]);

  const getJobStatusVariant = () => {
    if (status === "PENDING" && totalSuccessCount + totalFailureCount > 0)
      return "MIXED_PENDING";
    if (status === "PENDING" && totalPendingCount === totalCount)
      return "PENDING";

    if (!isJobDone) return status;

    if (totalSuccessCount === totalCount) return "SUCCESS";
    if (totalFailureCount === totalCount) return "FAILURE";
    if (totalFailureCount !== totalCount && totalFailureCount > 0)
      return "MIXED_FAILURE";

    return status;
  };

  const variant = getJobStatusVariant();

  const icon = getIcon({
    status: variant,
    totalFailureCount,
    totalPendingCount,
    count,
  });

  return (
    <StatusGroup
      status={variant}
      icon={icon}
      title={statusTitleMapping[variant] || ""}
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
          `pipeline run${totalCount > 1 ? "s" : ""}`,
        ].join(" ")
      }
      data-test-id="job-status"
    />
  );
};
