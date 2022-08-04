import { useEnvironmentOnEdit } from "@/environments-view/stores/useEnvironmentOnEdit";
import type { CustomImage, EnvironmentState } from "@/types";
import React from "react";

/**
 * according to the fetched environment, extract custom image (if any), and load it into the state `customImage`
 * Note that this only occurs when `customImage` is empty; otherwise, when user selects the other default images,
 * the custom image will disappear.
 */
export const useCustomImage = (
  isLoaded: boolean,
  isUsingDefaultImage: boolean,
  environmentOnEdit: EnvironmentState | undefined
) => {
  const [customImage, setCustomImage] = React.useState<CustomImage>();
  const { setEnvironmentOnEdit } = useEnvironmentOnEdit();

  React.useEffect(() => {
    if (customImage) setEnvironmentOnEdit(customImage);
  }, [customImage, setEnvironmentOnEdit]);

  React.useEffect(() => {
    const shouldLoadCurrentCustomImage =
      isLoaded && environmentOnEdit && !customImage;

    if (shouldLoadCurrentCustomImage) {
      // If user choose orchest/base-kernel-py, BE will fill the latest matching version of the image, e.g. `orchest/base-kernel-py:v2022.05.3`.
      // This means that from the BE perspective, `orchest/base-kernel-py` means latest, equivalent to `orchest/base-kernel-py:${current_orchest_version}`.
      // User could still choose to use an older version of the Orchest default image, e.g. `orchest/base-kernel-py:v2022.05.1`.
      // Then this is considered as a custom image, because user choose to specify an image themselves, so do the other non-Orchest images.
      const { base_image, gpu_support, language } = environmentOnEdit;
      setCustomImage(
        !isUsingDefaultImage ? { base_image, gpu_support, language } : undefined
      );
    }
  }, [isLoaded, environmentOnEdit, isUsingDefaultImage, customImage]);

  return [customImage, setCustomImage] as const;
};
