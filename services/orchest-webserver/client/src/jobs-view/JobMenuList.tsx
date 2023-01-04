import { useProjectJobsApi } from "@/api/jobs/useProjectJobsApi";
import { formatServerDateTime } from "@/utils/webserver-utils";
import MenuList from "@mui/material/MenuList";
import Stack from "@mui/material/Stack";
import React from "react";
import { CreateJobButton } from "./CreateJobButton";
import { usePollJobsStatus } from "./hooks/usePollJobsStatus";
import { useSelectJob } from "./hooks/useSelectJob";
import { useSyncJobUuidWithQueryArgs } from "./hooks/useSyncJobUuidWithQueryArgs";
import { useUnsavedChangesWarning } from "./hooks/useUnsavedChangesWarning";
import { JobMenuItem } from "./JobMenuItem";
import { useEditJob } from "./stores/useEditJob";

export const JobMenuList = () => {
  useSyncJobUuidWithQueryArgs();

  const jobChangesUuid = useEditJob((state) => state.jobChanges?.uuid);
  const jobChangesName = useEditJob((state) => state.jobChanges?.name || "");
  const jobChangesStatus = useEditJob((state) => state.jobChanges?.status);
  const { withConfirmation } = useUnsavedChangesWarning();

  const jobs = useProjectJobsApi((state) => state.jobs || []);
  const { selectJob } = useSelectJob();
  usePollJobsStatus();

  const redirect = React.useCallback(
    (event: React.MouseEvent, uuid: string) => selectJob(event, uuid),
    [selectJob]
  );

  return (
    <Stack
      direction="column"
      sx={{
        width: "100%",
        height: "100%",
        backgroundColor: (theme) => theme.palette.grey[100],
      }}
    >
      <CreateJobButton sx={{ flexShrink: 0 }} onCreated={redirect} />
      <MenuList
        sx={{
          overflowY: "auto",
          flexShrink: 1,
          paddingTop: 0,
        }}
        tabIndex={0} // MUI's MenuList default is -1
      >
        {jobs.map((job) => {
          const selected = jobChangesUuid === job.uuid;
          const snapshotDatetime = formatServerDateTime(job.created_time);
          const pipelinePathAndSnapshotDatetime = `${job.pipeline_run_spec.run_config.pipeline_path} • ${snapshotDatetime}`;
          const name = selected ? jobChangesName : job.name;
          const jobStatus = selected ? jobChangesStatus : job.status;

          return (
            <JobMenuItem
              key={job.uuid}
              uuid={job.uuid}
              selected={selected}
              jobStatus={jobStatus}
              name={name}
              subtitle={pipelinePathAndSnapshotDatetime}
              onClick={(event, uuid) =>
                withConfirmation(async () => redirect(event, uuid))
              }
            />
          );
        })}
      </MenuList>
    </Stack>
  );
};
