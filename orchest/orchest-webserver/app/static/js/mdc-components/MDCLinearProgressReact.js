import React from 'react';
import { MDCLinearProgress } from '@material/linear-progress';

class MDCLinearProgressReact extends React.Component {

    componentDidMount() {
        this.mdc = new MDCLinearProgress(this.refs.progress);
    }

    render() {
        return <div role="progressbar" ref={"progress"} className="mdc-linear-progress mdc-linear-progress--indeterminate" aria-label="Progress Bar">
            <div className="mdc-linear-progress__buffer">
                <div className="mdc-linear-progress__buffer-bar"></div>
                <div className="mdc-linear-progress__buffer-dots"></div>
            </div>
            <div className="mdc-linear-progress__bar mdc-linear-progress__primary-bar">
                <span className="mdc-linear-progress__bar-inner"></span>
            </div>
            <div className="mdc-linear-progress__bar mdc-linear-progress__secondary-bar">
                <span className="mdc-linear-progress__bar-inner"></span>
            </div>
        </div>;
    }
}

export default MDCLinearProgressReact;

