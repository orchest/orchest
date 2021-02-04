import React from "react";
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
        <ul key={idx}>
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
            classNames={["column push-down"]}
          />
          {!this.props.readOnly && (
            <MDCIconButtonToggleReact
              icon="delete"
              tooltipText="Delete entry"
              onClick={() => this.props.onDelete(idx)}
            />
          )}
        </ul>
      );
    });

    return (
      <div className="environment-variables-list">
        <ol>{envVarList}</ol>
      </div>
    );
  }
}

export default EnvVarList;
