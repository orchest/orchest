import { MDCDataTableReact, MDCTextFieldReact } from "@orchest/lib-mdc";
import React from "react";

interface ForwardedSearchableTableProps {
  getSelectedRowIndices: () => number[];
  setSelectedRowIds: (rowIds: string[]) => void;
}

interface SearchableTableProps<T> {
  selectable?: boolean;
  headers: any[];
  rows: T[][];
  detailRows?: any[];
  selectedIndices?: number[];
  onRowClick?: (row: any, idx: any, event: any) => void; // TODO: remove any
  onSelectionChanged?: (selectedRows: T[], allRows: T[]) => void;
}

const SearchableTable = <T extends string | number | Record<string, unknown>>(
  props: SearchableTableProps<T>,
  ref: React.MutableRefObject<ForwardedSearchableTableProps>
) => {
  const tableRef = React.useRef<ForwardedSearchableTableProps>(null);

  const [state, setState] = React.useState({
    rowSearchMask: new Array(props.rows.length).fill(1),
    searchValue: "",
  });

  const onSearchChange = (searchValue: string) => {
    // case insensitive search
    const value = searchValue.toLocaleLowerCase();

    const rowSearchMask =
      value.length === 0
        ? new Array(props.rows.length).fill(1)
        : props.rows.map((cols) =>
            cols.join(" ").toLocaleLowerCase().indexOf(value) !== -1 ? 1 : 0
          );

    setState({
      rowSearchMask: rowSearchMask,
      searchValue,
    });
  };

  const filteredRows = (rows: unknown[]) =>
    !rows ? null : rows.filter((_, i: number) => state.rowSearchMask[i] === 1);

  React.useEffect(
    () =>
      setState((prevState) => ({
        ...prevState,
        rowSearchMask: new Array(props.rows.length).fill(1),
      })),
    [props.rows]
  );

  const getSelectedRowIndices = () => tableRef.current.getSelectedRowIndices();

  const setSelectedRowIds = (rowIds) =>
    tableRef.current.setSelectedRowIds(rowIds);

  React.useImperativeHandle(ref, () => ({
    getSelectedRowIndices,
    setSelectedRowIds,
  }));

  return (
    <>
      <MDCTextFieldReact
        onChange={onSearchChange}
        value={state.searchValue}
        classNames={["mdc-text-field--outlined", "fullwidth", "search"]}
        notched={true}
        label="Search"
      />
      <MDCDataTableReact
        ref={tableRef as React.LegacyRef<MDCDataTableReact>}
        selectable={props.selectable}
        selectedIndices={filteredRows(props.selectedIndices)}
        onSelectionChanged={props.onSelectionChanged}
        onRowClick={props.onRowClick}
        classNames={["fullwidth"]}
        headers={props.headers}
        rows={filteredRows(props.rows)}
        detailRows={filteredRows(props.detailRows)}
        data-test-id={props["data-test-id"]}
      />
    </>
  );
};

export default React.forwardRef(SearchableTable);
