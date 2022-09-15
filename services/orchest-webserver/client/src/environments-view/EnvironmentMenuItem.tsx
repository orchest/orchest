import { SidePanelMenuItem } from "@/components/Layout/layout-with-side-panel/SidePanelMenuItem";
import { TStatus } from "@/components/Status";
import { EnvironmentState } from "@/types";
import React from "react";
import { BuildStatusIcon } from "./BuildStatusIcon";
import { LANGUAGE_MAP } from "./common";

type EnvironmentMenuItemProps = Pick<
  EnvironmentState,
  "uuid" | "name" | "language"
> & {
  selected: boolean;
  showStatusIcon: boolean;
  onClick: (uuid: string) => void;
  latestBuildStatus: TStatus | undefined;
};

export const EnvironmentMenuItem = React.memo(function EnvironmentMenuItem({
  uuid,
  name,
  language,
  latestBuildStatus,
  selected,
  onClick,
  showStatusIcon,
}: EnvironmentMenuItemProps) {
  return (
    <SidePanelMenuItem
      uuid={uuid}
      title={name}
      selected={selected}
      onClick={onClick}
      showStatusIcon={showStatusIcon}
      statusIconTooltip={latestBuildStatus || "Draft"}
      subtitle={LANGUAGE_MAP[language]}
      statusIcon={<BuildStatusIcon latestBuildStatus={latestBuildStatus} />}
    />
  );
});
