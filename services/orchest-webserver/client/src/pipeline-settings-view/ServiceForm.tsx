import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { EnvVarList, EnvVarPair } from "@/components/EnvVarList";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { Service } from "@/types";
import CheckIcon from "@mui/icons-material/Check";
import InfoIcon from "@mui/icons-material/Info";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { visuallyHidden } from "@mui/utils";
import { hasValue } from "@orchest/lib-utils";
import cloneDeep from "lodash.clonedeep";
import React from "react";
import {
  MultiSelect,
  MultiSelectError,
  MultiSelectInput,
  MultiSelectLabel,
} from "../components/MultiSelect";
import { getServiceURLs } from "../utils/webserver-utils";

const FormSectionTitle: React.FC<{ title: string }> = ({ children, title }) => (
  <Typography
    component="h3"
    variant="h6"
    display="flex"
    alignItems="center"
    sx={{
      margin: (theme) => theme.spacing(3, 0),
    }}
  >
    {children}
    <Tooltip title={title}>
      <InfoIcon
        fontSize="small"
        sx={{ marginLeft: (theme) => theme.spacing(1) }}
      />
    </Tooltip>
  </Typography>
);

const ServiceForm: React.FC<{
  service: Service;
  services: Record<string, Service>;
  updateService: (service: Service) => void;
  disabled: boolean;
}> = ({ service, services, updateService, disabled }) => {
  const { projectUuid, pipelineUuid, runUuid } = useCustomRoute();
  const environmentPrefix = "environment@";

  const environmentOptions = useEnvironmentsApi(
    (state) => state.environments || []
  );

  let [showImageDialog, setShowImageDialog] = React.useState(false);
  let [editImageName, setEditImageName] = React.useState(
    service.image.startsWith(environmentPrefix) ? "" : service.image
  );
  let [editImageEnvironmentUUID, setEditImageEnvironmentUUID] = React.useState(
    service.image.startsWith(environmentPrefix)
      ? service.image.replace(environmentPrefix, "")
      : ""
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleServiceChange = (key: string, value: any) => {
    let serviceClone = cloneDeep(service);
    serviceClone[key] = value;
    updateService(serviceClone);
  };

  const [serviceName, setServiceName] = React.useState(service.name);
  const [serviceNameError, setServiceNameError] = React.useState<string | null>(
    null
  );
  const hasServiceNameError = hasValue(serviceNameError);

  const allServiceNames = React.useMemo(() => {
    return Object.values(services).map((s) => s.name);
  }, [services]);
  const handleNameChange = (newName: string) => {
    setServiceName(newName);

    if (newName !== service.name && allServiceNames.includes(newName)) {
      setServiceNameError("Same service name has been taken");
      return;
    }
    setServiceNameError(null);
    updateService({ ...service, name: newName });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleServiceBindsChange = (key: string, value: any) => {
    let serviceClone = cloneDeep(service);
    serviceClone.binds =
      serviceClone.binds !== undefined ? serviceClone.binds : {};
    serviceClone.binds[key] = value;

    // Clear empty value bind entries
    if (value.trim().length == 0) {
      delete serviceClone.binds[key];
    }

    updateService(serviceClone);
  };

  const handleScopeCheckbox = (isChecked, checkboxScope) => {
    let _scope = cloneDeep(service.scope);
    if (!isChecked) {
      _scope = _scope.filter((el) => el !== checkboxScope);
    } else if (_scope.indexOf(checkboxScope) == -1) {
      _scope.push(checkboxScope);
    }
    handleServiceChange("scope", _scope);
  };

  const envVarsDictToList = (envVariables) => {
    return Object.keys(envVariables).map((key) => ({
      name: key,
      value: envVariables[key],
    }));
  };

  const onCloseEditImageName = () => {
    setShowImageDialog(false);
  };

  const resolveEnvironmentName = (environmentImageName: string) => {
    let environmentUUID = environmentImageName.replace(environmentPrefix, "");
    let environments = environmentOptions.filter(
      (el) => el.uuid === environmentUUID
    );

    if (environments.length > 0) {
      return "Environment: " + environments[0].name;
    } else {
      return environmentImageName;
    }
  };

  return !projectUuid || !pipelineUuid ? null : (
    <>
      <Paper
        sx={{
          paddingTop: (theme) => theme.spacing(1),
          borderTop: (theme) => `1px solid ${theme.palette.grey[100]}`,
          marginBottom: (theme) => theme.spacing(2),
        }}
      >
        {!environmentOptions ? (
          <LinearProgress />
        ) : (
          <Box sx={{ padding: (theme) => theme.spacing(3) }}>
            <Box component="fieldset" sx={{ border: 0 }}>
              <Box component="legend" sx={visuallyHidden}>
                {["Configure", `"${service.name}"`, "service"]
                  .filter(Boolean)
                  .join(" ")}
              </Box>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Name"
                  type="text"
                  disabled={disabled}
                  error={hasServiceNameError}
                  value={serviceName}
                  onChange={(e) => {
                    handleNameChange(e.target.value);
                  }}
                  fullWidth
                  helperText={
                    serviceNameError ||
                    "The name of the service. Up to 26 digits, lowercase letters or dashes are allowed."
                  }
                  aria-describedby="tooltip-name"
                  data-test-id={`service-${service.name}-name`}
                />
                <TextField
                  label="Image"
                  type="text"
                  disabled={disabled || hasServiceNameError}
                  onClick={() => {
                    // TODO:  improve this
                    setShowImageDialog(true);
                  }}
                  onChange={() => {
                    // Override direct edits
                    handleServiceChange("image", service.image);
                  }}
                  value={
                    service.image.startsWith(environmentPrefix)
                      ? resolveEnvironmentName(service.image)
                      : service.image
                  }
                  fullWidth
                  data-test-id={`service-${service.name}-image`}
                />
              </Stack>
              <FormSectionTitle title="Change the service start up behavior by specifying the command and args options.">
                Start behavior
              </FormSectionTitle>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Command (optional)"
                  type="text"
                  disabled={disabled || hasServiceNameError}
                  value={service.command}
                  onChange={(e) => {
                    handleServiceChange("command", e.target.value);
                  }}
                  fullWidth
                  aria-describedby="tooltip-command"
                  helperText="This is the same `command` as the command for a k8s Pod. E.g. `bash`."
                  data-test-id={`service-${service.name}-command`}
                />

                <TextField
                  label="Args (optional)"
                  type="text"
                  disabled={disabled || hasServiceNameError}
                  value={service.args}
                  onChange={(e) => {
                    handleServiceChange("args", e.target.value);
                  }}
                  fullWidth
                  helperText="This is the same `args` as the args for a k8s Pod. E.g. `-c 'echo hello'`. They are appended to the command."
                  aria-describedby="tooltip-args"
                  data-test-id={`service-${service.name}-args`}
                />
              </Stack>
              <FormSectionTitle title="Mounts give you access to the project files or /data files from within the service. Entered paths should be absolute paths in the container image.">
                Mounts
              </FormSectionTitle>

              <Stack direction="row" spacing={2}>
                <TextField
                  label="Project directory (optional)"
                  type="text"
                  disabled={disabled || hasServiceNameError}
                  value={service.binds?.["/project-dir"]}
                  onChange={(e) => {
                    handleServiceBindsChange("/project-dir", e.target.value);
                  }}
                  fullWidth
                  data-test-id={`service-${service.name}-project-mount`}
                />
                <TextField
                  label="Data directory (optional)"
                  type="text"
                  disabled={disabled || hasServiceNameError}
                  value={service?.binds?.["/data"]}
                  onChange={(e) => {
                    handleServiceBindsChange("/data", e.target.value);
                  }}
                  fullWidth
                  data-test-id={`service-${service.name}-data-mount`}
                />
              </Stack>

              <Stack direction="row" spacing={2}>
                <Stack direction="column" flex={1}>
                  <FormSectionTitle title="Enter ports like 80, 8080 to make the service available through a URL.">
                    Ports
                  </FormSectionTitle>
                  <MultiSelect
                    type="number"
                    items={
                      service.ports
                        ? service.ports.map((port) => ({
                            value: port.toString(),
                          }))
                        : []
                    }
                    disabled={disabled || hasServiceNameError}
                    onChange={(ports) => {
                      handleServiceChange(
                        "ports",
                        ports
                          .map(({ value }) => parseInt(value))
                          .filter((el) => !isNaN(el))
                      );
                    }}
                  >
                    <MultiSelectLabel screenReaderOnly>Ports</MultiSelectLabel>
                    <MultiSelectInput />
                    <MultiSelectError />
                  </MultiSelect>
                </Stack>
                <Stack direction="column" flex={1}>
                  <FormSectionTitle title="The URLs that will be directly available to communicate with the service. These are all proxied by Orchest.">
                    URLs
                  </FormSectionTitle>
                  <Stack direction="column" spacing={2}>
                    {service.ports &&
                      getServiceURLs(
                        service,
                        projectUuid,
                        pipelineUuid,
                        runUuid
                      ).map((url) => (
                        <Link
                          key={url}
                          href={url}
                          margin="normal"
                          sx={{ width: "100%" }}
                        >
                          {url}
                        </Link>
                      ))}
                  </Stack>
                </Stack>
              </Stack>

              <Stack direction="row" spacing={2}>
                <Stack direction="column" flex={1}>
                  <FormSectionTitle title="When you preserve the base path the first component of the path https://<hostname>/1/2/... will be passed to the service when the request is proxied by Orchest.">
                    Preserve base path
                  </FormSectionTitle>
                  <FormGroup>
                    <FormControlLabel
                      label="Preserve base path"
                      control={
                        <Checkbox
                          checked={service?.preserve_base_path === true}
                          disabled={disabled || hasServiceNameError}
                          onChange={(e) => {
                            handleServiceChange(
                              "preserve_base_path",
                              e.target.checked
                            );
                          }}
                        />
                      }
                    />
                  </FormGroup>
                </Stack>
                <Stack direction="column" flex={1}>
                  <FormSectionTitle
                    title="
                  An exposed service is reachable from outside the cluster at its
                  defined ports. This is useful, for example, for services like
                  code-server or tensorboad, or to expose an API endpoint. If
                  authentication is required you will need to be logged in to access the
                  service, for that, make sure that auth is enabled in the settings.
                  "
                  >
                    Exposed service endpoints
                  </FormSectionTitle>
                  <FormGroup>
                    <FormControlLabel
                      label="Exposed"
                      disabled={disabled || hasServiceNameError}
                      control={
                        <Checkbox
                          checked={service.exposed}
                          onChange={(e) => {
                            handleServiceChange("exposed", e.target.checked);
                          }}
                        />
                      }
                    />
                    <FormControlLabel
                      label="Authentication required"
                      disabled={disabled || hasServiceNameError}
                      control={
                        <Checkbox
                          checked={service.requires_authentication}
                          onChange={(e) => {
                            handleServiceChange(
                              "requires_authentication",
                              e.target.checked
                            );
                          }}
                        />
                      }
                    />
                  </FormGroup>
                </Stack>
              </Stack>
              <Stack direction="row" spacing={2}>
                <Stack direction="column" flex={1}>
                  <FormSectionTitle title="Scope defines whether a service will run during interactive sessions, in job sessions, or both.">
                    Scope
                  </FormSectionTitle>
                  <FormGroup>
                    <FormControlLabel
                      label="Interactive sessions"
                      disabled={disabled || hasServiceNameError}
                      control={
                        <Checkbox
                          checked={service.scope.indexOf("interactive") >= 0}
                          onChange={(e) => {
                            handleScopeCheckbox(
                              e.target.checked,
                              "interactive"
                            );
                          }}
                        />
                      }
                    />
                    <FormControlLabel
                      label="Job sessions"
                      disabled={disabled || hasServiceNameError}
                      control={
                        <Checkbox
                          checked={service.scope.indexOf("noninteractive") >= 0}
                          onChange={(e) => {
                            handleScopeCheckbox(
                              e.target.checked,
                              "noninteractive"
                            );
                          }}
                        />
                      }
                    />
                  </FormGroup>
                </Stack>
                <Stack
                  direction="column"
                  flex={1}
                  data-test-id={`service-${service.name}-inherited-env-vars`}
                >
                  <FormSectionTitle title="Services don't get access to project, pipeline and job level environment variables by default. Enter the names of environment variables you want to have access to within the service. Note, inherited environment variables override any service defined environment variables, but only if they are defined at the project, pipeline or job level.">
                    Inherited environment variables
                  </FormSectionTitle>
                  <MultiSelect
                    items={(service?.env_variables_inherit || []).map(
                      (env_variable) =>
                        env_variable && {
                          value: env_variable.toString(),
                        }
                    )}
                    disabled={disabled || hasServiceNameError}
                    onChange={(env_variables) => {
                      handleServiceChange(
                        "env_variables_inherit",
                        env_variables.map(({ value }) => value)
                      );
                    }}
                  >
                    <MultiSelectLabel screenReaderOnly>
                      Environment variables
                    </MultiSelectLabel>
                    <MultiSelectInput />
                    <MultiSelectError />
                  </MultiSelect>
                </Stack>
              </Stack>

              <Stack direction="column" flex={1}>
                <FormSectionTitle title="Environment variables specific to the service. Note! These are versioned, so don't use it for secrets.">
                  Environment variables
                </FormSectionTitle>
                <EnvVarList
                  variables={envVarsDictToList(service.env_variables || {})}
                  readOnly={disabled}
                  setValue={(
                    dispatcher: (
                      currentValue: EnvVarPair[] | undefined
                    ) => EnvVarPair[] | undefined
                  ) => {
                    const updated =
                      dispatcher(
                        envVarsDictToList(service.env_variables || {})
                      ) || [];
                    handleServiceChange(
                      "env_variables",
                      updated.reduce((obj, current) => {
                        return { ...obj, [current.name]: current.value };
                      }, {})
                    );
                  }}
                  data-test-id={`service-${service.name}`}
                />
              </Stack>
            </Box>
          </Box>
        )}
      </Paper>
      <Dialog open={showImageDialog} onClose={onCloseEditImageName}>
        <form
          id="edit-service-image"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();

            if (editImageEnvironmentUUID == "") {
              handleServiceChange("image", editImageName);
            } else {
              handleServiceChange(
                "image",
                environmentPrefix + editImageEnvironmentUUID
              );
            }
            onCloseEditImageName();
          }}
        >
          <DialogTitle>Edit service image</DialogTitle>
          <DialogContent>
            <Box sx={{ marginTop: (theme) => theme.spacing(2) }}>
              <Tooltip title="An image name that can be resolved locally, or from Docker Hub. E.g. `tensorflow/tensorflow:latest`">
                <TextField
                  label="Image name"
                  autoFocus
                  aria-describedby={"tooltip-imageNameField"}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditImageName(value);
                    if (value.length > 0) {
                      setEditImageEnvironmentUUID("");
                    }
                  }}
                  fullWidth
                  value={editImageName}
                  data-test-id="service-image-name-dialog-image-name"
                />
              </Tooltip>
              <p className="push-up push-down">
                Or choose an environment as your image:
              </p>
              <FormControl fullWidth>
                <InputLabel id="select-environment-label">
                  Environment
                </InputLabel>
                <Select
                  labelId="select-environment-label"
                  id="select-environment"
                  value={editImageEnvironmentUUID}
                  label="Environment"
                  onChange={(e) => {
                    const environmentUUID = e.target.value;
                    setEditImageEnvironmentUUID(environmentUUID);
                    if (environmentUUID.length > 0) {
                      setEditImageName("");
                    }
                  }}
                >
                  {environmentOptions.map((element) => {
                    return (
                      <MenuItem key={element.uuid} value={element.uuid}>
                        {element.name}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={onCloseEditImageName}>Cancel</Button>
            <Button
              startIcon={<CheckIcon />}
              variant="contained"
              type="submit"
              form="edit-service-image"
              data-test-id="service-image-name-dialog-save"
            >
              Save
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
};

export default ServiceForm;
