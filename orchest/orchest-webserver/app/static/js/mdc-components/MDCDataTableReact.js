import React from 'react';
import {MDCDataTable} from '@material/data-table';

class MDCDataTableReact extends React.Component {

    componentDidMount() {
        this.mdc = new MDCDataTable(this.refs.dataTable);
    }
    
    render() {

        let topClasses = ["mdc-data-table"];

        if (this.props.classNames) {
            topClasses = topClasses.concat(this.props.classNames)
        }
        topClasses = topClasses.join(" ");


        let tableHeaders = [];
        for(let x = 0; x < this.props.headers.length; x++){
            tableHeaders.push(
                <th key={x} className="mdc-data-table__header-cell" role="columnheader" scope="col">
                    {this.props.headers[x]}
                </th>
            )
        }

        let tableRows = [];

        for(let x = 0; x < this.props.rows.length; x++){

            let rowCells = [];

            for(let i = 0; i < this.props.rows[x].length; i++){
                if(i == 0){
                    rowCells.push(
                        <td key={i} className="mdc-data-table__cell" scope="row" id={"u" + i}>
                            {this.props.rows[x][i]}
                        </td>
                    );
                }else{
                    rowCells.push(
                        <td key={i} className="mdc-data-table__cell">
                            {this.props.rows[x][i]}
                        </td>
                    );
                }
            }

            tableRows.push(
                <tr key={x} data-row-id={"u" + x} className="mdc-data-table__row">

                    <td className="mdc-data-table__cell mdc-data-table__cell--checkbox">
                        <div className="mdc-checkbox mdc-data-table__row-checkbox">
                            <input type="checkbox" className="mdc-checkbox__native-control" aria-labelledby="u0"/>
                            <div className="mdc-checkbox__background">
                            <svg className="mdc-checkbox__checkmark" viewBox="0 0 24 24">
                                <path className="mdc-checkbox__checkmark-path" fill="none" d="M1.73,12.91 8.1,19.28 22.79,4.59" />
                            </svg>
                            <div className="mdc-checkbox__mixedmark"></div>
                            </div>
                            <div className="mdc-checkbox__ripple"></div>
                        </div>
                    </td>
                    
                    {rowCells}
              </tr>
            )
        }


        return <div className={topClasses} ref="dataTable">
        <div className="mdc-data-table__table-container">
          <table className="mdc-data-table__table" aria-label="Dessert calories">
            <thead>
              <tr className="mdc-data-table__header-row">
                <th className="mdc-data-table__header-cell mdc-data-table__header-cell--checkbox" role="columnheader" scope="col">
                  <div className="mdc-checkbox mdc-data-table__header-row-checkbox mdc-checkbox--selected">
                    <input type="checkbox" className="mdc-checkbox__native-control" aria-label="Toggle all rows"/>
                    <div className="mdc-checkbox__background">
                      <svg className="mdc-checkbox__checkmark" viewBox="0 0 24 24">
                        <path className="mdc-checkbox__checkmark-path" fill="none" d="M1.73,12.91 8.1,19.28 22.79,4.59" />
                      </svg>
                      <div className="mdc-checkbox__mixedmark"></div>
                    </div>
                    <div className="mdc-checkbox__ripple"></div>
                  </div>
                </th>
                {tableHeaders}
              </tr>
            </thead>
            <tbody className="mdc-data-table__content">
              {tableRows}
            </tbody>
          </table>
        </div>
      </div>
    }
}

export default MDCDataTableReact;