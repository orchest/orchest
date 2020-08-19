
import React, { Fragment } from 'react';
import MDCDataTableReact from '../lib/mdc-components/MDCDataTableReact';
import MDCTextFieldReact from '../lib/mdc-components/MDCTextFieldReact';

class SearchableTable extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            "rowSearchMask": new Array(this.props.rows.length).fill(1)
        }
    }

    onSearchChange(value){
        
        // case insensitive search
        value = value.toLocaleLowerCase();

        let rowSearchMask = new Array(this.props.rows.length).fill(0);
        
        if(value.length === 0){
            rowSearchMask.fill(1);
        }else{
            for(let x = 0; x < this.props.rows.length; x++){

                let concattedSearchString = 
                    this.props.rows[x].join(" ").toLocaleLowerCase();
                    
                if(concattedSearchString.indexOf(value) !== -1){
                    rowSearchMask[x] = 1;
                }
            }
        }

        this.setState({
            rowSearchMask: rowSearchMask
        })

    }

    componentDidUpdate(prevProps){
        if(this.props.rows !== prevProps.rows){
            this.setState({"rowSearchMask": new Array(this.props.rows.length).fill(1)});
        }
    }    

    getSelectedRowIndices(){
        return this.refs.table.getSelectedRowIndices();
    }
    
    setSelectedRowIds(rowIds){
        this.refs.table.setSelectedRowIds(rowIds);
    }

    filteredRows(rows){
        if(!rows){
            return
        }

        let filteredRows = [];

        for(let x = 0; x < rows.length; x++){
            if(this.state.rowSearchMask[x] === 1){
                filteredRows.push(rows[x]);
            }
        }

        return filteredRows
    }

    render() {
        return <Fragment>

            <MDCTextFieldReact onChange={this.onSearchChange.bind(this)} classNames={['mdc-text-field--outlined', 'fullwidth', 'search']} notched={true} label="Search" />

            <MDCDataTableReact ref="table" selectable={this.props.selectable} selectedIndices={this.filteredRows(this.props.selectedIndices)} onSelectionChanged={this.props.onSelectionChanged} onRowClick={this.props.onRowClick} classNames={['fullwidth']} headers={this.props.headers} rows={this.filteredRows(this.props.rows)} detailRows={this.filteredRows(this.props.detailRows)} />
            
        </Fragment>
    }

}

export default SearchableTable



