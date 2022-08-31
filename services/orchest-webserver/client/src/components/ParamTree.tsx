import { useGlobalContext } from "@/contexts/GlobalContext";
import { StrategyJson, StrategyJsonValue } from "@/types";
import { omit } from "@/utils/record";
import LightbulbOutlined from "@mui/icons-material/LightbulbOutlined";
import {
  Alert,
  AlertDescription,
  AlertHeader,
  Link,
} from "@orchest/design-system";
import classNames from "classnames";
import isString from "lodash.isstring";
import React from "react";

export const NoParameterAlert = () => {
  return (
    <Alert status="info">
      <AlertHeader>
        <LightbulbOutlined fontSize="small" />
        {`This pipeline doesn't have any parameters defined`}
      </AlertHeader>
      <AlertDescription>
        <>
          <Link
            target="_blank"
            href="https://docs.orchest.io/en/stable/fundamentals/jobs.html#parametrizing-pipelines-and-steps"
          >
            Learn more
          </Link>{" "}
          about parametrizing your pipelines and steps.
        </>
      </AlertDescription>
    </Alert>
  );
};

const maxLength = 50;
const truncateParameterValue = (value) => {
  // stringify non string values
  const valueString = !isString(value) ? JSON.stringify(value) : value;

  return valueString.length > maxLength
    ? valueString.substring(0, maxLength - 1) + "…"
    : valueString;
};

type ParamTreeProps = {
  pipelineName: string;
  selectParameter?: (parameterKey: string, key: string) => void;
  strategyJson: StrategyJson;
  activeParameter: string | undefined;
  "data-test-id": string;
};

const Parameter = ({
  activeParameter = "|",
  stepStrategy,
  includeTitle = true,
  dataTestId,
  selectParameter,
}: {
  activeParameter: string | undefined;
  stepStrategy: StrategyJsonValue;
  includeTitle?: boolean;
  dataTestId: string;
  selectParameter?: (parameterKey: string, key: string) => void;
}) => {
  const [key, strategyJsonKey] = activeParameter.split("|");
  return (
    <>
      {includeTitle && stepStrategy.title && stepStrategy.title.length > 0 && (
        <b key={stepStrategy.key}>{stepStrategy.title}</b>
      )}
      {Object.entries(stepStrategy.parameters).map(([parameterKey, value]) => {
        const selected =
          key == parameterKey && strategyJsonKey == stepStrategy.key;

        return (
          <div
            key={`${parameterKey}-${stepStrategy.key}`}
            className="parameter-row"
            data-test-id={`${dataTestId}-parameter-row-${parameterKey}`}
          >
            <div className="parameter-key">{parameterKey}:</div>
            <div
              className={classNames(
                "parameter-value",
                selectParameter ? " editable" : ""
              )}
              onClick={() => selectParameter?.(parameterKey, stepStrategy.key)}
              data-test-id={`${dataTestId}-parameter-row-${parameterKey}-value`}
            >
              <span
                style={{
                  fontWeight: selected ? "bold" : "normal",
                }}
              >
                {truncateParameterValue(value)}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
};

export const ParamTree = ({
  pipelineName,
  selectParameter,
  "data-test-id": dataTestId,
  activeParameter,
  strategyJson,
}: ParamTreeProps) => {
  const { config } = useGlobalContext();
  const pipelineParameterization =
    strategyJson[config?.PIPELINE_PARAMETERS_RESERVED_KEY || ""];

  const stepStrategies = config?.PIPELINE_PARAMETERS_RESERVED_KEY
    ? omit(strategyJson, config?.PIPELINE_PARAMETERS_RESERVED_KEY)
    : strategyJson;

  return (
    <div className="parameter-tree">
      {Object.keys(strategyJson).length == 0 && <NoParameterAlert />}
      {pipelineParameterization && (
        <div className="param-block">
          <h3>Pipeline: {pipelineName}</h3>
          <Parameter
            activeParameter={activeParameter}
            dataTestId={dataTestId}
            selectParameter={selectParameter}
            stepStrategy={pipelineParameterization}
            includeTitle={false}
          />
        </div>
      )}
      {Object.keys(stepStrategies).length > 0 && (
        <div className="param-block">
          <h3>Steps</h3>
          <div className="step-params">
            {Object.entries(stepStrategies).map(([key, value]) => {
              return (
                <Parameter
                  key={key}
                  activeParameter={activeParameter}
                  dataTestId={dataTestId}
                  selectParameter={selectParameter}
                  stepStrategy={value}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
