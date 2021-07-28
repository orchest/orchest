import * as React from "react";
import {
  MDCButtonReact,
  MDCIconButtonToggleReact,
  MDCTextFieldReact,
} from "@orchest/lib-mdc";

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
