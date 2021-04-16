import React from "react";

import { useOrchest } from "@/lib/orchest";

import Dialogs from "./components/Dialogs";
import HeaderBar from "./components/HeaderBar";
import MainDrawer from "./components/MainDrawer";

import $ from "jquery";
import "./utils/overflowing";

window.$ = $;

declare global {
  interface Window {
    $: any;
  }
}

const App = () => {
  const orchest = useOrchest();

  console.log(orchest);

  window.orchest = orchest;

  return (
    <>
      <HeaderBar
        selectedProject={orchest.selectedProject}
        projectSelectorHash={orchest.projectSelectorHash}
        changeSelectedProject={orchest.setProject.bind(this)}
        ref={orchest.refManager.nrefs.headerBar}
        toggleDrawer={orchest.handleToggleDrawer.bind(this)}
      />
      <div className="app-container">
        <MainDrawer
          open={orchest.drawerOpen}
          setDrawerOpen={orchest.handleDrawerOpen.bind(this)}
          selectedElement={orchest.activeViewName}
        />
        <main className="main-content" id="main-content">
          {orchest.view}
          <div
            ref={orchest.refManager?.nrefs?.jupyter}
            className="persistent-view jupyter hidden"
          />
        </main>
      </div>
      <div className="dialogs">
        <Dialogs ref={orchest.refManager?.nrefs?.dialogs} />
      </div>
    </>
  );
};

export default App;
