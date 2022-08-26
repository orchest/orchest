import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { IconButton } from "@/components/common/IconButton";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { EnvironmentState } from "@/types";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined"; // cspell:disable-line
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useSelectEnvironment } from "./hooks/useSelectEnvironment";
import { useEditEnvironment } from "./stores/useEditEnvironment";

const getNextEnvironmentUuid = (
  environments: EnvironmentState[],
  environmentUuid: string
) => {
  const indexToDelete = environments.findIndex(
    (environment) => environment.uuid === environmentUuid
  );
  const nextEnvironmentIndex =
    indexToDelete === environments.length - 1 ? 0 : indexToDelete + 1;

  return environments[nextEnvironmentIndex].uuid;
};

export const EnvironmentMoreOptions = () => {
  const { setConfirm } = useGlobalContext();
  const uuid = useEditEnvironment((state) => state.environmentChanges?.uuid);
  const name = useEditEnvironment((state) => state.environmentChanges?.name);
  const action = useEditEnvironment(
    (state) => state.environmentChanges?.action
  );

  const { selectEnvironment } = useSelectEnvironment();

  const deleteEnvironment = useEnvironmentsApi((state) => state.delete);
  const isDeleting = useEnvironmentsApi((state) => state.isDeleting);
  const environments = useEnvironmentsApi((state) => state.environments);

  const [anchorElement, setAnchorElement] = React.useState<
    Element | undefined
  >();

  const handleClose = () => setAnchorElement(undefined);
  const handleOpen = (e: React.MouseEvent) => setAnchorElement(e.currentTarget);

  const showDeleteEnvironmentDialog = () => {
    handleClose();
    if (!name || !uuid) return;
    setConfirm(
      `Delete "${name}"`,
      "Are you sure you want to delete this Environment?",
      {
        onConfirm: (resolve) => {
          const nextEnvironmentUuid = getNextEnvironmentUuid(
            environments || [],
            uuid
          );

          deleteEnvironment(uuid, action).then(() => {
            selectEnvironment(nextEnvironmentUuid);
            resolve(true);
          });

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
          disabled={!uuid || isDeleting}
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
