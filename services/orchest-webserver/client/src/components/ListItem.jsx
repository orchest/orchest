import React from "react";

class ListItem extends React.Component {
  constructor(props) {
    super(props);
  }

  onClick(e) {
    e.stopPropagation();
  }

  componentDidMount() {}

  onClickListItem(e) {
    this.props.onClickListItem(this.props.item, e);
  }

  render() {
    return (
      <li onClick={this.onClickListItem.bind(this)} className="mdc-list-item">
        <span className="mdc-list-item__ripple"></span>
        <span className="mdc-list-item__text">{this.props.item.name}</span>
      </li>
    );
  }
}

export default ListItem;
