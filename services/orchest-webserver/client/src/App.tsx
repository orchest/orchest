import { Routes } from "@/Routes";
import Box from "@mui/material/Box";
import { enableMapSet } from "immer";
import React from "react";
import { Prompt } from "react-router-dom";
import { CommandPalette } from "./components/CommandPalette";
import { OnboardingDialog } from "./components/layout/legacy/OnboardingDialog";
import { SystemDialog } from "./components/SystemDialog";
import { useGlobalContext } from "./contexts/GlobalContext";
import { HeaderBar } from "./header-bar/HeaderBar";
import { useOnAppStart } from "./hooks/useOnAppStart";
import Jupyter from "./jupyter/Jupyter";

enableMapSet();

const App = () => {
  useOnAppStart();

  const [jupyter, setJupyter] = React.useState<Jupyter | null>(null);
  const { setConfirm } = useGlobalContext();

  // load server side config populated by flask template
  const {
    state: { hasUnsavedChanges },
  } = useGlobalContext();

  const jupyterRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (jupyterRef.current)
      setJupyter(new Jupyter(jupyterRef.current, setConfirm));
  }, [setConfirm]);

  window.orchest = {
    jupyter,
  };

  return (
    <>
      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <HeaderBar />
        <Box
          component="main"
          sx={{
            flex: 1,
            overflow: "hidden",
            position: "relative",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
          id="main-content"
          data-test-id="app"
        >
          <Routes />
          <div ref={jupyterRef} className="persistent-view jupyter hidden" />
        </Box>
      </Box>
      <Prompt when={hasUnsavedChanges} message="hasUnsavedChanges" />
      <SystemDialog />
      <OnboardingDialog />
      <CommandPalette />
    </>
  );
};

export default App;
