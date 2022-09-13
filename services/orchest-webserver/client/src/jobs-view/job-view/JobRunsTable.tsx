import { useJobRunsApi } from "@/api/job-runs/useJobRunsApi";
import RouteLink from "@/components/RouteLink";
import { useRouteLink } from "@/hooks/useCustomRoute";
import { PipelineRun, PipelineRunStatus } from "@/types";
import { capitalize } from "@/utils/text";
import { ChevronRightSharp } from "@mui/icons-material";
import CancelOutlined from "@mui/icons-material/CancelOutlined";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined"; // cs
import PlayCircleOutline from "@mui/icons-material/PlayCircleOutline";
import StopCircleOutlined from "@mui/icons-material/StopCircleOutlined";
import {
  Collapse,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import format from "date-fns/format";
import React from "react";
import { formatPipelineParams } from "../common";

export type JobRunsTableProps = {
  runs: PipelineRun[];
  pageSize: number;
  pageNumber: number;
  totalCount: number;
  setPageNumber: (pageNumber: number) => void;
  setPageSize: (pageSize: number) => void;
};

const cellStyle: Record<number, React.CSSProperties> = {
  0: { width: 0, padding: 0, margin: 0 },
  2: { width: "45%" },
};

type ContextMenuState = {
  run?: PipelineRun | undefined;
  isOpen?: boolean;
  anchorEl?: Element | undefined;
};

const canCancelRun = (run: PipelineRun | undefined): run is PipelineRun =>
  run?.status === "STARTED" || run?.status === "PENDING";

export const JobRunsTable = ({
  runs,
  pageSize,
  totalCount,
  pageNumber,
  setPageNumber,
  setPageSize,
}: JobRunsTableProps) => {
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState>({});
  const cancelRun = useJobRunsApi((api) => api.cancel);

  const openContextMenu = (run: PipelineRun, anchorEl: Element) => {
    setContextMenu({ run, anchorEl, isOpen: true });
  };

  const closeContextMenu = React.useCallback(() => {
    setContextMenu((state) => ({
      ...state,
      runUuid: undefined,
      isOpen: false,
    }));
  }, []);

  const onClickCancelRun = () => {
    const { run } = contextMenu;

    if (canCancelRun(run)) {
      cancelRun(run.uuid).then(closeContextMenu);
    }
  };

  return (
    <>
      <Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell style={cellStyle[0]} />
                <TableCell style={cellStyle[1]}>ID</TableCell>
                <TableCell style={cellStyle[2]}>Parameters</TableCell>
                <TableCell style={cellStyle[3]}>Status</TableCell>
                <TableCell style={cellStyle[4]}>Started</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {runs.map((run) => (
                <RunRow
                  key={run.uuid}
                  run={run}
                  openContextMenu={(anchorEl) => openContextMenu(run, anchorEl)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={totalCount}
          rowsPerPage={pageSize}
          page={pageNumber - 1}
          onPageChange={(_, newPage) => setPageNumber(newPage + 1)}
          onRowsPerPageChange={(event) =>
            setPageSize(Number(event.target.value))
          }
        />
      </Box>
      <Menu
        anchorEl={contextMenu.anchorEl}
        id="pipeline-settings-menu"
        open={contextMenu.isOpen || false}
        onClose={closeContextMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={onClickCancelRun}
          disabled={!canCancelRun(contextMenu.run)}
        >
          <ListItemIcon>
            <StopCircleOutlined />
          </ListItemIcon>
          <ListItemText>Cancel run</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

type RunRowProps = {
  run: PipelineRun;
  openContextMenu: (anchorEl: Element) => void;
};

const RunRow = ({ run, openContextMenu }: RunRowProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const pipelineUrl = useRouteLink("jobRun", {
    runUuid: run.uuid,
    jobUuid: run.job_uuid,
    pipelineUuid: run.pipeline_uuid,
  });

  return (
    <>
      <TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
        <TableCell style={cellStyle[0]}>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setIsOpen(!isOpen)}
          >
            <ChevronRightSharp
              style={{
                transform: isOpen ? "rotate(90deg)" : undefined,
                transition: "transform 150ms ease-in",
              }}
            />
          </IconButton>
        </TableCell>
        <TableCell style={cellStyle[1]}>{run.job_run_index}</TableCell>
        <TableCell style={cellStyle[2]}>
          <Stack direction="row" justifyContent="space-between">
            {run.parameters ? formatPipelineParams(run.parameters) : "—"}
            <RouteLink underline="none" to={pipelineUrl}>
              VIEW
            </RouteLink>
          </Stack>
        </TableCell>
        <TableCell style={cellStyle[3]}>
          <Chip
            sx={{ paddingLeft: (theme) => theme.spacing(0.5) }}
            icon={<RunStatusIcon status={run.status} />}
            label={capitalize(run.status.toLowerCase())}
          />
        </TableCell>
        <TableCell style={cellStyle[4]}>
          <Stack direction="row" justifyContent="space-between">
            {run.started_time ? formatDate(run.started_time) : "—"}
            <IconButton
              onClick={({ currentTarget }) => openContextMenu(currentTarget)}
            >
              <MoreHorizOutlinedIcon fontSize="small" />
            </IconButton>
          </Stack>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={4}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}></Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

type RunStatusIconProps = { status: PipelineRunStatus };

const RunStatusIcon = ({ status }: RunStatusIconProps) => {
  switch (status) {
    case "SUCCESS":
      return <CheckCircleOutline fontSize="small" color="success" />;
    case "ABORTED":
      return <StopCircleOutlined fontSize="small" color="error" />;
    case "FAILURE":
      return <CancelOutlined fontSize="small" color="error" />;
    case "STARTED":
      return <PlayCircleOutline fontSize="small" />;
    default:
      return null;
  }
};

const formatDate = (dateStr: string) =>
  format(new Date(dateStr), "MMM d yyyy, p");
