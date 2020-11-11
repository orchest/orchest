import React from "react";
import { MDCTextField } from "@material/textfield";
import { RefManager, uuidv4 } from "../utils/all";

class MDCTextFieldAreaReact extends React.Component {
  constructor() {
    super();

    this.refManager = new RefManager();
  }
  componentWillUnmount() {}

  getPropValue() {
    return this.props.value ? this.props.value : "";
  }

  componentDidMount() {
    this.mdc = new MDCTextField(this.refManager.refs.input);
    this.mdc.value = this.getPropValue();
  }

  onChange() {
    if (this.mdc.value !== this.getPropValue() && this.props.onChange) {
      this.props.onChange(this.mdc.value);
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.value !== this.props.value) {
      this.mdc.value = this.getPropValue();
    }
  }

  render() {
    let randomFor = uuidv4();

    let topClasses = ["mdc-text-field", "mdc-text-field--textarea"];

    if (this.props.disabled) {
      topClasses.push("mdc-text-field--disabled");
    }

    if (this.props.classNames) {
      topClasses = topClasses.concat(this.props.classNames);
    }

    return (
      <div ref={this.refManager.nrefs.input} className={topClasses.join(" ")}>
        <textarea
          disabled={this.props.disabled}
          id={randomFor}
          onChange={this.onChange.bind(this)}
          className="mdc-text-field__input"
          rows="5"
        ></textarea>
        <div className="mdc-notched-outline">
          <div className="mdc-notched-outline__leading"></div>
          <div className="mdc-notched-outline__notch">
            <label htmlFor={randomFor} className="mdc-floating-label">
              {this.props.label}
            </label>
          </div>
          <div className="mdc-notched-outline__trailing"></div>
        </div>
      </div>
    );
  }
}

export default MDCTextFieldAreaReact;
