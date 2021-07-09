import * as React from "react";
import { MDCFormField } from "@material/form-field";
import { MDCRadio } from "@material/radio";
import { RefManager, uuidv4 } from "@orchest/lib-utils";

// used only in orchest-webserver
export class MDCRadioReact extends React.Component<any> {
  refManager: RefManager;
  mdc: MDCRadio;
  mdcField: MDCFormField;

  constructor() {
    // @ts-ignore
    super();

    this.refManager = new RefManager();
  }
  componentDidMount() {
    this.mdcField = new MDCFormField(this.refManager.refs.formField);
    this.mdc = new MDCRadio(this.refManager.refs.radio);
  }

  onChange(e) {
    if (this.props.onChange) {
      this.props.onChange(e);
    }
  }

  render() {
    let topClasses = ["mdc-form-field"];

    if (this.props.classNames) {
      topClasses = topClasses.concat(this.props.classNames);
    }

    let randomFor = uuidv4();

    return (
      <div
        className={topClasses.join(" ")}
        ref={this.refManager.nrefs.formField}
      >
        <div className="mdc-radio" ref={this.refManager.nrefs.radio}>
          <input
            onChange={this.onChange.bind(this)}
            className="mdc-radio__native-control"
            type="radio"
            value={this.props.value}
            id={"radio-" + randomFor}
            name={this.props.name}
            checked={this.props.checked}
          />
          <div className="mdc-radio__background">
            <div className="mdc-radio__outer-circle"></div>
            <div className="mdc-radio__inner-circle"></div>
          </div>
          <div className="mdc-radio__ripple"></div>
        </div>
        <label htmlFor={"radio-" + randomFor}>{this.props.label}</label>
      </div>
    );
  }
}
