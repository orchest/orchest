// @ts-check
import React from "react";
import cronstrue from "cronstrue";
import parser from "cron-parser";
import { MDCButtonReact, MDCTextFieldReact } from "@orchest/lib-mdc";

/**
 * @param {Object} props
 * @param {boolean} [props.disabled]
 * @param {string} props.cronString
 */
export const CronScheduleInput = ({ cronString, disabled }) => {
  const [state, setState] = React.useState(cronString);

  const onChange = (changedCronString) => {
    if (changedCronString) setState(changedCronString);
  };

  return (
    <>
      <div className="push-down separated">
        <MDCButtonReact
          disabled={disabled}
          onClick={onChange.bind(this, "* * * * *")}
          label="Every minute"
        />
        <MDCButtonReact
          disabled={disabled}
          onClick={onChange.bind(this, "0 * * * *")}
          label="Hourly"
        />
        <MDCButtonReact
          disabled={disabled}
          onClick={onChange.bind(this, "0 0 * * *")}
          label="Daily"
        />
        <MDCButtonReact
          disabled={disabled}
          onClick={onChange.bind(this, "0 0 * * 0")}
          label="Weekly"
        />
        <MDCButtonReact
          disabled={disabled}
          onClick={onChange.bind(this, "0 0 1 * *")}
          label="Monthly"
        />
      </div>
      <MDCTextFieldReact
        disabled={disabled}
        label="Cron expression"
        onChange={(value) => {
          onChange(value);
        }}
        classNames={["push-down"]}
        value={state}
      />
      <div className={disabled ? "disabled-text" : ""}>
        {(() => {
          try {
            parser.parseExpression(state);
            return cronstrue.toString(state);
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
      <div className={"form-helper-text" + (disabled ? " disabled-text" : "")}>
        Note: the cron expression is evaluated in UTC time.
      </div>
    </>
  );
};

export default CronScheduleInput;
