import { useJobsApi } from "@/api/jobs/useJobsApi";
import { IconButton } from "@/components/common/IconButton";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { JobData } from "@/types";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined"; // cspell:disable-line
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useSelectJob } from "../hooks/useSelectJob";
import { useEditJob } from "../stores/useEditJob";
import { useJobActionMenu } from "./hooks/useJobActionMenu";
import { JobPrimaryButtonIcon } from "./JobPrimaryButtonIcon";

const getNextJob = (jobs: JobData[], jobUuid: string) => {
  const indexToDelete = jobs.findIndex((job) => job.uuid === jobUuid);
  const nextJobIndex =
    indexToDelete === jobs.length - 1 ? 0 : indexToDelete + 1;

  return jobs[nextJobIndex];
};

export const JobMoreOptions = () => {
  const { setConfirm } = useGlobalContext();
  const name = useEditJob((state) => state.jobChanges?.name);
  const uuid = useEditJob((state) => state.jobChanges?.uuid);
  const { selectJob } = useSelectJob();
  const [deleteJob, isDeleting, jobs = []] = useJobsApi((state) => [
    state.delete,
    state.isDeleting,
    state.jobs,
  ]);

  const [anchorElement, setAnchorElement] = React.useState<
    Element | undefined
  >();

  const handleClose = () => setAnchorElement(undefined);
  const handleOpen = (e: React.MouseEvent) => setAnchorElement(e.currentTarget);

  const isJobChangesLoaded = hasValue(uuid) && hasValue(name);

  const showDeleteEnvironmentDialog = () => {
    handleClose();
    if (!isJobChangesLoaded) return;
    setConfirm(
      `Delete "${name}"`,
      "Are you sure you want to delete this Job?",
      {
        onConfirm: (resolve) => {
          const nextJob = getNextJob(jobs, uuid);

          selectJob(nextJob.uuid);
          deleteJob(uuid).then(() => resolve(true));
          return true;
        },
        confirmLabel: "Delete Environment",
        cancelLabel: "Keep Environment",
        confirmButtonColor: "error",
      }
    );
  };

  const actions = useJobActionMenu();

  const isOpen = hasValue(anchorElement);

  const disabled = useEditJob((state) => !state.isEditing);

  return (
    <>
      <IconButton
        title="More options"
        onClick={handleOpen}
        disabled={disabled}
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
        {actions.map((option) => {
          const onClick = () => {
            option.action?.();
            handleClose();
          };

          return (
            <MenuItem
              key={option.label}
              disabled={option.disabled}
              onClick={onClick}
            >
              <ListItemIcon>
                <JobPrimaryButtonIcon type={option.icon} />
              </ListItemIcon>
              <ListItemText>{option.label}</ListItemText>
            </MenuItem>
          );
        })}
        <Divider />
        <MenuItem
          disabled={!isJobChangesLoaded || isDeleting}
          onClick={showDeleteEnvironmentDialog}
        >
          <ListItemIcon>
            <DeleteOutlineOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Delete Job
        </MenuItem>
      </Menu>
    </>
  );
};
