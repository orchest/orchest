import SearchIcon from "@mui/icons-material/Search";
import InputBase, { InputBaseProps } from "@mui/material/InputBase";
import { styled } from "@mui/material/styles";
import React from "react";

const SearchContainer = styled("div")(({ theme }) => ({
  position: "relative",
  borderRadius: theme.spacing(0.5),
  border: `1px solid ${theme.palette.grey[400]}`,
  margin: theme.spacing(1, 0),
  width: "100%",
}));

const SearchIconWrapper = styled("div")(({ theme }) => ({
  padding: theme.spacing(0, 1, 0, 1.5),
  color: theme.palette.action.active,
  height: "100%",
  position: "absolute",
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: "inherit",
  width: "100%",
  "& .MuiInputBase-input": {
    padding: theme.spacing(1.5, 1, 1.5, 0),
    paddingLeft: `calc(1em + ${theme.spacing(3.5)})`,
    transition: theme.transitions.create("width"),
    width: "100%",
  },
}));

export const SearchField = ({
  autoFocus,
  tabIndex,
  value,
  disabled,
  onChange,
  placeholder = "Search",
  onKeyDown,
}: {
  autoFocus?: boolean;
  tabIndex?: number;
  value: string;
  disabled?: boolean;
  onChange: InputBaseProps["onChange"];
  placeholder?: string;
  onKeyDown?: InputBaseProps["onKeyDown"];
}) => {
  return (
    <SearchContainer>
      <SearchIconWrapper>
        <SearchIcon />
      </SearchIconWrapper>
      <StyledInputBase
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        placeholder={placeholder}
        inputProps={{ "aria-label": placeholder }}
        value={value}
        disabled={disabled}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
    </SearchContainer>
  );
};
