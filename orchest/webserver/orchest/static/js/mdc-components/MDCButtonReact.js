import React from 'react';
import { MDCRipple } from '@material/ripple';

class MDCButtonReact extends React.Component {
    componentDidMount() {
        this.mdc = new MDCRipple(this.refs.button);
    }
    render() {

        return <button ref={"button"} onClick={this.props.onClick} className={"mdc-button mdc-button--raised"}>
            <div className="mdc-button__ripple"></div>
            <span className="mdc-button__label">{this.props.label}</span>
        </button>;
    }
}

export default MDCButtonReact;