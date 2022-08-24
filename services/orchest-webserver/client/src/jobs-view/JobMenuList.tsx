import { useJobsApi } from "@/api/jobs/useJobsApi";
import { formatServerDateTime } from "@/utils/webserver-utils";
import MenuList from "@mui/material/MenuList";
import Stack from "@mui/material/Stack";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { CreateJobButton } from "./CreateJobButton";
import { usePollJobsStatus } from "./hooks/usePollJobsStatus";
import { useSelectJob } from "./hooks/useSelectJob";
import { useSyncJobUuidWithQueryArgs } from "./hooks/useSyncJobUuidWithQueryArgs";
import { JobMenuItem } from "./JobMenuItem";
import { useEditJob } from "./stores/useEditJob";

export const JobMenuList = () => {
  useSyncJobUuidWithQueryArgs();

  const { jobChanges } = useEditJob();
  const { jobs = [] } = useJobsApi();
  const { selectJob } = useSelectJob();
  usePollJobsStatus();

  const redirect = React.useCallback(
    (uuid: string) => {
      const [pipelineUuid, jobUuid] = uuid.split("|");
      selectJob(pipelineUuid, jobUuid);
    },
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
          const selected = hasValue(jobChanges) && jobChanges.uuid === job.uuid;
          const uuid = `${job.pipeline_uuid}|${job.uuid}`;
          const snapshotDatetime = formatServerDateTime(job.created_time);
          const pipelinePathAndSnapshotDatetime = `${job.pipeline_run_spec.run_config.pipeline_path} • ${snapshotDatetime}`;
          return (
            <JobMenuItem
              key={uuid}
              uuid={uuid}
              selected={selected}
              jobStatus={job.status}
              name={job.name}
              subtitle={pipelinePathAndSnapshotDatetime}
              onClick={redirect}
            />
          );
        })}
      </MenuList>
    </Stack>
  );
};
