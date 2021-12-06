import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import React from "react";

const getTimeString = (date: Date) => {
  return (
    ("0" + date.getHours()).slice(-2) +
    ":" +
    ("0" + date.getMinutes()).slice(-2)
  );
};

const getDateString = (date: Date) => {
  return (
    date.getFullYear() +
    "-" +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    "-" +
    ("0" + date.getDate()).slice(-2)
  );
};

const DateTimeInput: React.FC<{
  value?: Date;
  disabled?: boolean;
  onChange?: (dateTime: Date) => void;
}> = ({ value, disabled, onChange }) => {
  const [dateTime, setDateTime] = React.useState(new Date());

  const update = (iso: string) => {
    const newDateTime = new Date(iso);
    if (onChange) {
      onChange(newDateTime);
      return;
    }
    setDateTime(newDateTime);
  };

  const renderedDateTime = React.useMemo(() => value || dateTime, [
    value,
    dateTime,
  ]);

  const timeString = React.useMemo(() => getTimeString(renderedDateTime), [
    renderedDateTime,
  ]);

  const dateString = React.useMemo(() => getDateString(renderedDateTime), [
    renderedDateTime,
  ]);

  const handleChangeTime = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const newTimeString = e.target.value;
    update(`${getDateString(renderedDateTime)} ${newTimeString}`);
  };

  const handleChangeDate = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const newDateString = e.target.value;
    update(`${newDateString} ${getTimeString(renderedDateTime)}`);
  };

  return (
    <Stack spacing={4}>
      <Box>
        <TextField
          variant="filled"
          type="date"
          label="Date"
          value={dateString}
          onChange={handleChangeDate}
          InputLabelProps={{
            shrink: true,
          }}
        />
      </Box>
      <Box>
        <TextField
          variant="filled"
          type="time"
          label="Time"
          value={timeString}
          onChange={handleChangeTime}
          InputLabelProps={{
            shrink: true,
          }}
        />
      </Box>
    </Stack>
  );
};

export default DateTimeInput;
