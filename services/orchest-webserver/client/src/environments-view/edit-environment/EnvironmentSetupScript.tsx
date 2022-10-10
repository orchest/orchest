import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import { CodeMirror } from "@/components/common/CodeMirror";
import LockOutlined from "@mui/icons-material/LockOutlined";
import Box from "@mui/material/Box";
import { grey } from "@mui/material/colors";
import Typography from "@mui/material/Typography";
import "codemirror/mode/shell/shell";
import "codemirror/theme/dracula.css";
import React from "react";
import { isEnvironmentBuilding } from "../common";
import { useEditEnvironment } from "../stores/useEditEnvironment";

type SetupScriptCodeMirrorProps = {
  value?: string;
  locked?: boolean;
  onChange: (value: string) => void;
};

const SetupScriptCodeMirror = React.memo(function SetupScriptCodeMirror({
  value = "",
  onChange,
  locked,
}: SetupScriptCodeMirrorProps) {
  return (
    <Box
      sx={{
        position: "relative",
        ".CodeMirror-scroll": {
          opacity: locked ? 0.5 : undefined,
        },
        ".CodeMirror-lines": {
          cursor: locked ? "not-allowed" : undefined,
        },
      }}
    >
      <CodeMirror
        locked={locked}
        value={value}
        onBeforeChange={(_, __, newValue) => onChange(newValue)}
        options={{
          mode: "application/x-sh",
          theme: "dracula",
          lineNumbers: true,
          readOnly: locked,
          viewportMargin: Infinity,
        }}
      />
      {locked && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            right: 0,
            padding: 2,
            pointerEvents: "none",
          }}
        >
          <LockOutlined style={{ fill: grey[200] }} fontSize="small" />
        </Box>
      )}
    </Box>
  );
});

export const EnvironmentSetupScript = () => {
  const setupScript = useEditEnvironment(
    (state) => state.environmentChanges?.setup_script
  );
  const latestBuildStatus = useEditEnvironment(
    (state) => state.environmentChanges?.latestBuild?.status
  );
  const setEnvironmentChanges = useEditEnvironment(
    (state) => state.setEnvironmentChanges
  );

  const handleChangeSetupScript = React.useCallback(
    (value: string) => {
      setEnvironmentChanges({ setup_script: value });
    },
    [setEnvironmentChanges]
  );

  const isBuilding = isEnvironmentBuilding(latestBuildStatus);

  return (
    <Accordion defaultExpanded>
      <AccordionSummary aria-controls="setup-script" id="setup-script-header">
        <Typography component="h5" variant="h6">
          Setup script {isBuilding ? "(read-only)" : ""}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <SetupScriptCodeMirror
          onChange={handleChangeSetupScript}
          value={setupScript}
          locked={isBuilding}
        />
      </AccordionDetails>
    </Accordion>
  );
};
