import React from 'react';
import ListItem from "./ListItem";
import { MDCList } from '@material/list';

class ItemList extends React.Component {

    componentDidMount(){
        this.mdc = new MDCList(this.refs.mdcList);
    }

    render() {

        this.listItems = this.props.items.map((item, key) => (
            <ListItem item={item} ref={"listItem" + key} onClickListItem={this.props.onClickListItem} key={key} />
        ));

        return <ul className="mdc-list" ref="mdcList" role="group" aria-label="List with items">
            {this.listItems}
        </ul>
    }

}

export default ItemList