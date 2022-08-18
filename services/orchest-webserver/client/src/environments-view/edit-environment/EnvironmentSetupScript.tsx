import { CodeMirror } from "@/components/common/CodeMirror";
import Typography from "@mui/material/Typography";
import "codemirror/theme/dracula.css";
import React from "react";
import { isEnvironmentBuilding } from "../common";
import { useEditEnvironment } from "../stores/useEditEnvironment";
import {
  EnvironmentsAccordion,
  EnvironmentsAccordionDetails,
  EnvironmentsAccordionSummary,
} from "./components/EnvironmentsAccordion";
import { useEnvironmentsUiStateStore } from "./stores/useEnvironmentsUiStateStore";

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
  const {
    isSetupScriptOpen,
    setIsSetupScriptOpen,
  } = useEnvironmentsUiStateStore();
  const { environmentChanges, setEnvironmentChanges } = useEditEnvironment();

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
    <EnvironmentsAccordion
      expanded={isSetupScriptOpen}
      onChange={handleChangeIsOpen}
    >
      <EnvironmentsAccordionSummary
        aria-controls="setup-script"
        id="setup-script-header"
      >
        <Typography component="h5" variant="h6">
          Setup script
        </Typography>
      </EnvironmentsAccordionSummary>
      <EnvironmentsAccordionDetails>
        <SetupScriptCodeMirror
          onChange={handleChangeSetupScript}
          value={environmentChanges?.setup_script}
          isReadOnly={isEnvironmentBuilding(environmentChanges?.latestBuild)}
        />
      </EnvironmentsAccordionDetails>
    </EnvironmentsAccordion>
  );
};
