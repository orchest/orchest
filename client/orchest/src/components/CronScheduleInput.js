import React from "react";
import cronstrue from "cronstrue";
import cron from "cron-validate";
import { MDCButtonReact, MDCTextFieldReact } from "@lib/mdc";

class CronScheduleInput extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      cronString: this.props.cronString,
    };
  }

  onChange(cronString) {
    if (this.props.onChange) {
      this.props.onChange(cronString);
    }
    this.setState({
      cronString,
    });
  }

  render() {
    return (
      <>
        <div className="push-down separated">
          <MDCButtonReact
            disabled={this.props.disabled}
            onClick={this.onChange.bind(this, "* * * * *")}
            label="Every minute"
          />
          <MDCButtonReact
            disabled={this.props.disabled}
            onClick={this.onChange.bind(this, "0 * * * *")}
            label="Hourly"
          />
          <MDCButtonReact
            disabled={this.props.disabled}
            onClick={this.onChange.bind(this, "0 0 * * *")}
            label="Daily"
          />
          <MDCButtonReact
            disabled={this.props.disabled}
            onClick={this.onChange.bind(this, "0 0 * * 0")}
            label="Weekly"
          />
          <MDCButtonReact
            disabled={this.props.disabled}
            onClick={this.onChange.bind(this, "0 0 1 * *")}
            label="Monthly"
          />
        </div>
        <MDCTextFieldReact
          disabled={this.props.disabled}
          label="Cron expression"
          onChange={(value) => {
            this.onChange(value);
          }}
          classNames={["push-down"]}
          value={this.state.cronString}
        />
        <div className={this.props.disabled ? "disabled-text" : ""}>
          {(() => {
            try {
              let cronResult = cron(this.state.cronString);
              if (cronResult.isValid()) {
                return cronstrue.toString(this.state.cronString);
              }
            } catch (err) {
              console.warn(err);
            }
            return (
              <div className="warning">
                <i className="material-icons">warning</i> Invalid cron string.
              </div>
            );
          })()}
        </div>
      </>
    );
  }
}

export default CronScheduleInput;
