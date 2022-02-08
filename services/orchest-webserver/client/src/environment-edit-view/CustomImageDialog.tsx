import CheckIcon from "@mui/icons-material/Check";
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
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { hasValue, LANGUAGE_MAP } from "@orchest/lib-utils";
import { useFormik } from "formik";
import React from "react";

export const CustomImageDialog = ({
  isOpen,
  onClose,
  saveEnvironment,
}: {
  isOpen: boolean;
  onClose: () => void;
  saveEnvironment: ({
    imageName,
    language,
    gpuSupport,
  }: {
    imageName: string;
    language: string;
    gpuSupport: boolean;
  }) => Promise<void>;
}) => {
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
    initialValues: {
      imageName: "",
      language: "",
      gpuSupport: false,
    },
    isInitialValid: false,
    validate: ({ imageName, language }) => {
      const errors: Record<string, string> = {};
      if (!imageName) errors.imageName = "Container image name cannot be empty";
      if (!language) errors.language = "Please select a language";
      return errors;
    },
    onSubmit: async (
      { imageName, language, gpuSupport },
      { setSubmitting }
    ) => {
      setSubmitting(true);
      await saveEnvironment({ imageName, language, gpuSupport });
      setSubmitting(false);
    },
    enableReinitialize: true,
  });

  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="xs">
      <form id="add-custom-base-image-form" onSubmit={handleSubmit}>
        <DialogTitle>Add custom base image</DialogTitle>
        <DialogContent>
          <Stack
            spacing={3}
            direction="column"
            sx={{ paddingTop: (theme) => theme.spacing(3) }}
          >
            <TextField
              label="Container image name from a registry"
              autoFocus
              required
              name="imageName"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">docker pull</InputAdornment>
                ),
              }}
              error={touched.imageName && hasValue(errors.imageName)}
              helperText={touched.imageName && errors.imageName}
              value={values.imageName}
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
            <FormGroup>
              <FormControlLabel
                label="GPU support"
                data-test-id="pipeline-settings-configuration-memory-eviction"
                name="gpuSupport"
                control={
                  <Checkbox
                    checked={values.gpuSupport}
                    onChange={handleChange}
                  />
                }
              />
            </FormGroup>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            startIcon={<CheckIcon />}
            type="submit"
            variant="contained"
            disabled={!isValid || isSubmitting}
            form="add-custom-base-image-form"
          >
            Add
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
