import { useInterval } from "@/hooks/use-interval";
import { Routes } from "@/Routes";
import Box from "@mui/material/Box";
import OpenReplay from "@openreplay/tracker";
import { makeRequest } from "@orchest/lib-utils";
import React from "react";
import { BrowserRouter as Router, Prompt } from "react-router-dom";
import { useIntercom } from "react-use-intercom";
import BuildPendingDialog from "./components/BuildPendingDialog";
import { CommandPalette } from "./components/CommandPalette";
import { OnboardingDialog } from "./components/Layout/OnboardingDialog";
import { SystemDialog } from "./components/SystemDialog";
import { useAppContext } from "./contexts/AppContext";
import { AppInnerContextProvider } from "./contexts/AppInnerContext";
import { HeaderBar } from "./header-bar/HeaderBar";
import Jupyter from "./jupyter/Jupyter";

const App = () => {
  const [jupyter, setJupyter] = React.useState<Jupyter | null>(null);
  const { boot } = useIntercom();
  const { setConfirm } = useAppContext();

  // load server side config populated by flask template
  const {
    state: { hasUnsavedChanges },
    setAsSaved,
    config,
    user_config,
  } = useAppContext();

  const jupyterRef = React.useRef<HTMLDivElement>(null);

  // Each client provides an heartbeat, used for telemetry and idle
  // checking.
  useInterval(() => {
    makeRequest("GET", "/heartbeat");
  }, 5000);

  React.useEffect(() => {
    if (!user_config || !config) return;

    if (config.FLASK_ENV === "development") {
      console.log("Orchest is running with --dev.");
    }

    if (config.CLOUD === true) {
      console.log("Orchest is running with --cloud.");

      boot({
        email: user_config.INTERCOM_USER_EMAIL,
        createdAt: config.INTERCOM_DEFAULT_SIGNUP_DATE,
      });

      const tracker = new OpenReplay({
        projectKey: config.OPENREPLAY_PROJECT_KEY,
        ingestPoint: config.OPENREPLAY_INGEST_POINT,
        obscureTextEmails: true,
        obscureTextNumbers: true,
        obscureInputEmails: true,
        defaultInputMode: 1,
      });
      tracker.start();
    }
  }, [config, user_config]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (jupyterRef.current)
      setJupyter(new Jupyter(jupyterRef.current, setConfirm));
  }, [setConfirm]);

  window.orchest = {
    jupyter,
  };

  return (
    <Router
      getUserConfirmation={(message, callback) => {
        // use Prompt component to intercept route changes
        // handle the blocking event here
        if (message === "hasUnsavedChanges") {
          setConfirm(
            "Warning",
            "There are unsaved changes. Are you sure you want to navigate away?",
            async (resolve) => {
              setAsSaved();
              callback(true);
              resolve(true);
              return true;
            }
          );
        }
      }}
    >
      <AppInnerContextProvider>
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
        <BuildPendingDialog />
        <OnboardingDialog />
        <CommandPalette />
      </AppInnerContextProvider>
    </Router>
  );
};

export default App;
