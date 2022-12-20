import { useOrchestConfigsApi } from "@/api/system-config/useOrchestConfigsApi";
import { CustomImage, Language } from "@/types";
import Alert from "@mui/material/Alert";
import Checkbox from "@mui/material/Checkbox";
import Collapse from "@mui/material/Collapse";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useForm } from "react-hook-form";
import {
  DEFAULT_BASE_IMAGES,
  GPU_SUPPORT_ENABLED,
  LANGUAGE_MAP,
} from "../common";
import { useSelectBaseImage } from "./hooks/useSelectBaseImage";

const DEFAULT_FORM_STATE: CustomImage = {
  base_image: "",
  language: Object.keys(LANGUAGE_MAP)[0] as Language,
  gpu_support: false,
};

const isDefaultImage = (baseImage: string) => {
  baseImage = baseImage.toLowerCase().trim();

  return DEFAULT_BASE_IMAGES.some((image) => baseImage === image.base_image);
};

export const CustomImageDetails = () => {
  const config = useOrchestConfigsApi((state) => state.config);
  const {
    selectedImage,
    customImage,
    editCustomImage,
    environmentUuid,
  } = useSelectBaseImage();

  const isOpen = selectedImage.base_image === customImage.base_image;

  const { register, watch, setValue, formState, getValues } = useForm({
    defaultValues: DEFAULT_FORM_STATE,
    mode: "onChange",
  });

  const [language, gpuSupport, baseImage] = watch([
    "language",
    "gpu_support",
    "base_image",
  ]);

  React.useEffect(() => {
    if (isOpen && formState.isDirty && formState.isValid) {
      editCustomImage(getValues());
    }
  }, [
    baseImage,
    gpuSupport,
    language,
    isOpen,
    formState.isDirty,
    formState.isValid,
    getValues,
    editCustomImage,
  ]);

  const hasInitializedEnvironmentUuid = React.useRef<string>();
  const shouldReinitializeValue =
    isOpen &&
    hasValue(environmentUuid) &&
    hasInitializedEnvironmentUuid.current !== environmentUuid;

  React.useEffect(() => {
    if (shouldReinitializeValue) {
      hasInitializedEnvironmentUuid.current = environmentUuid;
      for (const [name, value] of Object.entries(customImage)) {
        setValue(name as keyof CustomImage, value);
      }
    }
  }, [shouldReinitializeValue, customImage, setValue, environmentUuid]);

  return (
    <Collapse in={isOpen}>
      <form id="add-custom-base-image-form">
        <Stack direction="column">
          <Stack spacing={3} direction="row">
            <Stack direction="column" flex={1}>
              <TextField
                {...register("base_image", {
                  validate: (value) =>
                    isDefaultImage(value)
                      ? "This is a default image."
                      : undefined,
                })}
                label="Image path"
                InputLabelProps={{ shrink: true }}
                required
                autoFocus
                error={Boolean(formState.errors.base_image)}
                placeholder="python:latest"
                helperText={formState.errors.base_image?.message}
              />
              <Typography
                variant="body2"
                padding={1.75}
                sx={{ color: (theme) => theme.palette.text.secondary }}
              >
                Use the path for the external image (default registry: Docker
                Hub).
              </Typography>
            </Stack>
            <Stack direction="column" flex={1}>
              <FormControl>
                <InputLabel id="select-language-label">Language</InputLabel>
                <Select
                  {...register("language")}
                  labelId="select-language-label"
                  id="select-language"
                  label="Language"
                  value={language}
                  required
                  error={Boolean(formState.errors.language)}
                >
                  {Object.entries(LANGUAGE_MAP).map(([value, label]) => {
                    return (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    );
                  })}
                </Select>
                {formState.errors.language?.message && (
                  <FormHelperText>
                    {formState.errors.language?.message}
                  </FormHelperText>
                )}
              </FormControl>
              <Typography
                variant="body2"
                padding={1.75}
                sx={{ color: (theme) => theme.palette.text.secondary }}
              >
                Determines for which kernel language this environment can be
                used. This only affects pipeline steps that point to a Notebook.
              </Typography>
            </Stack>
          </Stack>
          {GPU_SUPPORT_ENABLED && (
            <Stack direction="column">
              <FormGroup>
                <FormControlLabel
                  label="GPU support"
                  data-test-id="pipeline-settings-configuration-memory-eviction"
                  control={
                    <Checkbox
                      {...register("gpu_support")}
                      checked={gpuSupport}
                    />
                  }
                />
              </FormGroup>
              {gpuSupport && (
                <Alert severity="info" tabIndex={-1}>
                  {config?.GPU_ENABLED_INSTANCE && (
                    <>
                      If enabled, the environment will request GPU capabilities
                      when in use.
                    </>
                  )}
                  {!config?.GPU_ENABLED_INSTANCE &&
                    (config?.CLOUD ? (
                      <>
                        This instance is not configured with a GPU. Change the
                        instance type to a GPU enabled one if you need GPU
                        pass-through. Steps using this environment will work
                        regardless, but no GPU pass-through will take place.
                      </>
                    ) : (
                      <>
                        {`Could not detect a GPU. Check out `}
                        <Link
                          target="_blank"
                          href={`${config?.ORCHEST_WEB_URLS.readthedocs}/getting_started/installation.html#gpu-support`}
                          rel="noopener noreferrer"
                          tabIndex={-1}
                        >
                          the documentation
                        </Link>
                        {` to make sure Orchest is properly configured for
                        environments with GPU support. In particular, make sure
                        the selected base image supports GPU pass through. Steps
                        using this environment will work regardless, but no GPU
                        pass-through will take place.`}
                      </>
                    ))}
                </Alert>
              )}
            </Stack>
          )}
        </Stack>
      </form>
    </Collapse>
  );
};
