import React from "react";
import _ from "lodash";
import { MDCTextFieldReact, MDCCheckboxReact } from "@orchest/lib-mdc";
import { getServiceURLs } from "../utils/webserver-utils";
import EnvVarList from "@/components/EnvVarList";

const ServiceForm = (props) => {
  const handleServiceChange = (key, value) => {
    let service = _.cloneDeep(props.service);
    service[key] = value;
    props.updateService(service);
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

  return (
    <div className="service-form">
      <div className="columns inner-padded">
        <div className="column">
          <MDCTextFieldReact
            label="Name"
            inputType="text"
            disabled={props.disabled}
            value={props.service.name}
            onChange={(value) => {
              handleServiceChange("name", value);
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
            disabled={props.disabled}
            value={props.service.image}
            onChange={(value) => {
              handleServiceChange("image", value);
            }}
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
          <MDCTextFieldReact
            label="Ports"
            inputType="text"
            disabled={props.disabled}
            value={props.service.ports ? props.service.ports.join(",") : ""}
            onChange={(value) => {
              handleServiceChange(
                "ports",
                value
                  .replaceAll(" ", "")
                  .split(",")
                  .map((port) => parseInt(port))
              );
            }}
            classNames={["fullwidth"]}
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
              <>
                <a key={url} href={url}>
                  {url}
                </a>
                <br />
              </>
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
          <h3 className="push-down">Inhereted environment variables</h3>
          <MDCTextFieldReact
            label="Environment variables"
            inputType="text"
            disabled={props.disabled}
            value={
              props.service.env_variables_inherit
                ? props.service.env_variables_inherit.join(",")
                : ""
            }
            onChange={(value) => {
              handleServiceChange(
                "env_variables_inherit",
                value.replaceAll(" ", "").split(",")
              );
            }}
            classNames={["fullwidth"]}
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
            ...(props.service.env_variables ? props.service.env_variables : {}),
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
    </div>
  );
};

export default ServiceForm;
