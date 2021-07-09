import * as React from "react";
import { MDCFormField } from "@material/form-field";
import { MDCCheckbox } from "@material/checkbox";
import { RefManager, uuidv4 } from "@orchest/lib-utils";

// used only in orchest-webserver
export class MDCCheckboxReact extends React.Component<any> {
  refManager: RefManager;
  mdc: MDCCheckbox;
  mdcField: MDCFormField;

  constructor() {
    // @ts-ignore
    super();

    this.refManager = new RefManager();
  }
  componentDidMount() {
    this.mdcField = new MDCFormField(this.refManager.refs.formField);
    this.mdc = new MDCCheckbox(this.refManager.refs.checkbox);
    this.mdcField.input = this.mdc;

    if (this.props.value === true) {
      this.mdc.checked = true;
    } else {
      this.mdc.checked = false;
    }

    // TODO: find out why React onChange is not called
    this.refManager.refs.nativeCheckbox.onchange = this.onChange.bind(this);
  }

  onChange() {
    if (this.props.onChange) {
      this.props.onChange(this.mdc.checked);
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
        <div className="mdc-checkbox" ref={this.refManager.nrefs.checkbox}>
          <input
            type="checkbox"
            className="mdc-checkbox__native-control"
            id={randomFor}
            disabled={this.props.disabled === true}
            ref={this.refManager.nrefs.nativeCheckbox}
          />
          <div className="mdc-checkbox__background">
            <svg className="mdc-checkbox__checkmark" viewBox="0 0 24 24">
              <path
                className="mdc-checkbox__checkmark-path"
                fill="none"
                d="M1.73,12.91 8.1,19.28 22.79,4.59"
              />
            </svg>
            <div className="mdc-checkbox__mixedmark"></div>
          </div>
          <div className="mdc-checkbox__ripple"></div>
        </div>
        <label htmlFor={randomFor}>{this.props.label}</label>
      </div>
    );
  }
}
