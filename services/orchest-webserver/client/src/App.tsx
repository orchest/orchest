import { useInterval } from "@/hooks/use-interval";
import { Routes } from "@/Routes";
import { makeRequest } from "@orchest/lib-utils";
import $ from "jquery";
import React, { useRef } from "react";
import { BrowserRouter as Router, Prompt } from "react-router-dom";
import { useIntercom } from "react-use-intercom";
import BuildPendingDialog from "./components/BuildPendingDialog";
import CommandPalette from "./components/CommandPalette";
import HeaderBar from "./components/HeaderBar";
import MainDrawer from "./components/MainDrawer";
import { SystemDialog } from "./components/SystemDialog";
import { useAppContext } from "./contexts/AppContext";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useSendAnalyticEvent } from "./hooks/useSendAnalyticEvent";
import Jupyter from "./jupyter/Jupyter";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
$.fn.overflowing = function () {
  let overflowed = false;

  this.each(function () {
    let el = $(this)[0];

    if (el.offsetHeight < el.scrollHeight || el.offsetWidth < el.scrollWidth) {
      overflowed = true;
    } else {
      overflowed = false;
    }
  });

  return overflowed;
};

window.$ = $;

const App = () => {
  const [jupyter, setJupyter] = React.useState(null);
  const { boot } = useIntercom();
  const [isDrawerOpen, setIsDrawerOpen] = useLocalStorage("drawer", true);
  const { setConfirm } = useAppContext();

  const toggleDrawer = () => setIsDrawerOpen((currentValue) => !currentValue);

  const sendEvent = useSendAnalyticEvent();

  // load server side config populated by flask template
  const {
    state: { config, user_config, hasUnsavedChanges },
    setAsSaved,
  } = useAppContext();

  const jupyterRef = useRef(null);
  const dialogsRef = useRef(null);

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
    }
  }, [config, user_config]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    setJupyter(new Jupyter(jupyterRef.current, setConfirm));
  }, []);

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
            () => {
              setAsSaved();
              callback(true);
            }
          );
        }
      }}
    >
      <Prompt when={hasUnsavedChanges} message="hasUnsavedChanges" />
      <HeaderBar toggleDrawer={toggleDrawer} />
      <div className="app-container" data-test-id="app">
        <MainDrawer isOpen={isDrawerOpen} />
        <main className="main-content" id="main-content">
          <Routes />
          <div ref={jupyterRef} className="persistent-view jupyter hidden" />
        </main>
      </div>
      <SystemDialog />
      <BuildPendingDialog />
      <CommandPalette />
    </Router>
  );
};

export default App;
