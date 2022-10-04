import { isNumber } from "@/utils/webserver-utils";
import InputAdornment from "@mui/material/InputAdornment";
import InputBase from "@mui/material/InputBase";
import React, { useEffect, useState } from "react";
import {
  MAX_SCALE_FACTOR,
  MIN_SCALE_FACTOR,
  useCanvasScaling,
} from "../contexts/CanvasScalingContext";

type ZoomValueFieldProps = {
  disabled: boolean;
};

export const ZoomValueField = ({ disabled }: ZoomValueFieldProps) => {
  const { scaleFactor, setScaleFactor } = useCanvasScaling();
  const [percentage, setPercentage] = useState(Math.round(scaleFactor * 100));

  useEffect(() => setPercentage(Math.round(scaleFactor * 100)), [scaleFactor]);

  const onBlur = () => setScaleFactor(percentage / 100);
  const onChange = ({ target }: React.ChangeEvent<HTMLInputElement>) => {
    if (isNumber(target.valueAsNumber)) {
      setPercentage(target.valueAsNumber);
    }
  };

  const onKeyPress = (event: React.KeyboardEvent) => {
    if (event.code === "Enter") {
      setScaleFactor(percentage / 100);
    }
  };

  return (
    <InputBase
      size="small"
      type="number"
      margin="dense"
      value={percentage}
      disabled={disabled}
      onKeyPress={onKeyPress}
      endAdornment={
        <InputAdornment position="end" sx={{ marginLeft: 0 }}>
          %
        </InputAdornment>
      }
      inputProps={{
        inputMode: "numeric",
        step: 1,
        min: MIN_SCALE_FACTOR * 100,
        max: MAX_SCALE_FACTOR * 100,
        sx: {
          padding: 0,
          width: (theme) => theme.spacing(4.5),
        },
      }}
      sx={{
        border: "none",
        display: "flex",
        alignItems: "center",
        padding: 0,
      }}
      onChange={onChange}
      onBlur={onBlur}
    />
  );
};
