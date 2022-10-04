import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import parser from "cron-parser";
import cronstrue from "cronstrue";
import * as React from "react";

const buttons = [
  {
    label: "Every minute",
    cronString: "* * * * *",
  },
  {
    label: "Hourly",
    cronString: "0 * * * *",
  },
  {
    label: "Daily",
    cronString: "0 0 * * *",
  },
  {
    label: "Weekly",
    cronString: "0 0 * * 0",
  },
  {
    label: "Monthly",
    cronString: "0 0 1 * *",
  },
];

export const CronScheduleInput: React.FC<{
  disabled: boolean;
  value: string;
  onChange: (value: string) => void;
  dataTestId: string;
}> = ({ value, disabled, onChange, dataTestId }) => {
  const onChangeCronString = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const value = e.target.value;
    onChange(value);
  };

  const cronDescription = React.useMemo(() => {
    try {
      parser.parseExpression(value);
      return cronstrue.toString(value);
    } catch (error) {
      return false;
    }
  }, [value]);

  return (
    <Stack>
      <Stack
        direction="row"
        spacing={2}
        sx={{ marginBottom: (theme) => theme.spacing(2) }}
      >
        {buttons.map((button) => (
          <Button
            color="secondary"
            key={button.label}
            disabled={disabled}
            onClick={() => onChange(button.cronString)}
          >
            {button.label}
          </Button>
        ))}
      </Stack>
      <TextField
        error={!cronDescription}
        disabled={disabled}
        label="Cron expression"
        value={value}
        onChange={onChangeCronString}
        data-test-id={dataTestId}
        helperText={!cronDescription ? "Invalid cron string." : " "}
        sx={{ width: (theme) => theme.spacing(20) }}
      />
      <Typography sx={{ marginBottom: 2 }}>{cronDescription}</Typography>
      <Typography variant="subtitle2">
        Note: the cron expression is evaluated in UTC time.
      </Typography>
    </Stack>
  );
};

export default CronScheduleInput;
