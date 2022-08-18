import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import RadioGroup from "@mui/material/RadioGroup";
import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import React from "react";
import { DEFAULT_BASE_IMAGES } from "../common";
import { BaseImageHeader } from "./BaseImageHeader";
import { BaseImageRadioOption } from "./BaseImageRadioOption";
import { CustomImageDetails } from "./CustomImageDetails";
import { useSelectBaseImage } from "./hooks/useSelectBaseImage";

const Image = styled("img")(({ theme }) => ({ maxHeight: theme.spacing(3) }));

const BaseImageRadioGroup = ({ children }: { children: React.ReactNode }) => {
  const { selectedImage, selectBaseImage } = useSelectBaseImage();
  return (
    <RadioGroup
      aria-labelledby="base-image"
      value={selectedImage.base_image}
      onChange={(e, value) => {
        selectBaseImage(value);
      }}
      sx={{
        display: "flex",
        flexFlow: "row wrap",
        paddingLeft: (theme) => theme.spacing(0.5),
      }}
    >
      {children}
    </RadioGroup>
  );
};

const CustomImageRadioOption = () => {
  const { customImage } = useSelectBaseImage();

  return (
    <BaseImageRadioOption key="custom-image" value={customImage.base_image}>
      <AddCircleOutlineOutlinedIcon color="primary" />
      <Typography variant="body2">Custom</Typography>
    </BaseImageRadioOption>
  );
};

export const EnvironmentImagesRadioGroup = () => {
  return (
    <>
      <FormControl margin="normal" fullWidth>
        <FormLabel
          id="base-image"
          sx={{ marginBottom: (theme) => theme.spacing(1) }}
        >
          <BaseImageHeader />
        </FormLabel>
        <BaseImageRadioGroup>
          {DEFAULT_BASE_IMAGES.map(
            ({ base_image, img_src, label, unavailable }) => {
              const title = unavailable
                ? "Temporarily unavailable"
                : base_image;
              return (
                <BaseImageRadioOption
                  key={base_image}
                  title={title}
                  value={base_image}
                  disabled={unavailable}
                >
                  <Image
                    src={`${img_src}`}
                    alt={title}
                    loading="lazy"
                    sx={unavailable ? { filter: "grayscale(100%)" } : undefined}
                  />
                  <Typography variant="body2">{label}</Typography>
                </BaseImageRadioOption>
              );
            }
          )}
          <CustomImageRadioOption />
        </BaseImageRadioGroup>
      </FormControl>
      <CustomImageDetails />
    </>
  );
};
