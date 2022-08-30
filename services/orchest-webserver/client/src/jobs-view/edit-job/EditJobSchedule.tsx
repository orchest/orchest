import CronScheduleInput from "@/components/CronScheduleInput";
import { DateTimeInput } from "@/components/DateTimeInput";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { JobDocLink } from "@/legacy-job-view/JobDocLink";
import { toUtcDateTimeString } from "@/utils/date-time";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { useCronString } from "./hooks/useCronString";
import { useScheduleDateTime } from "./hooks/useScheduleDateTime";

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

type ScheduleOption = "one-off" | "recurring";

export const EditJobSchedule = () => {
  const setJobChanges = useEditJob((state) => state.setJobChanges);

  const [scheduleOption, setScheduleOption] = React.useState<ScheduleOption>(
    "one-off"
  );
  const [cronString, setCronString] = useCronString();
  const [nextScheduledTime, setNextScheduledTime] = useScheduleDateTime();

  React.useEffect(() => {
    if (scheduleOption === "one-off") {
      setJobChanges({
        next_scheduled_time: toUtcDateTimeString(nextScheduledTime),
        schedule: undefined,
      });
    }
    if (scheduleOption === "recurring") {
      setJobChanges({
        next_scheduled_time: undefined,
        schedule: cronString,
      });
    }
  }, [scheduleOption, setJobChanges, nextScheduledTime, cronString]);

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
