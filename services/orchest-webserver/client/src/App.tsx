import React, { useRef } from "react";
import { makeRequest } from "@orchest/lib-utils";

import { useOrchest } from "@/hooks/orchest";

import Dialogs from "./components/Dialogs";
import HeaderBar from "./components/HeaderBar";
import MainDrawer from "./components/MainDrawer";
import Jupyter from "./jupyter/Jupyter";

import PipelineSettingsView from "./views/PipelineSettingsView";
import PipelineView from "./views/PipelineView";
import ProjectsView from "./views/ProjectsView";
import JupyterLabView from "./views/JupyterLabView";

import {
  nameToComponent,
  componentName,
  generateRoute,
  decodeRoute,
  pascalCaseToCapitalized,
  loadIntercom,
} from "./utils/webserver-utils";
import EnvironmentsView from "./views/EnvironmentsView";
import PipelinesView from "./views/PipelinesView";
import JobsView from "./views/JobsView";

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
  const [view, setView] = React.useState(null);
  const [state, setState] = React.useState<{
    activeViewName: string;
    ViewComponent: React.FunctionComponent;
    dynamicProps: Record<string, unknown>;
  }>({
    activeViewName: "",
    dynamicProps: null,
    ViewComponent: null,
  });

  const context = useOrchest();

  const jupyterRef = useRef(null);
  const dialogsRef = useRef(null);

  const KEEP_PIPELINE_VIEWS = [
    PipelineView,
    PipelineSettingsView,
    JupyterLabView,
  ];
  const INJECT_PROJECT_UUID_VIEWS = [EnvironmentsView, PipelinesView, JobsView];

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

  window.onpopstate = (event) => {
    if (event.state !== null) {
      context.dispatch({
        type: "setLoadViewSpec",
        payload: {
          TagName: nameToComponent(event.state.viewName),
          dynamicProps: event.state.dynamicProps,
          isOnPopState: true,
        },
      });
    }
  };

  React.useEffect(() => {
    if (context.state.loadViewSpec === undefined) return;

    const {
      TagName,
      dynamicProps,
      isOnPopState,
      onCancelled,
    } = context.state.loadViewSpec;

    const conditionalBody = () => {
      if (!isOnPopState) {
        // This public loadView sets the state through the
        // history API.

        let [pathname, search] = generateRoute(TagName, dynamicProps);

        // Because pushState objects need to be serialized,
        // we need to store the string representation of the TagName.
        let viewName = componentName(TagName);
        window.history.pushState(
          {
            viewName,
            dynamicProps,
          },
          "",
          pathname + search
        );

        /* `title` argument for pushState was deprecated,
        document.title should be used instead. */
        window.document.title =
          pascalCaseToCapitalized(viewName.replace("View", "")) + " · Orchest";
      }

      _loadView(TagName, dynamicProps);
    };

    if (!context.state.unsavedChanges) {
      conditionalBody();
    } else {
      confirm(
        "Warning",
        "There are unsaved changes. Are you sure you want to navigate away?",
        () => {
          context.dispatch({ type: "setUnsavedChanges", payload: false });
          conditionalBody();
        },
        onCancelled
      );
    }
  }, [context?.state.loadViewSpec]);

  const _loadView = (ViewComponent: React.FunctionComponent, dynamicProps) => {
    let viewName = componentName(ViewComponent);

    // Analytics call
    sendEvent("view load", { name: viewName });

    if (config["CLOUD"] === true && window.Intercom !== undefined) {
      window.Intercom("update");
    }

    if (KEEP_PIPELINE_VIEWS.indexOf(ViewComponent) === -1) {
      context.dispatch({ type: "pipelineClear" });
    }

    // select menu if menu tag is selected
    setState((prevState) => ({
      ...prevState,
      ViewComponent,
      dynamicProps,
      activeViewName: viewName,
    }));
  };

  const _generateView = (
    ViewComponent: React.FunctionComponent<{ project_uuid: string }>,
    dynamicProps: Record<string, unknown>
  ) => {
    return (
      <ViewComponent
        {...dynamicProps}
        {...(INJECT_PROJECT_UUID_VIEWS.indexOf(ViewComponent) !== -1 && {
          project_uuid: context.state.project_uuid,
        })}
      />
    );
  };

  const loadView = (
    TagName: React.FunctionComponent,
    dynamicProps = {},
    onCancelled?: () => void
  ) => {
    context.dispatch({
      type: "setLoadViewSpec",
      payload: {
        TagName,
        dynamicProps,
        isOnPopState: false,
        onCancelled,
      },
    });
  };

  const loadDefaultView = () => {
    // if request view doesn't load, load default route
    loadView(ProjectsView);
  };

  const initializeFirstView = () => {
    // handle default
    if (location.pathname == "/") {
      loadDefaultView();
    } else {
      try {
        let [TagName, dynamicProps] = decodeRoute(
          location.pathname,
          location.search
        );
        loadView(TagName, dynamicProps);
      } catch (error) {
        loadDefaultView();
      }
    }
  };

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

  const getProject = () => {
    return new Promise((resolve, reject) => {
      // Use this to get the currently selected project outside
      // of a view that consumes it as props.
      // E.g. in the pipeline view that loads the selected project's
      // pipeline when no query arguments are passed.
      if (context.state.project_uuid) {
        resolve(context.state.project_uuid);
      } else {
        // No project selected yet, fetch from server
        makeRequest(
          "GET",
          "/async/projects?skip_discovery=true&session_counts=false"
        )
          .then((result) => {
            let projects = JSON.parse(result as string);
            if (projects.length == 0) {
              resolve(undefined);
            } else {
              resolve(projects[0].uuid);
            }
          })
          .catch(() => {
            reject();
          });
      }
    });
  };

  React.useEffect(() => {
    setJupyter(new Jupyter(jupyterRef.current));
    initializeFirstView();
  }, []);

  window.orchest = {
    config,
    loadView,
    alert,
    confirm,
    requestBuild,
    getProject,
    jupyter,
  };

  React.useEffect(() => {
    if (state.ViewComponent)
      setView(_generateView(state.ViewComponent, state.dynamicProps));
  }, [state, context?.state?.project_uuid]);

  return (
    <>
      <HeaderBar />
      <div className="app-container" data-test-id="app">
        <MainDrawer selectedElement={state.activeViewName} />
        <main className="main-content" id="main-content">
          {view || null}
          <div ref={jupyterRef} className="persistent-view jupyter hidden" />
        </main>
      </div>
      <div className="dialogs">
        <Dialogs ref={dialogsRef} />
      </div>
    </>
  );
};

export default App;
