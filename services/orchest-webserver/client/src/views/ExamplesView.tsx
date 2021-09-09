import React, { useState } from "react";
import { MDCButtonReact, MDCTabBarReact } from "@orchest/lib-mdc";

import ProjectsView from "./ProjectsView";

const ExampleCard = () => {};

const ExamplesView = () => {
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const goToProjects = () => {
    window.orchest.loadView(ProjectsView);
  };
  const changeTabByIndex = (index: number) => {
    setSelectedTab(index);
  };
  return (
    <div className="view-page examples-view">
      <div className="push-down">
        <MDCButtonReact
          label="Back to projects"
          icon="arrow_back"
          onClick={goToProjects}
        />
      </div>
      <h2>Explore examples</h2>
      <MDCTabBarReact
        selectedIndex={selectedTab}
        items={["Curated Examples", "Community contributed"]}
        icons={["list", "group"]} // TODO: how to embed Orchest logo as the icon font?
        onChange={changeTabByIndex}
      />
      <div className="tab-view">
        {selectedTab === 0 && <div>Orchest</div>}
        {selectedTab === 1 && <div>Community</div>}
      </div>
    </div>
  );
};

export default ExamplesView;
