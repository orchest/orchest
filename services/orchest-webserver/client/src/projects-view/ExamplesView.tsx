import React, { useState } from "react";

import { MDCButtonReact, MDCTabBarReact } from "@orchest/lib-mdc";

import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { useOrchest } from "@/hooks/orchest";

import { ImportDialog } from "./ImportDialog";

type ExampleData = {
  uuid: string;
  tags: string[];
  title: string;
  author: string;
  description: string;
  url: string;
};

// TODO: get real data
const data: [ExampleData[], ExampleData[]] = [
  [
    {
      uuid: "1231121r",
      title: "Downloading HN entries",
      description:
        "Pipeline parameters can be useful if you want to configure global parameters such as: the learning rate, data path, or object storage bucket name. Pipeline parameters can be useful if you want to configure global parameters such as: the learning rate, data path, or object storage bucket name.",
      tags: ["parameters", "basics"],
      author: "Abid",
      url: "https://github.com/orchest/quickstart",
    },
  ],
  [],
];

type ExampleCardProps = ExampleData & {
  startImport: (url: string) => void;
};

const ExampleCard: React.FC<ExampleCardProps> = ({
  title,
  description,
  tags,
  author,
  url,
  startImport,
}) => {
  const importExample = () => startImport(url);
  return (
    <div className="example-card">
      <div className="example-tags-container">
        {tags.map((tag) => (
          <span key={tag} className="example-tag">
            {tag}
          </span>
        ))}
      </div>
      <h4 className="example-card-title truncate">{title}</h4>
      <div className="example-card-author">by {author}</div>
      <p className="example-card-description">{description}</p>
      <div className="example-card-button-container">
        <MDCButtonReact
          label="IMPORT"
          classNames={["example-import-button"]}
          onClick={importExample}
        />
      </div>
    </div>
  );
};

const pageHeaderText = `Don't start from scratch, use a template!`;
const pageHeaderSubtitle = `Use examples contributed by the community to kickstart your Orchest pipelines.`;

const ExamplesView: React.FC = () => {
  const [isImporting, setIsImporting] = React.useState(false);
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const { navigateTo } = useCustomRoute();

  const { state, dispatch } = useOrchest();

  const goToProjects = () => {
    navigateTo(siteMap.projects.path);
  };
  const changeTabByIndex = (index: number) => {
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
      <div className="heading-section">
        <h2 className="examples-view-title">{pageHeaderText}</h2>
        <h3 className="examples-view-subtitle">{pageHeaderSubtitle}</h3>
      </div>
      <div className="example-view-tabs-container">
        <MDCTabBarReact
          selectedIndex={selectedTab}
          items={["Curated Examples", "Community contributed"]}
          icons={["/image/logo.svg", "group"]}
          onChange={changeTabByIndex}
        />
        {data[selectedTab].map((item) => {
          return (
            <ExampleCard
              key={item.uuid}
              {...item}
              startImport={startImport}
            ></ExampleCard>
          );
        })}
      </div>
    </div>
  );
};

export default ExamplesView;
