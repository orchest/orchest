import * as React from "react";
import { MDCDataTable } from "@material/data-table";
import { RefManager, someParentHasClass } from "@orchest/lib-utils";

// used only in orchest-webserver
export class MDCDataTableReact extends React.Component<any, any> {
  mdc: MDCDataTable;
  mdcInvalidated: boolean;
  refManager: RefManager;

  constructor(props) {
    super(props);

    this.mdcInvalidated = false;

    this.state = {};

    this.refManager = new RefManager();
  }

  componentDidMount() {
    this.initializeMDC();
  }

  initializeMDC() {
    let listenersExist = false;

    if (this.mdc !== undefined) {
      listenersExist = true;
    }
    this.mdc = new MDCDataTable(this.refManager.refs.dataTable);

    if (!listenersExist) {
      this.mdc.listen(
        "MDCDataTable:rowSelectionChanged",
        this.selectionChangedListener.bind(this)
      );
      this.mdc.listen(
        "MDCDataTable:selectedAll",
        this.selectionChangedListener.bind(this)
      );
      this.mdc.listen(
        "MDCDataTable:unselectedAll",
        this.selectionChangedListener.bind(this)
      );
    }

    this.updateSelection();
  }

  selectionChangedListener() {
    this.callSelectionChanged();
  }

  getSelectedRowIndices() {
    let selectedRowIndices = [];
    let selectedRowIDs = this.mdc.getSelectedRowIds();

    // 'u0' => 0
    for (let x = 0; x < selectedRowIDs.length; x++) {
      selectedRowIndices.push(parseInt(selectedRowIDs[x].slice(1)));
    }

    return selectedRowIndices;
  }

  setSelectedRowIds(rowIds) {
    if (this.mdc.getRows().length > 0) {
      this.mdc.setSelectedRowIds(rowIds);
    }
  }

  callSelectionChanged() {
    if (this.props.onSelectionChanged) {
      let selectedRows = [];

      let selectedRowIDs = this.mdc.getSelectedRowIds();

      // 'u0' => 0
      for (let x = 0; x < selectedRowIDs.length; x++) {
        selectedRows.push(
          this.props.rows[parseInt(selectedRowIDs[x].slice(1))]
        );
      }

      this.props.onSelectionChanged(selectedRows, this.props.rows);
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (nextProps.rows.length != this.props.rows.length) {
      this.mdcInvalidated = true;
    }

    return true;
  }

  componentDidUpdate() {
    // if (this.mdcInvalidated) {

    //   if (this.props.rows.length > 0) {
    //     this.initializeMDC()
    //   }

    //   this.mdcInvalidated = false;
    // }

    if (this.mdc) {
      this.mdc.layout();
    }
  }

  updateSelection() {
    if (this.props.selectedIndices) {
      let selectedRowIDs = [];

      for (let x = 0; x < this.props.selectedIndices.length; x++) {
        if (this.props.selectedIndices[x] === 1) {
          selectedRowIDs.push("u" + x);
        }
      }

      if (selectedRowIDs.length > 0) {
        this.mdc.setSelectedRowIds(selectedRowIDs);
      }
    }
  }

  rowClick(row, idx, e) {
    if (e.target && !someParentHasClass(e.target, "consume-click")) {
      if (this.props.onRowClick !== undefined) {
        this.props.onRowClick(row, idx, e);
      }

      // update detail state
      let state = {};
      let stateKey = "row" + idx + "Detail";

      if (this.state[stateKey] === true) {
        state[stateKey] = false;
      } else {
        state[stateKey] = true;
      }

      this.setState(state);
    }
  }

  render() {
    let topClasses = ["mdc-data-table"];

    if (this.props.classNames) {
      topClasses = topClasses.concat(this.props.classNames);
    }

    if (
      this.props.onRowClick !== undefined ||
      this.props.detailRows !== undefined
    ) {
      topClasses.push("row-clickable");
    }

    let tableHeaders = [];
    for (let x = 0; x < this.props.headers.length; x++) {
      tableHeaders.push(
        <th
          key={x}
          className="mdc-data-table__header-cell"
          role="columnheader"
          scope="col"
        >
          {this.props.headers[x]}
        </th>
      );
    }

    let tableRows = [];

    for (let x = 0; x < this.props.rows.length; x++) {
      let rowCells = [];

      for (let i = 0; i < this.props.rows[x].length; i++) {
        if (i == 0) {
          rowCells.push(
            <td key={i} className="mdc-data-table__cell" scope="row">
              {this.props.rows[x][i]}
            </td>
          );
        } else {
          rowCells.push(
            <td key={i} className="mdc-data-table__cell">
              {this.props.rows[x][i]}
            </td>
          );
        }
      }

      tableRows.push(
        <tr
          onClick={this.rowClick.bind(this, this.props.rows[x], x)}
          key={x}
          data-row-id={"u" + x}
          className="mdc-data-table__row"
        >
          {(() => {
            if (this.props.selectable) {
              return (
                <td className="mdc-data-table__cell mdc-data-table__cell--checkbox">
                  <div className="mdc-checkbox mdc-data-table__row-checkbox">
                    <input
                      type="checkbox"
                      className="mdc-checkbox__native-control consume-click"
                      aria-labelledby={"u" + x}
                    />
                    <div className="mdc-checkbox__background">
                      <svg
                        className="mdc-checkbox__checkmark"
                        viewBox="0 0 24 24"
                      >
                        <path
                          className="mdc-checkbox__checkmark-path"
                          fill="none"
                          d="M1.73,12.91 8.1,19.28 22.79,4.59"
                        />
                      </svg>
                      <div className="mdc-checkbox__mixedmark"></div>
                    </div>
                    <div className="mdc-checkbox__ripple"></div>
                  </div>
                </td>
              );
            }
          })()}

          {rowCells}
        </tr>
      );

      if (this.state["row" + x + "Detail"] === true && this.props.detailRows) {
        tableRows.push(
          <tr key={"_" + x}>
            <td
              className="mdc-data-table__details"
              colSpan={
                this.props.headers.length + (this.props.selectable ? 1 : 0)
              }
            >
              {this.props.detailRows[x]}
            </td>
          </tr>
        );
      }
    }

    return (
      <div
        className={topClasses.join(" ")}
        ref={this.refManager.nrefs.dataTable}
      >
        <div className="mdc-data-table__table-container">
          <table className="mdc-data-table__table" aria-label="Data table">
            <thead>
              <tr className="mdc-data-table__header-row">
                {(() => {
                  if (this.props.selectable) {
                    return (
                      <th
                        className="mdc-data-table__header-cell mdc-data-table__header-cell--checkbox"
                        role="columnheader"
                        scope="col"
                      >
                        <div className="mdc-checkbox mdc-data-table__header-row-checkbox mdc-checkbox--selected">
                          <input
                            type="checkbox"
                            disabled={this.props.rows.length == 0}
                            className="mdc-checkbox__native-control"
                            aria-label="Toggle all rows"
                          />
                          <div className="mdc-checkbox__background">
                            <svg
                              className="mdc-checkbox__checkmark"
                              viewBox="0 0 24 24"
                            >
                              <path
                                className="mdc-checkbox__checkmark-path"
                                fill="none"
                                d="M1.73,12.91 8.1,19.28 22.79,4.59"
                              />
                            </svg>
                            <div className="mdc-checkbox__mixedmark"></div>
                          </div>
                          <div className="mdc-checkbox__ripple"></div>
                        </div>
                      </th>
                    );
                  }
                })()}

                {tableHeaders}
              </tr>
            </thead>
            <tbody className="mdc-data-table__content">{tableRows}</tbody>
          </table>
        </div>
      </div>
    );
  }
}
