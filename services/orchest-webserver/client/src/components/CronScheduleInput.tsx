import { MDCButtonReact, MDCTextFieldReact } from "@orchest/lib-mdc";
import parser from "cron-parser";
import cronstrue from "cronstrue";
import * as React from "react";

export interface ICronScheduleInputProps {
  disabled: boolean;
  cronString: string;
  onChange: (value: string) => void;
  dataTestId: string;
}

export const CronScheduleInput: React.FC<ICronScheduleInputProps> = ({
  cronString,
  disabled,
  onChange,
  dataTestId: dataTestId,
}) => {
  const [state, setState] = React.useState(cronString);

  const handleButton = (changedCronString) => {
    setState(changedCronString);
    onChange(changedCronString);
  };

  return (
    <>
      <div className="push-down separated">
        <MDCButtonReact
          disabled={disabled}
          onClick={() => handleButton("* * * * *")}
          label="Every minute"
        />
        <MDCButtonReact
          disabled={disabled}
          onClick={() => handleButton("0 * * * *")}
          label="Hourly"
        />
        <MDCButtonReact
          disabled={disabled}
          onClick={() => handleButton("0 0 * * *")}
          label="Daily"
        />
        <MDCButtonReact
          disabled={disabled}
          onClick={() => handleButton("0 0 * * 0")}
          label="Weekly"
        />
        <MDCButtonReact
          disabled={disabled}
          onClick={() => handleButton("0 0 1 * *")}
          label="Monthly"
        />
      </div>
      <MDCTextFieldReact
        disabled={disabled}
        label="Cron expression"
        onChange={(value) => {
          setState(value);
          onChange(value);
        }}
        classNames={["push-down"]}
        value={state}
        data-test-id={dataTestId}
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
