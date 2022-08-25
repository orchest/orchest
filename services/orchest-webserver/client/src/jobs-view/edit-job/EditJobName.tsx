import { useCustomRoute } from "@/hooks/useCustomRoute";
import TextField from "@mui/material/TextField";
import React from "react";
import { useEditJob } from "../stores/useEditJob";

export const EditJobName = () => {
  const { jobUuid } = useCustomRoute();
  const { jobChanges, setJobChanges } = useEditJob();
  const [value = "", setValue] = React.useState<string>();
  const [hasEdited, setHasEdited] = React.useState(false);

  const isEnvironmentLoaded = jobUuid && jobUuid === jobChanges?.uuid;

  React.useEffect(() => {
    if (isEnvironmentLoaded && jobChanges?.name) {
      setValue(jobChanges?.name);
    }
  }, [jobChanges?.name, isEnvironmentLoaded, jobUuid]);

  const isInvalid = hasEdited && value.trim().length === 0;

  return (
    <TextField
      required
      value={value}
      onFocus={() => setHasEdited(true)}
      onBlur={() => setJobChanges({ name: value.trim() })}
      onChange={({ target }) => {
        setValue(target.value);

        if (target.value) {
          setJobChanges({ name: target.value });
        }
      }}
      InputLabelProps={{ required: false }}
      error={isInvalid}
      helperText={isInvalid ? "Job name cannot be blank" : " "}
      label="Job name"
      sx={{ width: { xs: "100%", lg: "50%" } }}
    />
  );
};
