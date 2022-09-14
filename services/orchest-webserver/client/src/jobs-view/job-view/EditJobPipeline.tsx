import { useSnapshotsApi } from "@/api/snapshots/useSnapshotsApi";
import { useCancelablePromise } from "@/hooks/useCancelablePromise";
import { PipelineDataInSnapshot } from "@/types";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useSetJobPipelineUuid } from "../hooks/useSetJobPipelineUuid";
import { useEditJob } from "../stores/useEditJob";
import { useLoadValueFromJobChanges } from "./hooks/useLoadValueFromJobChanges";

export const EditJobPipeline = () => {
  const isDraft = useEditJob((state) => state.jobChanges?.status === "DRAFT");
  const snapshotUuid = useEditJob((state) => state.jobChanges?.snapshot_uuid);

  const fetchSnapshot = useSnapshotsApi((state) => state.fetchOne);
  const { makeCancelable } = useCancelablePromise();
  const [pipelines, setPipelines] = React.useState<PipelineDataInSnapshot[]>();

  React.useEffect(() => {
    if (snapshotUuid)
      makeCancelable(fetchSnapshot(snapshotUuid))
        .then((snapshot) => {
          if (snapshot) {
            setPipelines(Object.values(snapshot.pipelines));
          }
        })
        .catch((error) => {
          if (!error.isCanceled) console.error(error);
        });
  }, [fetchSnapshot, snapshotUuid, makeCancelable]);

  const { setPipelineUuid, isChangingPipelineUuid } = useSetJobPipelineUuid();

  const disabled = !isDraft || isChangingPipelineUuid;

  const [jobPipelineUuid = "", setJobPipelineUuid] = React.useState<string>();

  useLoadValueFromJobChanges(
    (jobChanges) => jobChanges?.pipeline_uuid,
    setJobPipelineUuid
  );

  const handleChange = async (event: SelectChangeEvent) => {
    const pipelineUuid = event.target.value as string;
    await setPipelineUuid(pipelineUuid);
    setJobPipelineUuid(pipelineUuid);
  };

  return hasValue(pipelines) ? (
    <FormControl
      disabled={disabled}
      sx={{ width: "50%", minWidth: (theme) => theme.spacing(35) }}
    >
      <InputLabel id="job-pipeline-select-label" shrink>
        Pipeline
      </InputLabel>
      <Select
        labelId="job-pipeline-select-label"
        id="job-pipeline-select"
        value={jobPipelineUuid}
        label="Pipeline"
        onChange={handleChange}
      >
        {pipelines.map((pipeline) => {
          return (
            <MenuItem
              key={pipeline.definition.uuid}
              value={pipeline.definition.uuid}
            >
              {pipeline.definition.name}
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  ) : null;
};
