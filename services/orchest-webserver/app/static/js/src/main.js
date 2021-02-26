import { MDCTopAppBar } from "@material/top-app-bar";
import { MDCDrawer } from "@material/drawer";

import $ from "jquery";
window.$ = $;

import "./utils/overflowing";
import Dialogs from "./components/Dialogs";
import HeaderButtons from "./components/HeaderButtons";
import Jupyter from "./jupyter/Jupyter";
import PipelineSettingsView from "./views/PipelineSettingsView";
import PipelineView from "./views/PipelineView";
import React from "react";
import ReactDOM from "react-dom";

import { PersistentLocalConfig, makeRequest } from "./lib/utils/all";
import {
  nameToComponent,
  componentName,
  generateRoute,
  decodeRoute,
  getViewDrawerParentViewName,
  pascalCaseToCapitalized,
} from "./utils/webserver-utils";
import ProjectsView from "./views/ProjectsView";
import JupyterLabView from "./views/JupyterLabView";

function Orchest() {
  // load server side config populated by flask template
  this.config = {};
  this.config = JSON.parse(window.ORCHEST_CONFIG);

  this.environment = "production";
  if (this.config["FLASK_ENV"] == "development") {
    this.environment = "development";
  }

  console.log("Orchest is running in environment: " + this.environment);

  this.reactRoot = document.querySelector(".react-view-root");

  this.browserConfig = new PersistentLocalConfig("orchest");

  const drawer = MDCDrawer.attachTo(document.getElementById("main-drawer"));

  function setDrawerSelectedIndex(drawer, viewName) {
    // resolve mapped parent view
    viewName = getViewDrawerParentViewName(viewName);

    for (let x = 0; x < drawer.list.listElements.length; x++) {
      let listElement = drawer.list.listElements[x];
      let elementViewName = listElement.attributes.getNamedItem(
        "data-react-view"
      ).value;

      if (viewName === elementViewName) {
        drawer.list.selectedIndex = x;
      }
    }
  }

  // create Jupyter manager
  this.jupyter = new Jupyter($(".persistent-view.jupyter"));

  // mount titlebar component
  this.headerBar = document.querySelector(".header-bar-interactive");
  this.headerBarComponent = ReactDOM.render(<HeaderButtons />, this.headerBar);

  drawer.list.singleSelection = true;

  this.drawer = drawer;

  drawer.listen("MDCList:action", (e) => {
    let selectedIndex = e.detail.index;

    let listElement = drawer.list.listElements[selectedIndex];

    if (listElement.attributes.getNamedItem("data-react-view")) {
      let viewName = listElement.attributes.getNamedItem("data-react-view");
      if (viewName) {
        viewName = viewName.value;
        this.loadView(nameToComponent(viewName));
      }
    }
  });

  this.sendEvent = function (event, properties) {
    if (!orchest.config["TELEMETRY_DISABLED"]) {
      makeRequest("POST", "/analytics", {
        type: "json",
        content: {
          event: event,
          properties: properties,
        },
      });
    }
  };

  this.activeView = undefined;
  this._loadView = function (TagName, dynamicProps) {
    let viewName = componentName(TagName);
    this.activeView = viewName;

    // Analytics call
    this.sendEvent("view load", { name: viewName });

    if (
      TagName !== PipelineView &&
      TagName !== PipelineSettingsView &&
      TagName !== JupyterLabView
    ) {
      this.headerBarComponent.clearPipeline();
    }

    // select menu if menu tag is selected
    setDrawerSelectedIndex(this.drawer, viewName);

    ReactDOM.render(<TagName {...dynamicProps} />, this.reactRoot);
  };

  this.setUnsavedChanges = (unsavedChanges) => {
    if (unsavedChanges) {
      // Enable navigation prompt
      window.onbeforeunload = function () {
        return true;
      };
    } else {
      // Remove navigation prompt
      window.onbeforeunload = null;
    }

    this.unsavedChanges = unsavedChanges;
  };

  this.setUnsavedChanges(false);

  this.loadView = function (TagName, dynamicProps, onCancelled) {
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

      this._loadView(TagName, dynamicProps);
    };

    if (!this.unsavedChanges) {
      conditionalBody();
    } else {
      this.confirm(
        "Warning",
        "There are unsaved changes. Are you sure you want to navigate away?",
        () => {
          this.setUnsavedChanges(false);
          conditionalBody();
        },
        onCancelled
      );
    }
  };

  window.onpopstate = (event) => {
    if (event.state !== null) {
      let conditionalBody = () => {
        this._loadView(
          nameToComponent(event.state.viewName),
          event.state.dynamicProps
        );
      };

      if (!this.unsavedChanges) {
        conditionalBody();
      } else {
        this.confirm(
          "Warning",
          "There are unsaved changes. Are you sure you want to navigate away?",
          () => {
            this.setUnsavedChanges(false);
            conditionalBody();
          }
        );
      }
    }
  };

  this.initializeFirstView = function () {
    // handle default
    if (location.pathname == "/") {
      this.loadDefaultView();
    }
    try {
      let [TagName, dynamicProps] = decodeRoute(
        location.pathname,
        location.search
      );
      this.loadView(TagName, dynamicProps);
    } catch (error) {
      this.loadDefaultView();
    }
  };

  this.loadDefaultView = function () {
    // if request view doesn't load, load default route
    this.loadView(ProjectsView);
  };

  const topAppBar = MDCTopAppBar.attachTo(document.getElementById("app-bar"));
  topAppBar.setScrollTarget(document.getElementById("main-content"));
  topAppBar.listen("MDCTopAppBar:nav", () => {
    window.localStorage.setItem("topAppBar.open", "" + !drawer.open);

    drawer.open = !drawer.open;
  });

  drawer.listen("MDCDrawer:opened", () => {
    document.body.focus();
  });

  // persist nav menu to localStorage
  if (window.localStorage.getItem("topAppBar.open") !== null) {
    if (window.localStorage.getItem("topAppBar.open") === "true") {
      drawer.open = true;
    } else {
      drawer.open = false;
    }
  } else {
    // default drawer state is open
    drawer.open = true;
  }

  // to embed an <iframe> in the main application as a first class citizen (with state) there needs to be a
  // persistent element on the page. It will only be created when the JupyterLab UI is first requested.
  this.dialogHolder = document.querySelector(".dialogs");

  // avoid anchor link clicking default behavior
  $("a[href='#']").on("click", (e) => {
    e.preventDefault();
  });

  let dialogs = ReactDOM.render(<Dialogs />, this.dialogHolder);

  this.alert = function (title, content, onClose) {
    // Analytics call
    this.sendEvent("alert show", { title: title, content: content });

    dialogs.alert(title, content, onClose);
  };
  this.confirm = function (title, content, onConfirm, onCancel) {
    // Analytics call
    this.sendEvent("confirm show", { title: title, content: content });

    dialogs.confirm(title, content, onConfirm, onCancel);
  };

  this.requestBuild = function (
    project_uuid,
    environmentValidationData,
    requestedFromView,
    onBuildComplete,
    onCancel
  ) {
    // Analytics call
    this.sendEvent("build-request request", {
      requestedFromView: requestedFromView,
    });

    dialogs.requestBuild(
      project_uuid,
      environmentValidationData,
      requestedFromView,
      onBuildComplete,
      onCancel
    );
  };
}

window.orchest = new Orchest();
window.orchest.initializeFirstView();
