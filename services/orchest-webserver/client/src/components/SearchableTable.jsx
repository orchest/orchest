import React from "react";
import { MDCDataTableReact, MDCTextFieldReact } from "@orchest/lib-mdc";

/**
 * @typedef {{
 *  selectable?: boolean;
 *  headers: any[];
 *  rows: any[];
 *  detailRows?: any[];
 *  selectedIndices?: any[];
 *  onRowClick?: () => void;
 *  onSelectionChanged?: () => void;
 *  ref?: any;
 * }} TSearchableTableProps
 *
 * @type React.FC<TSearchableTableProps>
 */
const SearchableTable = React.forwardRef((props, ref) => {
  /**
   * @type React.MutableRefObject<{
   *  getSelectedRowIndices: () => any;
   *  setSelectedRowIds: (rowIds: any) => any;
   * }> */
  const tableRef = React.useRef(null);

  const [state, setState] = React.useState({
    rowSearchMask: new Array(props.rows.length).fill(1),
    searchValue: "",
  });

  const onSearchChange = (searchValue) => {
    // case insensitive search
    const value = searchValue.toLocaleLowerCase();

    const rowSearchMask =
      value.length === 0
        ? new Array(props.rows.length).fill(1)
        : props.rows.map((row) =>
            row.join(" ").toLocaleLowerCase().indexOf(value) !== -1 ? 1 : 0
          );

    setState({
      rowSearchMask: rowSearchMask,
      searchValue,
    });
  };

  const filteredRows = (rows) =>
    !rows ? null : rows.filter((_, i) => state.rowSearchMask[i] === 1);

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
    <React.Fragment>
      <MDCTextFieldReact
        onChange={onSearchChange.bind(this)}
        value={state.searchValue}
        classNames={["mdc-text-field--outlined", "fullwidth", "search"]}
        notched={true}
        label="Search"
      />

      <MDCDataTableReact
        // @ts-ignore
        ref={tableRef}
        selectable={props.selectable}
        selectedIndices={filteredRows(props.selectedIndices)}
        onSelectionChanged={props.onSelectionChanged}
        onRowClick={props.onRowClick}
        classNames={["fullwidth"]}
        headers={props.headers}
        rows={filteredRows(props.rows)}
        detailRows={filteredRows(props.detailRows)}
      />
    </React.Fragment>
  );
});

export default SearchableTable;
