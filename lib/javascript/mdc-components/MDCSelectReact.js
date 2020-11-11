import React from "react";
import { MDCSelect } from "@material/select";
import { arraysEqual, RefManager } from "../utils/all";

class MDCSelectReact extends React.Component {
  constructor() {
    super();

    this.refManager = new RefManager();
  }
  componentWillUnmount() {}

  componentDidMount() {
    this.initializeMDC();
  }

  initializeMDC() {
    this.mdc = new MDCSelect(this.refManager.refs.select);
    this.mdc.value = this.props.value;
    this.mdc.listen("MDCSelect:change", this.mdcSelectChangeHandler.bind(this));
  }

  mdcSelectChangeHandler() {
    if (this.mdc.value !== this.props.value && this.mdc.value != "") {
      if (this.props.onChange) {
        this.props.onChange(this.mdc.value);
      }
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.value !== this.props.value) {
      this.mdc.value = this.props.value;
    }


    // allow updating options
    if (!arraysEqual(prevProps.options, this.props.options)) {
      this.mdc.unlisten(
        "MDCSelect:change",
        this.mdcSelectChangeHandler.bind(this)
      );
      this.mdc.destroy();
      this.initializeMDC();
    }

  }

  render() {
    let listItems = this.props.options.map((item, key) => {
      // if only single entry is passed instead of value, display value
      if (item.length == 1) {
        item[1] = item[0];
      }

      return (
        <li key={key} className="mdc-list-item" data-value={item[0]}>
          {item[1]}
        </li>
      );
    });

    let topClasses = ["mdc-select"];

    if (this.props.disabled) {
      topClasses.push("mdc-select--disabled");
    }

    if (this.props.classNames) {
      topClasses = topClasses.concat(this.props.classNames);
    }

    return (
      <div className={topClasses.join(" ")} ref={this.refManager.nrefs.select}>
        <div className="mdc-select__anchor" aria-disabled={this.props.disabled}>
          <i className="mdc-select__dropdown-icon"></i>
          <div className="mdc-select__selected-text"></div>
          <span className="mdc-floating-label">{this.props.label}</span>
          <div className="mdc-line-ripple"></div>
        </div>

        <div className="mdc-select__menu mdc-menu mdc-menu-surface">
          <ul className="mdc-list">{listItems}</ul>
        </div>
      </div>
    );
  }
}

export default MDCSelectReact;
