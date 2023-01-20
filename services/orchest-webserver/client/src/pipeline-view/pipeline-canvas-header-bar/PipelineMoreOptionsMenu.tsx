import { useFileApi } from "@/api/files/useFileApi";
import { usePipelinesApi } from "@/api/pipelines/usePipelinesApi";
import { IconButton } from "@/components/common/IconButton";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useActivePipeline } from "@/hooks/useActivePipeline";
import { useActiveProject } from "@/hooks/useActiveProject";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined"; // cspell:disable-line
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";

export const PipelineMoreOptionsMenu = () => {
  const expand = useFileApi((api) => api.expand);
  const { setConfirm } = useGlobalContext();
  const { isReadOnly } = usePipelineDataContext();
  const deletePipeline = usePipelinesApi((api) => api.delete);
  const pipeline = useActivePipeline();
  const project = useActiveProject();

  const [anchorElement, setAnchorElement] = React.useState<
    Element | undefined
  >();

  const handleClose = () => setAnchorElement(undefined);
  const handleOpen = (e: React.MouseEvent) => setAnchorElement(e.currentTarget);

  const showDeletePipelineDialog = () => {
    handleClose();
    if (isReadOnly || !project || !pipeline) return;
    setConfirm(
      `Delete "${pipeline?.path}"`,
      "Are you sure you want to delete this pipeline?",
      {
        onConfirm: async (resolve) => {
          // TODO: Freeze PipelineEditor until the delete operation is done.
          await deletePipeline(project.uuid, pipeline.uuid);

          await expand("/project-dir", pipeline.path);

          resolve(true);
          return true;
        },
        confirmLabel: "Delete pipeline",
        cancelLabel: "Keep pipeline",
        confirmButtonColor: "error",
      }
    );
  };

  const { setFullscreenTab } = usePipelineCanvasContext();
  const openSettings = () => {
    setFullscreenTab("configuration");
    handleClose();
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
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
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
