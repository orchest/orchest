import { CodeMirror } from "@/components/common/CodeMirror";
import Typography from "@mui/material/Typography";

import "codemirror/theme/dracula.css";
import React from "react";

import { isEnvironmentBuilding } from "../common";
import { useEnvironmentOnEdit } from "../stores/useEnvironmentOnEdit";
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
  const { environmentOnEdit, setEnvironmentOnEdit } = useEnvironmentOnEdit();

  const handleChangeSetupScript = React.useCallback(
    (value: string) => {
      setEnvironmentOnEdit({ setup_script: value });
    },
    [setEnvironmentOnEdit]
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
        isExpanded={isSetupScriptOpen}
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
          value={environmentOnEdit?.setup_script}
          isReadOnly={isEnvironmentBuilding(environmentOnEdit?.latestBuild)}
        />
      </EnvironmentsAccordionDetails>
    </EnvironmentsAccordion>
  );
};
