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
import React from "react";
import { useForm } from "react-hook-form";
import {
  DEFAULT_BASE_IMAGES,
  GPU_SUPPORT_ENABLED,
  LANGUAGE_MAP,
} from "./common";

type CustomImageDialogProps = {
  initialValue: CustomImage | undefined;
  isOpen: boolean;
  onClose: () => void;
  saveEnvironment: (data: CustomImage) => Promise<Environment | null>;
  setCustomImage: (value: CustomImage) => void;
};

const DEFAULT_FORM_STATE: CustomImage = {
  base_image: "",
  language: Object.keys(LANGUAGE_MAP)[0] as Language,
  gpu_support: false,
};

const isDefaultImage = (baseImage: string) => {
  baseImage = baseImage.toLowerCase().trim();

  return DEFAULT_BASE_IMAGES.some((image) => baseImage === image.base_image);
};

export const CustomImageDialog = ({
  isOpen,
  onClose,
  saveEnvironment,
  initialValue,
  setCustomImage,
}: CustomImageDialogProps) => {
  const { config } = useAppContext();
  const { register, handleSubmit, watch, setValue, formState } = useForm({
    defaultValues: DEFAULT_FORM_STATE,
    mode: "onChange",
  });

  const [language, gpuSupport] = watch(["language", "gpu_support"]);

  const onSubmit = async (data: CustomImage) => {
    const image = await saveEnvironment(data);

    if (image) {
      setCustomImage(image);
      onClose();
    }
  };

  React.useEffect(() => {
    if (isOpen && initialValue) {
      for (const [name, value] of Object.entries(initialValue)) {
        setValue(name as keyof CustomImage, value);
      }
    }
  }, [isOpen, initialValue, setValue]);

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="xs">
      <form id="add-custom-base-image-form" onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>Add custom base image</DialogTitle>
        <DialogContent>
          <Stack spacing={3} direction="column">
            <Stack direction="row">
              <Typography>
                Use the path for the external image (default registry: Docker
                Hub). For example,{" "}
                <Code sx={{ marginTop: (theme) => theme.spacing(1) }}>
                  python:latest
                </Code>
              </Typography>
            </Stack>
            <TextField
              {...register("base_image", {
                validate: (value) =>
                  isDefaultImage(value)
                    ? "This is a default image."
                    : undefined,
              })}
              label="Image path"
              required
              autoFocus
              error={Boolean(formState.errors.base_image)}
              helperText={formState.errors.base_image?.message}
            />
            <FormControl fullWidth>
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
              <FormHelperText>
                {formState.errors.language?.message}
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
          <Button onClick={onClose} tabIndex={-1}>
            Cancel
          </Button>
          <Button
            startIcon={<CheckIcon />}
            type="submit"
            variant="contained"
            disabled={!formState.isValid || formState.isSubmitting}
            form="add-custom-base-image-form"
          >
            Confirm
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
