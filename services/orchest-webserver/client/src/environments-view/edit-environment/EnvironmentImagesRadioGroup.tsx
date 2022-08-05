import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import RadioGroup from "@mui/material/RadioGroup";
import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import React from "react";
import {
  DEFAULT_BASE_IMAGES,
  GPU_SUPPORT_ENABLED,
} from "../../environment-edit-view/common";
import { isEnvironmentBuilding } from "../common";
import { useEnvironmentOnEdit } from "../stores/useEnvironmentOnEdit";
import { BaseImageHeader } from "./BaseImageHeader";
import { BaseImageRadioOption } from "./BaseImageRadioOption";
import { CustomImageDetails } from "./CustomImageDetails";
import { useSelectBaseImage } from "./hooks/useSelectBaseImage";

const Image = styled("img")(({ theme }) => ({ maxHeight: theme.spacing(3) }));

export const EnvironmentImagesRadioGroup = () => {
  const { selectedImage, customImage, selectBaseImage } = useSelectBaseImage();

  const { environmentOnEdit } = useEnvironmentOnEdit();
  const disabled = isEnvironmentBuilding(environmentOnEdit?.latestBuild);

  return (
    <>
      <FormControl margin="normal" fullWidth>
        <FormLabel
          id="base-image"
          sx={{ marginBottom: (theme) => theme.spacing(1) }}
        >
          <BaseImageHeader />
        </FormLabel>
        <RadioGroup
          aria-labelledby="base-image"
          value={selectedImage.base_image}
          onChange={(e, value) => {
            selectBaseImage(value);
          }}
          sx={{ display: "flex", flexFlow: "row wrap" }}
        >
          {DEFAULT_BASE_IMAGES.map(({ base_image, img_src, label }) => {
            const isUnavailable =
              !GPU_SUPPORT_ENABLED &&
              base_image === "orchest/base-kernel-py-gpu";
            return (
              <BaseImageRadioOption
                key={base_image}
                title={isUnavailable ? "Temporarily unavailable" : base_image}
                value={base_image}
                disabled={isUnavailable || disabled}
              >
                <Image
                  src={`${img_src}`}
                  alt={isUnavailable ? "Temporarily unavailable" : base_image}
                  loading="lazy"
                  sx={isUnavailable ? { filter: "grayscale(100%)" } : undefined}
                />
                <Typography variant="body2">{label}</Typography>
              </BaseImageRadioOption>
            );
          })}
          <BaseImageRadioOption
            key="custom-image"
            value={customImage.base_image}
            disabled={disabled}
          >
            <AddCircleOutlineOutlinedIcon color="primary" />
            <Typography variant="body2">Custom</Typography>
          </BaseImageRadioOption>
        </RadioGroup>
      </FormControl>
      <CustomImageDetails />
    </>
  );
};
