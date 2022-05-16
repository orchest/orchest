import { BackButton } from "@/components/common/BackButton";
import { LogoIcon } from "@/components/common/icons/LogoIcon";
import { TabLabel, Tabs } from "@/components/common/Tabs";
import { Layout } from "@/components/Layout";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useImportUrl } from "@/hooks/useImportUrl";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { useTransition } from "@/hooks/useTransition";
import { siteMap } from "@/routingConfig";
import { Example, Project } from "@/types";
import GroupIcon from "@mui/icons-material/Group";
import Tab from "@mui/material/Tab";
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
  ["orchest", "orchest-examples"].includes(owner.toLowerCase());

type ImportingState = "READY" | "IMPORTING" | "DONE";

const tabs = [
  {
    id: "curated-examples",
    label: "Curated Examples",
    icon: <LogoIcon />,
  },
  {
    id: "community-contributed",
    label: "Community contributed",
    icon: <GroupIcon />,
  },
];

const ExamplesView: React.FC = () => {
  // global states
  const { navigateTo } = useCustomRoute();
  useSendAnalyticEvent("view load", { name: siteMap.examples.path });

  const { data } = useFetchExamples();

  // local states
  const [projectName, setProjectName] = React.useState<string>("");
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
  const examples = React.useMemo<[Example[], Example[]]>(() => {
    if (!data) return [[], []];

    return data.reduce(
      (categorized, example) => {
        const tabIndex = isCuratedByOrchest(example.owner) ? 0 : 1;
        categorized[tabIndex].push(example);
        return categorized;
      },
      [[], []] as [Example[], Example[]]
    );
  }, [data]);

  const goToProjects = (e: React.MouseEvent) => {
    navigateTo(siteMap.projects.path, undefined, e);
  };

  const goToSelectedProject = (e: React.MouseEvent) => {
    navigateTo(siteMap.pipeline.path, { query: { projectUuid } }, e);
  };

  const changeTabByIndex = (
    e: React.SyntheticEvent<Element, Event>,
    index: EXAMPLES_TAB
  ) => {
    setSelectedTab(index);
  };

  const startImport = (url: string) => {
    setImportUrl(url);
    setImportingState("IMPORTING");
  };

  const onImportComplete = (newProject: Pick<Project, "uuid" | "path">) => {
    setProjectUuid(newProject.uuid);
    setProjectName(newProject.path);
    setImportingState("DONE");
  };

  const closeDialog = () => {
    setImportingState("READY");
    setProjectName("");
    setImportUrl("");
  };

  return (
    <Layout
      toolbarElements={
        <BackButton onClick={goToProjects}>Back to projects</BackButton>
      }
    >
      <div className="view-page examples-view">
        <ImportDialog
          onClose={closeDialog}
          open={importingState === "IMPORTING"}
          importUrl={importUrl}
          setImportUrl={setImportUrl}
          onImportComplete={onImportComplete}
          hideUploadOption
          hideProjectMetadata
        />
        <ImportSuccessDialog
          projectName={projectName}
          open={importingState === "DONE"}
          onClose={closeDialog}
          goToPipelines={goToSelectedProject}
        />
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
          <Tabs
            value={selectedTab}
            onChange={changeTabByIndex}
            label="Example Tabs"
            data-test-id="example-tabs"
          >
            {tabs.map((tab) => (
              <Tab
                key={tab.id}
                id={tab.id}
                label={<TabLabel icon={tab.icon}>{tab.label}</TabLabel>}
                aria-controls={tab.id}
                data-test-id={`${tab.id}-tab`}
              />
            ))}
          </Tabs>
          {/* TODO: we need a loading skeleton */}
          <div className="example-cards-container">
            {selectedTab === EXAMPLES_TAB.COMMUNITY && <ContributeCard />}
            {examples[selectedTab].map((item) => {
              return (
                <ExampleCard
                  key={item.url}
                  {...item}
                  startImport={startImport}
                />
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ExamplesView;
