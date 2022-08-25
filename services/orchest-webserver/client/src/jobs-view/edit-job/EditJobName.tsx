import TextField from "@mui/material/TextField";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { useLoadValueFromJobChanges } from "./hooks/useLoadValueFromJobChanges";

export const EditJobName = () => {
  const { setJobChanges } = useEditJob();
  const [value = "", setValue] = React.useState<string>();
  const [hasEdited, setHasEdited] = React.useState(false);

  useLoadValueFromJobChanges((valueFromStore) =>
    setValue(valueFromStore?.name || "")
  );

  const isInvalid = hasEdited && value.trim().length === 0;

  const handleChange = ({
    target,
  }: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValue(target.value);
    if (target.value) setJobChanges({ name: target.value });
  };

  return (
    <TextField
      required
      value={value}
      onFocus={() => setHasEdited(true)}
      onBlur={() => setJobChanges({ name: value.trim() })}
      onChange={handleChange}
      InputLabelProps={{ required: false }}
      error={isInvalid}
      helperText={isInvalid ? "Job name cannot be blank" : " "}
      label="Job name"
      sx={{ width: { xs: "100%", lg: "70%" } }}
    />
  );
};
