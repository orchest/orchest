import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useAppContext } from "@/contexts/AppContext";
import {
  BASE_IMAGE_LANGUAGES,
  DEFAULT_BASE_IMAGES,
  getNewEnvironmentName,
  isEnvironmentBuilding,
} from "@/environments-view/common";
import { useEditEnvironment } from "@/environments-view/stores/useEditEnvironment";
import { CustomImage } from "@/types";
import { capitalize } from "@/utils/text";
import React from "react";
import { useBaseImageStore } from "../stores/useBaseImageStore";
import { getDefaultImageFromEnvironment } from "./useLoadSelectedBaseImage";

/**
 * Provides functions to select a base image for the environment, including
 * the custom image.
 */
export const useSelectBaseImage = () => {
  const { orchestVersion } = useAppContext();
  const { environments } = useEnvironmentsApi();
  const { environmentChanges, setEnvironmentChanges } = useEditEnvironment();
  const disabled = isEnvironmentBuilding(environmentChanges?.latestBuild);

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

      setEnvironmentChanges(baseImageForSaving);
    }
  }, [selectedImage, setEnvironmentChanges, orchestVersion]);

  React.useEffect(() => {
    save();
  }, [save]);

  const generateUniqueEnvironmentName = React.useCallback(
    (newName: string, language: string) => {
      const environmentsInLanguage = environments?.filter(
        (env) => env.language === language
      );
      return getNewEnvironmentName(newName, environmentsInLanguage);
    },
    [environments]
  );

  const changeEnvironmentPrefixPerLanguage = React.useCallback(
    (selectedImageLanguage: string) => {
      if (!environmentChanges?.name) {
        setEnvironmentChanges({
          name: generateUniqueEnvironmentName(
            capitalize(selectedImageLanguage),
            selectedImageLanguage
          ),
        });
        return;
      }

      const envNameWithoutSerialNumber = environmentChanges.name
        .replace(/( )+\(\d+\)?$/, "")
        .toLowerCase();

      if (BASE_IMAGE_LANGUAGES.has(envNameWithoutSerialNumber)) {
        setEnvironmentChanges({
          name: generateUniqueEnvironmentName(
            capitalize(selectedImageLanguage),
            selectedImageLanguage
          ),
        });
      }
    },
    [
      environmentChanges?.name,
      setEnvironmentChanges,
      generateUniqueEnvironmentName,
    ]
  );

  const selectBaseImage = React.useCallback(
    (baseImage: string) => {
      if (disabled || !environmentChanges?.uuid) return;
      isTouched.current = true;
      if (baseImage === customImage.base_image) {
        setSelectedImage(environmentChanges.uuid, customImage);
        changeEnvironmentPrefixPerLanguage(customImage.language);
        return;
      }

      const foundDefaultImage = DEFAULT_BASE_IMAGES.find((image) =>
        [image.base_image, `${image.base_image}:${orchestVersion}`].includes(
          baseImage
        )
      );
      if (foundDefaultImage) {
        setSelectedImage(environmentChanges.uuid, foundDefaultImage);
        changeEnvironmentPrefixPerLanguage(foundDefaultImage.language);
      }
    },
    [
      customImage,
      disabled,
      orchestVersion,
      setSelectedImage,
      environmentChanges?.uuid,
      changeEnvironmentPrefixPerLanguage,
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
