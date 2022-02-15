import { DEFAULT_BASE_IMAGES } from "@/environment-edit-view/common";
import { CustomImage, Environment } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import { isEmptyObject } from "jquery";
import React from "react";
import useSWR from "swr";
import { MutatorCallback } from "swr/dist/types";

export function useFetchEnvironment(initialEnvironment: Environment) {
  const { project_uuid, uuid } = initialEnvironment;

  const isExistingEnvironment = Boolean(project_uuid) && Boolean(uuid);

  const [newEnvironment, setNewEnvironment] = React.useState<Environment>(
    initialEnvironment
  );

  // TODO: if environment is not available, BE should return 404
  // currently it returns an empty object `{}`
  const { data, error, isValidating, mutate } = useSWR<Environment>(
    isExistingEnvironment
      ? `/store/environments/${project_uuid}/${uuid}`
      : null,
    fetcher
  );

  const setEnvironment = React.useCallback(
    (
      data?: Environment | Promise<Environment> | MutatorCallback<Environment>
    ) => mutate(data, false),
    [mutate]
  );

  /**
   * according to the fetched environment, extract custom image (if any), and load it into the state `customImage`
   * Note that this only occurs when `customImage` is empty; otherwise, when user select other default images, the custom image will disappear
   */
  const [customImage, setCustomImage] = React.useState<CustomImage>(null);

  React.useEffect(() => {
    if (data && uuid && !customImage) {
      setCustomImage(
        !DEFAULT_BASE_IMAGES.some(
          (image) => data.base_image === image.base_image
        )
          ? data
          : null
      );
    }
  }, [data, uuid, customImage]);

  return {
    environment: isEmptyObject(data) ? newEnvironment : data,
    error: isEmptyObject(data) ? "Failed to fetch environment" : error,
    isFetchingEnvironment: isValidating,
    fetchEnvironment: mutate,
    setEnvironment: isExistingEnvironment ? setEnvironment : setNewEnvironment,
    customImage,
    setCustomImage,
  };
}
