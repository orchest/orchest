import MenuItem from "@mui/material/MenuItem";
import capitalize from "@mui/utils/capitalize";
import React from "react";
import { RunSortDirection } from "../utils/filter";
import { FilterSelect } from "./FilterSelect";

export type SortFilterProps = {
  selected: RunSortDirection;
  onChange: (direction: RunSortDirection) => void;
};

export const SortFilter = ({ selected, onChange }: SortFilterProps) => {
  return (
    <FilterSelect
      label=""
      value={selected}
      onChange={(event) => onChange(event.target.value as RunSortDirection)}
      prettifyValue={(value) => `Sort: ${capitalize(value)}`}
    >
      <MenuItem dense value="newest" selected={selected === "newest"}>
        Newest
      </MenuItem>
      <MenuItem dense value="oldest" selected={selected === "oldest"}>
        Oldest
      </MenuItem>
    </FilterSelect>
  );
};
