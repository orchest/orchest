import { SidePanelMenuItem } from "@/components/Layout/layout-with-side-panel/SidePanelMenuItem";
import { EnvironmentState } from "@/types";
import React from "react";
import { BuildStatusIcon } from "./BuildStatusIcon";
import { LANGUAGE_MAP } from "./common";

type EnvironmentMenuItemProps = EnvironmentState & {
  selected: boolean;
  showStatusIcon: boolean;
  onClick: (uuid: string) => void;
};

export const EnvironmentMenuItem = React.memo(function EnvironmentMenuItem({
  uuid,
  name,
  language,
  latestBuild,
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
      statusIconTooltip={latestBuild?.status || "Draft"}
      subtitle={LANGUAGE_MAP[language]}
      statusIcon={<BuildStatusIcon latestBuildStatus={latestBuild} />}
    />
  );
});
