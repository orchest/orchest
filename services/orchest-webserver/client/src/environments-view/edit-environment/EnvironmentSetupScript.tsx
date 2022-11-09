import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import { CodeMirror } from "@/components/common/CodeMirror";
import LockOutlined from "@mui/icons-material/LockOutlined";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
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
  const script = useEditEnvironment(
    (state) => state.environmentChanges?.setup_script
  );
  const buildStatus = useEditEnvironment(
    (state) => state.environmentChanges?.latestBuild?.status
  );
  const setBuilt = useEditEnvironment((state) => state.setBuilt);
  const update = useEditEnvironment((state) => state.setEnvironmentChanges);
  const isModified = useEditEnvironment(
    (state) => script !== state.built?.setup_script
  );

  const [didRebuild, setDidRebuild] = React.useState(false);
  const [builtSuccessfully, setBuiltSuccessfully] = React.useState(true);

  React.useEffect(() => {
    if (isEnvironmentBuilding(buildStatus)) {
      setBuiltSuccessfully(false);
      setDidRebuild(true);
    } else if (buildStatus === "SUCCESS") {
      setBuiltSuccessfully(true);
    }
  }, [buildStatus]);

  React.useEffect(() => {
    if (builtSuccessfully && didRebuild) {
      setBuilt();
      setDidRebuild(false);
    }
  }, [builtSuccessfully, didRebuild, setBuilt]);

  const updateScript = React.useCallback(
    (value: string) => update({ setup_script: value }),
    [update]
  );

  console.log({ isModified });

  const isBuilding = isEnvironmentBuilding(buildStatus);

  return (
    <Accordion defaultExpanded>
      <AccordionSummary aria-controls="setup-script" id="setup-script-header">
        <Typography component="h5" variant="h6">
          Setup script
          {(isModified || isBuilding) && (
            <Chip
              sx={{ marginLeft: 1 }}
              size="small"
              label={
                isBuilding ? "Locked while building" : "Changes not yet built"
              }
            />
          )}
        </Typography>
      </AccordionSummary>

      <AccordionDetails>
        <SetupScriptCodeMirror
          onChange={updateScript}
          value={script}
          locked={isBuilding}
        />
      </AccordionDetails>
    </Accordion>
  );
};
