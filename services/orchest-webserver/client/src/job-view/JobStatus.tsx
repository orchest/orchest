import { StatusGroup } from "@/components/Status";
import theme from "@/theme";
import { Job } from "@/types";
import { commaSeparatedString } from "@/utils/text";
import React from "react";
import { PieChart } from "react-minimal-pie-chart";

export const JobStatus: React.FC<Pick<
  Job,
  "status" | "pipeline_run_status_counts"
>> = ({ status, pipeline_run_status_counts: count }) => {
  const totalCount = Object.values(count).reduce(
    (sum, current) => sum + current,
    0
  );
  const getJobStatusVariant = () => {
    if (["STARTED", "PAUSED", "SUCCESS", "ABORTED"].includes(status))
      return status;

    if (status === "PENDING" && count.PENDING + count.STARTED === totalCount)
      return "PENDING";

    if (count.ABORTED + count.FAILURE === totalCount) return "FAILURE";

    if (status === "PENDING") return "MIXED_PENDING";

    return status;
  };

  const variant = getJobStatusVariant();
  return (
    <StatusGroup
      status={status}
      icon={
        variant === "MIXED_PENDING" && (
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
        variant === "MIXED_PENDING" &&
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
