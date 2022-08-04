import { useAppContext } from "@/contexts/AppContext";
import { isEnvironmentBuilding } from "@/environments-view/common";
import { useEnvironmentOnEdit } from "@/environments-view/stores/useEnvironmentOnEdit";
import { Environment } from "@/types";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import Link from "@mui/material/Link";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import {
  DEFAULT_BASE_IMAGES,
  GPU_SUPPORT_ENABLED,
} from "../../environment-edit-view/common";
import { useCustomImage } from "./hooks/useCustomImage";

type ImageOptionProps = {
  disabled: boolean;
  value: string;
  children: React.ReactElement;
  title?: string;
};
const ImageOption = ({
  title,
  value,
  children,
  disabled,
}: ImageOptionProps) => {
  const content = (
    <FormControlLabel
      value={value}
      disabled={disabled}
      label={children}
      control={<Radio />}
      sx={{ marginLeft: (theme) => theme.spacing(1) }}
    />
  );

  return title ? <Tooltip title={title}>{content}</Tooltip> : content;
};

const Image = styled("img")(({ theme }) => ({ maxHeight: theme.spacing(3) }));

/**
 * Check if the base image is part of the default images.
 * Note: when saving the environment, BE will attach the current Orchest version to the image name.
 * A default base image with a different version is considered as a custom image.
 */
const getDefaultImageFromEnvironment = (
  environmentBaseImage: Environment["base_image"] | undefined,
  orchestVersion: string | null | undefined
) => {
  if (!environmentBaseImage) return undefined;
  return DEFAULT_BASE_IMAGES.find(({ base_image }) => {
    const versionedImage = `${base_image}:${orchestVersion}`;
    return [versionedImage, base_image].includes(environmentBaseImage);
  });
};

const BaseImageHeader = () => {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography component="h3" variant="body1">
        Base image
      </Typography>
      <Tooltip
        title={
          <Typography variant="caption" component="span">
            The base image can be extended using the environment set-up script (
            <Link
              target="_blank"
              rel="noopener noreferrer"
              href="https://docs.orchest.io/en/latest/fundamentals/environments.html"
            >
              learn more
            </Link>
            ).
          </Typography>
        }
        placement="right"
        arrow
      >
        <InfoOutlinedIcon
          fontSize="small"
          color="primary"
          style={{ width: "24px", height: "24px" }}
        />
      </Tooltip>
    </Stack>
  );
};

export const EnvironmentImagesRadioGroup = () => {
  const { orchestVersion } = useAppContext();
  const { environmentOnEdit, setEnvironmentOnEdit } = useEnvironmentOnEdit();
  const disabled = isEnvironmentBuilding(environmentOnEdit?.latestBuild);

  const selectedDefaultImage = React.useMemo(() => {
    return getDefaultImageFromEnvironment(
      environmentOnEdit?.base_image,
      orchestVersion
    );
  }, [environmentOnEdit?.base_image, orchestVersion]);

  const [customImage, setCustomImage] = useCustomImage(
    hasValue(orchestVersion),
    hasValue(selectedDefaultImage),
    environmentOnEdit
  );

  const onChangeSelection = (baseImage: string) => {
    if (disabled) return;
    if (customImage && baseImage === customImage.base_image) {
      setEnvironmentOnEdit(customImage);
      return;
    }
    const foundDefaultImage = DEFAULT_BASE_IMAGES.find((image) =>
      [image.base_image, `${image.base_image}:${orchestVersion}`].includes(
        baseImage
      )
    );
    if (foundDefaultImage) {
      // Always return a un-versioned image, and let BE fill the version.
      setEnvironmentOnEdit({ base_image: foundDefaultImage.base_image });
    }
  };

  const selectedImage =
    selectedDefaultImage?.base_image || customImage || DEFAULT_BASE_IMAGES[0];

  return (
    <FormControl margin="normal" fullWidth>
      <FormLabel
        id="base-image"
        sx={{ marginBottom: (theme) => theme.spacing(1) }}
      >
        <BaseImageHeader />
      </FormLabel>
      <RadioGroup
        aria-labelledby="base-image"
        value={selectedImage}
        onChange={(e, value) => {
          console.log("DEV value: ", value);
          onChangeSelection(value);
        }}
        sx={{ marginLeft: (theme) => theme.spacing(-2) }}
        row
      >
        {DEFAULT_BASE_IMAGES.map(({ base_image, img_src, label }) => {
          const isUnavailable =
            !GPU_SUPPORT_ENABLED && base_image === "orchest/base-kernel-py-gpu";
          return (
            <ImageOption
              key={base_image}
              title={isUnavailable ? "Temporarily unavailable" : base_image}
              value={base_image}
              disabled={isUnavailable || disabled}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="flex-start"
              >
                <Image
                  src={`${img_src}`}
                  alt={isUnavailable ? "Temporarily unavailable" : base_image}
                  loading="lazy"
                  sx={isUnavailable ? { filter: "grayscale(100%)" } : undefined}
                />
                <Typography variant="body1">{label}</Typography>
              </Stack>
            </ImageOption>
          );
        })}
        <ImageOption
          key="custom-image"
          value={customImage?.base_image || ""}
          disabled={disabled}
        >
          <>{`Custom`}</>
        </ImageOption>
      </RadioGroup>
    </FormControl>
  );
};
