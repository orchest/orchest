import EnvVarList from "@/components/EnvVarList";
import { Service } from "@/types";
import CheckIcon from "@mui/icons-material/Check";
import InfoIcon from "@mui/icons-material/Info";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { visuallyHidden } from "@mui/utils";
import { MDCCheckboxReact, MDCSelectReact } from "@orchest/lib-mdc";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import _ from "lodash";
import React from "react";
import { getServiceURLs } from "../utils/webserver-utils";
import {
  MultiSelect,
  MultiSelectError,
  MultiSelectInput,
  MultiSelectLabel,
} from "./MultiSelect";

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
  project_uuid: string;
  pipeline_uuid: string;
  run_uuid: string;
  updateService: (service: Service) => void;
  nameChangeService: (oldName: string, newName: string) => void;
  disabled: boolean;
}> = (props) => {
  const environmentPrefix = "environment@";

  let [showImageDialog, setShowImageDialog] = React.useState(false);
  let [environmentOptions, setEnvironmentOptions] = React.useState(undefined);
  let [editImageName, setEditImageName] = React.useState(
    props.service.image.startsWith(environmentPrefix) ? "" : props.service.image
  );
  let [editImageEnvironmentUUID, setEditImageEnvironmentUUID] = React.useState(
    props.service.image.startsWith(environmentPrefix)
      ? props.service.image.replace(environmentPrefix, "")
      : ""
  );

  const [promiseManager] = React.useState(new PromiseManager());

  React.useEffect(() => {
    return () => {
      promiseManager.cancelCancelablePromises();
    };
  }, []);

  React.useEffect(() => {
    fetchEnvironmentOptions();
  }, [props.project_uuid]);

  const handleServiceChange = (key: string, value: any) => {
    let service = _.cloneDeep(props.service);
    service[key] = value;
    props.updateService(service);
  };

  const handleNameChange = (newName: string) => {
    let oldName = props.service["name"];
    props.nameChangeService(oldName, newName);
  };

  const handleServiceBindsChange = (key: string, value: any) => {
    let service = _.cloneDeep(props.service);
    service.binds = service.binds !== undefined ? service.binds : {};
    service.binds[key] = value;

    // Clear empty value bind entries
    if (value.trim().length == 0) {
      delete service.binds[key];
    }

    props.updateService(service);
  };

  const handleScopeCheckbox = (isChecked, checkboxScope) => {
    let _scope = _.cloneDeep(props.service.scope);
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

  const fetchEnvironmentOptions = () => {
    let environmentsEndpoint = `/store/environments/${props.project_uuid}`;

    let fetchEnvironmentOptionsPromise = makeCancelable(
      makeRequest("GET", environmentsEndpoint),
      promiseManager
    );

    fetchEnvironmentOptionsPromise.promise
      .then((response) => {
        let result = JSON.parse(response);

        let environmentOptions = [["", ""]];

        for (let environment of result) {
          environmentOptions.push([environment.uuid, environment.name]);
        }

        setEnvironmentOptions(environmentOptions);
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const onCloseEditImageName = () => {
    setShowImageDialog(false);
  };

  const resolveEnvironmentName = (environmentImageName) => {
    let environmentUUID = environmentImageName.replace(environmentPrefix, "");
    let environments = environmentOptions.filter(
      (el) => el[0] == environmentUUID
    );

    if (environments.length > 0) {
      return "Environment: " + environments[0][1];
    } else {
      return environmentImageName;
    }
  };

  return (
    <>
      <Paper
        sx={{
          paddingTop: (theme) => theme.spacing(1),
          margin: (theme) => theme.spacing(2, 0),
        }}
      >
        {!environmentOptions ? (
          <LinearProgress />
        ) : (
          <Box sx={{ padding: (theme) => theme.spacing(3) }}>
            <Box component="fieldset" sx={{ border: 0 }}>
              <Box component="legend" sx={visuallyHidden}>
                {["Configure", `"${props.service.name}"`, "service"]
                  .filter(Boolean)
                  .join(" ")}
              </Box>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Name"
                  type="text"
                  disabled={props.disabled}
                  value={props.service.name}
                  onChange={(e) => {
                    handleNameChange(e.target.value);
                  }}
                  fullWidth
                  helperText="The name of the service. Up to 36 digits, letters or dashes are allowed."
                  aria-describedby="tooltip-name"
                  data-test-id={`service-${props.service.name}-name`}
                />
                <TextField
                  label="Image"
                  type="text"
                  disabled={props.disabled}
                  onClick={() => {
                    // TODO:  improve this
                    setShowImageDialog(true);
                  }}
                  onChange={() => {
                    // Override direct edits
                    handleServiceChange("image", props.service.image);
                  }}
                  value={
                    props.service.image.startsWith(environmentPrefix)
                      ? resolveEnvironmentName(props.service.image)
                      : props.service.image
                  }
                  fullWidth
                  data-test-id={`service-${props.service.name}-image`}
                />
              </Stack>
              <FormSectionTitle title="Change the service start up behavior by specifying the entrypoint and command options. This is similar the Docker equivalents.">
                Start behavior
              </FormSectionTitle>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Entrypoint (optional)"
                  type="text"
                  disabled={props.disabled}
                  value={props.service.entrypoint}
                  onChange={(e) => {
                    handleServiceChange("entrypoint", e.target.value);
                  }}
                  fullWidth
                  aria-describedby="tooltip-entrypoint"
                  helperText="This is the same `entrypoint` as the entrypoint for Docker. E.g. `python main.py`."
                  data-test-id={`service-${props.service.name}-entrypoint`}
                />

                <TextField
                  label="Command (optional)"
                  type="text"
                  disabled={props.disabled}
                  value={props.service.command}
                  onChange={(e) => {
                    handleServiceChange("command", e.target.value);
                  }}
                  fullWidth
                  helperText="This is the same `command` as the command for Docker. E.g. `arg1 -v`. They are appended to the entrypoint."
                  aria-describedby="tooltip-command"
                  data-test-id={`service-${props.service.name}-command`}
                />
              </Stack>
              <FormSectionTitle title="Mounts give you access to the project files or /data files from within the service. Entered paths should be absolute paths in the container image.">
                Mounts
              </FormSectionTitle>

              <Stack direction="row" spacing={2}>
                <TextField
                  label="Project directory (optional)"
                  type="text"
                  disabled={props.disabled}
                  value={props.service.binds?.["/project-dir"]}
                  onChange={(e) => {
                    handleServiceBindsChange("/project-dir", e.target.value);
                  }}
                  fullWidth
                  data-test-id={`service-${props.service.name}-project-mount`}
                />
                <TextField
                  label="Data directory (optional)"
                  type="text"
                  disabled={props.disabled}
                  value={props.service?.binds?.["/data"]}
                  onChange={(e) => {
                    handleServiceBindsChange("/data", e.target.value);
                  }}
                  fullWidth
                  data-test-id={`service-${props.service.name}-data-mount`}
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
                      props.service.ports
                        ? props.service.ports.map((port) => ({
                            value: port.toString(),
                          }))
                        : []
                    }
                    disabled={props.disabled}
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
                    {props.service.ports &&
                      getServiceURLs(
                        props.service,
                        props.project_uuid,
                        props.pipeline_uuid,
                        props.run_uuid
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
                  <MDCCheckboxReact
                    onChange={(isChecked: boolean) => {
                      handleServiceChange("preserve_base_path", isChecked);
                    }}
                    disabled={props.disabled}
                    label="Preserve base path"
                    value={props.service?.preserve_base_path === true}
                  />
                </Stack>
                <Stack direction="column" flex={1}>
                  <FormSectionTitle title="Require authentication for the exposed service endpoints.">
                    Authentication required
                  </FormSectionTitle>
                  <MDCCheckboxReact
                    onChange={(isChecked) => {
                      handleServiceChange("requires_authentication", isChecked);
                    }}
                    disabled={props.disabled}
                    label="Authentication required"
                    value={props.service.requires_authentication !== false}
                  />
                </Stack>
              </Stack>

              <Stack direction="row" spacing={2}>
                <Stack direction="column" flex={1}>
                  <FormSectionTitle title="Scope defines whether a service will run during interactive sessions, in job sessions, or both.">
                    Scope
                  </FormSectionTitle>
                  <MDCCheckboxReact
                    disabled={props.disabled}
                    onChange={(isChecked) => {
                      handleScopeCheckbox(isChecked, "interactive");
                    }}
                    label="Interactive sessions"
                    value={props.service.scope.indexOf("interactive") >= 0}
                  />
                  <br />
                  <MDCCheckboxReact
                    disabled={props.disabled}
                    onChange={(isChecked) => {
                      handleScopeCheckbox(isChecked, "noninteractive");
                    }}
                    label="Job sessions"
                    value={props.service.scope.indexOf("noninteractive") >= 0}
                  />
                </Stack>
                <Stack direction="column" flex={1}>
                  <FormSectionTitle title="Services don't get access to project, pipeline and job level environment variables by default. Enter the names of environment variables you want to have access to within the service. Note, inherited environment variables override any service defined environment variables, but only if they are defined at the project, pipeline or job level.">
                    Inherited environment variables
                  </FormSectionTitle>
                  <MultiSelect
                    items={props.service?.env_variables_inherit?.map(
                      (env_variable) =>
                        env_variable && {
                          value: env_variable.toString(),
                        }
                    )}
                    disabled={props.disabled}
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
                  value={envVarsDictToList(props.service.env_variables || {})}
                  readOnly={props.disabled}
                  onChange={(value, idx, changeType) => {
                    let envVarsList = envVarsDictToList(
                      props.service.env_variables || {}
                    );
                    envVarsList[idx][changeType] = value;

                    let envVars = {};
                    for (let x = 0; x < envVarsList.length; x++) {
                      envVars[envVarsList[x]["name"]] = envVarsList[x]["value"];
                    }

                    handleServiceChange("env_variables", envVars);
                  }}
                  onAdd={() => {
                    handleServiceChange("env_variables", {
                      ...(props.service.env_variables || {}),
                      "": "",
                    });
                  }}
                  onDelete={(idx) => {
                    let envVarsList = envVarsDictToList(
                      props.service.env_variables
                        ? props.service.env_variables
                        : {}
                    );
                    envVarsList.splice(idx, 1);

                    let envVars = {};
                    for (let x = 0; x < envVarsList.length; x++) {
                      envVars[envVarsList[x]["name"]] = envVarsList[x]["value"];
                    }

                    handleServiceChange("env_variables", envVars);
                  }}
                  data-test-id={`service-${props.service.name}`}
                />
              </Stack>
            </Box>
          </Box>
        )}
      </Paper>
      <Dialog open={showImageDialog} onClose={onCloseEditImageName}>
        <DialogTitle>Edit service image</DialogTitle>
        <DialogContent>
          <div>
            <Tooltip title="An image name that can be resolved locally, or from Docker Hub. E.g. `tensorflow/tensorflow:latest`">
              <TextField
                label="Image name"
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
            <MDCSelectReact
              label="Environment"
              classNames={["fullwidth"]}
              onChange={(environmentUUID) => {
                setEditImageEnvironmentUUID(environmentUUID);
                if (environmentUUID.length > 0) {
                  setEditImageName("");
                }
              }}
              value={editImageEnvironmentUUID}
              options={environmentOptions}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button color="secondary" onClick={onCloseEditImageName}>
            Cancel
          </Button>
          <Button
            startIcon={<CheckIcon />}
            variant="contained"
            type="submit"
            onClick={() => {
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
            data-test-id="service-image-name-dialog-save"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ServiceForm;
