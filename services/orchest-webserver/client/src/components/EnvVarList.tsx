import { isValidEnvironmentVariableName } from "@/utils/webserver-utils";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import React from "react";
import { IconButton } from "./common/IconButton";

export interface IEnvVarListProps {
  value?: { name: string | null; value: string | null }[];
  onChange?: (value: string, index: number, type: string) => void;
  onAdd?: (e: React.MouseEvent<Element, MouseEvent>) => void;
  onDelete?: (index: number) => void;
  readOnly?: boolean;
}

export const EnvVarList: React.FC<IEnvVarListProps> = (props) => {
  return (
    <div className="environment-variables-list">
      {(!props.value || props.value.length == 0) && (
        <p className="push-down">
          <i>No environment variables have been defined.</i>
        </p>
      )}
      <ul>
        {props.value.map((pair, idx) => {
          if (!pair) return;

          return (
            <li key={pair.name}>
              <TextField
                error={!isValidEnvironmentVariableName(pair.name)}
                value={pair.name || ""}
                onChange={(e) => {
                  props.onChange(e.target.value, idx, "name");
                }}
                label="Name"
                disabled={props.readOnly === true}
                data-test-id={props["data-test-id"] + "-env-var-name"}
                data-test-title={
                  props["data-test-id"] + `-env-var-${pair.name}-name`
                }
              />
              <TextField
                value={pair.value || ""}
                onChange={(e) => props.onChange(e.target.value, idx, "value")}
                label="Value"
                disabled={props.readOnly === true}
                data-test-id={props["data-test-id"] + "-env-var-value"}
                data-test-title={
                  props["data-test-id"] + `-env-var-${pair.name}-value`
                }
              />
              {!props.readOnly && (
                <IconButton
                  title="Delete entry"
                  onClick={() => props.onDelete(idx)}
                >
                  <DeleteIcon />
                </IconButton>
              )}
            </li>
          );
        })}
      </ul>
      {!props.readOnly && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={props.onAdd}
          data-test-id={props["data-test-id"] + "-env-var-add"}
        />
      )}
    </div>
  );
};

export default EnvVarList;
