import * as React from "react";
import { MDCSelect } from "@material/select";
import { arraysEqual, RefManager, uuidv4 } from "@orchest/lib-utils";

// used only in orchest-webserver
export class MDCSelectReact extends React.Component<any> {
  refManager: RefManager;
  mdc: MDCSelect;

  constructor() {
    // @ts-ignore
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
        this.props.onChange(
          this.mdc.value,
          this.getDisplayValueForOptionValue(this.mdc.value)
        );
      }
    }
  }

  getDisplayValueForOptionValue(value) {
    for (let option of this.props.options) {
      if (option[0] == value) {
        return option[option.length - 1];
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
    let id_uuid = uuidv4();

    let listItems = this.props.options.map((item, key) => {
      // if only single entry is passed instead of value, display value
      if (item.length == 1) {
        item[1] = item[0];
      }

      return (
        <li
          key={key}
          className="mdc-list-item"
          aria-selected="false"
          data-value={item[0]}
          role="option"
        >
          <span className="mdc-list-item__ripple" />
          <span className="mdc-list-item__text">{item[1]}</span>
        </li>
      );
    });

    let topClasses = ["mdc-select"];

    if (this.props.notched === true) {
      topClasses.push("mdc-select--outlined");
    } else {
      topClasses.push("mdc-select--filled");
    }

    if (this.props.disabled) {
      topClasses.push("mdc-select--disabled");
    }

    if (this.props.classNames) {
      topClasses = topClasses.concat(this.props.classNames);
    }

    return (
      <div className={topClasses.join(" ")} ref={this.refManager.nrefs.select}>
        <div
          className="mdc-select__anchor"
          aria-disabled={this.props.disabled}
          role="button"
          aria-haspopup="listbox"
          aria-expanded="false"
          aria-labelledby={"selected-text-" + id_uuid}
        >
          {this.props.notched ? (
            <span className="mdc-notched-outline">
              <span className="mdc-notched-outline__leading" />
              <span className="mdc-notched-outline__notch">
                <span
                  id={"outlined-select-label-" + id_uuid}
                  className="mdc-floating-label"
                >
                  {this.props.label}
                </span>
              </span>
              <span className="mdc-notched-outline__trailing" />
            </span>
          ) : (
            <>
              <span className="mdc-select__ripple" />
              <span id={"label-" + id_uuid} className="mdc-floating-label">
                {this.props.label}
              </span>
            </>
          )}

          <span className="mdc-select__selected-text-container">
            <span
              id={"selected-text-" + id_uuid}
              className="mdc-select__selected-text"
            />
          </span>
          <span className="mdc-select__dropdown-icon">
            <svg
              className="mdc-select__dropdown-icon-graphic"
              viewBox="7 10 10 5"
              focusable="false"
            >
              <polygon
                className="mdc-select__dropdown-icon-inactive"
                stroke="none"
                fillRule="evenodd"
                points="7 10 12 15 17 10"
              ></polygon>
              <polygon
                className="mdc-select__dropdown-icon-active"
                stroke="none"
                fillRule="evenodd"
                points="7 15 12 10 17 15"
              ></polygon>
            </svg>
          </span>
          {!this.props.notched && <span className="mdc-line-ripple" />}
        </div>

        <div className="mdc-select__menu mdc-menu mdc-menu-surface mdc-menu-surface--fullwidth">
          <ul className="mdc-list">{listItems}</ul>
        </div>
      </div>
    );
  }
}
