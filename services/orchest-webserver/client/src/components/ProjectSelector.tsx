// @ts-check
import { useOrchest } from "@/hooks/orchest";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useMatchProjectRoot } from "@/hooks/useMatchProjectRoot";
import { siteMap } from "@/routingConfig";
import type { Project } from "@/types";
import LinearProgress from "@mui/material/LinearProgress";
import { MDCSelectReact } from "@orchest/lib-mdc";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import React from "react";

export type TProjectSelectorRef = any;

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
      })
      .catch((error) => console.log(error));
  };

  // sync state.projectUuid and the route param projectUuid
  React.useEffect(() => {
    if (projectUuidFromRoute) {
      dispatch({ type: "projectSet", payload: projectUuidFromRoute });
    }
  }, [projectUuidFromRoute]);

  React.useEffect(() => {
    // ProjectSelector only appears at Project Root, i.e. pipelines, jobs, and environments
    // in case that project is deleted
    if (matchProjectRoot) fetchProjects();

    return () => {
      promiseManager.cancelCancelablePromises();
    };
  }, [matchProjectRoot]);

  React.useEffect(() => {
    if (state.hasLoadedProjects && matchProjectRoot) {
      const invalidProjectUuid = !validateProjectUuid(
        projectUuidFromRoute,
        state.projects
      );

      if (invalidProjectUuid) {
        // Select the first one from the given projects
        let newProjectUuid =
          state.projects.length > 0 ? state.projects[0].uuid : undefined;

        // navigate ONLY if user is at the project root and
        // we're switching projects (because of detecting an
        // invalidProjectUuid)
        dispatch({ type: "projectSet", payload: newProjectUuid });
        onChangeProject(newProjectUuid);
      }
    }
  }, [state.hasLoadedProjects, projectUuidFromRoute]);

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
    <LinearProgress ref={ref} />
  );
};

export default React.forwardRef(ProjectSelector);
