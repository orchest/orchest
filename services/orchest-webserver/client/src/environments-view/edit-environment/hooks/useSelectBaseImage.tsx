import { useAppContext } from "@/contexts/AppContext";
import {
  DEFAULT_BASE_IMAGES,
  isEnvironmentBuilding,
} from "@/environments-view/common";
import { useEnvironmentOnEdit } from "@/environments-view/stores/useEnvironmentOnEdit";
import { CustomImage } from "@/types";
import React from "react";
import { useBaseImageStore } from "../stores/useBaseImageStore";
import { getDefaultImageFromEnvironment } from "./useLoadSelectedBaseImage";

/**
 * Provides functions to select a base image for the environment, including
 * the custom image.
 */
export const useSelectBaseImage = () => {
  const { orchestVersion } = useAppContext();
  const { environmentOnEdit, setEnvironmentOnEdit } = useEnvironmentOnEdit();
  const disabled = isEnvironmentBuilding(environmentOnEdit?.latestBuild);

  const [
    selectedImage,
    setSelectedImage,
    customImage,
    editCustomImageInStore,
    environmentUuid,
  ] = useBaseImageStore((state) => [
    state.selectedImage,
    state.setSelectedImage,
    state.customImage,
    state.editCustomImage,
    state.environmentUuid,
  ]);

  const isTouched = React.useRef(false);

  const save = React.useCallback(() => {
    if (isTouched.current) {
      // Save the base image without the version if the version is the current Orchest version.
      // So that later when user update to a newer version, this environment will automatically get updated.
      const baseImageForSaving =
        getDefaultImageFromEnvironment(
          selectedImage.base_image,
          orchestVersion
        ) || selectedImage;

      setEnvironmentOnEdit(baseImageForSaving);
    }
  }, [selectedImage, setEnvironmentOnEdit, orchestVersion]);

  React.useEffect(() => {
    save();
  }, [save]);

  const selectBaseImage = React.useCallback(
    (baseImage: string) => {
      if (disabled || !environmentOnEdit?.uuid) return;
      isTouched.current = true;
      if (baseImage === customImage.base_image) {
        setSelectedImage(environmentOnEdit.uuid, customImage);
        return;
      }

      const foundDefaultImage = DEFAULT_BASE_IMAGES.find((image) =>
        [image.base_image, `${image.base_image}:${orchestVersion}`].includes(
          baseImage
        )
      );
      if (foundDefaultImage)
        setSelectedImage(environmentOnEdit.uuid, foundDefaultImage);
    },
    [
      customImage,
      disabled,
      orchestVersion,
      setSelectedImage,
      environmentOnEdit?.uuid,
    ]
  );

  const editCustomImage = React.useCallback(
    (value: CustomImage) => {
      isTouched.current = true;
      editCustomImageInStore(value);
    },
    [editCustomImageInStore]
  );

  return {
    selectedImage,
    customImage,
    editCustomImage,
    selectBaseImage,
    environmentUuid,
  };
};
