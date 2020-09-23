import React from 'react';
import { RefManager, uuidv4 } from '../lib/utils/all';

class ListCheckItem extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            checked: false
        }

        this.refManager = new RefManager();
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

        let randomFor = uuidv4();

        return <li onClick={this.onClickListItem.bind(this)} ref={this.refManager.nrefs.listItem} className="mdc-list-item" role="checkbox" aria-checked="false">
            <span className="mdc-list-item__ripple"></span>
            <span className="mdc-list-item__graphic">
                <div className="mdc-checkbox" >
                    <input type="checkbox" onClick={this.onClick} onChange={this.checkboxChange.bind(this)} checked={this.state.checked ? "checked" : false}
                        className="mdc-checkbox__native-control"
                        id={randomFor} />
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
            <label className="mdc-list-item__text" htmlFor={randomFor}>
                {this.props.item.name}
            </label>
            {this.props.item.icon ? <i className="material-icons">{this.props.item.icon}</i> : undefined }
        </li>
    }
}

export default ListCheckItem;