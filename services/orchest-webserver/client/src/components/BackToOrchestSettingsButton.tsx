import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import React from "react";
import { BackButton } from "./common/BackButton";

export const BackToOrchestSettingsButton = () => {
  const { navigateTo } = useCustomRoute();
  const returnToSettings = () => {
    navigateTo(siteMap.settings.path);
  };

  return <BackButton onClick={returnToSettings}>Back to settings</BackButton>;
};
