import { useProjectJobsApi } from "@/api/jobs/useProjectJobsApi";
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
import { useDeleteJob } from "./hooks/useDeleteJob";
import { useEditJobType } from "./hooks/useEditJobType";
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
  const { deleteJob, isDeletingJob } = useDeleteJob();

  const jobs = useProjectJobsApi((state) => state.jobs || []);

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

          selectJob(undefined, nextJob.uuid);
          deleteJob(uuid).then(() => resolve(true));
          return true;
        },
        confirmLabel: "Delete Job",
        cancelLabel: "Keep Job",
        confirmButtonColor: "error",
      }
    );
  };

  const actions = useJobActionMenu();

  const isOpen = hasValue(anchorElement);

  const editJobType = useEditJobType();
  const disabled = useEditJob(
    (state) => state.isEditing && editJobType === "active-cronjob"
  );

  return (
    <>
      <IconButton
        title={!disabled ? "More options" : undefined}
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
        {<Divider />}
        <MenuItem
          disabled={!isJobChangesLoaded || isDeletingJob}
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
