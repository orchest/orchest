import React from "react";

export const useAutoChangeProject = (
  validProjectUuid: string | undefined,
  projectUuidFromRoute: string | undefined,
  projectPath: string | undefined,
  customNavigateTo: (projectUuid: string, path: string | undefined) => void
) => {
  const onChangeProject = React.useCallback(
    (uuid: string) => {
      if (uuid) {
        customNavigateTo(uuid, projectPath);
      }
    },
    [projectPath, customNavigateTo]
  );

  React.useEffect(() => {
    // Only change project if validProjectUuid is different from projectUuidFromRoute
    // if validProjectUuid is undefined, it means that the page is being loaded for the first time,
    // no need to change project.
    if (validProjectUuid && validProjectUuid !== projectUuidFromRoute) {
      onChangeProject(validProjectUuid);
    }
  }, [validProjectUuid, onChangeProject, projectUuidFromRoute]);

  return onChangeProject;
};
