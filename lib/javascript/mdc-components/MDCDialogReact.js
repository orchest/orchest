import React from 'react';
import {MDCDialog} from '@material/dialog';

class MDCDialogReact extends React.Component {
    componentDidMount() {

        this.mdc = new MDCDialog(this.refs.dialog);
        this.mdc.open();

        this.mdc.listen("MDCDialog:closed", () => {
            if(this.props.onClose){
                this.props.onClose();
            }
        })
    }

    close() {
        this.mdc.close();
    }

    componentDidUpdate(){
        this.mdc.open();
    }

    render() {
        return <div ref="dialog"
        className="mdc-dialog"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="my-dialog-title"
                    aria-describedby="my-dialog-content">
                <div className="mdc-dialog__container">
                <div className="mdc-dialog__surface">
                    <h2 className="mdc-dialog__title" id="my-dialog-title">
                        {this.props.title}
                    </h2>
                    <div className="mdc-dialog__content" id="my-dialog-content">
                        {this.props.content}
                    </div>
                    <footer className="mdc-dialog__actions">
                        {this.props.actions}
                    </footer>
                </div>
                </div>
                <div className="mdc-dialog__scrim"></div>
            </div>;
    }
}

export default MDCDialogReact;

