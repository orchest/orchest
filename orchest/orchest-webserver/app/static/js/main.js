import {MDCTopAppBar} from "@material/top-app-bar";
import {MDCDrawer} from "@material/drawer";

import PipelinesView from "./views/PipelinesView";
import SettingsView from "./views/SettingsView";
import DataSourcesView from "./views/DataSourcesView";
import DataSourceEditView from "./views/DataSourceEditView";
import HeaderButtons from "./views/HeaderButtons";
import React from 'react';
import ReactDOM from 'react-dom';
import PipelineView from "./views/PipelineView";
import Jupyter from "./jupyter/Jupyter";
import {makeRequest} from "./utils/all";

import './lib/overflowing';
 
function Orchest() {

    this.reactRoot = document.querySelector(".react-view-root");

    this.Components = {
        "PipelinesView": PipelinesView,
        "DataSourcesView": DataSourcesView,
        "DataSourceEditView": DataSourceEditView,
        "PipelineView": PipelineView,
        "SettingsView": SettingsView,
    };

    const drawer = MDCDrawer.attachTo(document.getElementById('main-drawer'));

    // mount titlebare componenet
    this.headerBar = document.querySelector(".header-bar-interactive");
    this.headerBarComponent = ReactDOM.render(<HeaderButtons />, this.headerBar);

    drawer.list.singleSelection = true;
    
    drawer.listen("MDCList:action", (e) => {
        let selectedIndex = e.detail.index;

        let listElement = drawer.list.listElements[selectedIndex];

        let viewName = listElement.attributes.getNamedItem("data-react-view").value;

        this.loadView(this.Components[viewName]);
    });

    this.loadView = function(TagName, dynamicProps){
        // make sure reactRoot is not hidden
        $(this.reactRoot).removeClass("hidden");
        if(this.jupyter){
            this.jupyter.hide();
        }

        ReactDOM.render(<TagName {...dynamicProps} />, this.reactRoot);
    };


    this.initializeFirstView = function(){
        // load first pipeline
        makeRequest("GET", "/async/pipelines", {
        }).then((response) => {
            let result = JSON.parse(response);
            if(result.success && result.result.length > 0){
                let firstPipeline = result.result[0];
                // this.loadView(PipelineView, {"uuid": firstPipeline.uuid });
                this.loadView(DataSourcesView);
            }else{
                console.warn("Could not load a first pipeline");
                console.log(result);
            }
        });
    }


    this.initializeFirstView();

    const topAppBar = MDCTopAppBar.attachTo(document.getElementById('app-bar'));
    topAppBar.setScrollTarget(document.getElementById('main-content'));
    topAppBar.listen('MDCTopAppBar:nav', () => {

      window.localStorage.setItem("topAppBar.open", "" + !drawer.open);

      drawer.open = !drawer.open;
    });



    // persist nav menu to localStorage
    if(window.localStorage.getItem("topAppBar.open") !== null){
        if(window.localStorage.getItem("topAppBar.open") === "true"){
            drawer.open = true;
        }else{
            drawer.open = false;
        }
    }

    // to embed an <iframe> in the main application as a first class citizen (with state) there needs to be a
    // persistent element on the page. It will only be created when the JupyterLab UI is first requested.

    this.jupyter = new Jupyter($(".persistent-view.jupyter"));

    this.showJupyter = function(){
        this.jupyter.show();

        // hide reactDOM
        $(this.reactRoot).addClass('hidden');
    };

}

window.orchest = new Orchest();

