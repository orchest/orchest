import { useDebounce } from "@/hooks/useDebounce";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { alpha, styled } from "@mui/material/styles";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { visuallyHidden } from "@mui/utils";
import React from "react";

const Search = styled("div")(({ theme }) => ({
  position: "relative",
  borderRadius: theme.spacing(1),
  border: `1px solid ${alpha(theme.palette.grey[300], 0.7)}`,
  backgroundColor: alpha(theme.palette.grey[300], 0.2),
  "&:hover": {
    backgroundColor: alpha(theme.palette.grey[300], 0.3),
  },
  margin: theme.spacing(2, 0),
  width: "100%",
}));

const SearchIconWrapper = styled("div")(({ theme }) => ({
  padding: theme.spacing(0, 1, 0, 2),
  color: theme.palette.grey[400],
  height: "100%",
  position: "absolute",
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: "inherit",
  width: "100%",
  "& .MuiInputBase-input": {
    padding: theme.spacing(1.5, 1, 1.5, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create("width"),
    width: "100%",
  },
}));

function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }
  return 0;
}

type Order = "asc" | "desc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getComparator<Key extends keyof any>(
  order: Order,
  orderBy: Key
): (
  a: { [key in Key]: number | string },
  b: { [key in Key]: number | string }
) => number {
  return order === "desc"
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

export type HeadCell<T> = {
  disablePadding?: boolean;
  id: keyof T;
  label: string;
  numeric?: boolean;
};

type EnhancedTableProps<T> = {
  numSelected: number;
  onRequestSort: (event: React.MouseEvent<unknown>, property: keyof T) => void;
  onSelectAllClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  order: Order;
  orderBy: keyof T | "";
  rowCount: number;
  data: HeadCell<T>[];
  selectable: boolean;
};

function EnhancedTableHead<T>(props: EnhancedTableProps<T>) {
  const {
    onSelectAllClick,
    order,
    orderBy,
    numSelected,
    rowCount,
    onRequestSort,
    selectable,
    data,
  } = props;
  const createSortHandler = (property: keyof T) => (
    event: React.MouseEvent<unknown>
  ) => {
    onRequestSort(event, property);
  };

  return (
    <TableHead>
      <TableRow>
        {selectable && (
          <TableCell padding="checkbox">
            <Checkbox
              color="primary"
              indeterminate={numSelected > 0 && numSelected < rowCount}
              checked={rowCount > 0 && numSelected === rowCount}
              onChange={onSelectAllClick}
              inputProps={{ "aria-label": "select all desserts" }}
            />
          </TableCell>
        )}
        {data.map((headCell) => (
          <TableCell
            key={headCell.id.toString()}
            align={headCell.numeric ? "right" : "left"}
            padding={headCell.disablePadding ? "none" : "normal"}
            sortDirection={orderBy === headCell.id ? order : false}
          >
            <TableSortLabel
              active={orderBy === headCell.id}
              direction={orderBy === headCell.id ? order : "asc"}
              onClick={createSortHandler(headCell.id)}
            >
              {headCell.label}
              {orderBy === headCell.id ? (
                <Box component="span" sx={visuallyHidden}>
                  {order === "desc" ? "sorted descending" : "sorted ascending"}
                </Box>
              ) : null}
            </TableSortLabel>
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}

export type DataTableRenders<T> = Partial<
  Record<keyof T, (row: T & { uuid: string }) => React.ReactNode>
>;

type DataTableProps<T> = {
  headCells: HeadCell<T>[];
  rows: (T & { uuid: string })[];
  id: string;
  selectable?: boolean;
  initialOrderBy?: keyof T;
  initialOrder?: Order;
  deleteSelectedRows?: (rowUuids: string[]) => void;
  onRowClick?: (uuid: string) => void;
  renderers?: DataTableRenders<T>;
  rowHeight?: number;
  debounceTime?: number;
  [key: string]: any;
};

export const DataTable = <T extends Record<string, any>>({
  id,
  headCells,
  rows: originalRows,
  initialOrderBy,
  initialOrder,
  deleteSelectedRows,
  onRowClick,
  selectable = false,
  renderers = {},
  rowHeight = 57,
  debounceTime = 250,
  ...props
}: DataTableProps<T>) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, debounceTime);
  const [order, setOrder] = React.useState<Order>(initialOrder || "asc");
  const [orderBy, setOrderBy] = React.useState<keyof T | "">(
    initialOrderBy || ""
  );
  const [selected, setSelected] = React.useState<string[]>([]);
  const [page, setPage] = React.useState(0);

  const [rowsPerPage, setRowsPerPage] = React.useState<number>(10);

  const sortedRows = React.useMemo(() => {
    return originalRows.sort(getComparator(order, orderBy));
  }, [order, orderBy, originalRows]);

  // search is more expensive, should put later than sort
  const rows = React.useMemo(() => {
    return !debouncedSearchTerm
      ? sortedRows
      : sortedRows.filter((unfilteredRow) => {
          return Object.entries(unfilteredRow).some(([, value]) =>
            value.toString().toLowerCase().includes(debouncedSearchTerm)
          );
        });
  }, [sortedRows, debouncedSearchTerm]);

  React.useEffect(() => {
    setSelected((currentSelected) => {
      return currentSelected.filter((selectedRowUuid) =>
        rows.some((row) => row.uuid === selectedRowUuid)
      );
    });
  }, [rows]);

  const handleRequestSort = (
    event: React.MouseEvent<unknown>,
    property: keyof T
  ) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelectedRows = rows.map((n) => n.uuid);
      setSelected(newSelectedRows);
      return;
    }
    setSelected([]);
  };

  const handleClickCheckbox = (e: React.MouseEvent<unknown>, uuid: string) => {
    if (!selectable) return;
    // prevent firing handleClickRow
    e.stopPropagation();
    setSelected((currentSelected) => {
      const selectedIndex = currentSelected.indexOf(uuid);

      if (selectedIndex === -1) return [...currentSelected, uuid];

      if (selectedIndex === 0) return currentSelected.slice(1);

      if (selectedIndex === selected.length - 1)
        return currentSelected.slice(0, -1);

      return [
        ...selected.slice(0, selectedIndex),
        ...selected.slice(selectedIndex + 1),
      ];
    });
  };

  const handleClickRow = (e: React.MouseEvent<unknown>, uuid: string) => {
    if (!selectable) return;
    // if onRowClick is not defined, select the row as default
    if (onRowClick) {
      e.preventDefault();
      onRowClick(uuid);
    } else {
      handleClickCheckbox(e, uuid);
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDeleteSelectedRows = () => {
    if (deleteSelectedRows) deleteSelectedRows(selected);
    setSelected([]);
  };

  const isSelected = (uuid: string) => selected.indexOf(uuid) !== -1;

  // Avoid a layout jump when reaching the last page with empty rows.
  const emptyRows =
    page > 0 ? Math.max(0, (1 + page) * rowsPerPage - rows.length) : 0;

  const tableTitleId = `${id}-title`;

  const headKey = headCells[0].id;

  return (
    <Box sx={{ width: "100%" }} {...props}>
      <Search>
        <SearchIconWrapper>
          <SearchIcon />
        </SearchIconWrapper>
        <StyledInputBase
          placeholder="Search"
          inputProps={{ "aria-label": "search" }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </Search>
      <Paper sx={{ width: "100%", mb: 2 }}>
        <TableContainer>
          <Table
            sx={{ minWidth: 750 }}
            aria-labelledby={tableTitleId}
            size="medium"
            id={id}
          >
            <EnhancedTableHead
              selectable={selectable}
              numSelected={selected.length}
              order={order}
              orderBy={orderBy}
              onSelectAllClick={handleSelectAllClick}
              onRequestSort={handleRequestSort}
              rowCount={rows.length}
              data={headCells}
            />
            <TableBody>
              {rows
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row: T & { uuid: string }) => {
                  const isItemSelected = isSelected(row.uuid);
                  const labelId = `${id}-checkbox-${row.uuid}`;

                  return (
                    <TableRow
                      hover
                      onClick={(e) => handleClickRow(e, row.uuid)}
                      role="checkbox"
                      aria-checked={isItemSelected}
                      tabIndex={-1}
                      key={row.uuid}
                      selected={isItemSelected}
                      sx={selectable ? { cursor: "pointer" } : null}
                    >
                      {selectable && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            color="primary"
                            checked={isItemSelected}
                            onClick={(e) => handleClickCheckbox(e, row.uuid)}
                            inputProps={{ "aria-labelledby": labelId }}
                          />
                        </TableCell>
                      )}
                      <TableCell
                        component="th"
                        id={labelId}
                        scope="row"
                        padding="normal"
                      >
                        {renderers[headKey]
                          ? renderers[headKey](row)
                          : row[headKey]}
                      </TableCell>
                      {headCells.slice(1).map(({ id }) => {
                        const cellValue = row[id];
                        console.log("🥁");
                        console.log(cellValue);
                        return (
                          <TableCell
                            key={id.toString()}
                            align={
                              typeof cellValue === "number" ? "right" : "left"
                            }
                          >
                            {renderers[id] ? renderers[id](row) : cellValue}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              {emptyRows > 0 && (
                <TableRow style={{ height: rowHeight * emptyRows }}>
                  <TableCell colSpan={6} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack direction="row">
          {selected.length > 0 && (
            <Stack direction="row" alignItems="center">
              <Typography
                color={selected.length > 0 ? "inherit" : "initial"}
                variant="subtitle1"
                component="div"
                sx={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  marginLeft: (theme) => theme.spacing(2.5),
                  marginRight: (theme) => theme.spacing(2),
                }}
              >
                {selected.length > 0 ? `${selected.length} selected` : ""}
              </Typography>
              {deleteSelectedRows && (
                <Tooltip title="Delete">
                  <IconButton onClick={handleDeleteSelectedRows}>
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          )}
          <TablePagination
            sx={{ flex: 1 }}
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={rows.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Stack>
      </Paper>
    </Box>
  );
};
