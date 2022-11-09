import { useGlobalContext } from "@/contexts/GlobalContext";
import { StateDispatcher, useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { useForceUpdate } from "@/hooks/useForceUpdate";
import { useInterval } from "@/hooks/useInterval";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useMounted } from "@/hooks/useMounted";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import Alert from "@mui/material/Alert";
import Box, { BoxProps } from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Collapse from "@mui/material/Collapse";
import Fade from "@mui/material/Fade";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { SxProps, Theme } from "@mui/material/styles";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";
import { visuallyHidden } from "@mui/utils";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { IconButton } from "./common/IconButton";
import { SearchField } from "./SearchField";

function descendingComparator(
  a: Record<string, string | number>,
  b: Record<string, string | number>,
  orderBy: string | number
) {
  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }
  return 0;
}

type Order = "asc" | "desc";

function getComparator(
  order: Order,
  orderBy: string
): (
  a: Record<string, number | string>,
  b: Record<string, number | string>
) => number {
  return order === "desc"
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

export type DataTableColumn<T, C = T> = {
  disablePadding?: boolean;
  id: keyof C;
  label: string;
  numeric?: boolean;
  sortable?: boolean;
  align?: "inherit" | "left" | "center" | "right" | "justify";
  sx?: SxProps<Theme>;
  render?: (row: T & { id: string }, disabled?: boolean) => React.ReactNode;
};

export type DataTableRow<T> = T & {
  /**
   * Something that uniquely identifies the row within the table.
   * Used as `key` and within the `data-test-id`.
   */
  id: string;
  disabled?: boolean;
  // in case you're rendering something totally different from the data
  // provide a searchIndex for matching user's search term
  searchIndex?: string;
  details?: React.ReactNode;
};

type EnhancedTableProps<T, C> = {
  tableId: string;
  numSelected: number;
  onRequestSort: (event: React.MouseEvent<unknown>, property: string) => void;
  onSelectAllClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  order: Order;
  orderBy: keyof C | "";
  rowCount: number;
  data: DataTableColumn<T, C>[];
  selectable: boolean;
  disabled: boolean;
};

function EnhancedTableHead<T, C>(props: EnhancedTableProps<T, C>) {
  const {
    tableId,
    onSelectAllClick,
    order,
    orderBy,
    numSelected,
    rowCount,
    onRequestSort,
    selectable,
    disabled,
    data,
  } = props;
  const createSortHandler = (property: string) => (
    event: React.MouseEvent<unknown>
  ) => {
    onRequestSort(event, property);
  };

  return (
    <TableHead>
      <TableRow>
        {selectable && (
          <TableCell padding="checkbox" align="center">
            <Checkbox
              color="primary"
              indeterminate={numSelected > 0 && numSelected < rowCount}
              checked={rowCount > 0 && numSelected === rowCount}
              onChange={onSelectAllClick}
              disabled={disabled}
              inputProps={{ "aria-label": "select all desserts" }}
              data-test-id={`${tableId}-toggle-all-rows`}
            />
          </TableCell>
        )}
        {data.map((headCell, index) => (
          <TableCell
            key={headCell.id.toString()}
            align={index === 0 ? "left" : headCell.align || "left"}
            padding={headCell.disablePadding ? "none" : "normal"}
            sortDirection={orderBy === headCell.id ? order : false}
          >
            <Box sx={headCell.sx}>
              {headCell.sortable ? (
                <TableSortLabel
                  active={orderBy === headCell.id}
                  direction={orderBy === headCell.id ? order : "asc"}
                  disabled={disabled}
                  onClick={createSortHandler(headCell.id.toString())}
                >
                  {headCell.label}
                  {orderBy === headCell.id ? (
                    <Box component="span" sx={visuallyHidden}>
                      {order === "desc"
                        ? "sorted descending"
                        : "sorted ascending"}
                    </Box>
                  ) : null}
                </TableSortLabel>
              ) : (
                headCell.label
              )}
            </Box>
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}

// this container has built-in Skeleton
// and by default, we limit height to ensure consistent rowHeight
// it could be overwritten with sx if needed.
const CellContainer: React.FC<{
  isLoading: boolean | undefined;
  sx?: SxProps<Theme>;
  skeletonSx?: SxProps<Theme>;
  onAuxClick?: (e: React.MouseEvent) => void;
}> = ({ isLoading, sx, skeletonSx, onAuxClick, children }) => {
  const auxClickHandler = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAuxClick?.(e);
  };
  return (
    <>
      <Fade in={isLoading} unmountOnExit>
        <Box sx={skeletonSx}>
          <Skeleton
            variant="text"
            sx={{ height: (theme) => theme.spacing(3) }}
          />
        </Box>
      </Fade>
      {!isLoading && (
        <Box sx={sx} onAuxClick={auxClickHandler}>
          {children}
        </Box>
      )}
    </>
  );
};

export function renderCell<T, C>(
  column: DataTableColumn<T, C> | undefined,
  row: DataTableRow<T>,
  disabled: boolean
) {
  if (!hasValue(column)) return null;
  return column.render
    ? column.render(row, disabled)
    : row[column.id.toString()] ?? null;
}

function Row<T, C>({
  isLoading,
  disabled,
  hover = false,
  tableId,
  columns,
  data,
  isSelected,
  selectable,
  onRowClick,
  onClickCheckbox,
  isDetailsOpen = false,
  rowHeight,
}: {
  isLoading?: boolean;
  disabled: boolean;
  hover?: boolean;
  tableId: string;
  columns: DataTableColumn<T, C>[];
  data: DataTableRow<T>;
  onClickCheckbox: (
    e: React.MouseEvent<HTMLButtonElement>,
    uuid: string
  ) => void;
  isSelected: boolean;
  selectable: boolean;
  isDetailsOpen?: boolean;
  onRowClick: (
    e: React.MouseEvent,
    uuid: string,
    isShowingDetail: boolean
  ) => void;
  rowHeight: number;
}) {
  const [isOpen, setIsOpen] = React.useState(isDetailsOpen);
  const handleClickRow = (e: React.MouseEvent) => {
    if (!disabled) {
      setIsOpen((current) => {
        onRowClick(e, data.id, !current);
        return !current;
      });
    }
  };

  const labelId = `checkbox-${data.id}`;

  return (
    <>
      <TableRow
        hover={!isLoading && !disabled && hover}
        onClick={handleClickRow}
        role="checkbox"
        aria-checked={isSelected}
        tabIndex={-1}
        key={data.id}
        selected={isSelected}
        sx={{
          ...(data.details
            ? { "& > *": { borderBottom: "unset !important" } }
            : null),
          ...(!isLoading && !disabled && (selectable || hover)
            ? { cursor: "pointer" }
            : null),
          height: data.details ? rowHeight - 1 : rowHeight,
        }}
        data-test-id={
          isLoading ? "loading-table-row" : `${tableId}-row-${data.id}`
        }
      >
        {selectable && (
          <TableCell padding="checkbox" align="center">
            <CellContainer
              skeletonSx={{ padding: (theme) => theme.spacing(0, 1.5) }}
              isLoading={isLoading}
            >
              <Checkbox
                color="primary"
                checked={isSelected}
                disabled={disabled}
                onClick={(e) => onClickCheckbox(e, data.id)}
                inputProps={{ "aria-labelledby": labelId }}
                data-test-id={`${tableId}-row-checkbox`}
              />
            </CellContainer>
          </TableCell>
        )}
        <TableCell component="th" align="left" id={labelId} scope="row">
          <CellContainer
            isLoading={isLoading}
            sx={{
              color: (theme) =>
                disabled ? theme.palette.action.disabled : undefined,
              ...columns[0]?.sx,
            }}
            onAuxClick={handleClickRow}
          >
            {renderCell(columns[0], data, disabled)}
          </CellContainer>
        </TableCell>
        {columns.slice(1).map((column) => {
          return (
            <TableCell
              key={column.id.toString()}
              align={column.align || "left"}
            >
              <CellContainer
                isLoading={isLoading}
                sx={{
                  color: (theme) =>
                    disabled ? theme.palette.action.disabled : undefined,
                  ...column.sx,
                }}
                onAuxClick={handleClickRow}
              >
                {column.sortable ? (
                  <Box sx={{ marginRight: (theme) => theme.spacing(2.75) }}>
                    {renderCell(column, data, disabled)}
                  </Box>
                ) : (
                  renderCell(column, data, disabled)
                )}
              </CellContainer>
            </TableCell>
          );
        })}
      </TableRow>
      {data.details && (
        <TableRow>
          <TableCell
            style={{ paddingBottom: 0, paddingTop: 0 }}
            colSpan={selectable ? columns.length + 1 : columns.length}
          >
            <Collapse in={isOpen} timeout="auto" unmountOnExit>
              {data.details}
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export type DataTableFetcherResponse<T> = {
  rows: (T & { id: string })[];
  totalCount: number;
};

type DataTableFetcher<T> = (props: {
  page?: number;
  rowsPerPage?: number;
  searchTerm?: string;
  run: (
    promise: Promise<DataTableFetcherResponse<T>>
  ) => Promise<void | DataTableFetcherResponse<T>>;
}) => void;

type DataTableProps<T, C = T> = {
  columns: DataTableColumn<T, C>[];
  fetcher?: DataTableFetcher<T>;
  rows?: (T & { id: string })[];
  // this prop is useful when `rows` is not given, and the data is fetched from within via `fetcher`
  composeRow?: (
    row: T & { id: string },
    setData: StateDispatcher<DataTableFetcherResponse<T>>,
    fetchData: () => void
  ) => DataTableRow<T>;
  id: string;
  initialSelectedRows?: string[];
  selectedRows?: string[];
  setSelectedRows?: (
    action: string[] | ((current: string[]) => string[])
  ) => void;
  onChangeSelection?: (rowUuids: string[]) => void;
  selectable?: boolean;
  initialOrderBy?: string;
  initialOrder?: Order;
  initialRowsPerPage?: number;
  deleteSelectedRows?: (rowUuids: string[]) => Promise<boolean>;
  onRowClick?: (e: React.MouseEvent, uuid: string) => void;
  rowHeight?: number;
  debounceTime?: number;
  refreshInterval?:
    | number
    | null
    | ((rows: DataTableRow<T>[]) => number | null);
  hideSearch?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  disablePagination?: boolean;
  dense?: boolean;
  containerSx?: SxProps<Theme>;
  retainSelectionsOnPageChange?: boolean;
  footnote?: React.ReactNode;
  tableContainerElevation?: number;
} & BoxProps;

function generateLoadingRows<T, C>(
  rowCount: number,
  columns: DataTableColumn<T, C>[]
) {
  // rendering large amount of table rows with skeleton is causing performance issue
  // We limit it to 25, which should suffice for most users' viewport.
  const renderedRowCount = Math.min(25, rowCount);
  return [...Array(renderedRowCount).keys()].map((key) => {
    return columns.reduce((all, col) => {
      // add isLoading: true signifies this row is a loading row (i.e. will be filled by Skeleton).
      // thus, the data ([col.id]) doesn't matter, we just fill an empty string.
      return { ...all, [col.id]: "", uuid: key, isLoading: true };
    }, {});
  }) as DataTableRow<T>[];
}

// always 8 * N + 1
// 1px for the bottom-border width
// * NOTE: try not to create exceptions and adhere to these pre-defined value
// if you put Icons in the rows, give negative top/bottom margin (usually -4px)
// to counter-balance the Table Cell padding
enum FIXED_ROW_HEIGHT {
  MEDIUM = 57,
  SMALL = 33,
  SELECTABLE = 43, // i.e. the height of the checkbox
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export const DataTable = React.forwardRef(function DataTable<
  T extends AnyRecord,
  C = T
>(
  {
    id,
    columns,
    rows: originalRowsFromProp,
    composeRow = (row) => row,
    initialOrderBy,
    initialOrder,
    deleteSelectedRows,
    onRowClick,
    selectable = false,
    rowHeight,
    debounceTime = 250,
    hideSearch,
    initialSelectedRows = [],
    selectedRows,
    setSelectedRows,
    onChangeSelection,
    fetcher,
    isLoading,
    initialRowsPerPage = 10,
    containerSx,
    dense,
    disabled,
    disablePagination = false,
    refreshInterval = null,
    retainSelectionsOnPageChange,
    footnote,
    sx,
    ...props
  }: DataTableProps<T, C>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const { setAlert } = useGlobalContext();

  const mounted = useMounted();
  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, debounceTime);
  const [order, setOrder] = React.useState<Order>(initialOrder || "asc");
  const [orderBy, setOrderBy] = React.useState<string>(initialOrderBy || "");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const isTableDisabled = disabled || isDeleting;

  // page is one-indexed
  const [page, setPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = useLocalStorage(
    disablePagination ? undefined : `${id}-table-page-size`,
    disablePagination ? null : initialRowsPerPage
  );

  const { run, status, error, data, setData } = useAsync<
    DataTableFetcherResponse<T>
  >();
  const fetchData = React.useCallback(async () => {
    if (fetcher) {
      return fetcher({
        run,
        page,
        ...(rowsPerPage ? { rowsPerPage } : null),
        searchTerm: debouncedSearchTerm,
      });
    }
  }, [run, fetcher, debouncedSearchTerm, page, rowsPerPage]);

  const [shouldUpdate, forceUpdate] = useForceUpdate();

  React.useEffect(() => {
    setPage((current) => {
      if (current === 1) forceUpdate(); // if page is already 1, it won't trigger re-render
      return 1;
    });
  }, [debouncedSearchTerm, forceUpdate]);

  // when user change searchTerm, page, and rowsPerPage, it should re-fetch data, however
  // if we simply subscribe to debouncedSearchTerm, page, and rowsPerPage, an extra request will occur when page !== 1 and searchTerm is changing
  // because search is debounced, so we need to subscribe to debouncedSearchTerm, but we are unable to batch debouncedSearchTerm and page
  // that is, when debouncedSearchTerm changes when page is not 1,two identical requests will be fired
  // to prevent this extra request, fetchData should only depends on page, and rowsPerPage (because page will be set to 1 when debouncedSearchTerm changes)
  // yet, if page is already 1, it won't trigger re-render, we create a phantom state `shouldUpdate` to force rerender
  React.useEffect(() => {
    fetchData();
  }, [shouldUpdate, page, rowsPerPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // if the data is fetched via fetcher, we don't use client-side search and pagination.
  const useClientSideSearchAndPagination = !fetcher;

  const isFetchingData = isLoading || status === "PENDING";

  const [localSelected, setLocalSelected] = React.useState<string[]>(
    initialSelectedRows
  );

  const selected = selectedRows || localSelected;
  const setSelected = (
    action: string[] | ((current: string[]) => string[])
  ) => {
    const dispatcher = setSelectedRows || setLocalSelected;
    dispatcher((current) => {
      const value = action instanceof Function ? action(current) : action;
      if (onChangeSelection && mounted.current) onChangeSelection(value);
      return value;
    });
  };

  const sortedRows = React.useMemo(() => {
    const originalRows = originalRowsFromProp || data?.rows || [];

    if (!orderBy) return originalRows;
    return originalRows.sort(getComparator(order, orderBy));
  }, [order, orderBy, originalRowsFromProp, data]);

  // multi-column search is more expensive (O(n^2)), should be put later than one-column sort (O(n log(n)))
  // NOTE: this concern is only for client-side, server-side it doesn't matter (i.e. when fetcher is given)
  const shouldSkipClientSideFiltering =
    !debouncedSearchTerm || !useClientSideSearchAndPagination;
  const rows = React.useMemo(() => {
    return shouldSkipClientSideFiltering
      ? sortedRows
      : sortedRows.filter((unfilteredRow) => {
          return columns.some((column) => {
            const value = `${unfilteredRow[column.id.toString()]}${
              unfilteredRow.searchIndex || ""
            }`;
            return value
              .toLowerCase()
              .includes(debouncedSearchTerm.toLowerCase());
          });
        });
  }, [sortedRows, debouncedSearchTerm, columns, shouldSkipClientSideFiltering]);

  const totalCount = useClientSideSearchAndPagination
    ? rows.length
    : data?.totalCount || rows.length;

  const rowsInPage = React.useMemo<(T & { id: string })[]>(() => {
    if (!hasValue(rowsPerPage)) return rows;
    const startIndex = Math.max(page - 1, 0) * rowsPerPage;
    const slicedRows = useClientSideSearchAndPagination
      ? rows.slice(startIndex, startIndex + rowsPerPage)
      : rows;

    return !isFetchingData
      ? slicedRows
      : generateLoadingRows(rowsPerPage, columns); // generate loading rows (will be filled with skeletons when rendering).
  }, [
    rows,
    page,
    rowsPerPage,
    columns,
    useClientSideSearchAndPagination,
    isFetchingData,
  ]);

  useInterval(
    () => forceUpdate(),
    refreshInterval instanceof Function
      ? refreshInterval(rowsInPage)
      : refreshInterval
  );

  React.useEffect(() => {
    if (mounted.current) {
      setSelected((currentSelected) => {
        return currentSelected.filter((selectedRowUuid) =>
          rows.some((row) => row.uuid === selectedRowUuid)
        );
      });
    }
    // we only want to filter selected when row is updated
  }, [mounted, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRequestSort = (
    event: React.MouseEvent<unknown>,
    property: string
  ) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    // we only allow select all entries in the same page
    // and when user change page, the selection will be cleaned up.
    setSelected((current) => {
      if (current.length < rowsInPage.length) {
        const newSelectedRows = rowsInPage.map((n) => n.uuid);
        return newSelectedRows;
      }
      const selectedAllItemsInPage =
        event.target.checked && event.target.dataset.indeterminate;

      if (selectedAllItemsInPage && current.length >= rowsInPage.length) {
        // select all rows in all pages
        // note that if it's server-side pagination,
        // it only selects rowsInPage because rows and rowsInPage are identical
        return rows.map((n) => n.uuid);
      }
      return [];
    });
  };

  const handleClickCheckbox = (e: React.MouseEvent<unknown>, uuid: string) => {
    if (!selectable) return;
    // prevent firing handleClickRow
    e.stopPropagation();

    setSelected((currentValue) => {
      const isChecked = (e.target as HTMLInputElement).checked;
      return isChecked
        ? [...currentValue, uuid]
        : currentValue.filter((checkedUuid) => checkedUuid !== uuid);
    });
  };

  const [rowsShowingDetails, setRowsShowingDetails] = React.useState<string[]>(
    []
  );

  const handleClickRow = (
    e: React.MouseEvent,
    uuid: string,
    isShowingDetails: boolean
  ) => {
    if (onRowClick) {
      e.preventDefault();
      onRowClick(e, uuid);
    }
    setRowsShowingDetails((current) => {
      if (isShowingDetails) {
        return [...current, uuid];
      } else {
        return current.filter((u) => u !== uuid);
      }
    });
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    if (!isDeleting) setPage(newPage + 1);
    if (!retainSelectionsOnPageChange && !isDeleting) setSelected([]);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!isDeleting) {
      setRowsPerPage(parseInt(event.target.value, 10));
      setPage(1);
    }
  };

  const handleDeleteSelectedRows = async () => {
    try {
      if (deleteSelectedRows) {
        setIsDeleting(true);
        const success = await deleteSelectedRows(selected);
        if (success) setSelected([]);
        setIsDeleting(false);

        // if fetcher is not provided (i.e. you feed rows in the props)
        // you should also re-fetch from the parent as well.
        if (!useClientSideSearchAndPagination) fetchData();
      }
    } catch (deleteRowsError) {
      // Preferably the promise of deleteSelectedRows should handle error itself
      // although it's okay to let DataTable handle the error for deleting selected rows.
      const errorMessage = `Failed to delete selected items. ${deleteRowsError}`;
      console.error(`[DataTable] ${errorMessage}`);
      setAlert("Error", errorMessage);
      // If error bubbles up to this function, we set isDeleting to false, and fetch data to ensure data correctness
      // !NOTE: if `fetcher` is not provided, fetchData won't do anything, deleteSelectedRows should refetch in its try/catch.
      setIsDeleting(false);
      fetchData();
    }
  };

  const handleChangeSearchTerm = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setSearchTerm(e.target.value);
  };

  const isSelected = (uuid: string) => selected.indexOf(uuid) !== -1;

  // Avoid a layout jump when reaching the last page with empty rows.
  const emptyRows = !hasValue(rowsPerPage)
    ? 0
    : page > 1
    ? Math.max(0, page * rowsPerPage - totalCount)
    : 0;

  const tableTitleId = `${id}-title`;

  const renderedRowHeight =
    rowHeight ||
    (!dense
      ? FIXED_ROW_HEIGHT.MEDIUM
      : selectable
      ? FIXED_ROW_HEIGHT.SELECTABLE
      : FIXED_ROW_HEIGHT.SMALL);

  return (
    <Box sx={{ width: "100%", ...sx }} {...props} ref={ref}>
      {!hideSearch && (
        <SearchField
          value={searchTerm}
          disabled={isTableDisabled}
          onChange={handleChangeSearchTerm}
        />
      )}
      <Box sx={{ width: "100%" }}>
        <TableContainer sx={containerSx}>
          <Table
            sx={{ minWidth: 750 }}
            aria-labelledby={tableTitleId}
            stickyHeader
            size={dense ? "small" : "medium"}
            id={id}
            data-test-id={id}
          >
            <EnhancedTableHead<T, C>
              tableId={id}
              selectable={selectable}
              numSelected={selected.length}
              order={order}
              orderBy={orderBy as keyof C}
              disabled={isTableDisabled}
              onSelectAllClick={handleSelectAllClick}
              onRequestSort={handleRequestSort}
              rowCount={rows.length}
              data={columns}
            />
            <TableBody sx={{ maxHeight: "100px" }} data-test-id={`${id}-rows`}>
              {!error &&
                rowsInPage.map((row: DataTableRow<T>) => {
                  const isItemSelected = isSelected(row.id);
                  const isRowDisabled =
                    isTableDisabled || row.disabled || false;
                  return (
                    <Row<T, C>
                      isLoading={isFetchingData}
                      disabled={isRowDisabled}
                      hover={hasValue(onRowClick) || hasValue(row.details)}
                      tableId={id}
                      data={composeRow(row, setData, fetchData)}
                      columns={columns}
                      isSelected={isItemSelected}
                      onRowClick={handleClickRow}
                      onClickCheckbox={handleClickCheckbox}
                      selectable={selectable}
                      isDetailsOpen={rowsShowingDetails.includes(row.id)}
                      rowHeight={renderedRowHeight}
                      key={row.id}
                    />
                  );
                })}
              {error && (
                <TableRow style={{ height: renderedRowHeight * emptyRows }}>
                  <TableCell
                    colSpan={selectable ? columns.length + 1 : columns.length}
                    sx={{ padding: (theme) => theme.spacing(3) }}
                  >
                    <Alert severity="error">Failed to fetch data</Alert>
                    <Button
                      startIcon={<RefreshIcon />}
                      disabled={isFetchingData}
                      sx={{ marginTop: (theme) => theme.spacing(0.5) }}
                      onClick={fetchData}
                    >
                      Refresh
                    </Button>
                  </TableCell>
                </TableRow>
              )}
              {!error && emptyRows > 0 && (
                <TableRow style={{ height: renderedRowHeight * emptyRows }}>
                  <TableCell
                    colSpan={selectable ? columns.length + 1 : columns.length}
                  />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack direction="row">
          <Stack direction="row" alignItems="center">
            <Typography
              color={selected.length > 0 ? "inherit" : "initial"}
              variant="subtitle1"
              component="div"
              sx={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                fontSize: (theme) => theme.typography.body2.fontSize,
                marginLeft: (theme) => theme.spacing(3.5),
                marginRight: (theme) => theme.spacing(2),
                color: (theme) => theme.palette.grey[800],
              }}
            >
              {isDeleting &&
                `Deleting selected ${selected.length} item${
                  selected.length > 1 ? "s" : ""
                }...`}
              {!isDeleting && selected.length > 0
                ? `${selected.length} selected`
                : footnote}
            </Typography>
            {selected.length > 0 && deleteSelectedRows && (
              <IconButton
                title="Delete"
                data-test-id={`${id}-delete`}
                disabled={isTableDisabled}
                onClick={handleDeleteSelectedRows}
              >
                <DeleteIcon />
              </IconButton>
            )}
          </Stack>
          {rowsPerPage && (
            <TablePagination
              sx={{ flex: 1 }}
              rowsPerPageOptions={[5, 10, 25, 100]}
              component="div"
              count={totalCount}
              rowsPerPage={rowsPerPage}
              page={page - 1} // NOTE: this is zero-indexed
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              size={dense ? "small" : "medium"} // this doesn't make a difference, need to report a bug to MUI
              data-test-id={`${id}-pagination`}
            />
          )}
        </Stack>
      </Box>
    </Box>
  );
}) as <T extends Record<string, any>, C = T>( //eslint-disable-line @typescript-eslint/no-explicit-any
  props: DataTableProps<T, C>
) => JSX.Element;
