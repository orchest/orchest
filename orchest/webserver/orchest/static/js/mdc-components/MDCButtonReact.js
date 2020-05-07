import React from 'react';
import { MDCRipple } from '@material/ripple';

class MDCButtonReact extends React.Component {
    componentDidMount() {
        this.mdc = new MDCRipple(this.refs.button);
    }

    click(){
        this.mdc.activate();
        this.props.onClick();
        this.mdc.deactivate();
    }
    
    render() {

        let topClasses = ["mdc-button", "mdc-button--raised"];
        if (this.props.classNames) {
            topClasses = topClasses.concat(this.props.classNames)
        }
        topClasses = topClasses.join(" ");

        return <button ref={"button"} onClick={this.props.onClick} className={topClasses}>
            <div className="mdc-button__ripple"></div>

            {(() => {
                if (this.props.icon && this.props.label) {
                    return <span className="mdc-button__label">
                        <i className="material-icons mdc-button__icon">{this.props.icon}</i>{this.props.label}</span>;
                }
                if (this.props.icon) {
                    return <i className="material-icons">{this.props.icon}</i>;
                }
                if (this.props.label) {
                    return <span className="mdc-button__label">{this.props.label}</span>
                }
            })()}

        </button>;
    }
}

export default MDCButtonReact;