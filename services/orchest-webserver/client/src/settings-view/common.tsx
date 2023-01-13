import { OrchestConfig, OrchestUserConfig } from "@/types";
import { omit, pick } from "@/utils/record";

/**
 * Return a shallow copy of configJSON, with the unmodifiable properties removed.
 * Note that this function doesn't mutate the provided objects.
 */
export const extractEditable = (
  orchestConfig: OrchestConfig,
  configJSON: Partial<OrchestUserConfig>
): Partial<OrchestUserConfig> => {
  if (!orchestConfig?.CLOUD) return { ...configJSON };

  const keysToOmit = orchestConfig?.CLOUD_UNMODIFIABLE_CONFIG_VALUES || [];
  return omit(configJSON, ...keysToOmit);
};

/**
 * Return a shallow copy of configJSON, with the modifiable properties removed.
 * Note that this function doesn't mutate the provided objects.
 */
export const extractUneditable = (
  orchestConfig: OrchestConfig,
  configJSON: Partial<OrchestUserConfig>
): Partial<OrchestUserConfig> => {
  if (!orchestConfig?.CLOUD) return {};

  const keysToPick = orchestConfig?.CLOUD_UNMODIFIABLE_CONFIG_VALUES || [];
  return pick(configJSON, ...keysToPick);
};
