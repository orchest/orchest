import { IconButton } from "@/components/common/IconButton";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { fetcher } from "@/utils/fetcher";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined"; // cspell:disable-line
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineEditorContext } from "./contexts/PipelineEditorContext";

const deletePipeline = (projectUuid: string, pipelineUuid: string) => {
  return fetcher(`/async/pipelines/${projectUuid}/${pipelineUuid}`, {
    method: "DELETE",
  });
};

export const PipelineMoreOptionsMenu = () => {
  const { setConfirm } = useAppContext();
  const { navigateTo, pipelineUuid, jobUuid } = useCustomRoute();
  const { runUuid, isReadOnly } = usePipelineEditorContext();
  const {
    state: { projectUuid, pipeline },
    dispatch,
  } = useProjectsContext();

  const [anchorElement, setAnchorElement] = React.useState<
    Element | undefined
  >();

  const handleClose = () => setAnchorElement(undefined);
  const handleOpen = (e: React.MouseEvent) => setAnchorElement(e.currentTarget);

  const showDeletePipelineDialog = () => {
    handleClose();
    if (isReadOnly || !projectUuid || !pipeline) return;
    setConfirm(
      `Delete "${pipeline?.path}"`,
      "Are you sure you want to delete this pipeline?",
      {
        onConfirm: async (resolve) => {
          // TODO: Freeze PipelineEditor until the delete operation is done.
          await deletePipeline(projectUuid, pipeline.uuid);
          dispatch((current) => {
            return {
              type: "SET_PIPELINES",
              payload: (current.pipelines || []).filter(
                (currentPipeline) => currentPipeline.uuid !== pipeline.uuid
              ),
            };
          });
          resolve(true);
          return true;
        },
        confirmLabel: "Delete pipeline",
        cancelLabel: "Keep pipeline",
        confirmButtonColor: "error",
      }
    );
  };
  const isJobRun = jobUuid && runUuid;
  const openSettings = (e: React.MouseEvent) => {
    navigateTo(
      isJobRun
        ? siteMap.jobRunPipelineSettings.path
        : siteMap.pipelineSettings.path,
      {
        query: {
          projectUuid,
          pipelineUuid,
          ...(isJobRun ? { jobUuid, runUuid } : undefined),
        },
        state: { isReadOnly },
      },
      e
    );
  };

  const isOpen = hasValue(anchorElement);

  return (
    <>
      <IconButton
        title="More options"
        size="small"
        data-test-id="pipeline-settings"
        onClick={handleOpen}
      >
        <MoreHorizOutlinedIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorElement}
        id="pipeline-settings-menu"
        open={isOpen}
        onClose={handleClose}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <MenuItem disabled={!hasValue(pipeline)} onClick={openSettings}>
          <ListItemIcon>
            <SettingsOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Pipeline settings
        </MenuItem>
        <MenuItem
          disabled={isReadOnly || !hasValue(pipeline)}
          onClick={showDeletePipelineDialog}
        >
          <ListItemIcon>
            <DeleteOutlineOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Delete Pipeline
        </MenuItem>
      </Menu>
    </>
  );
};
