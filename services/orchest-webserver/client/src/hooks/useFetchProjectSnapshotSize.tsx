import React from "react";
import { useFetchProject } from "./useFetchProject";

export const useFetchProjectSnapshotSize = (
  projectUuid: string | undefined
) => {
  const { project } = useFetchProject(projectUuid);

  const projectSnapshotSize = React.useMemo(() => {
    return project ? project.project_snapshot_size : 0;
  }, [project]);

  return projectSnapshotSize;
};
