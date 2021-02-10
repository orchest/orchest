import React from "react";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCIconButtonToggleReact from "../lib/mdc-components/MDCIconButtonToggleReact";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";

class EnvVarList extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const envVarList = this.props.value.map((pair, idx) => {
      if (!pair) {
        return;
      }

      return (
        <li key={idx}>
          <MDCTextFieldReact
            value={pair["name"]}
            onChange={(e) => this.props.onChange(e, idx, "name")}
            label="Name"
            disabled={this.props.readOnly === true}
            classNames={["column push-down push-right"]}
          />
          <MDCTextFieldReact
            value={pair["value"]}
            onChange={(e) => this.props.onChange(e, idx, "value")}
            label="Value"
            disabled={this.props.readOnly === true}
            classNames={["column push-down push-right"]}
          />
          {!this.props.readOnly && (
            <MDCIconButtonToggleReact
              icon="delete"
              tooltipText="Delete entry"
              onClick={() => this.props.onDelete(idx)}
            />
          )}
        </li>
      );
    });

    return (
      <div className="environment-variables-list">
        {(!this.props.value || this.props.value.length == 0) && (
          <p className="push-down">
            <i>No environment variables have been defined.</i>
          </p>
        )}
        <ul>{envVarList}</ul>
        {!this.props.readOnly && (
          <MDCButtonReact
            icon="add"
            classNames={["mdc-button--raised push-down"]}
            onClick={this.props.onAdd}
          />
        )}
      </div>
    );
  }
}

export default EnvVarList;
