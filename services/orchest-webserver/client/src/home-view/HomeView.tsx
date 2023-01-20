import { ViewLayout } from "@/components/layout/ViewLayout";
import { useCurrentQuery } from "@/hooks/useCustomRoute";
import React from "react";
import { AllRunsTab } from "./AllRunsTab";
import { ExamplesTab } from "./ExamplesTab";
import { HomeHeader } from "./HomeHeader";
import { ProjectsTab } from "./ProjectsTab";

export type HomeTabs = "examples" | "projects";

export const HomeView = () => {
  const { tab = "projects" } = useCurrentQuery();

  return (
    <ViewLayout
      header={({ scrolled }) => <HomeHeader scrolled={scrolled} />}
      paddingBottom={4}
    >
      {tab === "examples" && <ExamplesTab />}
      {tab === "projects" && <ProjectsTab />}
      {tab === "all-runs" && <AllRunsTab />}
    </ViewLayout>
  );
};
