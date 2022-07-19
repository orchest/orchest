import { isNumber } from "@/utils/webserver-utils";
import InputAdornment from "@mui/material/InputAdornment";
import InputBase from "@mui/material/InputBase";
import React from "react";
import {
  MAX_SCALE_FACTOR,
  MIN_SCALE_FACTOR,
  useScaleFactor,
} from "../contexts/ScaleFactorContext";

export const ScaleFactorField = () => {
  const { scaleFactor, setScaleFactor } = useScaleFactor();
  const scaleFactorInPercentage = Math.round(scaleFactor * 100);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = Number(e.target.value);
    if (isNumber(value)) {
      setScaleFactor(value / 100);
    }
  };

  return (
    <InputBase
      size="small"
      type="number"
      value={scaleFactorInPercentage}
      inputProps={{
        inputMode: "numeric",
        step: 1,
        min: MIN_SCALE_FACTOR * 100,
        max: MAX_SCALE_FACTOR * 100,
        sx: {
          padding: 0,
          width: (theme) => theme.spacing(4),
        },
      }}
      margin="dense"
      endAdornment={
        <InputAdornment position="end" sx={{ marginLeft: 0 }}>
          %
        </InputAdornment>
      }
      sx={{
        border: "none",
        display: "flex",
        alignItems: "center",
        padding: 0,
      }}
      onChange={handleChange}
    />
  );
};
