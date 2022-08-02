import {
  EnvironmentsApiState,
  useEnvironmentsApi,
} from "@/api/environments/useEnvironmentsApi";
import { IconButton } from "@/components/common/IconButton";
import { useAppContext } from "@/contexts/AppContext";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined"; // cspell:disable-line
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditEnvironment } from "./stores/useEditEnvironment";

const selector = (state: EnvironmentsApiState) =>
  [state.delete, state.isDeleting] as const;

export const EnvironmentMoreOptions = () => {
  const { setConfirm } = useAppContext();
  const { environment } = useEditEnvironment();
  const [deleteEnvironment, isDeleting] = useEnvironmentsApi(selector);

  const [anchorElement, setAnchorElement] = React.useState<
    Element | undefined
  >();

  const handleClose = () => setAnchorElement(undefined);
  const handleOpen = (e: React.MouseEvent) => setAnchorElement(e.currentTarget);

  const showDeleteEnvironmentDialog = () => {
    handleClose();
    if (!environment) return;
    setConfirm(
      `Delete "${environment.name}"`,
      "Are you sure you want to delete this Environment?",
      {
        onConfirm: (resolve) => {
          deleteEnvironment(environment.uuid).then(() => resolve(true));
          return true;
        },
        confirmLabel: "Delete Environment",
        cancelLabel: "Keep Environment",
        confirmButtonColor: "error",
      }
    );
  };

  const isOpen = hasValue(anchorElement);

  return (
    <>
      <IconButton
        title="More options"
        onClick={handleOpen}
        sx={{
          height: (theme) => theme.spacing(4.5),
          width: (theme) => theme.spacing(4.5),
        }}
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
        <MenuItem
          disabled={!hasValue(environment) || isDeleting}
          onClick={showDeleteEnvironmentDialog}
        >
          <ListItemIcon>
            <DeleteOutlineOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Delete Environment
        </MenuItem>
      </Menu>
    </>
  );
};
