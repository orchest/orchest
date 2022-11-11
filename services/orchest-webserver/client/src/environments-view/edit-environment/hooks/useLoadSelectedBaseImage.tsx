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
  const { environmentUuid, projectUuid } = useCustomRoute();
  const environmentChangesProjectUuid = useEditEnvironment(
    (state) => state.changes?.project_uuid
  );
  const uuid = useEditEnvironment((state) => state.changes?.uuid);
  const language = useEditEnvironment((state) => state.changes?.language);
  const gpuSupport = useEditEnvironment((state) => state.changes?.gpu_support);
  const baseImage = useEditEnvironment((state) => state.changes?.base_image);

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

      const foundDefaultImage = DEFAULT_BASE_IMAGES.find(
        (image) => image.base_image === baseImage
      );

      setSelectedImage(uuid, savedImage);
      if (!foundDefaultImage) setCustomImage(uuid, savedImage);
    }
  }, [
    hasDataFetched,
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
