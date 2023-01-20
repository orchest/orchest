import { SelectChangeEvent } from "@mui/material/Select";
import React, { PropsWithChildren } from "react";
import { FilterSelect, FilterSelectProps } from "./FilterSelect";

type MultiFilterProps<T extends string> = PropsWithChildren<{
  id: string;
  label: string;
  selected: T[];
  minWidth: string;
  onChange: (values: T[]) => void;
  prettify?: (value: T) => string;
  MenuProps?: FilterSelectProps["MenuProps"];
}>;

export function MultiFilter<T extends string>({
  label,
  id,
  children,
  onChange,
  minWidth,
  prettify = (value) => value,
  selected,
  MenuProps,
}: MultiFilterProps<T>) {
  const handleChange = (event: SelectChangeEvent<T[]>) => {
    if (typeof event.target.value === "string") {
      onChange(event.target.value.split(",") as T[]);
    } else {
      onChange(event.target.value);
    }
  };

  return (
    <FilterSelect
      multiple
      sx={{ minWidth }}
      size="small"
      variant="outlined"
      aria-label={`${label} filter`}
      value={selected}
      label={selected.length === 0 ? label : ""}
      labelId={id}
      onChange={handleChange}
      prettifyValue={prettify}
      MenuProps={MenuProps}
    >
      {children}
    </FilterSelect>
  );
}
