// @ts-check
import React from "react";
import { useHistory } from "react-router-dom";
import { MDCLinearProgressReact, MDCSelectReact } from "@orchest/lib-mdc";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import { useOrchest } from "@/hooks/orchest";
import { generatePathFromRoute, siteMap } from "@/routingConfig";
import type { Project } from "@/types";
import { useMatchProjectRoot } from "@/hooks/useMatchProjectRoot";

export type TProjectSelectorRef = any;
export type TProjectSelectorProps = any;

const ProjectSelector = (_, ref: TProjectSelectorRef) => {
  const { state, dispatch } = useOrchest();
  const history = useHistory();
  const match = useMatchProjectRoot();

  const [promiseManager] = React.useState(new PromiseManager());

  const listProcess = (projects: Project[]) => {
    return projects.map((project) => [project.uuid, project.path]);
  };

  const onChangeProject = (projectId: string) => {
    if (projectId) {
      dispatch({ type: "projectSet", payload: projectId });
      const path = match ? match.path : siteMap.pipeline.path;
      history.push(generatePathFromRoute(path, { projectId }));
    }
  };

  // check whether given project is part of projects
  const validateProjectId = (
    projectId: string | undefined,
    projectsToValidate: Project[]
  ): string | undefined => {
    let foundProjectUUID =
      projectId !== undefined
        ? projectsToValidate.some((project) => project.uuid == projectId)
        : false;

    if (!foundProjectUUID) {
      dispatch({
        type: "projectSet",
        payload: undefined,
      });
    }

    return foundProjectUUID ? projectId : undefined;
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

        // validate the currently selected project, if its invalid
        // it will be set to undefined
        let projectId = validateProjectId(state.project_uuid, fetchedProjects);

        // either there was no selected project or the selection
        // was invalid, set the selection to the first project if possible
        if (projectId === undefined && fetchedProjects.length > 0) {
          projectId = fetchedProjects[0].uuid;
          onChangeProject(projectId);
        }

        // setSelectItems(listProcess(projectsRes));
        // setProjects(projectsRes);
        // Needs to be here in case the request is cancelled, will otherwise
        // result in an uncaught error that can throw off cypress.
      })
      .catch((error) => console.log(error));
  };

  React.useEffect(() => {
    const isExistingProject = validateProjectId(
      state.project_uuid,
      state.projects
    );
    // We only fetch projects again if the given project is not part of the current projects on FE
    if (!isExistingProject) fetchProjects();

    return () => {
      promiseManager.cancelCancelablePromises();
    };
  }, [state.project_uuid, state.projects]);

  const selectItems = listProcess(state.projects);

  return state.projects ? (
    <MDCSelectReact
      ref={ref}
      label="Project"
      notched={true}
      classNames={["project-selector", "fullwidth"]}
      options={selectItems}
      onChange={onChangeProject}
      value={state?.project_uuid}
      data-test-id="project-selector"
    />
  ) : (
    <MDCLinearProgressReact ref={ref} />
  );
};

export default React.forwardRef(ProjectSelector);
