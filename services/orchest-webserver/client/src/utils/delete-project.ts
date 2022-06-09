import { fetcher, HEADER } from "@orchest/lib-utils";

export const deleteProject = (projectUuid: string) =>
  fetcher("/async/projects", {
    method: "DELETE",
    headers: HEADER.JSON,
    body: JSON.stringify({
      project_uuid: projectUuid,
    }),
  });

export default deleteProject;
