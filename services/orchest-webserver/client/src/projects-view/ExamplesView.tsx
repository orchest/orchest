import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useImportUrl } from "@/hooks/useImportUrl";
import { useTransition } from "@/hooks/useTransition";
import { siteMap } from "@/routingConfig";
import { Example } from "@/types";
import { BackgroundTask } from "@/utils/webserver-utils";
import { MDCButtonReact, MDCTabBarReact } from "@orchest/lib-mdc";
import React from "react";
import { CommunityWarning } from "./CommunityWarning";
import { ContributeCard } from "./ContributeCard";
import { ExampleCard } from "./ExampleCard";
import { useFetchExamples } from "./hooks/useFetchExamples";
import { ImportDialog } from "./ImportDialog";
import { ImportSuccessDialog } from "./ImportSuccessDialog";

const pageHeaderText = `Don't start from scratch, use a template!`;
const pageHeaderSubtitle = `Use examples contributed by the community to kickstart your Orchest pipelines.`;

enum EXAMPLES_TAB {
  "ORCHEST" = 0,
  "COMMUNITY" = 1,
}

const isCuratedByOrchest = (owner: string) =>
  ["orchest", "orchest-example"].includes(owner.toLowerCase());

type ImportingState = "READY" | "IMPORTING" | "DONE";

const ExamplesView: React.FC = () => {
  // global states
  const { navigateTo } = useCustomRoute();
  const { data } = useFetchExamples();
  // local states
  const [projectName, setProjectName] = React.useState<string>();
  const [projectUuid, setProjectUuid] = React.useState<string>();
  const [importingState, setImportingState] = React.useState<ImportingState>(
    "READY"
  );
  const [selectedTab, setSelectedTab] = React.useState<EXAMPLES_TAB>(
    EXAMPLES_TAB.ORCHEST
  );
  const [importUrl, setImportUrl] = useImportUrl();

  // if user loads the app with a pre-filled import_url in their query string
  // we prompt them directly with the import modal
  React.useEffect(() => {
    if (importUrl !== "") setImportingState("IMPORTING");
  }, []);

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

  const goToSelectedProject = () => {
    navigateTo(siteMap.pipelines.path, { query: { projectUuid } });
  };

  const changeTabByIndex = (index: EXAMPLES_TAB) => {
    setSelectedTab(index);
  };

  const startImport = (url: string) => {
    setImportUrl(url);
    setImportingState("IMPORTING");
  };

  const onImportComplete = (result: BackgroundTask) => {
    if (result.status === "SUCCESS") {
      setImportingState("DONE");
      setProjectUuid(result.result);
    }
  };

  const closeDialog = () => {
    setImportingState("READY");
    setProjectName("");
    setImportUrl("");
  };

  return (
    <div className="view-page examples-view">
      <ImportDialog
        projectName={projectName}
        setProjectName={setProjectName}
        onClose={closeDialog}
        open={importingState === "IMPORTING"}
        importUrl={importUrl}
        setImportUrl={setImportUrl}
        onImportComplete={onImportComplete}
      />

      <ImportSuccessDialog
        projectName={projectName}
        open={importingState === "DONE"}
        onClose={closeDialog}
        goToPipelines={goToSelectedProject}
      />
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
              <ExampleCard key={item.url} {...item} startImport={startImport} />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ExamplesView;
