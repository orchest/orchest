import { OrchestConfig, OrchestUserConfig } from "@/types";
import cloneDeep from "lodash.clonedeep";

export const configToVisibleConfig = (
  orchestConfig: OrchestConfig,
  configJSON: Partial<OrchestUserConfig>
): Partial<OrchestUserConfig> => {
  if (orchestConfig?.CLOUD !== true) {
    return configJSON;
  }

  let visibleJSON = cloneDeep(configJSON);

  // strip cloud config
  (orchestConfig?.CLOUD_UNMODIFIABLE_CONFIG_VALUES || []).forEach((key) => {
    delete visibleJSON[key];
  });

  return visibleJSON;
};

export const configToInvisibleConfig = (
  orchestConfig: OrchestConfig,
  configJSON: Partial<OrchestUserConfig>
): Partial<OrchestUserConfig> => {
  if (orchestConfig?.CLOUD !== true) {
    return {};
  }

  let invisibleJSON = cloneDeep(configJSON);

  // Strip visible config
  const cloudUnmodifiableConfigValues =
    orchestConfig.CLOUD_UNMODIFIABLE_CONFIG_VALUES || [];

  for (let key of Object.keys(invisibleJSON)) {
    if (!cloudUnmodifiableConfigValues.includes(key)) {
      delete invisibleJSON[key];
    }
  }

  return invisibleJSON;
};
