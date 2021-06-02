import React from "react";
import { parseISO } from "date-fns";
import { MDCTextFieldReact } from "@orchest/lib-mdc";

class DateTimeInput extends React.Component {
  constructor(props) {
    super(props);

    let date = new Date();
    this.state = {
      timeValue:
        ("0" + date.getHours()).slice(-2) +
        ":" +
        ("0" + date.getMinutes()).slice(-2),
      dateValue:
        date.getFullYear() +
        "-" +
        ("0" + (date.getMonth() + 1)).slice(-2) +
        "-" +
        ("0" + date.getDate()).slice(-2),
    };
  }

  getISOString() {
    return parseISO(
      this.state.dateValue + " " + this.state.timeValue
    ).toISOString();
  }

  render() {
    return (
      <div className="datetime-input">
        <div>
          <MDCTextFieldReact
            label="Time"
            inputType="time"
            disabled={this.props.disabled}
            value={this.state.timeValue}
            onChange={(value) => {
              this.setState({ timeValue: value });
            }}
            onFocus={this.props.onFocus}
          />
        </div>
        <div>
          <MDCTextFieldReact
            label="Date"
            inputType="date"
            disabled={this.props.disabled}
            value={this.state.dateValue}
            onChange={(value) => {
              this.setState({ dateValue: value });
            }}
            onFocus={this.props.onFocus}
          />
        </div>
      </div>
    );
  }
}

export default DateTimeInput;
