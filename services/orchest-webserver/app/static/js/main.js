import { MDCTopAppBar } from "@material/top-app-bar";
import { MDCDrawer } from "@material/drawer";

import $ from "jquery";
window.$ = $;

import ProjectsView from "./views/ProjectsView";
import SettingsView from "./views/SettingsView";
import HelpView from "./views/HelpView";
import ManageUsersView from "./views/ManageUsersView";
import DataSourcesView from "./views/DataSourcesView";
import FileManagerView from "./views/FileManagerView";
import DataSourceEditView from "./views/DataSourceEditView";
import JobsView from "./views/JobsView";
import PipelinesView from "./views/PipelinesView";
import EditJobView from "./views/EditJobView";
import HeaderButtons from "./components/HeaderButtons";
import React from "react";
import ReactDOM from "react-dom";
import PipelineView from "./views/PipelineView";
import Jupyter from "./jupyter/Jupyter";
import "./utils/overflowing";
import JobView from "./views/JobView";
import PipelineSettingsView from "./views/PipelineSettingsView";
import Dialogs from "./components/Dialogs";
import EnvironmentsView from "./views/EnvironmentsView";
import UpdateView from "./views/UpdateView";
import { PersistentLocalConfig, makeRequest } from "./lib/utils/all";

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

  this.viewComponents = {
    ProjectsView,
    DataSourcesView,
    FileManagerView,
    EnvironmentsView,
    DataSourceEditView,
    PipelineView,
    SettingsView,
    HelpView,
    UpdateView,
    PipelinesView,
    JobsView,
    JobView,
    EditJobView,
    ManageUsersView,
  };

  this.componentName = function (TagName) {
    for (let viewName of Object.keys(orchest.viewComponents)) {
      if (orchest.viewComponents[viewName] === TagName) {
        return viewName;
      }
    }
  };

  const drawer = MDCDrawer.attachTo(document.getElementById("main-drawer"));

  // mount titlebar component
  this.headerBar = document.querySelector(".header-bar-interactive");
  this.headerBarComponent = ReactDOM.render(<HeaderButtons />, this.headerBar);

  drawer.list.singleSelection = true;

  this.drawer = drawer;

  drawer.listen("MDCList:action", (e) => {
    let selectedIndex = e.detail.index;

    let listElement = drawer.list.listElements[selectedIndex];

    if (listElement.attributes.getNamedItem("data-react-view")) {
      let viewName = listElement.attributes.getNamedItem("data-react-view")
        .value;

      this.loadView(this.viewComponents[viewName]);
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

  this.loadView = function (TagName, dynamicProps) {
    let viewName = this.componentName(TagName);

    // Analytics call
    this.sendEvent("view load", { name: viewName });

    // make sure reactRoot is not hidden
    $(this.reactRoot).removeClass("hidden");

    if (this.jupyter) {
      this.jupyter.hide();

      if (TagName !== PipelineView && TagName !== PipelineSettingsView) {
        this.headerBarComponent.clearPipeline();
      }
    }

    // select menu if menu tag is selected
    for (let listIndex in drawer.list.listElements) {
      let listElement = drawer.list.listElements[listIndex];

      if (listElement.getAttribute("data-react-view") === viewName) {
        drawer.list.selectedIndex = parseInt(listIndex);
      }
    }

    ReactDOM.render(<TagName {...dynamicProps} />, this.reactRoot);
  };

  this.initializeFirstView = function () {
    this.loadView(ProjectsView);
  };

  setTimeout(() => {
    this.initializeFirstView();
  }, 0);

  const topAppBar = MDCTopAppBar.attachTo(document.getElementById("app-bar"));
  topAppBar.setScrollTarget(document.getElementById("main-content"));
  topAppBar.listen("MDCTopAppBar:nav", () => {
    window.localStorage.setItem("topAppBar.open", "" + !drawer.open);

    drawer.open = !drawer.open;
  });

  // persist nav menu to localStorage
  if (window.localStorage.getItem("topAppBar.open") !== null) {
    if (window.localStorage.getItem("topAppBar.open") === "true") {
      drawer.open = true;
    } else {
      drawer.open = false;
    }
  }

  // to embed an <iframe> in the main application as a first class citizen (with state) there needs to be a
  // persistent element on the page. It will only be created when the JupyterLab UI is first requested.

  this.jupyter = new Jupyter($(".persistent-view.jupyter"));

  this.showJupyter = function () {
    this.jupyter.show();

    // hide reactDOM
    $(this.reactRoot).addClass("hidden");
  };

  this.dialogHolder = document.querySelector(".dialogs");

  // avoid anchor link clicking default behavior
  $("a[href='#']").click((e) => {
    e.preventDefault();
  });

  let dialogs = ReactDOM.render(<Dialogs />, this.dialogHolder);

  this.alert = function (title, content) {
    // Analytics call
    this.sendEvent("alert show", { title: title, content: content });

    dialogs.alert(title, content);
  };
  this.confirm = function (title, content, cb) {
    // Analytics call
    this.sendEvent("confirm show", { title: title, content: content });

    dialogs.confirm(title, content, cb);
  };
}

window.orchest = new Orchest();
