import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
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

/**
 * Provides functions to select a base image for the environment, including
 * the custom image.
 */
export const useSelectBaseImage = () => {
  const environments = useEnvironmentsApi((state) => state.environments);

  const setEnvironmentChanges = useEditEnvironment((state) => state.update);
  const name = useEditEnvironment((state) => state.changes?.name);
  const uuid = useEditEnvironment((state) => state.changes?.uuid);
  const latestBuildStatus = useEditEnvironment(
    (state) => state.changes?.latestBuild?.status
  );

  const disabled = isEnvironmentBuilding(latestBuildStatus);

  const selectedImage = useBaseImageStore((state) => state.selectedImage);
  const setSelectedImage = useBaseImageStore((state) => state.setSelectedImage);
  const customImage = useBaseImageStore((state) => state.customImage);
  const environmentUuid = useBaseImageStore((state) => state.environmentUuid);
  const editCustomImageInStore = useBaseImageStore(
    (state) => state.editCustomImage
  );

  const isTouched = React.useRef(false);

  const save = React.useCallback(() => {
    if (isTouched.current) {
      setEnvironmentChanges(selectedImage);
    }
  }, [selectedImage, setEnvironmentChanges]);

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
      if (!name) {
        setEnvironmentChanges({
          name: generateUniqueEnvironmentName(
            capitalize(selectedImageLanguage),
            selectedImageLanguage
          ),
        });
        return;
      }

      const envNameWithoutSerialNumber = name
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
    [name, setEnvironmentChanges, generateUniqueEnvironmentName]
  );

  const selectBaseImage = React.useCallback(
    (baseImage: string) => {
      if (disabled || !uuid) return;
      isTouched.current = true;
      if (baseImage === customImage.base_image) {
        setSelectedImage(uuid, customImage);
        changeEnvironmentPrefixPerLanguage(customImage.language);
        return;
      }

      const foundDefaultImage = DEFAULT_BASE_IMAGES.find(
        (image) => image.base_image === baseImage
      );
      if (foundDefaultImage) {
        setSelectedImage(uuid, foundDefaultImage);
        changeEnvironmentPrefixPerLanguage(foundDefaultImage.language);
      }
    },
    [
      customImage,
      disabled,
      setSelectedImage,
      uuid,
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
