// @ts-check
import * as React from "react";
import {
  makeRequest,
  PersistentLocalConfig,
  RefManager,
  uuidv4,
} from "@orchest/lib-utils";
import {
  componentName,
  decodeRoute,
  generateRoute,
  loadIntercom,
  nameToComponent,
  pascalCaseToCapitalized,
} from "@/utils/webserver-utils";
import EnvironmentsView from "@/views/EnvironmentsView";
import JobsView from "@/views/JobsView";
import JupyterLabView from "@/views/JupyterLabView";
import PipelineSettingsView from "@/views/PipelineSettingsView";
import PipelinesView from "@/views/PipelinesView";
import PipelineView from "@/views/PipelineView";
import ProjectsView from "@/views/ProjectsView";
import Jupyter from "@/jupyter/Jupyter";

/**
 * @typedef { import("./types").IOrchestContext } IOrchestContext
 * @typedef { import("./types").IOrchestProviderProps } IOrchestProviderProps
 */

/**
 * @type { React.Context<IOrchestContext> }
 */
export const OrchestContext = React.createContext(null);

/**
 * @type { (props?: {refs?: any}) => IOrchestContext }
 */
export const useOrchest = ({ refs }) => {
  const ctx = React.useContext(OrchestContext);

  return {
    ...ctx,
  };
};

/**
 */

/**
 * @type { React.FC<IOrchestContext> }
 */
export const OrchestProvider = ({ children, config, user_config }) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [unsavedChanges, setUnsavedChangesState] = React.useState(false);

  const KEEP_PIPELINE_VIEWS = [
    PipelineView,
    PipelineSettingsView,
    JupyterLabView,
  ];
  const INJECT_PROJECT_UUID_VIEWS = [EnvironmentsView, PipelinesView, JobsView];

  React.useEffect(() => {
    if (config && user_config) setIsLoading(false);
  }, [config, user_config]);

  if (config?.FLASK_ENV === "development") {
    console.log("Orchest is running with --dev.");
  }

  if (config?.CLOUD === true) {
    console.log("Orchest is running with --cloud.");

    loadIntercom(
      config.INTERCOM_APP_ID,
      config.INTERCOM_USER_EMAIL,
      config.INTERCOM_DEFAULT_SIGNUP_DATE
    );
  }

  // used in ./components/MainDrawer.jsx
  const browserConfig = new PersistentLocalConfig("orchest");

  // used only within function
  const sendEvent = (event, properties) => {
    if (!config?.TELEMETRY_DISABLED) {
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
      let conditionalBody = () => {
        _loadView(
          nameToComponent(event.state.viewName),
          event.state.dynamicProps
        );
      };

      if (!unsavedChanges) {
        conditionalBody();
      } else {
        confirm(
          "Warning",
          "There are unsaved changes. Are you sure you want to navigate away?",
          () => {
            setUnsavedChanges(false);
            conditionalBody();
          }
        );
      }
    }
  };

  // only used internally
  // load drawerOpen state
  let topAppBarOpen = browserConfig.get("topAppBar.open");

  const [state, setState] = React.useState({
    activeViewName: "",
    // Default drawer state is open.
    drawerOpen: topAppBarOpen === undefined || topAppBarOpen === "true",
    selectedProject: browserConfig.get("selected_project_uuid"),
    projectSelectorHash: uuidv4(),
    TagName: null,
    dynamicProps: null,
  });

  const refManager = new RefManager();
  const headerBarComponent = refManager.refs.headerBar;

  const _loadView = (TagName, dynamicProps) => {
    let viewName = componentName(TagName);

    // Analytics call
    sendEvent("view load", { name: viewName });

    if (config?.CLOUD === true && window.Intercom !== undefined) {
      window.Intercom("update");
    }

    if (KEEP_PIPELINE_VIEWS.indexOf(TagName) === -1) {
      headerBarComponent.clearPipeline();
    }

    // select menu if menu tag is selected
    setState((prevState) => ({
      ...prevState,
      // @ts-ignore
      TagName,
      dynamicProps,
      activeViewName: viewName,
    }));
  };

  const _generateView = (TagName, dynamicProps) => {
    // add selectedProject to ProjectBasedView
    if (INJECT_PROJECT_UUID_VIEWS.indexOf(TagName) !== -1) {
      dynamicProps.project_uuid = state.selectedProject;
    }

    return <TagName {...dynamicProps} />;
  };

  const setUnsavedChanges = (unsavedChanges) => {
    if (unsavedChanges) {
      // Enable navigation prompt
      window.onbeforeunload = function () {
        return true;
      };
    } else {
      // Remove navigation prompt
      window.onbeforeunload = null;
    }

    setUnsavedChangesState(unsavedChanges);
  };

  const loadView = (TagName, dynamicProps, onCancelled) => {
    // dynamicProps default
    if (!dynamicProps) {
      dynamicProps = {};
    }

    let conditionalBody = () => {
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
        /* `title` argument for pushState was deprecated, 
      document.title should be used instead. */
        "",
        pathname + search
      );

      window.document.title =
        pascalCaseToCapitalized(viewName.replace("View", "")) + " · Orchest";

      _loadView(TagName, dynamicProps);
    };

    if (!unsavedChanges) {
      conditionalBody();
    } else {
      confirm(
        "Warning",
        "There are unsaved changes. Are you sure you want to navigate away?",
        () => {
          setUnsavedChanges(false);
          conditionalBody();
        },
        onCancelled
      );
    }
  };

  const loadDefaultView = () => {
    // if request view doesn't load, load default route
    loadView(ProjectsView);
  };

  const initializeFirstView = () => {
    // handle default
    if (location.pathname == "/") {
      loadDefaultView();
    }
    try {
      let [TagName, dynamicProps] = decodeRoute(
        location.pathname,
        location.search
      );
      loadView(TagName, dynamicProps);
    } catch (error) {
      loadDefaultView();
    }
  };

  const alert = (title, content, onClose) => {
    // Analytics call
    sendEvent("alert show", { title: title, content: content });

    refManager.refs?.["dialogs"].alert(title, content, onClose);
  };

  const confirm = (title, content, onConfirm, onCancel) => {
    // Analytics call
    sendEvent("confirm show", { title: title, content: content });

    refManager.refs?.["dialogs"].confirm(title, content, onConfirm, onCancel);
  };

  const requestBuild = (
    project_uuid,
    environmentValidationData,
    requestedFromView,
    onBuildComplete,
    onCancel
  ) => {
    // Analytics call
    sendEvent("build-request request", {
      requestedFromView: requestedFromView,
    });

    refManager.refs?.["dialogs"].requestBuild(
      project_uuid,
      environmentValidationData,
      requestedFromView,
      onBuildComplete,
      onCancel
    );
  };

  React.useEffect(() => {
    // this.jupyter = new Jupyter(refManager.refs.jupyter);
    // this.headerBarComponent = refManager.refs.headerBar;
    // setUnsavedChanges(false);
    initializeFirstView();
  }, []);

  const handleToggleDrawer = () => {
    setState((prevState) => ({
      ...prevState,
      drawerOpen: !state.drawerOpen,
    }));
  };

  const handleDrawerOpen = (open) => {
    setState((prevState) => ({
      ...prevState,
      drawerOpen: open,
    }));
  };

  const setProject = (projectUUID) => {
    if (projectUUID === undefined) {
      browserConfig.remove("selected_project_uuid");
    } else {
      browserConfig.set("selected_project_uuid", projectUUID);
    }

    setState((prevState) => ({
      ...prevState,
      selectedProject: projectUUID,
    }));
  };

  const getProject = () => {
    return new Promise((resolve, reject) => {
      // Use this to get the currently selected project outside
      // of a view that consumes it as props.
      // E.g. in the pipeline view that loads the selected project's
      // pipeline when no query arguments are passed.
      if (state.selectedProject) {
        resolve(state.selectedProject);
      } else {
        // No project selected yet, fetch from server
        makeRequest(
          "GET",
          "/async/projects?skip_discovery=true&session_counts=false"
        )
          .then(
            /** @param {string} result */
            (result) => {
              let projects = JSON.parse(result);
              if (projects.length == 0) {
                resolve(undefined);
              } else {
                resolve(projects[0].uuid);
              }
            }
          )
          .catch(() => {
            reject();
          });
      }
    });
  };

  const invalidateProjects = () => {
    setState((prevState) => ({
      ...prevState,
      projectSelectorHash: uuidv4(),
    }));
  };

  let view;

  if (state.TagName) {
    view = _generateView(state.TagName, state.dynamicProps);
  }

  return (
    <OrchestContext.Provider
      value={{
        isLoading,
        config,
        user_config,
        browserConfig,
        loadView,
        alert,
        confirm,
        refManager,
        requestBuild,
        handleToggleDrawer,
        handleDrawerOpen,
        setProject,
        getProject,
        invalidateProjects,
        view,
        ...state,
      }}
    >
      {children}
    </OrchestContext.Provider>
  );
};
