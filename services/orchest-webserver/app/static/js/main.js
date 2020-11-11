import { MDCTopAppBar } from "@material/top-app-bar";
import { MDCDrawer } from "@material/drawer";

import ProjectsView from "./views/ProjectsView";
import SettingsView from "./views/SettingsView";
import ManageUsersView from "./views/ManageUsersView";
import DataSourcesView from "./views/DataSourcesView";
import FileManagerView from "./views/FileManagerView";
import DataSourceEditView from "./views/DataSourceEditView";
import ExperimentsView from "./views/ExperimentsView";
import PipelinesView from "./views/PipelinesView";
import CreateExperimentView from "./views/CreateExperimentView";
import HeaderButtons from "./views/HeaderButtons";
import React from "react";
import ReactDOM from "react-dom";
import PipelineView from "./views/PipelineView";
import Jupyter from "./jupyter/Jupyter";

import "./utils/overflowing";
import ExperimentView from "./views/ExperimentView";
import PipelineSettingsView from "./views/PipelineSettingsView";
import Dialogs from "./components/Dialogs";
import EnvironmentsView from "./views/EnvironmentsView";
import UpdateView from "./views/UpdateView";
import { PersistentLocalConfig } from "./lib/utils/all";

function Orchest() {
  this.environment = "production";

  if ($('input[name="FLASK_ENV"]').val() == "development") {
    this.environment = "development";
  }
  this.config = {};
  this.config["DOCS_ROOT"] = $('input[name="DOCS_ROOT"]').val();

  console.log("Orchest is running in environment: " + this.environment);

  this.reactRoot = document.querySelector(".react-view-root");

  this.browserConfig = new PersistentLocalConfig("orchest");

  this.Components = {
    ProjectsView,
    DataSourcesView,
    FileManagerView,
    EnvironmentsView,
    DataSourceEditView,
    PipelineView,
    SettingsView,
    UpdateView,
    PipelinesView,
    ExperimentsView,
    ExperimentView,
    CreateExperimentView,
    ManageUsersView,
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

      this.loadView(this.Components[viewName]);
    }
  });

  this.loadView = function (TagName, dynamicProps) {
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

      if (listElement.getAttribute("data-react-view") === TagName.name) {
        drawer.list.selectedIndex = parseInt(listIndex);
      }
    }

    ReactDOM.render(<TagName {...dynamicProps} />, this.reactRoot);
  };

  this.initializeFirstView = function () {
    // load first pipeline
    this.loadView(PipelinesView);
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
    dialogs.alert(title, content);
  };
  this.confirm = function (title, content, cb) {
    dialogs.confirm(title, content, cb);
  };

}

window.orchest = new Orchest();
