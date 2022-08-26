import { AccordionDetails, AccordionSummary } from "@/components/Accordion";
import { CodeMirror } from "@/components/common/CodeMirror";
import Typography from "@mui/material/Typography";
import "codemirror/theme/dracula.css";
import React from "react";
import { isEnvironmentBuilding } from "../common";
import { useEditEnvironment } from "../stores/useEditEnvironment";
import {
  EnvironmentAccordion,
  useSetupScriptAccordion,
} from "./components/EnvironmentAccordion";

type SetupScriptCodeMirrorProps = {
  value?: string;
  isReadOnly?: boolean;
  onChange: (value: string) => void;
};

const SetupScriptCodeMirror = React.memo(function SetupScriptCodeMirror({
  value = "",
  onChange,
  isReadOnly,
}: SetupScriptCodeMirrorProps) {
  return (
    <CodeMirror
      value={value}
      onBeforeChange={(_, __, newValue) => onChange(newValue)}
      options={{
        mode: "application/x-sh",
        theme: "dracula",
        lineNumbers: true,
        viewportMargin: Infinity,
        readOnly: isReadOnly,
      }}
    />
  );
});

export const EnvironmentSetupScript = () => {
  const [isSetupScriptOpen, setIsSetupScriptOpen] = useSetupScriptAccordion();

  const setupScript = useEditEnvironment(
    (state) => state.environmentChanges?.setup_script
  );
  const latestBuild = useEditEnvironment(
    (state) => state.environmentChanges?.latestBuild
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

  const handleChangeIsOpen = (
    event: React.SyntheticEvent,
    isExpanded: boolean
  ) => {
    setIsSetupScriptOpen(isExpanded);
  };

  return (
    <EnvironmentAccordion
      expanded={isSetupScriptOpen}
      onChange={handleChangeIsOpen}
    >
      <AccordionSummary aria-controls="setup-script" id="setup-script-header">
        <Typography component="h5" variant="h6">
          Setup script
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <SetupScriptCodeMirror
          onChange={handleChangeSetupScript}
          value={setupScript}
          isReadOnly={isEnvironmentBuilding(latestBuild)}
        />
      </AccordionDetails>
    </EnvironmentAccordion>
  );
};
