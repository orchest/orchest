import React from "react";
import ListItem from "./ListItem";
import { MDCList } from "@material/list";
import { RefManager } from "../lib/utils/all";

class ItemList extends React.Component {
  constructor() {
    super();

    this.refManager = new RefManager();
  }
  componentDidMount() {
    this.mdc = new MDCList(this.refManager.refs.mdcList);
  }

  render() {
    this.listItems = this.props.items.map((item, key) => (
      <ListItem
        item={item}
        ref={this.refManager.nrefs["listItem" + key]}
        onClickListItem={this.props.onClickListItem}
        key={key}
      />
    ));

    return (
      <ul
        className="mdc-list"
        ref={this.refManager.nrefs.mdcList}
        role="group"
        aria-label="List with items"
      >
        {this.listItems}
      </ul>
    );
  }
}

export default ItemList;
