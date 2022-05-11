import { useAppContext } from "@/contexts/AppContext";
import {
  Alert,
  AlertDescription,
  AlertHeader,
  IconLightBulbOutline,
  Link,
} from "@orchest/design-system";
import isString from "lodash.isstring";
import React from "react";

export interface IParamTreeProps {
  pipelineName: string;
  editParameter?: (parameterKey: any, key: any) => void;
  strategyJSON: any;
}

export const NoParameterAlert = () => {
  return (
    <Alert status="info">
      <AlertHeader>
        <IconLightBulbOutline />
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

const ParamTree: React.FC<IParamTreeProps> = (props) => {
  const { config } = useAppContext();

  const truncateParameterValue = (value) => {
    // stringify non string values
    if (!isString(value)) {
      value = JSON.stringify(value);
    }

    let maxLength = 50;
    return value.length > maxLength
      ? value.substring(0, maxLength - 1) + "…"
      : value;
  };

  const onEditParameter = (parameterKey, key) => {
    if (props.editParameter) {
      props.editParameter(parameterKey, key);
    }
  };

  const generateParameterElement = (stepStrategy, includeTitle?) => {
    let elements = [];

    if (includeTitle === undefined) {
      includeTitle = true;
    }

    if (includeTitle) {
      elements.push(<b key={stepStrategy.key}>{stepStrategy.title}</b>);
    }

    for (let parameterKey in stepStrategy.parameters) {
      let parameterValueClasses = ["parameter-value"];

      if (props.editParameter) {
        parameterValueClasses.push("editable");
      }

      elements.push(
        <div
          key={parameterKey + "-" + stepStrategy.key}
          className="parameter-row"
          data-test-id={
            props["data-test-id"] + `-parameter-row-${parameterKey}`
          }
        >
          <div className="parameter-key">{parameterKey}:</div>
          <div
            className={parameterValueClasses.join(" ")}
            onClick={() => onEditParameter(parameterKey, stepStrategy.key)}
            data-test-id={
              props["data-test-id"] + `-parameter-row-${parameterKey}-value`
            }
          >
            {truncateParameterValue(stepStrategy.parameters[parameterKey])}
          </div>
        </div>
      );
    }

    return elements;
  };

  const generateParameterTree = (strategyJSON) => {
    let pipelineParameterElement;
    let stepParameterElements = [];

    // first list pipeline parameters
    let pipelineParameterization =
      strategyJSON[config?.PIPELINE_PARAMETERS_RESERVED_KEY || ""];
    if (pipelineParameterization) {
      pipelineParameterElement = generateParameterElement(
        pipelineParameterization,
        false
      );
    }

    for (const stepUUID in strategyJSON) {
      if (stepUUID == config?.PIPELINE_PARAMETERS_RESERVED_KEY) {
        continue;
      }

      stepParameterElements = stepParameterElements.concat(
        generateParameterElement(strategyJSON[stepUUID])
      );
    }

    return [pipelineParameterElement, stepParameterElements];
  };

  let [pipelineParameterElement, stepParameterElements] = generateParameterTree(
    props.strategyJSON
  );

  return (
    <div className="parameter-tree">
      {Object.keys(props.strategyJSON).length == 0 && <NoParameterAlert />}

      {pipelineParameterElement !== undefined && (
        <div className="param-block">
          <h3>Pipeline: {props.pipelineName}</h3>
          {pipelineParameterElement}
        </div>
      )}

      {stepParameterElements.length > 0 && (
        <div className="param-block">
          <h3>Steps</h3>
          <div className="step-params">{stepParameterElements}</div>
        </div>
      )}
    </div>
  );
};

export default ParamTree;
