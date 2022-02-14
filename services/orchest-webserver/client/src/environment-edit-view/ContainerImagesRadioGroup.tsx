import { IconButton } from "@/components/common/IconButton";
import { CustomImage } from "@/types";
import { ellipsis } from "@/utils/styles";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import Radio from "@mui/material/Radio";
import RadioGroup, { useRadioGroup } from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import { styled, SxProps, Theme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";
import { DEFAULT_BASE_IMAGES, LANGUAGE_MAP } from "./common";
import { ContainerImageTile } from "./ContainerImageTile";
import { LabeledText } from "./LabeledText";

const ImageOption: React.FC<{
  supportGpu: boolean;
  value: string;
  title?: string;
  sx?: SxProps<Theme>;
}> = ({ title, value, supportGpu, sx, children }) => {
  const radioGroup = useRadioGroup();
  const checked = radioGroup && radioGroup.value === value;

  const icon = (
    <>
      <ContainerImageTile sx={sx} checked={checked}>
        {children || value}
        {supportGpu && (
          <Box
            sx={{
              position: "absolute",
              top: (theme) => theme.spacing(2),
              right: (theme) => theme.spacing(2.5),
              fontSize: (theme) => theme.typography.caption.fontSize,
              color: (theme) => theme.palette.primary.dark,
            }}
          >
            GPU
          </Box>
        )}
      </ContainerImageTile>
    </>
  );

  const content = (
    <FormControlLabel
      value={value}
      label=""
      sx={{ margin: 0, width: "100%" }}
      control={
        <Radio
          disableRipple
          sx={{ width: "100%" }}
          icon={icon}
          checkedIcon={icon}
        />
      }
    />
  );

  return title ? <Tooltip title={title}>{content}</Tooltip> : content;
};

const Image = styled("img")({ maxHeight: "70px" });

export const ContainerImagesRadioGroup = ({
  value,
  onChange,
  onOpenCustomBaseImageDialog,
  customImage,
}: {
  value: string;
  onChange: (newImage: CustomImage) => void;
  onOpenCustomBaseImageDialog: () => void;
  customImage: CustomImage;
}) => {
  const onChangeSelection = (baseImage: string) => {
    if (customImage && baseImage === customImage.base_image) {
      onChange(customImage);
      return;
    }
    onChange(
      DEFAULT_BASE_IMAGES.find((image) => image.base_image === baseImage)
    );
  };
  return (
    <RadioGroup value={value} onChange={(e, value) => onChangeSelection(value)}>
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
        {DEFAULT_BASE_IMAGES.map(({ base_image, img_src, gpu_support }) => {
          return (
            <Grid item sm={6} key={base_image}>
              <ImageOption
                title={base_image}
                value={base_image}
                supportGpu={gpu_support}
              >
                <Image src={`${img_src}`} alt={base_image} loading="lazy" />
              </ImageOption>
            </Grid>
          );
        })}
        {!customImage && (
          <Button
            startIcon={<AddCircleIcon />}
            fullWidth
            sx={{
              marginTop: (theme) => theme.spacing(4),
              padding: (theme) => theme.spacing(2, 0),
            }}
            onClick={onOpenCustomBaseImageDialog}
          >
            Create custom container image
          </Button>
        )}
        {customImage && (
          <Grid item sm={12}>
            <ImageOption
              value={customImage.base_image}
              sx={{ padding: (theme) => theme.spacing(2, 0) }}
              supportGpu={customImage.gpu_support}
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
                    {LANGUAGE_MAP[customImage.language]}
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
