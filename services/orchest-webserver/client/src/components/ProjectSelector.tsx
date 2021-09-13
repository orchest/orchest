// @ts-check
import React from "react";

import { MDCLinearProgressReact, MDCSelectReact } from "@orchest/lib-mdc";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import { useOrchest } from "@/hooks/orchest";
import { siteMap } from "@/routingConfig";
import type { Project } from "@/types";
import { useMatchProjectRoot } from "@/hooks/useMatchProjectRoot";
import { useCustomRoute } from "@/hooks/useCustomRoute";

export type TProjectSelectorRef = any;

[siteMap];

const ProjectSelector = (_, ref: TProjectSelectorRef) => {
  const { state, dispatch } = useOrchest();
  const { navigateTo, projectUuid: projectUuidFromRoute } = useCustomRoute();
  const matchProjectRoot = useMatchProjectRoot();

  const [promiseManager] = React.useState(new PromiseManager());

  const onChangeProject = (uuid: string) => {
    if (uuid) {
      const path = matchProjectRoot
        ? matchProjectRoot.path
        : siteMap.pipelines.path;
      navigateTo(path, { query: { projectUuid: uuid } });
    }
  };

  // check whether given project is part of projects
  const validateProjectUuid = (
    uuidToValidate: string | undefined,
    projects: Project[]
  ): string | undefined => {
    let isValid =
      uuidToValidate !== undefined
        ? projects.some((project) => project.uuid == uuidToValidate)
        : false;

    if (!isValid) {
      dispatch({
        type: "projectSet",
        payload: undefined,
      });
    }

    return isValid ? uuidToValidate : undefined;
  };

  const fetchProjects = () => {
    let fetchProjectsPromise = makeCancelable(
      makeRequest("GET", "/async/projects?skip_discovery=true"),
      promiseManager
    );

    fetchProjectsPromise.promise
      .then((response: string) => {
        let fetchedProjects: Project[] = JSON.parse(response);

        dispatch({
          type: "projectsSet",
          payload: fetchedProjects,
        });

        // Select the first one from the given projects, ONLY if user is at the project root
        if (matchProjectRoot && fetchedProjects.length > 0) {
          onChangeProject(fetchedProjects[0].uuid);
        }
      })
      .catch((error) => console.log(error));
  };

  // sync state.projectUuid and the route param projectUuid
  React.useEffect(() => {
    dispatch({ type: "projectSet", payload: projectUuidFromRoute });
  }, [projectUuidFromRoute]);
  // whenever state.projectUuid is changed, fetch proejcts when necessary
  // so we don't need to do this in other places, just in this component
  React.useEffect(() => {
    const isExistingProject = validateProjectUuid(
      state.projectUuid,
      state.projects
    );
    // We only fetch projects again if the given project is not part of the current projects on FE
    if (!isExistingProject) fetchProjects();

    return () => {
      promiseManager.cancelCancelablePromises();
    };
  }, [state.projectUuid]);

  const selectItems = state.projects.map((project) => [
    project.uuid,
    project.path,
  ]);

  // ProjectSelector only appears when user is at the project root, i.e. Pipelines, Jobs and Environments
  if (!matchProjectRoot) return null;
  return state.projects ? (
    <MDCSelectReact
      ref={ref}
      label="Project"
      notched={true}
      classNames={["project-selector", "fullwidth"]}
      options={selectItems}
      onChange={onChangeProject}
      value={state.projectUuid}
      data-test-id="project-selector"
    />
  ) : (
    <MDCLinearProgressReact ref={ref} />
  );
};

export default React.forwardRef(ProjectSelector);
