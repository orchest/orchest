import { SystemStatusIcon } from "@/components/common/SystemStatusIcon";
import { SidePanelMenuItem } from "@/components/layout/SidePanelMenuItem";
import { EnvironmentState, ImageBuildStatus } from "@/types";
import React from "react";
import { LANGUAGE_MAP } from "./common";

type EnvironmentMenuItemProps = Pick<
  EnvironmentState,
  "uuid" | "name" | "language"
> & {
  selected: boolean;
  showStatusIcon: boolean;
  onClick: (event: React.MouseEvent, uuid: string) => void;
  latestBuildStatus: ImageBuildStatus | undefined;
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
      statusIcon={
        <SystemStatusIcon
          status={latestBuildStatus}
          flavor="build"
          size="small"
        />
      }
    />
  );
});
