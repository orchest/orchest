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
    uuidToValidate: string | undefined | null,
    projects: Project[]
  ): string | undefined => {
    let isValid = uuidToValidate
      ? projects.some((project) => project.uuid == uuidToValidate)
      : false;

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

        // Select the first one from the given projects
        const newProjectUuid =
          fetchedProjects.length > 0 ? fetchedProjects[0].uuid : null;

        dispatch({ type: "projectSet", payload: newProjectUuid });

        // navigate ONLY if user is at the project root
        if (matchProjectRoot) onChangeProject(newProjectUuid);
      })
      .catch((error) => console.log(error));
  };

  // sync state.projectUuid and the route param projectUuid
  React.useEffect(() => {
    dispatch({ type: "projectSet", payload: projectUuidFromRoute });
  }, [projectUuidFromRoute]);
  React.useEffect(() => {
    // ProjectSelector only appears at Project Root, i.e. pipelines, jobs, and environments
    const isSwitchingToProjectRoot = matchProjectRoot && !projectUuidFromRoute;
    // in case that project is deleted
    const invalidProjectUuid = !validateProjectUuid(
      projectUuidFromRoute,
      state.projects
    );
    if (isSwitchingToProjectRoot || invalidProjectUuid) fetchProjects();

    return () => {
      promiseManager.cancelCancelablePromises();
    };
  }, [projectUuidFromRoute, matchProjectRoot]);

  const selectItems = state.projects.map((project) => [
    project.uuid,
    project.path,
  ]);

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
