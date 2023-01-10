import { useRequireRestart } from "@/api/system-config/useOrchestConfigsApi";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import "codemirror/mode/javascript/javascript";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import { useUserConfig } from "./hooks/useUserConfig";

export const UserConfig = () => {
  const {
    error,
    isDirty,
    setAsDirtyOnBlur,
    setValue: setUserConfig,
    value: userConfig,
    prettify,
  } = useUserConfig();
  const requireRestart = useRequireRestart(
    (state) => state.requireRestart || []
  );

  return (
    <Stack direction="column" alignItems="flex-start" spacing={1}>
      <Typography variant="h6">Custom configuration</Typography>
      <CodeMirror
        value={userConfig || ""}
        options={{
          mode: "application/json",
          theme: "jupyter",
          lineNumbers: true,
        }}
        onBeforeChange={(editor, data, value) => {
          setUserConfig(value);
        }}
        onBlur={(_, event) => {
          prettify();
          setAsDirtyOnBlur()(event);
        }}
      />
      <Stack
        direction="row"
        spacing={3}
        sx={{
          marginTop: (theme) => theme.spacing(1),
          marginBottom: (theme) => theme.spacing(1),
        }}
      >
        {isDirty && error && <Alert severity="warning">{String(error)}</Alert>}
        {!error && requireRestart.length > 0 && (
          <Alert severity="info">{`Restart Orchest for the changes to ${requireRestart
            .map((val) => `"${val}"`)
            .join(" ")} to take effect.`}</Alert>
        )}
      </Stack>
    </Stack>
  );
};
