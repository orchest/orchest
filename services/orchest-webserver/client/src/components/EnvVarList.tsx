import { isValidEnvironmentVariableName } from "@/utils/webserver-utils";
import {
  MDCButtonReact,
  MDCIconButtonToggleReact,
  MDCTextFieldReact,
} from "@orchest/lib-mdc";
import * as React from "react";

export interface IEnvVarListProps {
  value?: any;
  onChange?: any;
  onAdd?: any;
  onDelete?: any;
  readOnly?: boolean;
}

export const EnvVarList: React.FC<IEnvVarListProps> = (props) => (
  <div className="environment-variables-list">
    {(!props.value || props.value.length == 0) && (
      <p className="push-down">
        <i>No environment variables have been defined.</i>
      </p>
    )}
    <ul>
      {props.value.map((pair, idx) => {
        if (!pair) {
          return;
        }

        return (
          <li key={idx}>
            <MDCTextFieldReact
              value={pair["name"]}
              onChange={(e) => {
                props.onChange(e, idx, "name");
              }}
              label="Name"
              disabled={props.readOnly === true}
              classNames={["column push-down push-right"].concat(
                isValidEnvironmentVariableName(pair["name"]) ? [] : ["invalid"]
              )}
              data-test-id={props["data-test-id"] + "-env-var-name"}
              data-test-title={
                props["data-test-id"] + `-env-var-${pair["name"]}-name`
              }
            />
            <MDCTextFieldReact
              value={pair["value"]}
              onChange={(e) => props.onChange(e, idx, "value")}
              label="Value"
              disabled={props.readOnly === true}
              classNames={["column push-down push-right"]}
              data-test-id={props["data-test-id"] + "-env-var-value"}
              data-test-title={
                props["data-test-id"] + `-env-var-${pair["name"]}-value`
              }
            />
            {!props.readOnly && (
              <MDCIconButtonToggleReact
                icon="delete"
                tooltipText="Delete entry"
                onClick={() => props.onDelete(idx)}
              />
            )}
          </li>
        );
      })}
    </ul>
    {!props.readOnly && (
      <MDCButtonReact
        icon="add"
        classNames={["mdc-button--raised"]}
        onClick={props.onAdd}
        data-test-id={props["data-test-id"] + "-env-var-add"}
      />
    )}
  </div>
);

export default EnvVarList;
