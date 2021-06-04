// @ts-check
import React from "react";
import _ from "lodash";
import {
  MDCTextFieldReact,
  MDCCheckboxReact,
  MDCButtonReact,
  MDCDialogReact,
  MDCSelectReact,
  MDCLinearProgressReact,
} from "@orchest/lib-mdc";
import { getServiceURLs } from "../utils/webserver-utils";
import EnvVarList from "@/components/EnvVarList";
import { MultiSelect } from "./MultiSelect";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";

import { Box } from "@orchest/design-system";

const ServiceForm = (props) => {
  const orchest = window.orchest;

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

  const promiseManager = new PromiseManager();

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
                onChange={(value) => {
                  setEditImageName(value);
                  if (value.length > 0) {
                    setEditImageEnvironmentUUID("");
                  }
                }}
                classNames={["fullwidth"]}
                value={editImageName}
              />
              <p className="push-up push-down">
                Or choosing an environment as your image:
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
                  onChange={(value) => {
                    handleNameChange(value);
                  }}
                  classNames={["fullwidth"]}
                />
              </div>
              <div className="column">
                <MDCTextFieldReact
                  label="Command (optional)"
                  inputType="text"
                  disabled={props.disabled}
                  value={props.service.command}
                  onChange={(value) => {
                    handleServiceChange("command", value);
                  }}
                  classNames={["fullwidth"]}
                />
              </div>
              <div className="clear"></div>
            </div>

            <div className="columns inner-padded">
              <div className="column">
                <MDCTextFieldReact
                  label="Image"
                  inputType="text"
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
              <div className="column inner-padded">
                <MDCTextFieldReact
                  label="Entrypoint (optional)"
                  inputType="text"
                  disabled={props.disabled}
                  value={props.service.entrypoint}
                  onChange={(value) => {
                    handleServiceChange("entrypoint", value);
                  }}
                  classNames={["fullwidth"]}
                />
              </div>
              <div className="clear"></div>
            </div>

            <h3 className="push-down">Mounts</h3>
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
                <h3 className="push-down">Ports</h3>

                <MultiSelect
                  label="Ports"
                  screenReaderOnlyLabel
                  items={props.service.ports.map((port) => ({
                    value: port.toString(),
                  }))}
                  // onChange={(value) => {
                  //   handleServiceChange(
                  //     "ports",
                  //     value
                  //       .replaceAll(" ", "")
                  //       .split(",")
                  //       .map((port) => parseInt(port))
                  //   );
                  // }}
                />

                <h3 className="push-up push-down">Preserve base path</h3>
                <p>
                  This setting defines whether the first component of the URL is
                  forwarded to the service container by the network proxy.
                </p>
                <MDCCheckboxReact
                  onChange={(isChecked) => {
                    handleServiceChange("preserve_base_path", isChecked);
                  }}
                  label="Preserve base path"
                  value={props.service?.preserve_base_path === true}
                />
              </div>
              <div className="column">
                <h3 className="push-down">URLs</h3>
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

            <div className="columns">
              <div className="column">
                <h3 className="push-down">Scope</h3>
                <MDCCheckboxReact
                  onChange={(isChecked) => {
                    handleScopeCheckbox(isChecked, "interactive");
                  }}
                  label="Interactive"
                  value={props.service.scope.indexOf("interactive") >= 0}
                />
                <br />
                <MDCCheckboxReact
                  onChange={(isChecked) => {
                    handleScopeCheckbox(isChecked, "noninteractive");
                  }}
                  label="Non-iteractive"
                  value={props.service.scope.indexOf("noninteractive") >= 0}
                />
              </div>
              <div className="column">
                <h3 className="push-down">Inherited environment variables</h3>

                <MultiSelect
                  label="Environment variables"
                  screenReaderOnlyLabel
                  items={props.service?.env_variables_inherit?.map(
                    (env_variable) =>
                      env_variable && {
                        value: env_variable.toString(),
                      }
                  )}
                  // onChange={(value) => {
                  //   handleServiceChange(
                  //     "env_variables_inherit",
                  //     value.replaceAll(" ", "").split(",")
                  //   );
                  // }}
                />
              </div>
              <div className="clear"></div>
            </div>
            <h3 className="push-down">Environment variables</h3>
            <EnvVarList
              value={envVarsDictToList(
                props.service.env_variables ? props.service.env_variables : {}
              )}
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
            <h3 className="push-up push-down">Danger zone</h3>
            <MDCButtonReact
              label="Delete service"
              icon="delete"
              classNames={["mdc-button--raised"]}
              onClick={() => {
                orchest.confirm(
                  "Warning",
                  "Are you sure you want to delete the service: " +
                    props.service.name +
                    "?",
                  () => {
                    props.deleteService(props.service.name);
                  }
                );
              }}
            />
          </>
        </Box>
      </Box>
    </div>
  );
};

export default ServiceForm;
