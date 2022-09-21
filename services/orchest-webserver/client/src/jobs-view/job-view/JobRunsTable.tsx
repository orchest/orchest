import { RouteLink } from "@/components/RouteLink";
import { useRouteLink } from "@/hooks/useCustomRoute";
import { PipelineRun } from "@/types";
import { ChevronRightSharp } from "@mui/icons-material";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined"; // cs
import StopCircleOutlined from "@mui/icons-material/StopCircleOutlined";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import React from "react";
import { useCancelJobRun } from "../../hooks/useCancelJobRun";
import {
  canCancelRun,
  formatPipelineParams,
  formatRunStatus,
  humanizeDate,
} from "../common";
import { JobStatusIcon } from "../JobStatusIcon";

export type JobRunsTableProps = {
  runs: PipelineRun[];
  pageSize: number;
  pageNumber: number;
  totalCount: number;
  setPageNumber: (pageNumber: number) => void;
  setPageSize: (pageSize: number) => void;
  onLineToggled: (openRows: number) => void;
};

const cellStyle: Record<number, React.CSSProperties> = {
  0: { width: 0, padding: 0, margin: 0 },
  2: { width: "40%" },
};

type ContextMenuState = {
  isOpen?: boolean;
  run?: PipelineRun | undefined;
  anchorEl?: Element | undefined;
};

export const JobRunsTable = ({
  runs,
  pageSize,
  totalCount,
  pageNumber,
  setPageNumber,
  setPageSize,
  onLineToggled,
}: JobRunsTableProps) => {
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState>({});
  const [expanded, setExpanded] = React.useState<number>(0);
  const cancelRun = useCancelJobRun();

  const openContextMenu = (run: PipelineRun, anchorEl: Element) =>
    setContextMenu({ run, anchorEl, isOpen: true });

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

  React.useEffect(() => {
    setExpanded(0);
  }, [pageNumber, pageSize]);

  React.useEffect(() => {
    onLineToggled(expanded);
  }, [expanded, onLineToggled]);

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
                  onExpand={() => setExpanded((count) => count + 1)}
                  onCollapse={() => setExpanded((count) => count - 1)}
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
  onExpand: () => void;
  onCollapse: () => void;
  openContextMenu: (anchorEl: Element) => void;
};

const RunRow = ({
  run,
  openContextMenu,
  onExpand,
  onCollapse,
}: RunRowProps) => {
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
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <span>
              {formatPipelineParams(run.parameters).join(", ").trim() || "—"}
            </span>
            {run.status !== "PENDING" && (
              <RouteLink underline="none" to={pipelineUrl}>
                VIEW
              </RouteLink>
            )}
          </Stack>
        </TableCell>
        <TableCell style={cellStyle[3]}>
          <Chip
            sx={{ paddingLeft: (theme) => theme.spacing(0.5) }}
            icon={<JobStatusIcon status={run.status} />}
            label={formatRunStatus(run.status)}
          />
        </TableCell>
        <TableCell style={cellStyle[4]}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            {run.started_time ? humanizeDate(run.started_time) : "—"}
            <IconButton
              onClick={({ currentTarget }) => openContextMenu(currentTarget)}
            >
              <MoreHorizOutlinedIcon fontSize="small" />
            </IconButton>
          </Stack>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
          <Collapse
            in={isOpen}
            timeout="auto"
            onEnter={onExpand}
            onExited={onCollapse}
            unmountOnExit
          >
            <RunDetails run={run} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

export type RunDetailsProps = { run: PipelineRun };

export const RunDetails = ({ run }: RunDetailsProps) => {
  const params = formatPipelineParams(run.parameters);
  const hasParameters = params.length > 0;

  return (
    <Stack
      sx={{ margin: (theme) => theme.spacing(1, 0) }}
      direction="column"
      justifyContent="flex-start"
    >
      {params.map((param, index) => (
        <Typography variant="caption" key={index}>
          {param}
        </Typography>
      ))}
      {!hasParameters && <NoParameterAlert />}
    </Stack>
  );
};

export const NoParameterAlert = () => {
  return (
    <Typography variant="body2">
      <i>{`This Pipeline didn't have any Parameters defined.`}</i>
    </Typography>
  );
};
