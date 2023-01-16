import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select, { SelectProps } from "@mui/material/Select";
import { alpha } from "@mui/material/styles";
import Typography, { TypographyProps } from "@mui/material/Typography";
import React from "react";

export type FilterSelectProps<T = unknown> = {
  prettifyValue?: (value: Flatten<T>) => string;
} & Omit<SelectProps<T>, "renderValue">;

export function FilterSelect<T = unknown>({
  sx,
  value,
  label,
  prettifyValue,
  multiple,
  ...selectProps
}: FilterSelectProps<T>) {
  const isMultiple = Boolean(multiple) && value instanceof Array;
  const hasSelected = isMultiple ? value.length > 0 : Boolean(value);
  const id = React.useMemo(generateId, []);

  return (
    <FormControl size="small">
      <InputLabel size="small" id={id} sx={{ lineHeight: 0 }}>
        <Typography lineHeight="1" variant="button" textTransform="none">
          {!hasSelected ? label : ""}
        </Typography>
      </InputLabel>

      <Select
        multiple={multiple}
        size="small"
        variant="outlined"
        label={!hasSelected ? label : ""}
        color={hasSelected ? "primary" : undefined}
        value={value}
        aria-label={`${label} filter`}
        renderValue={(value) => (
          <FilterValue
            values={arrayify(value)}
            prettify={prettifyValue}
            color={hasSelected && isMultiple ? "primary" : "text.secondary"}
          />
        )}
        sx={{
          height: "30px",
          svg: {
            fill: (theme) =>
              hasSelected && isMultiple
                ? theme.palette.primary.main
                : undefined,
          },
          fieldset: {
            backgroundColor: (theme) =>
              hasSelected && isMultiple
                ? alpha(theme.palette.primary.main, 0.04)
                : undefined,
            borderColor: (theme) =>
              hasSelected && isMultiple
                ? theme.palette.primary.main
                : undefined,
          },
          ...sx,
        }}
        {...selectProps}
      />
    </FormControl>
  );
}

type FilterValueProps<T = unknown> = {
  values: T[];
  prettify?: (value: T) => string;
  color?: TypographyProps["color"];
};

function FilterValue<T = unknown>({
  values: [first, ...more],
  prettify = (value) => String(value),
  color,
}: FilterValueProps<T>) {
  if (!first) return null;

  return (
    <Typography color={color} variant="button" textTransform="none">
      {prettify(first)}
      {more.length > 0 ? ` +${more.length}` : null}
    </Typography>
  );
}

type Flatten<T> = T extends unknown[] ? T[number] : T;

const generateId = () => "filter-" + Math.floor(Math.random() * 100000);

function arrayify<T>(value: T) {
  return (value instanceof Array ? value : [value]) as Flatten<T>[];
}
