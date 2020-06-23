import React from 'react';
import ListCheckItemReact from "./ListCheckItemReact";

class CheckItemList extends React.Component {

    customSelectedIndex(){
        let selected = [];

        for(let x = 0; x < this.props.items.length; x++){
            if(this.refs["listItem"+x].getChecked()){
                selected.push(x);
            }
        }

        return selected
    }

    deselectAll(){
        for(let x = 0; x < this.props.items.length; x++){
            this.refs["listItem"+x].deselect();
        }
    }

    render() {

        this.listItems = this.props.items.map((item, key) => (
            <ListCheckItemReact item={item} ref={"listItem" + key} onClickListItem={this.props.onClickListItem} key={key} />
        ));

        return <ul className="mdc-list" ref="mdcList" role="group" aria-label="List with checkbox items">
            {this.listItems}
        </ul>
    }

}

export default CheckItemList