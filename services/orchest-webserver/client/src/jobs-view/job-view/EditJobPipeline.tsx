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

const parseSelectValue = (selectValue: string) =>
  selectValue.split(/\|(.*)/s) as [string, string];

export const EditJobPipeline = () => {
  const isDraft = useEditJob((state) => state.jobChanges?.status === "DRAFT");
  const {
    setPipelineUuid,
    isChangingPipelineUuid,
  } = useUpdateJobPipelineUuid();
  const disabled = !isDraft || isChangingPipelineUuid;

  const [selectValue = "", setSelectValue] = React.useState<string>();
  useLoadValueFromJobChanges(
    (jobChanges) =>
      `${jobChanges?.pipeline_uuid}|${jobChanges?.pipeline_definition.name}`,
    setSelectValue
  );

  const { pipelines } = useFetchSnapshotPipelines();

  const handleChange = async (event: SelectChangeEvent) => {
    const selectedValue = event.target.value as string;
    const [pipelineUuid, pipelineName] = parseSelectValue(selectedValue);

    await setPipelineUuid(pipelineUuid, pipelineName);
    setSelectValue(selectedValue);
  };

  return hasValue(pipelines) ? (
    <FormControl
      disabled={disabled}
      sx={{
        width: { xs: "80%", lg: "32%" },
        minWidth: (theme) => theme.spacing(35),
      }}
    >
      <InputLabel
        id="job-pipeline-select-label"
        shrink
        sx={{
          backgroundColor: "white",
          padding: (theme) => theme.spacing(0, 0.5),
        }}
      >
        Pipeline
      </InputLabel>
      <Select
        labelId="job-pipeline-select-label"
        id="job-pipeline-select"
        value={selectValue}
        required
        label="Pipeline"
        onChange={handleChange}
      >
        {pipelines.map((pipeline) => {
          return (
            <MenuItem
              key={pipeline.definition.uuid}
              value={`${pipeline.definition.uuid}|${pipeline.definition.name}`}
            >
              {pipeline.definition.name}
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  ) : null;
};
