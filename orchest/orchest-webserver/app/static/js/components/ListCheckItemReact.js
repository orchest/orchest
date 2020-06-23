import React from 'react';

class ListCheckItemReact extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            checked: false
        }
    }

    checkboxChange(e) {
        this.setState({ checked: !this.state.checked });
    }

    onClick(e) {
        e.stopPropagation();
    }

    getChecked(){
        return this.state.checked;
    }

    deselect(){
        this.setState({ checked: false });
    }

    onClickListItem(e){
        this.props.onClickListItem(this.props.item, e);
    }

    render() {
        return <li onClick={this.onClickListItem.bind(this)} className="mdc-list-item" role="checkbox" aria-checked="false">
            <span className="mdc-list-item__graphic">
                <div className="mdc-checkbox" >
                    <input type="checkbox" onClick={this.onClick} onChange={this.checkboxChange.bind(this)} checked={this.state.checked ? "checked" : false}
                        className="mdc-checkbox__native-control"
                        id="demo-list-checkbox-item-1" />
                    <div className="mdc-checkbox__background">
                        <svg className="mdc-checkbox__checkmark"
                            viewBox="0 0 24 24">
                            <path className="mdc-checkbox__checkmark-path"
                                fill="none"
                                d="M1.73,12.91 8.1,19.28 22.79,4.59" />
                        </svg>
                        <div className="mdc-checkbox__mixedmark"></div>
                    </div>
                </div>
            </span>
            <label className="mdc-list-item__text" htmlFor="demo-list-checkbox-item-1">{this.props.item.name}</label>
        </li>
    }
}

export default ListCheckItemReact;