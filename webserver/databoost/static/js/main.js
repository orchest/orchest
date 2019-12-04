import {MDCTopAppBar} from "@material/top-app-bar";
import {MDCDrawer} from "@material/drawer";

import PipelinesView from "./views/PipelinesView";
import DataSourcesView from "./views/DataSourcesView";
import React from 'react';
import ReactDOM from 'react-dom';

(function(){

    let reactRoot = document.querySelector(".react-view-root");

    const drawer = MDCDrawer.attachTo(document.getElementById('main-drawer'));

    drawer.listen("MDCList:action", (e) => {
        let selectedIndex = e.detail.index;

        let listElement = drawer.list.listElements[selectedIndex];

        let viewName = listElement.attributes.getNamedItem("data-react-view").value;

        switch(viewName) {
            case "PipelinesView":
                ReactDOM.render(<PipelinesView />, reactRoot);
                break;
            case "DataSourcesView":
                ReactDOM.render(<DataSourcesView />, reactRoot);
                break;
        }

    });

    const topAppBar = MDCTopAppBar.attachTo(document.getElementById('app-bar'));
    topAppBar.setScrollTarget(document.getElementById('main-content'));
    topAppBar.listen('MDCTopAppBar:nav', () => {
      drawer.open = !drawer.open;
    });









})();
