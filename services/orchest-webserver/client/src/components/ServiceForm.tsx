import * as React from "react";
import _ from "lodash";
import { Box, styled } from "@orchest/design-system";
import {
  MDCTextFieldReact,
  MDCCheckboxReact,
  MDCButtonReact,
  MDCDialogReact,
  MDCSelectReact,
  MDCLinearProgressReact,
  MDCTooltipReact,
} from "@orchest/lib-mdc";
import { getServiceURLs } from "../utils/webserver-utils";
import EnvVarList from "@/components/EnvVarList";
import {
  MultiSelect,
  MultiSelectError,
  MultiSelectInput,
  MultiSelectLabel,
} from "./MultiSelect";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";

const ServiceForm: React.FC<any> = (props) => {
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

  const handleServiceChange = (key, value) => {
    let service = _.cloneDeep(props.service);
    service[key] = value;
    props.updateService(service);
  };

  const handleNameChange = (newName) => {
    let oldName = props.service["name"];
    props.nameChangeService(oldName, newName);
  };

  const handleServiceBindsChange = (key, value) => {
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
      _scope = _scope.filter((el) => el != checkboxScope);
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

  if (!environmentOptions) {
    return <MDCLinearProgressReact />;
  }

  return (
    <div className="service-form">
      {showImageDialog && (
        <MDCDialogReact
          title="Edit service image"
          onClose={onCloseEditImageName}
          content={
            <div>
              <MDCTextFieldReact
                label="Image name"
                aria-describedby={"tooltip-imageNameField"}
                onChange={(value) => {
                  setEditImageName(value);
                  if (value.length > 0) {
                    setEditImageEnvironmentUUID("");
                  }
                }}
                classNames={["fullwidth"]}
                value={editImageName}
              />
              <MDCTooltipReact
                tooltipID="tooltip-imageNameField"
                tooltip="An image name that can be resolved locally, or from Docker Hub. E.g. `tensorflow/tensorflow:latest`"
              />
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
          }
          actions={
            <>
              <MDCButtonReact
                classNames={["push-right"]}
                label="Cancel"
                onClick={onCloseEditImageName}
              />
              <MDCButtonReact
                label="Save"
                icon="check"
                classNames={["mdc-button--raised"]}
                submitButton
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
              />
            </>
          }
        />
      )}

      <Box
        as="form"
        css={{ padding: "$4" }}
        onSubmit={(e) => e.preventDefault()}
      >
        <Box as="fieldset" css={{ border: 0 }}>
          <Box as="legend" css={{ include: "screenReaderOnly" }}>
            {["Configure", `"${props.service.name}"`, "service"]
              .filter(Boolean)
              .join(" ")}
          </Box>
          <>
            <div className="columns inner-padded">
              <div className="column">
                <MDCTextFieldReact
                  label="Name"
                  inputType="text"
                  disabled={props.disabled}
                  value={props.service.name}
                  maxLength="36"
                  onChange={(value) => {
                    handleNameChange(value);
                  }}
                  classNames={["fullwidth"]}
                  aria-describedby="tooltip-name"
                />
                <MDCTooltipReact
                  tooltipID="tooltip-name"
                  tooltip="The name of the service. Up to 36 digits, letters or dashes are allowed."
                />
              </div>
              <div className="column">
                <MDCTextFieldReact
                  label="Image"
                  inputType="text"
                  disabled={props.disabled}
                  onFocus={() => {
                    setShowImageDialog(true);
                  }}
                  onChange={(value) => {
                    // Override direct edits
                    handleServiceChange("image", props.service.image);
                  }}
                  value={
                    props.service.image.startsWith(environmentPrefix)
                      ? resolveEnvironmentName(props.service.image)
                      : props.service.image
                  }
                  classNames={["fullwidth"]}
                />
              </div>
              <div className="clear"></div>
            </div>

            <h3 className="push-up push-down">
              Start behavior{" "}
              <i
                className="material-icons inline-icon push-left"
                aria-describedby="tooltip-start"
              >
                info
              </i>
            </h3>
            <MDCTooltipReact
              tooltipID="tooltip-start"
              tooltip="Change the service start up behavior by specifying the entrypoint and command options. This is similar the Docker equivalents."
            />
            <div className="columns inner-padded">
              <div className="column">
                <MDCTextFieldReact
                  label="Entrypoint (optional)"
                  inputType="text"
                  disabled={props.disabled}
                  value={props.service.entrypoint}
                  onChange={(value) => {
                    handleServiceChange("entrypoint", value);
                  }}
                  classNames={["fullwidth"]}
                  aria-describedby="tooltip-entrypoint"
                />
                <MDCTooltipReact
                  tooltipID="tooltip-entrypoint"
                  tooltip="This is the same `entrypoint` as the entrypoint for Docker. E.g. `python main.py`."
                />
              </div>
              <div className="column inner-padded">
                <MDCTextFieldReact
                  label="Command (optional)"
                  inputType="text"
                  disabled={props.disabled}
                  value={props.service.command}
                  onChange={(value) => {
                    handleServiceChange("command", value);
                  }}
                  classNames={["fullwidth"]}
                  aria-describedby="tooltip-command"
                />
                <MDCTooltipReact
                  tooltipID="tooltip-command"
                  tooltip="This is the same `command` as the command for Docker. E.g. `arg1 -v`. They are appended to the entrypoint."
                />
              </div>
              <div className="clear"></div>
            </div>

            <h3 className="push-down">
              Mounts{" "}
              <i
                className="material-icons inline-icon push-left"
                aria-describedby="tooltip-mounts"
              >
                info
              </i>
            </h3>
            <MDCTooltipReact
              tooltipID="tooltip-mounts"
              tooltip="Mounts give you access to the project files or /data files from within the service. Entered paths should be absolute paths in the container image."
            />
            <div className="columns inner-padded">
              <div className="column">
                <MDCTextFieldReact
                  label="Project directory (optional)"
                  inputType="text"
                  disabled={props.disabled}
                  value={props.service?.binds?.["/project-dir"]}
                  onChange={(value) => {
                    handleServiceBindsChange("/project-dir", value);
                  }}
                  classNames={["fullwidth"]}
                />
              </div>
              <div className="column inner-padded">
                <MDCTextFieldReact
                  label="Data directory (optional)"
                  inputType="text"
                  disabled={props.disabled}
                  value={props.service?.binds?.["/data"]}
                  onChange={(value) => {
                    handleServiceBindsChange("/data", value);
                  }}
                  classNames={["fullwidth"]}
                />
              </div>
              <div className="clear"></div>
            </div>

            <div className="columns inner-padded">
              <div className="column">
                <h3>
                  Ports{" "}
                  <i
                    className="material-icons inline-icon push-left"
                    aria-describedby="tooltip-ports"
                  >
                    info
                  </i>
                </h3>
                <MDCTooltipReact
                  tooltipID="tooltip-ports"
                  tooltip="Enter ports like 80, 8080 to make the service available through a URL."
                />
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

                <h3 className="push-up push-down">
                  Preserve base path{" "}
                  <i
                    className="material-icons inline-icon push-left"
                    aria-describedby="tooltip-preserve-base-path"
                  >
                    info
                  </i>
                </h3>
                <MDCTooltipReact
                  tooltipID="tooltip-preserve-base-path"
                  tooltip="When you preserve the base path the first component of the path https://<hostname>/1/2/... will be passed to the service when the request is proxied by Orchest."
                />

                <MDCCheckboxReact
                  onChange={(isChecked) => {
                    handleServiceChange("preserve_base_path", isChecked);
                  }}
                  disabled={props.disabled}
                  label="Preserve base path"
                  value={props.service?.preserve_base_path === true}
                />
              </div>
              <div className="column">
                <h3 className="push-down">
                  URLs{" "}
                  <i
                    className="material-icons inline-icon push-left"
                    aria-describedby="tooltip-urls"
                  >
                    info
                  </i>
                </h3>
                <MDCTooltipReact
                  tooltipID="tooltip-urls"
                  tooltip="The URLs that will be available to communicate with the service. These are all proxied by Orchest."
                />
                {props.service.ports &&
                  getServiceURLs(
                    props.service,
                    props.project_uuid,
                    props.pipeline_uuid,
                    props.run_uuid
                  ).map((url) => (
                    <div key={url}>
                      <a href={url}>{url}</a>
                    </div>
                  ))}
              </div>
              <div className="clear"></div>
            </div>

            <div className="columns inner-padded">
              <div className="column">
                <h3 className="push-down">
                  Scope{" "}
                  <i
                    className="material-icons inline-icon push-left"
                    aria-describedby="tooltip-scope"
                  >
                    info
                  </i>
                </h3>
                <MDCTooltipReact
                  tooltipID="tooltip-scope"
                  tooltip="Scope defines whether a service will run during interactive sessions, in job sessions, or both."
                />
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
              </div>
              <div className="column">
                <h3>
                  Inherited environment variables{" "}
                  <i
                    className="material-icons inline-icon push-left"
                    aria-describedby="tooltip-inherited-env-variables"
                  >
                    info
                  </i>
                </h3>
                <MDCTooltipReact
                  tooltipID="tooltip-inherited-env-variables"
                  tooltip="Services don't get access to project, pipeline and job level environment variables by default. Enter the names of environment variables you want to have access to within the service. Note, inherited environment variables override any service defined environment variables, but only if they are defined at the project, pipeline or job level."
                />

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
              </div>
              <div className="clear"></div>
            </div>
            <h3 className="push-down">
              Environment variables{" "}
              <i
                className="material-icons inline-icon push-left"
                aria-describedby="tooltip-env-variables"
              >
                info
              </i>
            </h3>
            <MDCTooltipReact
              tooltipID="tooltip-env-variables"
              tooltip="Environment variables specific to the service. Note! These are versioned, so don't use it for secrets."
            />
            <EnvVarList
              value={envVarsDictToList(
                props.service.env_variables ? props.service.env_variables : {}
              )}
              readOnly={props.disabled}
              onChange={(value, idx, changeType) => {
                let envVarsList = envVarsDictToList(
                  props.service.env_variables ? props.service.env_variables : {}
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
                  ...(props.service.env_variables
                    ? props.service.env_variables
                    : {}),
                  "": "",
                });
              }}
              onDelete={(idx) => {
                let envVarsList = envVarsDictToList(
                  props.service.env_variables ? props.service.env_variables : {}
                );
                envVarsList.splice(idx, 1);

                let envVars = {};
                for (let x = 0; x < envVarsList.length; x++) {
                  envVars[envVarsList[x]["name"]] = envVarsList[x]["value"];
                }

                handleServiceChange("env_variables", envVars);
              }}
            />
          </>
        </Box>
      </Box>
    </div>
  );
};

export default ServiceForm;
