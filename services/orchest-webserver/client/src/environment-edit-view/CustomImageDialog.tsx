import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { CustomImage, Environment, Language } from "@/types";
import CheckIcon from "@mui/icons-material/Check";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
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
import { useFormik } from "formik";
import React from "react";
import {
  DEFAULT_BASE_IMAGES,
  GPU_SUPPORT_ENABLED,
  LANGUAGE_MAP,
} from "./common";

export const CustomImageDialog = ({
  isOpen,
  onClose,
  saveEnvironment,
  initialValue,
  setCustomImage,
}: {
  initialValue: CustomImage | undefined;
  isOpen: boolean;
  onClose: () => void;
  saveEnvironment: ({
    base_image,
    language,
    gpu_support,
  }: {
    base_image: string;
    language: Language;
    gpu_support: boolean;
  }) => Promise<Environment | null>;
  setCustomImage: (value: CustomImage) => void;
}) => {
  const { config } = useAppContext();
  const {
    handleSubmit,
    handleChange,
    handleBlur,
    values,
    errors,
    isSubmitting,
    touched,
    isValid,
  } = useFormik({
    initialValues: initialValue || {
      base_image: "",
      language: "" as Language,
      gpu_support: false,
    },
    isInitialValid: false,
    validate: ({ base_image, language }) => {
      const errors: Record<string, string> = {};
      if (!base_image) errors.base_image = "Image path cannot be empty";
      // prevent user enter the same path as the default images
      // otherwise, the custom tile would be gone after refreshing the page (because default image paths are not considered as a custom one)
      if (
        DEFAULT_BASE_IMAGES.some(
          (image) => image.base_image === base_image.toLowerCase().trim()
        )
      )
        errors.base_image =
          "Given path is part of the default images. No need to specify a custom one.";
      if (!language) errors.language = "Please select a language";
      return errors;
    },
    onSubmit: async (
      { base_image, language, gpu_support },
      { setSubmitting }
    ) => {
      setSubmitting(true);
      const success = await saveEnvironment({
        base_image,
        language,
        gpu_support,
      });
      if (success) {
        setCustomImage({ base_image, language, gpu_support });
        onClose();
      }
      setSubmitting(false);
    },
    enableReinitialize: true,
  });

  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="xs">
      <form id="add-custom-base-image-form" onSubmit={handleSubmit}>
        <DialogTitle>Add custom base image</DialogTitle>
        <DialogContent>
          <Stack spacing={3} direction="column">
            <Stack direction="row">
              <Typography>
                Use the path for the external image (default registry: Docker
                Hub). For example,
                <Code sx={{ marginTop: (theme) => theme.spacing(1) }}>
                  python:latest
                </Code>
              </Typography>
            </Stack>
            <TextField
              label="Image path"
              autoFocus
              required
              name="base_image"
              error={touched.base_image && hasValue(errors.base_image)}
              helperText={(touched.base_image && errors.base_image) || " "}
              value={values.base_image}
              onChange={handleChange}
              onBlur={handleBlur}
            />
            <FormControl fullWidth>
              <InputLabel id="select-language-label">Language</InputLabel>
              <Select
                labelId="select-language-label"
                id="select-language"
                value={values.language}
                label="Language"
                required
                error={touched.language && hasValue(errors.language)}
                name="language"
                onChange={handleChange}
                onBlur={handleBlur}
              >
                {Object.entries(LANGUAGE_MAP).map(([value, label]) => {
                  return (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  );
                })}
              </Select>
              <FormHelperText>
                {touched.language && errors.language}
              </FormHelperText>
            </FormControl>
            <Alert severity="info" tabIndex={-1}>
              The language determines for which kernel language this environment
              can be used. This only affects pipeline steps that point to a
              Notebook.
            </Alert>
            {GPU_SUPPORT_ENABLED && (
              <Stack direction="column">
                <FormGroup>
                  <FormControlLabel
                    label="GPU support"
                    data-test-id="pipeline-settings-configuration-memory-eviction"
                    name="gpu_support"
                    control={
                      <Checkbox
                        checked={values.gpu_support}
                        onChange={handleChange}
                      />
                    }
                  />
                </FormGroup>
                {values.gpu_support && (
                  <Alert severity="info" tabIndex={-1}>
                    {config?.GPU_ENABLED_INSTANCE && (
                      <>
                        If enabled, the environment will request GPU
                        capabilities when in use.
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
        </DialogContent>
        <DialogActions>
          <Button color="secondary" onClick={onClose} tabIndex={-1}>
            Cancel
          </Button>
          <Button
            startIcon={<CheckIcon />}
            type="submit"
            variant="contained"
            disabled={!isValid || isSubmitting}
            form="add-custom-base-image-form"
          >
            Confirm
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
