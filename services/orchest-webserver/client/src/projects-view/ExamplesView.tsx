import React from "react";

import { MDCButtonReact, MDCTabBarReact } from "@orchest/lib-mdc";

import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";

import { ImportDialog } from "./ImportDialog";
import { useFetchExamples } from "./hooks/useFetchExamples";
import { Example } from "@/types";
import { ExampleCard } from "./ExampleCard";
import { ContributeCard } from "./ContributeCard";
import { CommunityWarning } from "./CommunityWarning";
import { useTransition } from "@/hooks/useTransition";

const pageHeaderText = `Don't start from scratch, use a template!`;
const pageHeaderSubtitle = `Use examples contributed by the community to kickstart your Orchest pipelines.`;

enum EXAMPLES_TAB {
  "ORCHEST" = 0,
  "COMMUNITY" = 1,
}

const isCuratedByOrchest = (owner: string) =>
  ["orchest", "orchest-example"].includes(owner.toLowerCase());

const ExamplesView: React.FC = () => {
  const [isImporting, setIsImporting] = React.useState(false);
  const [selectedTab, setSelectedTab] = React.useState<EXAMPLES_TAB>(
    EXAMPLES_TAB.ORCHEST
  );
  const { navigateTo } = useCustomRoute();
  const { data } = useFetchExamples();
  const {
    shouldRender: shouldShowCommunityWithTransition,
    mountedStyle,
    unmountedStyle,
  } = useTransition(selectedTab === EXAMPLES_TAB.COMMUNITY);

  // the index of this array represents the tab index of MDCTabBarReact
  const examples = React.useMemo<[Example[], Example[]]>(() => {
    if (!data) return [[], []];

    return data.reduce(
      (categorized, example) => {
        const tabIndex = isCuratedByOrchest(example.owner) ? 0 : 1;
        categorized[tabIndex].push(example);
        return categorized;
      },
      [[], []]
    );
  }, [data]);

  const goToProjects = () => {
    navigateTo(siteMap.projects.path);
  };

  const changeTabByIndex = (index: EXAMPLES_TAB) => {
    setSelectedTab(index);
  };

  const [exampleUrl, setExampleUrl] = React.useState<string>();
  const [projectName, setProjectName] = React.useState<string>();

  const startImport = (url: string) => {
    setExampleUrl(url);
    setIsImporting(true);
  };

  return (
    <div className="view-page examples-view">
      {isImporting && (
        <ImportDialog
          projectName={projectName}
          setProjectName={setProjectName}
          initialImportUrl={exampleUrl}
          setShouldOpen={setIsImporting}
        />
      )}
      <div className="push-down">
        <MDCButtonReact
          label="Back to projects"
          icon="arrow_back"
          onClick={goToProjects}
        />
      </div>
      <div className="examples-view-heading-section">
        <div className="examples-view-heading-section_main">
          <h2 className="examples-view-title">{pageHeaderText}</h2>
          <h3 className="examples-view-subtitle">{pageHeaderSubtitle}</h3>
        </div>
        <CommunityWarning
          style={
            shouldShowCommunityWithTransition ? mountedStyle : unmountedStyle
          }
        />
      </div>
      <div className="example-view-tabs-container">
        <MDCTabBarReact
          selectedIndex={selectedTab}
          items={["Curated Examples", "Community contributed"]}
          icons={["/image/logo.svg", "group"]}
          onChange={changeTabByIndex}
        />
        {/* TODO: we need a loading skeleton */}
        {/* {status === "PENDING" && <MDCCircularProgressReact />} */}
        <div className="example-cards-container">
          {selectedTab === EXAMPLES_TAB.COMMUNITY && <ContributeCard />}
          {examples[selectedTab].map((item) => {
            return (
              <ExampleCard
                key={item.url}
                {...item}
                startImport={startImport}
              ></ExampleCard>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ExamplesView;
