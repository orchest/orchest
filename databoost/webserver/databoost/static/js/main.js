import {MDCTopAppBar} from "@material/top-app-bar";
import {MDCDrawer} from "@material/drawer";

import PipelinesView from "./views/PipelinesView";
import DataSourcesView from "./views/DataSourcesView";
import HeaderButtons from "./views/HeaderButtons";
import React from 'react';
import ReactDOM from 'react-dom';
import PipelineView from "./views/PipelineView";
import Jupyter from "./jupyter/Jupyter";

function Databoost() {

    this.reactRoot = document.querySelector(".react-view-root");

    this.Components = {
        "PipelinesView": PipelinesView,
        "DataSourcesView": DataSourcesView,
        "PipelineView": PipelineView
    };

    const drawer = MDCDrawer.attachTo(document.getElementById('main-drawer'));


    // mount titlebare componenet
    this.headerBar = document.querySelector(".header-bar-interactive");
    this.headerBarComponent = ReactDOM.render(<HeaderButtons />, this.headerBar);

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

    this.loadView(PipelineView, {"name": "My first pipeline", "uuid": "07612719-7e95-4fbd-be73-37fb428fdcb6" });

    const topAppBar = MDCTopAppBar.attachTo(document.getElementById('app-bar'));
    topAppBar.setScrollTarget(document.getElementById('main-content'));
    topAppBar.listen('MDCTopAppBar:nav', () => {
      drawer.open = !drawer.open;
    });

    // to embed an <iframe> in the main application as a first class citizen (with state) there needs to be a
    // persistent element on the page. It will only be created when the JupyterLab UI is first requested.

    this.jupyter = new Jupyter($(".persistent-view.jupyter"));

    this.showJupyter = function(){
        this.jupyter.show();

        // hide reactDOM
        $(this.reactRoot).addClass('hidden');
    };

}

window.databoost = new Databoost();

