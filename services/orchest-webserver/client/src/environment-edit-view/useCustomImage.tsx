import type { CustomImage, Environment } from "@/types";
import "codemirror/mode/shell/shell";
import "codemirror/theme/dracula.css";
import React from "react";

/**
 * according to the fetched environment, extract custom image (if any), and load it into the state `customImage`
 * Note that this only occurs when `customImage` is empty; otherwise, when user selects the other default images,
 * the custom image will disappear
 */
export const useCustomImage = (
  environment: Environment | undefined,
  defaultImageInUse: (CustomImage & { img_src: string }) | undefined,
  orchestVersion: string | undefined
) => {
  const [customImage, setCustomImage] = React.useState<CustomImage>();

  React.useEffect(() => {
    if (environment && !customImage && orchestVersion) {
      // If user choose orchest/base-kernel-py, BE will fill the latest matching version of the image, e.g. `orchest/base-kernel-py:v2022.05.3`.
      // This means that from the BE perspective, `orchest/base-kernel-py` means latest, equivalent to `orchest/base-kernel-py:${current_orchest_version}`.
      // User could still choose to use an older version of the Orchest default image, e.g. `orchest/base-kernel-py:v2022.05.1`.
      // Then this is considered as a custom image, because user choose to specify an image themselves, so do the other non-Orchest images.
      setCustomImage(!defaultImageInUse ? environment : undefined);
    }
  }, [environment, defaultImageInUse, orchestVersion, customImage]);

  return [customImage, setCustomImage] as const;
};
