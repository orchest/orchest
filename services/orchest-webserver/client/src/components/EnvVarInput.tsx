import { isValidEnvironmentVariableName } from "@/utils/webserver-utils";
import { VisibilityOffOutlined, VisibilityOutlined } from "@mui/icons-material";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import { InputAdornment } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import React from "react";

export type EnvVarInputProps = {
  /** The current environment variable name. */
  name: string;
  /** The current environment variable value.  */
  value: string;
  /** Disables both inputs. */
  disabled?: boolean;
  /** If true: the value is displayed as plain text, otherwise; a password. */
  revealed?: boolean;
  /** Called when name or value input is updated. */
  onChange: (name: string, value: string) => void;
  /** Called when the "remove"-button is clicked. */
  onRemove: () => void;
};

export const EnvVarInput = ({
  name,
  value,
  onChange,
  onRemove,
  revealed: initiallyRevealed = false,
  disabled: readOnly = false,
}: EnvVarInputProps) => {
  const isValidName = !name || isValidEnvironmentVariableName(name);
  const [revealed, setRevealed] = React.useState(initiallyRevealed);

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{ maxWidth: "40rem" }}
    >
      <Tooltip
        title="Must be alphanumeric characters mixed with underscores or hyphens"
        open={!isValidName}
        arrow
      >
        <TextField
          label="Name"
          value={name}
          onChange={({ target }) => onChange(target.value, value)}
          error={!isValidName}
          disabled={readOnly}
          data-test-id={`environment-variable-input-${name}-name`}
        />
      </Tooltip>
      <TextField
        label="Value"
        value={value}
        type={revealed ? "text" : "password"}
        onChange={({ target }) => onChange(name, target.value)}
        disabled={readOnly}
        data-test-id={`environment-variable-input-${name}-value`}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={() => setRevealed(!revealed)}>
                {revealed ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      {!readOnly && (
        <IconButton title="Delete variable" onClick={() => onRemove()}>
          <DeleteOutline />
        </IconButton>
      )}
    </Stack>
  );
};
