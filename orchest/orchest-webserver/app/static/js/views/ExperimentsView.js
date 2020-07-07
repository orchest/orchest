import React, { Fragment } from 'react';

import MDCDataTableReact from '../mdc-components/MDCDataTableReact';
import MDCIconButtonToggleReact from "../mdc-components/MDCIconButtonToggleReact";
import MDCTextFieldReact from '../mdc-components/MDCTextFieldReact';
import Modal from '../components/Modal';
import MDCSelectReact from '../mdc-components/MDCSelectReact';
import MDCButtonReact from '../mdc-components/MDCButtonReact';

class ExperimentsView extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            createModal: false,
        }

    }

    componentDidMount() {
        this.fetchList()
    }

    componentDidUpdate(prevProps, prevState, snapshot) {

    }

    fetchList() {

    }

    componentWillUnmount() {

    }

    onCreateClick() {
        this.setState({
            createModal: true
        })
    }
    onDeleteClick(){

    }

    onSubmitModal(){
        this.setState({
            createModal: false
        })
    }
    onCancelModal(){
        this.setState({
            createModal: false
        })
    }


    render() {

        let experiments = [
            ["LR search", "Training MNIST", "26 Jul. 2020"],
            ["Feature aug.", "Training MNIST", "24 Jul. 2020"],
            ["Feature aug.", "Training MNIST", "24 Jul. 2020"],
            ["Feature aug.", "LSAT solve", "24 Jul. 2020"],
            ["Small train set.", "LSAT solve", "21 Jul. 2020"],
        ]

        return <div className={"view-page experiments-page"}>

            <h2>Experiments</h2>

            {(() => {
                if(this.state.createModal){
                    return <Modal body={
                        <Fragment>
                            <h2>Create a new experiment</h2>
                            <MDCTextFieldReact classNames={['fullwidth']} label="Experiment name" />
                            <MDCSelectReact label="Pipeline" options={[
                                ["MNIST custom model"]
                            ]} />
                            <MDCButtonReact icon="science" classNames={["mdc-button--raised"]} label="Create experiment" onClick={this.onSubmitModal.bind(this)} />
                            
                            <MDCButtonReact icon="close" label="Cancel" onClick={this.onCancelModal.bind(this)} />
                        </Fragment>
                    } />
                }
            })() }

            <MDCTextFieldReact classNames={['mdc-text-field--outlined fullwidth']} notched={true} label="Search" />

            <div className={"experiment-actions"}>
                <MDCIconButtonToggleReact icon="add" onClick={this.onCreateClick.bind(this)} />
                <MDCIconButtonToggleReact icon="delete" onClick={this.onDeleteClick.bind(this)} />
            </div>

            <MDCDataTableReact classNames={['fullwidth']} headers={['Experiment', 'Pipeline', 'Date created']} rows={experiments} />

        </div>;
    }
}

export default ExperimentsView;