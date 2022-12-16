import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { IconButton } from "@/components/common/IconButton";
import { ProjectContextMenu } from "@/components/common/ProjectContextMenu";
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

export type ProjectRow = Pick<
  Project,
  "uuid" | "path" | "pipeline_count" | "session_count" | "active_job_count"
> & {
  settings: boolean;
};

export const ProjectsTable = () => {
  const projects = useProjectsApi((api) => api.projects ?? []);
  const deleting = useProjectsApi((api) => api.deleting);
  const { navigateTo } = useCustomRoute();
  const [menuAnchorEl, setMenuAnchorEl] = React.useState<HTMLElement>();
  const [openProject, setOpenProject] = React.useState<Project>();
  const onRowClick = (event: React.MouseEvent, projectUuid: string) =>
    navigateTo(siteMap.pipeline.path, { query: { projectUuid } }, event);

  const openContextMenu = React.useCallback(
    (event: React.MouseEvent, projectUuid: string) => {
      event.preventDefault();
      event.stopPropagation();

      setMenuAnchorEl(event.target as HTMLElement);
      setOpenProject(projects?.[projectUuid]);
    },
    [projects]
  );

  const closeContextMenu = React.useCallback(() => {
    setMenuAnchorEl(undefined);
    setOpenProject(undefined);
  }, []);

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
        sx: { margin: (theme) => theme.spacing(-0.5, 0), textAlign: "right" },
        render: function ProjectSettingsButton(row, disabled) {
          return !deleting.includes(row.uuid) ? (
            <IconButton
              title="More options"
              disabled={disabled}
              size="small"
              onClick={(event) => openContextMenu(event, row.uuid)}
              data-test-id={`project-settings-button-${row.id}`}
            >
              <MoreHorizOutlinedIcon fontSize="small" />
            </IconButton>
          ) : (
            "Deleting..."
          );
        },
      },
    ];
  }, [deleting, openContextMenu]);

  const projectRows: DataTableRow<ProjectRow>[] = React.useMemo(
    () =>
      Object.values(projects).map((project) => ({
        ...project,
        id: project.uuid,
        settings: true,
        disabled: deleting.includes(project.uuid),
      })),
    [deleting, projects]
  );

  return (
    <>
      <DataTable<ProjectRow>
        id="projects-table"
        isLoading={!hasValue(projects)}
        hideSearch
        onRowClick={onRowClick}
        columns={columns}
        rows={projectRows}
        data-test-id="projects-table"
      />
      {openProject && menuAnchorEl && (
        <ProjectContextMenu
          project={openProject}
          anchorEl={menuAnchorEl}
          onClose={closeContextMenu}
        />
      )}
    </>
  );
};
