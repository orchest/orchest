// @ts-check
import React from "react";
import { MDCLinearProgressReact, MDCSelectReact } from "@orchest/lib-mdc";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import { useOrchest } from "@/hooks/orchest";

export type TProjectSelectorRef = any;
export type TProjectSelectorProps = any;

const ProjectSelector = React.forwardRef<
  TProjectSelectorRef,
  TProjectSelectorProps
>((_, ref) => {
  const { state, dispatch } = useOrchest();
  const [selectItems, setSelectItems] = React.useState(null);
  const [projects, setProjects] = React.useState(null);

  const [promiseManager] = React.useState(new PromiseManager());

  const listProcess = (projects) => {
    let options = [];

    for (let project of projects) {
      options.push([project.uuid, project.path]);
    }

    return options;
  };

  const onChangeProject = (project_uuid) => {
    if (project_uuid) {
      dispatch({ type: "projectSet", payload: project_uuid });
    }
  };

  // check whether selected project is valid
  const validatePreSelectedProject = (project_uuid, projectsToValidate) => {
    let foundProjectUUID = false;

    for (let project of projectsToValidate) {
      if (project.uuid === project_uuid) {
        foundProjectUUID = true;
        break;
      }
    }

    if (!foundProjectUUID) {
      // selected project doesn't exist anymore
      project_uuid = undefined;
    }

    onChangeProject(project_uuid);
  };

  const fetchProjects = () => {
    let fetchProjectsPromise = makeCancelable(
      makeRequest("GET", "/async/projects?skip_discovery=true"),
      promiseManager
    );

    // @ts-ignore
    fetchProjectsPromise.promise.then((response) => {
      let projectsRes = JSON.parse(response);

      // validate the currently selected project, if its invalid
      // it will be set to undefined
      let project_uuid = state.project_uuid;
      if (project_uuid !== undefined) {
        validatePreSelectedProject(project_uuid, projectsRes);
      }

      // either there was no selected project or the selection
      // was invalid, set the selection to the first project if possible
      project_uuid = state.project_uuid;
      if (project_uuid === undefined && projectsRes.length > 0) {
        project_uuid = projectsRes[0].uuid;
        onChangeProject(project_uuid);
      }

      setSelectItems(listProcess(projectsRes));
      setProjects(projectsRes);
    });
  };

  React.useEffect(() => {
    fetchProjects();

    return () => {
      promiseManager.cancelCancelablePromises();
    };
  }, [state.project_uuid]);

  return projects ? (
    <MDCSelectReact
      ref={ref}
      label="Project"
      notched={true}
      classNames={["project-selector", "fullwidth"]}
      options={selectItems}
      onChange={onChangeProject.bind(this)}
      value={state?.project_uuid}
    />
  ) : (
    <MDCLinearProgressReact ref={ref} />
  );
});

export default ProjectSelector;
