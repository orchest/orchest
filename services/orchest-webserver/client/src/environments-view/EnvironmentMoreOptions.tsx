import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { IconButton } from "@/components/common/IconButton";
import { useGlobalContext } from "@/contexts/GlobalContext";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined"; // cspell:disable-line
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEnvironmentOnEdit } from "./stores/useEnvironmentOnEdit";

export const EnvironmentMoreOptions = () => {
  const { setConfirm } = useGlobalContext();
  const { environmentOnEdit } = useEnvironmentOnEdit();
  const [deleteEnvironment, isDeleting] = useEnvironmentsApi((state) => [
    state.delete,
    state.isDeleting,
  ]);

  const [anchorElement, setAnchorElement] = React.useState<
    Element | undefined
  >();

  const handleClose = () => setAnchorElement(undefined);
  const handleOpen = (e: React.MouseEvent) => setAnchorElement(e.currentTarget);

  const showDeleteEnvironmentDialog = () => {
    handleClose();
    if (!environmentOnEdit) return;
    setConfirm(
      `Delete "${environmentOnEdit.name}"`,
      "Are you sure you want to delete this Environment?",
      {
        onConfirm: (resolve) => {
          deleteEnvironment(environmentOnEdit.uuid).then(() => resolve(true));
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
          disabled={!hasValue(environmentOnEdit) || isDeleting}
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
