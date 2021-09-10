import React, { useRef } from "react";
import { makeRequest } from "@orchest/lib-utils";

import { BrowserRouter as Router } from "react-router-dom";

import { useOrchest } from "@/hooks/orchest";

import Dialogs from "./components/Dialogs";
import HeaderBar from "./components/HeaderBar";
import MainDrawer from "./components/MainDrawer";
import Jupyter from "./jupyter/Jupyter";

import { Routes } from "@/Routes";

import { loadIntercom } from "./utils/webserver-utils";

import $ from "jquery";

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

  const context = useOrchest();

  const jupyterRef = useRef(null);
  const dialogsRef = useRef(null);

  // load server side config populated by flask template
  const { config } = context.state;

  React.useEffect(() => {
    if (config.FLASK_ENV === "development") {
      console.log("Orchest is running with --dev.");
    }

    if (config.CLOUD === true) {
      console.log("Orchest is running with --cloud.");

      loadIntercom(
        config["INTERCOM_APP_ID"],
        config["INTERCOM_USER_EMAIL"],
        config["INTERCOM_DEFAULT_SIGNUP_DATE"]
      );
    }
  }, [config]);

  const sendEvent = function (event, properties) {
    if (!context.state.config["TELEMETRY_DISABLED"]) {
      makeRequest("POST", "/analytics", {
        type: "json",
        content: {
          event: event,
          properties: properties,
        },
      });
    }
  };

  // TODO:
  // [] unsaved changes
  // [x]] document.title
  // [] send analytic events
  // [] alert modal
  // [] confirm modal

  const alert = (title, content, onClose) => {
    // Analytics call
    sendEvent("alert show", { title: title, content: content });

    dialogsRef.current.alert(title, content, onClose);
  };

  const confirm = (title, content, onConfirm, onCancel?) => {
    // Analytics call
    sendEvent("confirm show", { title: title, content: content });

    dialogsRef.current.confirm(title, content, onConfirm, onCancel);
  };

  const requestBuild = (
    project_uuid: string,
    environmentValidationData,
    requestedFromView,
    onBuildComplete,
    onCancel: () => void
  ) => {
    // Analytics call
    sendEvent("build request", {
      requestedFromView: requestedFromView,
    });

    dialogsRef.current.requestBuild(
      project_uuid,
      environmentValidationData,
      requestedFromView,
      onBuildComplete,
      onCancel
    );
  };

  React.useEffect(() => {
    setJupyter(new Jupyter(jupyterRef.current));
  }, []);

  window.orchest = {
    config,
    alert,
    confirm,
    requestBuild,
    jupyter,
  };

  return (
    <Router>
      <HeaderBar />
      <div className="app-container" data-test-id="app">
        <MainDrawer />
        <main className="main-content" id="main-content">
          <Routes />
          <div ref={jupyterRef} className="persistent-view jupyter hidden" />
        </main>
      </div>
      <div className="dialogs">
        <Dialogs ref={dialogsRef} />
      </div>
    </Router>
  );
};

export default App;
