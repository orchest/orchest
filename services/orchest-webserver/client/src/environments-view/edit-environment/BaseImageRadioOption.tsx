import { ContainerImageTile } from "@/environments-view/edit-environment/ContainerImageTile";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import { useRadioGroup } from "@mui/material/RadioGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { visuallyHidden } from "@mui/utils";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

type BaseImageRadioOptionProps = {
  disabled: boolean;
  value: string;
  children: React.ReactElement;
  title?: string;
};
export const BaseImageRadioOption = ({
  title,
  value,
  children,
  disabled,
}: BaseImageRadioOptionProps) => {
  const radioGroup = useRadioGroup();
  const checked = hasValue(radioGroup) && radioGroup.value === value;
  const icon = (
    <>
      <ContainerImageTile checked={checked}>
        {children || value}
      </ContainerImageTile>
    </>
  );
  const content = (
    <FormControlLabel
      value={value}
      disabled={disabled}
      label={<Typography style={visuallyHidden}>{value}</Typography>}
      control={
        <Radio
          disableRipple
          sx={{ width: "100%" }}
          icon={icon}
          checkedIcon={icon}
        />
      }
      sx={{ width: (theme) => theme.spacing(30) }}
    />
  );

  return title ? <Tooltip title={title}>{content}</Tooltip> : content;
};
