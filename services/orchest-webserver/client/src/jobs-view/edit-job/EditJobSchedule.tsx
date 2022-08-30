import CronScheduleInput from "@/components/CronScheduleInput";
import { DateTimeInput } from "@/components/DateTimeInput";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { JobDocLink } from "@/legacy-job-view/JobDocLink";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import React from "react";
import {
  ScheduleOption,
  useJobScheduleOption,
} from "./hooks/useJobScheduleOption";

const SnapshotOversizedWarning = () => {
  const {
    state: { projects = [], projectUuid },
  } = useProjectsContext();

  const shouldShowSnapshotSizeTooBigWarning = React.useMemo(() => {
    const project = projects.find((project) => project.uuid === projectUuid);
    return (project?.project_snapshot_size ?? 0) > 50;
  }, [projects, projectUuid]);

  return shouldShowSnapshotSizeTooBigWarning ? (
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

  return (
    <Box sx={{ marginBottom: (theme) => theme.spacing(3) }}>
      <FormControl
        component="fieldset"
        sx={{ marginBottom: (theme) => theme.spacing(2), width: "100%" }}
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
