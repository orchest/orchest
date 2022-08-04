import { useAppContext } from "@/contexts/AppContext";
import { DEFAULT_BASE_IMAGES } from "@/environment-edit-view/common";
import { isEnvironmentBuilding } from "@/environments-view/common";
import { useEnvironmentOnEdit } from "@/environments-view/stores/useEnvironmentOnEdit";
import { CustomImage } from "@/types";
import React from "react";
import { useBaseImageStore } from "../stores/useBaseImageStore";
import {
  getDefaultImageFromEnvironment,
  useLoadSelectedBaseImage,
} from "./useLoadSelectedBaseImage";

export const useSelectBaseImage = () => {
  const { orchestVersion } = useAppContext();
  const { environmentOnEdit, setEnvironmentOnEdit } = useEnvironmentOnEdit();
  const disabled = isEnvironmentBuilding(environmentOnEdit?.latestBuild);
  useLoadSelectedBaseImage();

  const [
    selectedImage,
    setSelectedImage,
    customImage,
    editCustomImageInStore,
  ] = useBaseImageStore((state) => [
    state.selectedImage,
    state.setSelectedImage,
    state.customImage,
    state.editCustomImage,
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
      if (disabled) return;
      isTouched.current = true;
      if (baseImage === customImage.base_image) {
        setSelectedImage(customImage);
        return;
      }

      const foundDefaultImage = DEFAULT_BASE_IMAGES.find((image) =>
        [image.base_image, `${image.base_image}:${orchestVersion}`].includes(
          baseImage
        )
      );
      if (foundDefaultImage) setSelectedImage(foundDefaultImage);
    },
    [customImage, disabled, orchestVersion, setSelectedImage]
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
  };
};
