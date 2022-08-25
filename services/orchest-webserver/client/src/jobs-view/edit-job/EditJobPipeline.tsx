import { useProjectsContext } from "@/contexts/ProjectsContext";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { useLoadValueFromJobChanges } from "./hooks/useLoadValueFromJobChanges";

export const EditJobPipeline = () => {
  const {
    state: { pipelines },
  } = useProjectsContext();
  const { jobChanges, setJobChanges } = useEditJob();
  const [value = "", setValue] = React.useState<string>();

  useLoadValueFromJobChanges((valueFromStore) =>
    setValue(valueFromStore?.pipeline_uuid || "")
  );

  const handleChange = (event: SelectChangeEvent) => {
    const value = event.target.value as string;
    setValue(value);
    setJobChanges({ pipeline_uuid: value });
  };

  const disabled = jobChanges?.status !== "DRAFT";

  return hasValue(pipelines) ? (
    <FormControl
      disabled={disabled}
      sx={{ width: "50%", minWidth: (theme) => theme.spacing(35) }}
    >
      <InputLabel id="job-pipeline-select-label">Pipeline</InputLabel>
      <Select
        labelId="job-pipeline-select-label"
        id="job-pipeline-select"
        value={value}
        label="Pipeline"
        onChange={handleChange}
      >
        {pipelines.map((pipeline) => {
          return (
            <MenuItem key={pipeline.uuid} value={pipeline.uuid}>
              {pipeline.name}
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  ) : null;
};
