import CronScheduleInput from "@/components/CronScheduleInput";
import { DateTimeInput } from "@/components/DateTimeInput";
import { useActiveProject } from "@/hooks/useActiveProject";
import { JobDocLink } from "@/jobs-view/JobDocLink";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import React from "react";
import { useEditJobType } from "./hooks/useEditJobType";
import {
  ScheduleOption,
  useJobScheduleOption,
} from "./hooks/useJobScheduleOption";

const SIZE_LIMIT = 50;

const SnapshotOversizedWarning = () => {
  const project = useActiveProject();
  const isSnapshotTooBig = (project?.project_snapshot_size ?? 0) > SIZE_LIMIT;

  return isSnapshotTooBig ? (
    <Alert
      severity="warning"
      sx={{
        marginTop: (theme) => theme.spacing(3),
        width: "500px",
      }}
    >
      {`Snapshot size exceeds 50MB. You might want to enable Auto Clean-up to free up disk space regularly. Check the `}
      <JobDocLink />
      {` for more details.`}
    </Alert>
  ) : null;
};

export const EditJobSchedule = () => {
  const {
    scheduleOption,
    setScheduleOption,
    cronString,
    setCronString,
    nextScheduledTime,
    setNextScheduledTime,
  } = useJobScheduleOption();

  const editJobType = useEditJobType();

  return (
    <Box sx={{ marginBottom: (theme) => theme.spacing(3) }}>
      <FormControl
        component="fieldset"
        sx={{ marginBottom: (theme) => theme.spacing(2), width: "100%" }}
        disabled={editJobType !== "draft"}
      >
        <FormLabel id="schedule">Schedule</FormLabel>
        <RadioGroup
          row
          aria-labelledby="schedule"
          defaultValue="one-off"
          name="schedule-radio-group"
          value={scheduleOption}
          onChange={(e) => setScheduleOption(e.target.value as ScheduleOption)}
        >
          <FormControlLabel
            value="one-off"
            control={<Radio />}
            label="One off"
          />
          <FormControlLabel
            value="recurring"
            control={<Radio />}
            label="Recurring"
          />
        </RadioGroup>
      </FormControl>
      {scheduleOption === "one-off" && (
        <DateTimeInput
          disabled={scheduleOption !== "one-off"}
          value={nextScheduledTime}
          onChange={setNextScheduledTime}
        />
      )}
      {scheduleOption === "recurring" && (
        <>
          <CronScheduleInput
            value={cronString}
            onChange={setCronString}
            disabled={scheduleOption !== "recurring"}
            dataTestId="job-edit-schedule-cronjob-input"
          />
          <SnapshotOversizedWarning />
        </>
      )}
    </Box>
  );
};
