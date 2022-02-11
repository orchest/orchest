import { IconButton } from "@/components/common/IconButton";
import { CustomImage } from "@/types";
import { ellipsis } from "@/utils/styles";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import EditIcon from "@mui/icons-material/Edit";
import { SxProps, Theme } from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import Radio from "@mui/material/Radio";
import RadioGroup, { useRadioGroup } from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";
import { DEFAULT_BASE_IMAGES } from "./common";
import { ContainerImageTile } from "./ContainerImageTile";
import { LabeledText } from "./LabeledText";

const ImageOption: React.FC<{
  fullWidth?: boolean;
  value: string;
  title?: string;
  sx?: SxProps<Theme>;
}> = ({ fullWidth, title, value, sx, children }) => {
  const radioGroup = useRadioGroup();
  const checked = radioGroup && radioGroup.value === value;

  const content = (
    <FormControlLabel
      value={value}
      label=""
      sx={{ margin: 0, width: fullWidth ? "100%" : "auto" }}
      control={
        <Radio
          disableRipple
          sx={{ width: fullWidth ? "100%" : "auto" }}
          icon={
            <ContainerImageTile sx={sx}>{children || value}</ContainerImageTile>
          }
          checkedIcon={
            <ContainerImageTile sx={sx} checked={checked}>
              {children || value}
            </ContainerImageTile>
          }
        />
      }
    />
  );

  return title ? <Tooltip title={title}>{content}</Tooltip> : content;
};

export const ContainerImagesRadioGroup = ({
  value,
  onChange,
  onOpenCustomBaseImageDialog,
  customImage,
}: {
  value: string;
  onChange: (newValue: string) => void;
  onOpenCustomBaseImageDialog: () => void;
  customImage: CustomImage;
}) => {
  return (
    <RadioGroup value={value} onChange={(e, value) => onChange(value)}>
      <Box>
        <Typography component="h2" variant="h6">
          Choose a container image
        </Typography>
        <Typography variant="body2">
          The container image will be the starting point from which the
          environment will be built.
        </Typography>
      </Box>
      <Grid
        container
        spacing={1}
        sx={{ margin: (theme) => theme.spacing(2, -1, 0, -1) }}
      >
        {DEFAULT_BASE_IMAGES.map(({ base_image }) => {
          return (
            <Grid item sm={6} key={base_image}>
              <ImageOption title={base_image} value={base_image} />
            </Grid>
          );
        })}
        {!customImage && (
          <Button
            startIcon={<AddCircleIcon />}
            fullWidth
            sx={{ marginTop: (theme) => theme.spacing(2) }}
            onClick={onOpenCustomBaseImageDialog}
          >
            Create custom container image
          </Button>
        )}
        {customImage && (
          <Grid item sm={12}>
            <ImageOption
              fullWidth
              value={customImage.base_image}
              sx={{ padding: (theme) => theme.spacing(2, 0) }}
            >
              <Stack
                direction="row"
                justifyContent="space-around"
                alignItems="center"
                sx={{ width: "100%" }}
              >
                <Stack
                  direction="column"
                  spacing={1}
                  sx={{
                    width: "100%",
                    paddingLeft: (theme) => theme.spacing(3),
                  }}
                >
                  <LabeledText caption="Image path">
                    <Typography sx={ellipsis((theme) => theme.spacing(30))}>
                      {customImage.base_image}
                    </Typography>
                  </LabeledText>
                  <LabeledText caption="Language">
                    {customImage.language}
                  </LabeledText>
                </Stack>
                <IconButton
                  title="Edit custom container image"
                  sx={{
                    zIndex: 1,
                    marginRight: (theme) => theme.spacing(2),
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onOpenCustomBaseImageDialog();
                  }}
                >
                  <EditIcon />
                </IconButton>
              </Stack>
            </ImageOption>
          </Grid>
        )}
      </Grid>
    </RadioGroup>
  );
};
