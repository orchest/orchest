import React from 'react';
import { MDCLinearProgress } from '@material/linear-progress';
import { RefManager } from '../utils/all';

class MDCLinearProgressReact extends React.Component {

    constructor(){
        super()

        this.refManager = new RefManager();
    }

    componentDidMount() {
        this.mdc = new MDCLinearProgress(this.refManager.refs.progress);
    }

    render() {
        return <div role="progressbar" ref={this.refManager.nrefs.progress} className="mdc-linear-progress mdc-linear-progress--indeterminate" aria-label="Progress Bar">
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

