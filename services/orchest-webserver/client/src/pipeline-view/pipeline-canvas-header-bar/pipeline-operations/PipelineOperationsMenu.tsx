import { RunIncomingIcon } from "@/components/common/icons/RunIncomingIcon";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { requestCreateJob } from "@/jobs-view/common";
import { usePipelineDataContext } from "@/pipeline-view/contexts/PipelineDataContext";
import { siteMap } from "@/routingConfig";
import { isMacOs } from "@/utils/isMacOs";
import MoreTimeOutlinedIcon from "@mui/icons-material/MoreTimeOutlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import PlayCircleOutlineOutlinedIcon from "@mui/icons-material/PlayCircleOutlineOutlined";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useRunSteps } from "./useRunSteps";

const osSpecificHotKey = isMacOs() ? "⌘" : "Ctrl";

export const PipelineOperationsMenu = ({
  anchor,
  onClose,
}: {
  anchor: Element | undefined;
  onClose: () => void;
}) => {
  const { pipelineUuid, pipelineJson } = usePipelineDataContext();
  const {
    state: { pipeline },
    dispatch,
  } = useProjectsContext();
  const { runSelectedSteps, runAllSteps, runIncomingSteps } = useRunSteps();
  const { navigateTo, projectUuid } = useCustomRoute();

  const operationOptions = React.useMemo(
    () =>
      [
        {
          label: "Run all",
          icon: <PlayCircleOutlineOutlinedIcon fontSize="small" />,
          hotKey: "Shift Enter",
          action: runAllSteps,
        },
        {
          label: "Run selected",
          icon: <PlayArrowOutlinedIcon fontSize="small" />,
          hotKey: "Enter",
          action: runSelectedSteps,
        },
        {
          label: "Run incoming",
          icon: <RunIncomingIcon />,
          hotKey: "I",
          action: runIncomingSteps,
        },
        {
          label: "Schedule Job",
          icon: <MoreTimeOutlinedIcon fontSize="small" />,
          hotKey: "J",
          action: async () => {
            if (!projectUuid || !pipelineUuid || !pipelineJson?.name) return;
            dispatch({ type: "SET_PIPELINE_IS_READONLY", payload: true });
            const job = await requestCreateJob(
              projectUuid,
              `Job for ${pipeline?.path}`,
              pipelineUuid,
              pipelineJson?.name
            );
            dispatch({ type: "SET_PIPELINE_IS_READONLY", payload: false });
            navigateTo(siteMap.editJob.path, {
              query: { projectUuid, jobUuid: job.uuid },
            });
          },
        },
      ] as const,
    [
      runAllSteps,
      runIncomingSteps,
      runSelectedSteps,
      navigateTo,
      pipelineUuid,
      pipelineJson?.name,
      pipeline?.path,
      projectUuid,
      dispatch,
    ]
  );

  return (
    <Menu
      id="pipeline-operations-menu"
      anchorEl={anchor}
      open={hasValue(anchor)}
      onClose={onClose}
      MenuListProps={{
        dense: true,
        "aria-labelledby": "pipeline-operations",
        sx: { width: (theme) => theme.spacing(28) },
      }}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
    >
      {operationOptions.map((option) => {
        const disabled = !hasValue(option.action);
        const handleClick = () => {
          option.action?.();
          onClose();
        };
        return (
          <MenuItem
            key={option.label}
            disabled={disabled}
            onClick={handleClick}
          >
            <ListItemIcon>{option.icon}</ListItemIcon>
            <ListItemText>{option.label}</ListItemText>
            <Typography variant="caption" color="text.secondary">
              {`${osSpecificHotKey} ${option.hotKey}`}
            </Typography>
          </MenuItem>
        );
      })}
    </Menu>
  );
};
