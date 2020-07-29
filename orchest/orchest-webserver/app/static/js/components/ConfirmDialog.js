import React, { Fragment } from 'react';
import MDCDialogReact from '../mdc-components/MDCDialogReact';
import MDCButtonReact from '../mdc-components/MDCButtonReact';

class ConfirmDialog extends React.Component {

    confirm(){
        this.refs.dialog.close();

        if(this.props.onConfirm){
            this.props.onConfirm();
        }
    }

    cancel(){
        this.refs.dialog.close();

        if(this.props.onCancel){
            this.props.onCancel();
        }
    }

    render() {

        return <MDCDialogReact 
            ref="dialog"
            title={this.props.title}
            onClose={this.props.onClose}
            content={<p>{this.props.content}</p>}
            actions={<Fragment>
                <MDCButtonReact label="Ok" onClick={this.confirm.bind(this)} />
                <MDCButtonReact label="Cancel" onClick={this.cancel.bind(this)} />
            </Fragment>}
        />
    }

}

export default ConfirmDialog