import {MDCTopAppBar} from "@material/top-app-bar";
import {MDCDrawer} from "@material/drawer";

import PipelinesView from "./views/PipelinesView";
import DataSourcesView from "./views/DataSourcesView";
import React from 'react';
import ReactDOM from 'react-dom';
import PipelineView from "./views/PipelineView";

function Databoost() {

    this.reactRoot = document.querySelector(".react-view-root");

    this.Components = {
        "PipelinesView": PipelinesView,
        "DataSourcesView": DataSourcesView,
        "PipelineView": PipelineView
    };

    const drawer = MDCDrawer.attachTo(document.getElementById('main-drawer'));

    drawer.listen("MDCList:action", (e) => {
        let selectedIndex = e.detail.index;

        let listElement = drawer.list.listElements[selectedIndex];

        let viewName = listElement.attributes.getNamedItem("data-react-view").value;

        this.loadView(this.Components[viewName]);
    });

    this.loadView = function(TagName, dynamicProps){
        ReactDOM.render(<TagName {...dynamicProps} />, this.reactRoot);
    };

    this.loadView(PipelineView);

    const topAppBar = MDCTopAppBar.attachTo(document.getElementById('app-bar'));
    topAppBar.setScrollTarget(document.getElementById('main-content'));
    topAppBar.listen('MDCTopAppBar:nav', () => {
      drawer.open = !drawer.open;
    });

}

window.databoost = new Databoost();

