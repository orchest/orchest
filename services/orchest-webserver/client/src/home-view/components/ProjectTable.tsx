import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { IconButton } from "@/components/common/IconButton";
import { ProjectContextMenu } from "@/components/common/ProjectContextMenu";
import { useNavigate } from "@/hooks/useCustomRoute";
import { Project } from "@/types";
import { paginate } from "@/utils/array";
import MoreHorizOutlined from "@mui/icons-material/MoreHorizOutlined";
import { Skeleton } from "@mui/material";
import Box from "@mui/material/Box";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import React from "react";

const ENTRIES_PER_PAGE = 10;

export const ProjectTable = () => {
  const navigate = useNavigate();
  const projectMap = useProjectsApi((api) => api.projects);
  const hasData = projectMap !== undefined;

  const [menuAnchorEl, setMenuAnchorEl] = React.useState<HTMLElement>();
  const [selectedProject, setSelectedProject] = React.useState<Project>();
  const [pageNumber, setPageNumber] = React.useState(1);

  const { items, pageCount } = React.useMemo(
    () =>
      paginate(Object.values(projectMap ?? {}), pageNumber, ENTRIES_PER_PAGE),
    [projectMap, pageNumber]
  );

  const openProject = (project: Project) => {
    navigate({
      route: "pipeline",
      sticky: false,
      query: { projectUuid: project.uuid },
    });
  };

  return (
    <Stack gap={2} alignItems="center" justifyContent="flex-start">
      <Box height={625} width="100%">
        <Table aria-label="project list" size="small">
          <TableHead>
            <TableRow>
              <TableCell>Project</TableCell>
              <TableCell>Active sessions</TableCell>
              <TableCell>Active jobs</TableCell>
              <TableCell colSpan={2}>Environments</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {items.map((project) => (
              <TableRow
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => openProject(project)}
                key={project.uuid}
              >
                <TableCell>{project.path}</TableCell>
                <TableCell>{project.session_count}</TableCell>
                <TableCell>{project.active_job_count}</TableCell>
                <TableCell>{project.environment_count}</TableCell>
                <TableCell sx={{ textAlign: "right" }}>
                  <IconButton
                    aria-label="project options"
                    onClick={(event) => {
                      event.stopPropagation();

                      setSelectedProject(project);
                      setMenuAnchorEl(event.target as HTMLElement);
                    }}
                  >
                    <MoreHorizOutlined />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!hasData &&
              Array(3)
                .fill(null)
                .map((_, index) => (
                  <TableRow key={index} sx={{ height: 53 }}>
                    <TableCell>
                      <Skeleton width={100 + Math.random() * 70} />
                    </TableCell>
                    <TableCell>
                      <Skeleton width={24} />
                    </TableCell>
                    <TableCell>
                      <Skeleton width={24} />
                    </TableCell>
                    <TableCell colSpan={2}>
                      <Skeleton width={24} />
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </Box>

      {pageCount > 1 && (
        <Pagination
          color="primary"
          page={pageNumber}
          count={pageCount}
          onChange={(_, page) => setPageNumber(page)}
        />
      )}

      {selectedProject && (
        <ProjectContextMenu
          anchorEl={menuAnchorEl}
          project={selectedProject}
          onClose={() => setSelectedProject(undefined)}
        />
      )}
    </Stack>
  );
};
