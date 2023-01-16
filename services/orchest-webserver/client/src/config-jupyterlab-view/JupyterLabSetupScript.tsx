import "codemirror/mode/shell/shell";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import { useJupyterLabSetupScript } from "./hooks/useJupyterLabSetupScript";

type JupyterLabSetupScriptProps = {
  readOnly: boolean;
};

export const JupyterLabSetupScript = ({
  readOnly,
}: JupyterLabSetupScriptProps) => {
  const {
    setValue: setJupyterSetupScript,
    setAsDirtyOnBlur,
    value: jupyterSetupScript,
    isLoading,
  } = useJupyterLabSetupScript();
  return (
    <CodeMirror
      value={jupyterSetupScript}
      options={{
        mode: "application/x-sh",
        theme: "dracula",
        lineNumbers: true,
        viewportMargin: Infinity,
        readOnly: readOnly || isLoading,
      }}
      onBeforeChange={(editor, data, value) => {
        setJupyterSetupScript(value);
      }}
      onBlur={(_, event) => {
        setAsDirtyOnBlur()(event);
      }}
    />
  );
};
