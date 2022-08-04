import { useAppContext } from "@/contexts/AppContext";
import { DEFAULT_BASE_IMAGES } from "@/environment-edit-view/common";
import { useEnvironmentOnEdit } from "@/environments-view/stores/useEnvironmentOnEdit";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { Environment } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useBaseImageStore } from "../stores/useBaseImageStore";

/**
 * Check if the base image is part of the default images.
 * Note: when saving the environment, BE will attach the current Orchest version to the image name.
 * A default base image with a different version is considered as a custom image.
 */
export const getDefaultImageFromEnvironment = (
  environmentBaseImage: Environment["base_image"] | undefined,
  orchestVersion: string | null | undefined
) => {
  if (!environmentBaseImage) return undefined;
  return DEFAULT_BASE_IMAGES.find(({ base_image }) => {
    const versionedImage = `${base_image}:${orchestVersion}`;
    return [versionedImage, base_image].includes(environmentBaseImage);
  });
};

export const useLoadSelectedBaseImage = () => {
  const { orchestVersion } = useAppContext();
  const { environmentUuid, projectUuid } = useCustomRoute();
  const { environmentOnEdit } = useEnvironmentOnEdit();

  const [setSelectedImage, setCustomImage] = useBaseImageStore((state) => [
    state.setSelectedImage,
    state.setCustomImage,
  ]);

  const isLoaded = React.useRef(false);
  const hasDataFetched =
    hasValue(environmentOnEdit) &&
    environmentUuid === environmentOnEdit.uuid &&
    projectUuid === environmentOnEdit.project_uuid;

  const load = React.useCallback(() => {
    if (!isLoaded.current && hasDataFetched) {
      isLoaded.current = true;
      const { base_image, language, gpu_support } = environmentOnEdit;
      const savedImage = { base_image, language, gpu_support };
      // From the BE perspective, `orchest/base-kernel-py` means latest, equivalent to `orchest/base-kernel-py:${current_orchest_version}`.
      // If the image is, for example, orchest/base-kernel-py, BE will fill the latest matching version of the image, e.g. `orchest/base-kernel-py:v2022.05.3`.
      // User could still choose to use an older version of the Orchest default image, e.g. `orchest/base-kernel-py:v2022.05.1`.
      // Then this is considered as a custom image, because user choose to specify an image themselves, so do the other non-Orchest images.
      const selectedDefaultImage = getDefaultImageFromEnvironment(
        base_image,
        orchestVersion
      );

      setSelectedImage(selectedDefaultImage || savedImage);
      if (!selectedDefaultImage) setCustomImage(savedImage);
    }
  }, [
    environmentOnEdit,
    hasDataFetched,
    orchestVersion,
    setCustomImage,
    setSelectedImage,
  ]);

  React.useEffect(() => {
    load();
  }, [load]);
};
