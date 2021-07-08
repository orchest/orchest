// @ts-check
import React from "react";
import {
  MDCButtonReact,
  MDCIconButtonToggleReact,
  MDCTextFieldReact,
} from "@orchest/lib-mdc";

/**
 * @param {Object} props
 * @param {any} [props.value]
 * @param {any} [props.onChange]
 * @param {any} [props.onAdd]
 * @param {any} [props.onDelete]
 * @param {boolean} [props.readOnly]
 */
export const EnvVarList = (props) => (
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
              onChange={(e) => props.onChange(e, idx, "name")}
              label="Name"
              disabled={props.readOnly === true}
              classNames={["column push-down push-right"]}
            />
            <MDCTextFieldReact
              value={pair["value"]}
              onChange={(e) => props.onChange(e, idx, "value")}
              label="Value"
              disabled={props.readOnly === true}
              classNames={["column push-down push-right"]}
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
      />
    )}
  </div>
);

export default EnvVarList;
