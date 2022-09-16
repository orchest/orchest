import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useUpdateJobPipelineUuid } from "../hooks/useUpdateJobPipelineUuid";
import { useEditJob } from "../stores/useEditJob";
import { useFetchSnapshotPipelines } from "./hooks/useFetchSnapshotPipelines";
import { useLoadValueFromJobChanges } from "./hooks/useLoadValueFromJobChanges";

export const EditJobPipeline = () => {
  const isDraft = useEditJob((state) => state.jobChanges?.status === "DRAFT");
  const {
    setPipelineUuid,
    isChangingPipelineUuid,
  } = useUpdateJobPipelineUuid();
  const disabled = !isDraft || isChangingPipelineUuid;

  const [jobPipelineUuid = "", setJobPipelineUuid] = React.useState<string>();
  useLoadValueFromJobChanges(
    (jobChanges) =>
      `${jobChanges?.pipeline_uuid}|${jobChanges?.pipeline_definition.name}`,
    setJobPipelineUuid
  );

  const { pipelines } = useFetchSnapshotPipelines();

  const handleChange = async (event: SelectChangeEvent) => {
    const selectedValue = event.target.value as string;
    const [pipelineUuid, pipelineName] = selectedValue.split(/\|(.*)/s);
    await setPipelineUuid(pipelineUuid, pipelineName);
    setJobPipelineUuid(selectedValue);
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
              value={`${pipeline.definition.uuid}|${pipeline.definition.name}`}
              disabled={!pipeline.valid}
            >
              {pipeline.definition.name}
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  ) : null;
};
