import { IconButton } from "@/components/common/IconButton";
import {
  DataTable,
  DataTableColumn,
  DataTableRow,
} from "@/components/DataTable";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { Project } from "@/types";
import { ellipsis } from "@/utils/styles";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined"; // cspell:disable-line
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { NoProject } from "./NoProject";

export type ProjectRow = Pick<
  Project,
  "path" | "pipeline_count" | "session_count" | "active_job_count"
> & {
  settings: string;
};

export const ProjectsTable = ({
  projects,
  projectsBeingDeleted,
  openProjectMenu,
}: {
  projects: Project[] | undefined;
  projectsBeingDeleted: string[];
  openProjectMenu: (
    uuid: string
  ) => (event: React.MouseEvent<HTMLElement>) => void;
}) => {
  const { navigateTo } = useCustomRoute();
  const onRowClick = (e: React.MouseEvent, projectUuid: string) => {
    navigateTo(siteMap.pipeline.path, { query: { projectUuid } }, e);
  };

  const columns: DataTableColumn<ProjectRow>[] = React.useMemo(() => {
    return [
      {
        id: "path",
        label: "Project",
        sx: { margin: (theme) => theme.spacing(-0.5, 0) },
        render: function ProjectPath(row) {
          return (
            <Tooltip title={row.path}>
              <Box sx={ellipsis((theme) => theme.spacing(60))}>{row.path}</Box>
            </Tooltip>
          );
        },
      },
      { id: "pipeline_count", label: "Pipelines" },
      { id: "session_count", label: "Active sessions" },
      { id: "active_job_count", label: "Active jobs" },
      {
        id: "settings",
        label: "",
        sx: { margin: (theme) => theme.spacing(-0.5, 0) },
        render: function ProjectSettingsButton(row, disabled) {
          return !projectsBeingDeleted.includes(row.uuid) ? (
            <IconButton
              title="settings"
              disabled={disabled}
              size="small"
              data-test-id={`settings-button-${row.path}`}
              onClick={openProjectMenu(row.uuid)}
            >
              <MoreHorizOutlinedIcon fontSize="small" />
            </IconButton>
          ) : (
            "Deleting..."
          );
        },
      },
    ];
  }, [projectsBeingDeleted, openProjectMenu]);

  const projectRows: DataTableRow<ProjectRow>[] = React.useMemo(() => {
    if (!projects) return [];
    return projects.map((project) => {
      return {
        ...project,
        settings: project.path,
        disabled: projectsBeingDeleted.includes(project.uuid),
      };
    });
  }, [projects, projectsBeingDeleted]);

  return projects && projectRows.length === 0 ? (
    <NoProject />
  ) : (
    <DataTable<ProjectRow>
      id="project-list"
      isLoading={!hasValue(projects)}
      hideSearch
      onRowClick={onRowClick}
      columns={columns}
      rows={projectRows}
      data-test-id="projects-table"
    />
  );
};
