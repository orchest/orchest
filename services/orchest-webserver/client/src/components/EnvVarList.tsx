import { isValidEnvironmentVariableName } from "@/utils/webserver-utils";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";
import { IconButton } from "./common/IconButton";

export type EnvVarPair = {
  name: string;
  value: string;
};

export const EnvVarList: React.FC<{
  value: EnvVarPair[];
  setValue?: (
    callback: (
      currentValue: EnvVarPair[] | undefined
    ) => EnvVarPair[] | undefined
  ) => void;
  readOnly?: boolean;
  ["data-test-id"]?: string;
}> = ({
  value: variables,
  setValue,
  readOnly,
  ["data-test-id"]: testId = "",
}) => {
  const onChange = (payload: string, index: number, type: "name" | "value") => {
    if (!setValue) return;
    setValue((current) => {
      if (!current) return current;
      const found = current[index];
      const updated = { ...found, [type]: payload };
      return [...current.slice(0, index), updated, ...current.slice(index + 1)];
    });
  };

  const onAdd = () => {
    if (!setValue) return;
    setValue((current) => [...(current || []), { name: "", value: "" }]);
  };

  const remove = (index: number) => {
    if (!setValue) return;
    setValue((current) => {
      if (!current) return [];
      if (index < 0 || index >= current.length) return current;
      return [...current.slice(0, index), ...current.slice(index + 1)];
    });
  };

  return (
    <Stack direction="column" spacing={3} alignItems="flex-start">
      {variables.length === 0 && (
        <Typography>
          <i>No environment variables have been defined.</i>
        </Typography>
      )}
      {variables.map((pair, idx) => {
        if (!pair) return null;
        const elementKey = `env-variable-${idx}`;
        const isValidName =
          pair.name.length === 0 || isValidEnvironmentVariableName(pair.name);
        return (
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ maxWidth: "40rem" }}
            key={elementKey}
          >
            <Tooltip
              title="Must be numbers or alphabets concatenate with underscores or hyphen"
              open={!isValidName}
              arrow
            >
              <TextField
                key={`${elementKey}-name`}
                error={!isValidName}
                value={pair.name || ""}
                onChange={(e) => {
                  onChange(e.target.value, idx, "name");
                }}
                label="Name"
                autoFocus
                disabled={readOnly === true}
                data-test-id={`${testId}-env-var-name`}
                data-test-title={`${testId}-env-var-${pair.name}-name`}
              />
            </Tooltip>
            <TextField
              key={`${elementKey}-value`}
              value={pair.value || ""}
              onChange={(e) => onChange(e.target.value, idx, "value")}
              label="Value"
              disabled={readOnly === true}
              data-test-id={`${testId}-env-var-value`}
              data-test-title={`${testId}-env-var-${pair.name}-value`}
            />
            {!readOnly && (
              <IconButton title="Delete entry" onClick={() => remove(idx)}>
                <DeleteIcon />
              </IconButton>
            )}
          </Stack>
        );
      })}
      {!readOnly && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          color="secondary"
          onClick={onAdd}
          data-test-id={`${testId}-env-var-add`}
        >
          Create new variable
        </Button>
      )}
    </Stack>
  );
};

export default EnvVarList;
