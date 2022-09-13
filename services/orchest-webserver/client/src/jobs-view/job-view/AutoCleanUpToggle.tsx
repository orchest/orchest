import { Code } from "@/components/common/Code";
import { useAutoCleanUpEnabled } from "@/jobs-view/job-view/hooks/useAutoCleanUpEnabled";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";

type AutoCleanUpToggleProps = {
  selectedRuns: string[];
};

export const AutoCleanUpToggle = ({ selectedRuns }: AutoCleanUpToggleProps) => {
  const {
    isAutoCleanUpEnabled,
    numberOfRetainedRuns,
    onChangeNumberOfRetainedRuns,
    toggleIsAutoCleanUpEnabled,
  } = useAutoCleanUpEnabled(selectedRuns);

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      sx={{ marginTop: (theme) => theme.spacing(1) }}
    >
      <FormControlLabel
        sx={{ marginLeft: 0 }}
        control={
          <Switch
            checked={isAutoCleanUpEnabled}
            onChange={toggleIsAutoCleanUpEnabled}
            size="small"
            inputProps={{ "aria-label": "Enable auto clean-up" }}
          />
        }
        label={
          <Stack direction="row" alignItems="center">
            <Typography sx={{ marginLeft: (theme) => theme.spacing(1) }}>
              Auto clean-up
            </Typography>
            <Tooltip
              placement="right"
              title={
                <>
                  <Typography
                    variant="body2"
                    sx={{ marginBottom: (theme) => theme.spacing(1) }}
                  >
                    Retain the last finished pipeline runs and automatically
                    remove the oldest runs. This reduces disk space usage.
                  </Typography>
                  <Typography variant="body2">
                    If your pipeline produces artifacts that are stored in the
                    project directory, then you might want to backup the
                    artifacts to external sources or the <Code>/data</Code>{" "}
                    directory.
                  </Typography>
                </>
              }
            >
              <InfoOutlinedIcon
                color="primary"
                fontSize="small"
                sx={{
                  marginLeft: (theme) => theme.spacing(1),
                  cursor: "pointer",
                }}
              />
            </Tooltip>
          </Stack>
        }
      />
      <TextField
        variant="outlined"
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">pipeline runs</InputAdornment>
          ),
        }}
        disabled={!isAutoCleanUpEnabled}
        value={numberOfRetainedRuns}
        type="number"
        label="Keep"
        size="small"
        onChange={(e) => onChangeNumberOfRetainedRuns(parseInt(e.target.value))}
        sx={{ width: (theme) => theme.spacing(20) }}
      />
    </Stack>
  );
};
