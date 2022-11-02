import AddIcon from "@mui/icons-material/Add";
import Button from "@mui/material/Button";
import Stack, { StackProps } from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import produce from "immer";
import React from "react";
import { EnvVarInput } from "./EnvVarInput";

export type EnvVarPair = { name: string; value: string };

export type EnvVarListProps = StackProps & {
  variables: EnvVarPair[];
  setValue?: (
    callback: (
      currentValue: EnvVarPair[] | undefined
    ) => EnvVarPair[] | undefined
  ) => void;
  readOnly?: boolean;
};

export const EnvVarList = ({
  variables,
  readOnly,
  setValue: onChange,
  ...stackProps
}: EnvVarListProps) => {
  const update = React.useCallback(
    (index: number, name: string, value: string) =>
      onChange?.((current) => {
        if (!current) return current;

        return produce(current, (draft) => {
          draft[index] = { name, value };
        });
      }),
    [onChange]
  );

  const add = () =>
    onChange?.((current) => [...(current || []), { name: "", value: "" }]);

  const remove = (index: number) => {
    onChange?.((current) => {
      if (!current) return [];
      if (index < 0 || index >= current.length) return current;
      return [...current.slice(0, index), ...current.slice(index + 1)];
    });
  };

  return (
    <Stack
      direction="column"
      spacing={3}
      alignItems="flex-start"
      {...stackProps}
    >
      {variables.length === 0 && readOnly && (
        <Typography>
          <i>No environment variables have been defined.</i>
        </Typography>
      )}
      {variables.map((variable, index) => (
        <EnvVarInput
          {...variable}
          key={index}
          disabled={readOnly}
          onChange={(name, value) => update(index, name, value)}
          onRemove={() => remove(index)}
          revealed={!Boolean(variable.value)}
        />
      ))}
      {!readOnly && (
        <Button startIcon={<AddIcon />} color="primary" onClick={add}>
          New variable
        </Button>
      )}
    </Stack>
  );
};
