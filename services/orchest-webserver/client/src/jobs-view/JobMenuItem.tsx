import { SidePanelMenuItem } from "@/components/Layout/layout-with-side-panel/SidePanelMenuItem";
import { JobStatus } from "@/types";
import React from "react";
import { JobStatusIcon } from "./JobStatusIcon";

type JobMenuItemProps = {
  uuid: string;
  name: string;
  subtitle: string;
  jobStatus: JobStatus | undefined;
  selected: boolean;
  onClick: (uuid: string) => void;
};

export const JobMenuItem = React.memo(function JobMenuItem({
  uuid,
  name,
  subtitle,
  jobStatus,
  selected,
  onClick,
}: JobMenuItemProps) {
  return (
    <SidePanelMenuItem
      uuid={uuid}
      title={name}
      selected={selected}
      onClick={onClick}
      showStatusIcon
      statusIconTooltip={jobStatus || ""}
      subtitle={subtitle}
      statusIcon={<JobStatusIcon status={jobStatus} />}
    />
  );
});
