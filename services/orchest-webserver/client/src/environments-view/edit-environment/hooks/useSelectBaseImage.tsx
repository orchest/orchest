import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useAppContext } from "@/contexts/AppContext";
import {
  BASE_IMAGE_LANGUAGES,
  DEFAULT_BASE_IMAGES,
  getNewEnvironmentName,
  isEnvironmentBuilding,
} from "@/environments-view/common";
import { useEnvironmentOnEdit } from "@/environments-view/stores/useEnvironmentOnEdit";
import { CustomImage } from "@/types";
import { capitalize } from "@/utils/text";
import { hasValue } from "@orchest/lib-utils";
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
      if (!environmentOnEdit?.name) {
        setEnvironmentOnEdit({
          name: generateUniqueEnvironmentName(
            capitalize(selectedImageLanguage),
            selectedImageLanguage
          ),
        });
        return;
      }

      let environmentNameParts: string[] | undefined;
      for (const language of BASE_IMAGE_LANGUAGES) {
        const regex = new RegExp(`(^${language})(.*)`, "i");
        const matches = environmentOnEdit.name.match(regex);
        if (matches) {
          environmentNameParts = matches.slice(1, 3);
          break;
        }
      }

      if (
        hasValue(environmentNameParts) &&
        environmentNameParts[0].toLowerCase() !== selectedImageLanguage
      ) {
        setEnvironmentOnEdit({
          name: generateUniqueEnvironmentName(
            `${capitalize(selectedImageLanguage)}${environmentNameParts[1]}`,
            selectedImageLanguage
          ),
        });
      }
    },
    [
      environmentOnEdit?.name,
      setEnvironmentOnEdit,
      generateUniqueEnvironmentName,
    ]
  );

  const selectBaseImage = React.useCallback(
    (baseImage: string) => {
      if (disabled || !environmentOnEdit?.uuid) return;
      isTouched.current = true;
      if (baseImage === customImage.base_image) {
        setSelectedImage(environmentOnEdit.uuid, customImage);
        changeEnvironmentPrefixPerLanguage(customImage.language);
        return;
      }

      const foundDefaultImage = DEFAULT_BASE_IMAGES.find((image) =>
        [image.base_image, `${image.base_image}:${orchestVersion}`].includes(
          baseImage
        )
      );
      if (foundDefaultImage) {
        setSelectedImage(environmentOnEdit.uuid, foundDefaultImage);
        changeEnvironmentPrefixPerLanguage(foundDefaultImage.language);
      }
    },
    [
      customImage,
      disabled,
      orchestVersion,
      setSelectedImage,
      environmentOnEdit?.uuid,
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
