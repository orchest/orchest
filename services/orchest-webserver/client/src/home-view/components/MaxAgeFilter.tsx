import MenuItem from "@mui/material/MenuItem";
import React from "react";
import { RunMaxAxe } from "../utils/filter";
import { FilterSelect } from "./FilterSelect";

export type DurationFilterProps = {
  selected: RunMaxAxe;
  onChange: (duration: RunMaxAxe) => void;
};

const options: RunMaxAxe[] = ["all", "7 days", "30 days"];
const prettifyOption = (option: RunMaxAxe) =>
  option === "all" ? "All time" : `Last ${option}`;

export const MaxAgeFilter = ({ selected, onChange }: DurationFilterProps) => {
  return (
    <FilterSelect
      label=""
      value={selected}
      onChange={(event) => onChange(event.target.value as RunMaxAxe)}
      prettifyValue={prettifyOption}
    >
      {options.map((option) => (
        <MenuItem
          dense
          selected={option === selected}
          key={option}
          value={option}
        >
          {prettifyOption(option)}
        </MenuItem>
      ))}
    </FilterSelect>
  );
};
