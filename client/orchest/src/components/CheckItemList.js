import React from "react";
import ListCheckItem from "./ListCheckItem";
import { MDCList } from "@material/list";
import { RefManager } from "@lib/utils";

class CheckItemList extends React.Component {
  constructor() {
    super();

    this.refManager = new RefManager();
  }

  customSelectedIndex() {
    let selected = [];

    for (let x = 0; x < this.props.items.length; x++) {
      if (this.refManager.refs["listItem" + x].getChecked()) {
        selected.push(x);
      }
    }

    return selected;
  }

  deselectAll() {
    for (let x = 0; x < this.props.items.length; x++) {
      this.refManager.refs["listItem" + x].deselect();
    }
  }

  componentDidMount() {
    this.mdc = new MDCList(this.refManager.refs.mdcList);
  }

  render() {
    this.listItems = this.props.items.map((item, key) => (
      <ListCheckItem
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
        aria-label="List with checkbox items"
      >
        {this.listItems}
      </ul>
    );
  }
}

export default CheckItemList;
