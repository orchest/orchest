import { useJobsApi } from "@/api/jobs/useJobsApi";
import { IconButton } from "@/components/common/IconButton";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { JobData } from "@/types";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined"; // cspell:disable-line
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useSelectJob } from "../hooks/useSelectJob";
import { useEditJob } from "../stores/useEditJob";

const getNextJob = (jobs: JobData[], jobUuid: string) => {
  const indexToDelete = jobs.findIndex((job) => job.uuid === jobUuid);
  const nextJobIndex =
    indexToDelete === jobs.length - 1 ? 0 : indexToDelete + 1;

  return jobs[nextJobIndex];
};

export const JobMoreOptions = () => {
  const { setConfirm } = useGlobalContext();
  const { jobChanges } = useEditJob();
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

  const showDeleteEnvironmentDialog = () => {
    handleClose();
    if (!jobChanges) return;
    setConfirm(
      `Delete "${jobChanges.name}"`,
      "Are you sure you want to delete this Job?",
      {
        onConfirm: (resolve) => {
          const nextJob = getNextJob(jobs, jobChanges.uuid);

          deleteJob(jobChanges.uuid).then(() => {
            selectJob(nextJob.pipeline_uuid, nextJob.uuid);
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
          disabled={!hasValue(jobChanges) || isDeleting}
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
