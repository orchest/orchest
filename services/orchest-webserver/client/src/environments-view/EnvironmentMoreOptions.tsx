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
  const uuid = useEditEnvironment((state) => state.changes?.uuid);
  const name = useEditEnvironment((state) => state.changes?.name);
  const action = useEditEnvironment((state) => state.changes?.action);

  const selectEnvironment = useSelectEnvironment();
  const deleteEnvironment = useEnvironmentsApi((state) => state.delete);
  const environments = useEnvironmentsApi((state) => state.environments);
  const isUsedByJobs = useEnvironmentsApi((state) => state.isUsedByJobs);

  const [anchorElement, setAnchorElement] = React.useState<
    Element | undefined
  >();

  const handleClose = () => setAnchorElement(undefined);
  const handleOpen = (e: React.MouseEvent) => setAnchorElement(e.currentTarget);

  const showDeleteEnvironmentDialog = async () => {
    handleClose();
    if (!name || !uuid) return;
    const isUsed = await isUsedByJobs(uuid);
    setConfirm(
      `Delete "${name}"`,
      isUsed
        ? `"${name}" is in use by active Jobs. Are you sure you want to delete it? This will abort all jobs that are using it.`
        : "Are you sure you want to delete this Environment?",
      {
        onConfirm: (resolve) => {
          const nextEnvironmentUuid = getNextEnvironmentUuid(
            environments || [],
            uuid
          );

          deleteEnvironment(uuid, action).then(() => {
            selectEnvironment(undefined, nextEnvironmentUuid);
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
        <MenuItem disabled={!uuid} onClick={showDeleteEnvironmentDialog}>
          <ListItemIcon>
            <DeleteOutlineOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Delete Environment
        </MenuItem>
      </Menu>
    </>
  );
};
