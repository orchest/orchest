import { useAppContext } from "@/contexts/AppContext";
import { DEFAULT_BASE_IMAGES } from "@/environments-view/common";
import { useEditEnvironment } from "@/environments-view/stores/useEditEnvironment";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { CustomImage, EnvironmentData } from "@/types";
import React from "react";
import { useBaseImageStore } from "../stores/useBaseImageStore";

/**
 * Check if the base image is part of the default images.
 * Note: when saving the environment, BE will attach the current Orchest version to the image name.
 * A default base image with a different version is considered as a custom image.
 */
export const getDefaultImageFromEnvironment = (
  environmentBaseImage: EnvironmentData["base_image"] | undefined,
  orchestVersion: string | null | undefined
) => {
  if (!environmentBaseImage) return undefined;
  return DEFAULT_BASE_IMAGES.find(({ base_image }) => {
    const versionedImage = `${base_image}:${orchestVersion}`;
    return [versionedImage, base_image].includes(environmentBaseImage);
  });
};

/**
 * Performs a side effect that loads selected base image into the store when query args change.
 */
export const useLoadSelectedBaseImage = () => {
  const { orchestVersion } = useAppContext();
  const { environmentUuid, projectUuid } = useCustomRoute();
  const environmentChangesProjectUuid = useEditEnvironment(
    (state) => state.environmentChanges?.project_uuid
  );
  const uuid = useEditEnvironment((state) => state.environmentChanges?.uuid);
  const language = useEditEnvironment(
    (state) => state.environmentChanges?.language
  );
  const gpuSupport = useEditEnvironment(
    (state) => state.environmentChanges?.gpu_support
  );
  const baseImage = useEditEnvironment(
    (state) => state.environmentChanges?.base_image
  );

  const [setSelectedImage, setCustomImage] = useBaseImageStore((state) => [
    state.setSelectedImage,
    state.setCustomImage,
  ]);

  const isLoaded = React.useRef(false);
  const hasDataFetched =
    environmentUuid === uuid && projectUuid === environmentChangesProjectUuid;

  const load = React.useCallback(() => {
    if (!isLoaded.current && hasDataFetched && uuid) {
      isLoaded.current = true;

      const savedImage = {
        base_image: baseImage,
        gpu_support: gpuSupport,
        language,
      } as CustomImage;
      // From the BE perspective, `orchest/base-kernel-py` means latest, equivalent to `orchest/base-kernel-py:${current_orchest_version}`.
      // If the image is, for example, orchest/base-kernel-py, BE will fill the latest matching version of the image, e.g. `orchest/base-kernel-py:v2022.05.3`.
      // User could still choose to use an older version of the Orchest default image, e.g. `orchest/base-kernel-py:v2022.05.1`.
      // Then this is considered as a custom image, because user choose to specify an image themselves, so do the other non-Orchest images.
      const selectedDefaultImage = getDefaultImageFromEnvironment(
        baseImage,
        orchestVersion
      );

      setSelectedImage(uuid, selectedDefaultImage || savedImage);
      if (!selectedDefaultImage) setCustomImage(uuid, savedImage);
    }
  }, [
    hasDataFetched,
    orchestVersion,
    setCustomImage,
    setSelectedImage,
    baseImage,
    gpuSupport,
    language,
    uuid,
  ]);

  React.useEffect(() => {
    load();
  }, [load]);
};
