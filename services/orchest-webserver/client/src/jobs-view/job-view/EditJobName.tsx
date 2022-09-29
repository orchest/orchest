import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { useLoadValueFromJobChanges } from "./hooks/useLoadValueFromJobChanges";

export const EditJobName = () => {
  const setJobChanges = useEditJob((state) => state.setJobChanges);
  const [value = "", setValue] = React.useState<string>();
  const [hasEdited, setHasEdited] = React.useState(false);

  useLoadValueFromJobChanges((jobChanges) => jobChanges?.name, setValue);

  const isInvalid = hasEdited && value.trim().length === 0;

  const handleChange = ({
    target,
  }: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValue(target.value);
    if (target.value) setJobChanges({ name: target.value });
  };

  return (
    <Box>
      <TextField
        required
        value={value}
        onFocus={() => setHasEdited(true)}
        onBlur={() => {
          const trimmedValue = value.trim();
          if (trimmedValue) setJobChanges({ name: trimmedValue });
        }}
        onChange={handleChange}
        InputLabelProps={{ required: false }}
        error={isInvalid}
        helperText={isInvalid ? "Job name cannot be blank" : " "}
        label="Job name"
        sx={{ width: { xs: "100%", lg: "49%" } }}
      />
    </Box>
  );
};
