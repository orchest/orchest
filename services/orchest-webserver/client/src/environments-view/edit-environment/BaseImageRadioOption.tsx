import { ContainerImageTile } from "@/environments-view/edit-environment/ContainerImageTile";
import { alpha } from "@mui/material";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import { useRadioGroup } from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { visuallyHidden } from "@mui/utils";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { isEnvironmentBuilding } from "../common";
import { useEditEnvironment } from "../stores/useEditEnvironment";

type BaseImageRadioOptionProps = {
  disabled?: boolean;
  value: string;
  children: React.ReactNode;
  title?: string;
};

const BaseImageRadioOptionBase = React.memo(function BaseImageRadioOptionBase({
  title,
  value,
  children,
  disabled,
}: BaseImageRadioOptionProps) {
  const radioGroup = useRadioGroup();
  const checked = hasValue(radioGroup) && radioGroup.value === value;
  const icon = (
    <ContainerImageTile checked={checked}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="center"
      >
        {children || value}
      </Stack>
    </ContainerImageTile>
  );
  const content = (
    <FormControlLabel
      value={value}
      disabled={disabled}
      label={<Typography style={visuallyHidden}>{value}</Typography>}
      control={
        <Radio
          disableRipple
          sx={{
            width: "100%",
            "&:hover": { backgroundColor: "transparent" },
            "&:hover > div": {
              backgroundColor: (theme) =>
                checked
                  ? alpha(theme.palette.primary.light, 0.2)
                  : theme.palette.grey[100],
            },
          }}
          icon={icon}
          checkedIcon={icon}
        />
      }
      sx={{
        width: (theme) => theme.spacing(28),
        "&.Mui-disabled": {
          cursor: "not-allowed",
        },
      }}
    />
  );

  return title ? <Tooltip title={title}>{content}</Tooltip> : content;
});

export const BaseImageRadioOption = React.memo(function BaseImageRadioOption({
  disabled,
  children,
  ...props
}: BaseImageRadioOptionProps) {
  const latestBuildStatus = useEditEnvironment(
    (state) => state.changes?.latestBuild?.status
  );
  const disabledOnBuilding = isEnvironmentBuilding(latestBuildStatus);

  return (
    <BaseImageRadioOptionBase
      disabled={disabled || disabledOnBuilding}
      {...props}
    >
      {children}
    </BaseImageRadioOptionBase>
  );
});
