import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Typography from "@mui/material/Typography";
import "codemirror/mode/shell/shell";
import "codemirror/theme/dracula.css";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import { isEnvironmentBuilding } from "../common";
import { useEnvironmentOnEdit } from "../stores/useEnvironmentOnEdit";
import {
  EnvironmentsAccordion,
  EnvironmentsAccordionDetails,
  EnvironmentsAccordionSummary,
} from "./components/EnvironmentsAccordion";
import { useEnvironmentsUiStateStore } from "./stores/useEnvironmentsUiStateStore";

export const EnvironmentSetupScript = () => {
  const {
    isSetupScriptOpen,
    setIsSetupScriptOpen,
  } = useEnvironmentsUiStateStore();
  const { environmentOnEdit, setEnvironmentOnEdit } = useEnvironmentOnEdit();

  const onChange = (value: string) => {
    setEnvironmentOnEdit({ setup_script: value });
  };

  const handleChange = (event: React.SyntheticEvent, isExpanded: boolean) => {
    setIsSetupScriptOpen(isExpanded);
  };

  return (
    <EnvironmentsAccordion expanded={isSetupScriptOpen} onChange={handleChange}>
      <EnvironmentsAccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="setup-script"
        id="setup-script-header"
      >
        <Typography component="h5" variant="h6">
          Setup script
        </Typography>
      </EnvironmentsAccordionSummary>
      <EnvironmentsAccordionDetails>
        <CodeMirror
          value={environmentOnEdit?.setup_script || ""}
          onBeforeChange={(_, __, value) => onChange(value)}
          options={{
            mode: "application/x-sh",
            theme: "dracula",
            lineNumbers: true,
            viewportMargin: Infinity,
            readOnly: isEnvironmentBuilding(environmentOnEdit?.latestBuild),
          }}
        />
      </EnvironmentsAccordionDetails>
    </EnvironmentsAccordion>
  );
};
