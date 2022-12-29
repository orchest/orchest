import { useCancelPipelineRun } from "@/hooks/useCancelPipelineRun";
import { PipelineRun } from "@/types";
import { canCancelRun } from "@/utils/pipeline-run";
import Menu, { MenuProps } from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import React from "react";

export type PipelineRunContextMenuProps = MenuProps & {
  run: PipelineRun;
};

export const PipelineContextMenu = ({
  run,
  ...menuProps
}: PipelineRunContextMenuProps) => {
  const cancelRun = useCancelPipelineRun(run);

  const onCancelRun = () => {
    if (canCancelRun(run)) cancelRun();
  };

  const closeAfter = (action: () => void) => {
    action();
    menuProps.onClose?.({}, "escapeKeyDown");
  };

  return (
    <Menu
      id="pipeline-settings-menu"
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      {...menuProps}
    >
      <MenuItem
        onClick={() => closeAfter(onCancelRun)}
        disabled={!canCancelRun(run)}
      >
        Cancel run
      </MenuItem>
    </Menu>
  );
};
