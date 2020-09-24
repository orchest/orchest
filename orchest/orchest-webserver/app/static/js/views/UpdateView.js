import React from 'react';
import MDCButtonReact from '../lib/mdc-components/MDCButtonReact';
import MDCLinearProgressReact from '../lib/mdc-components/MDCLinearProgressReact';
import { makeCancelable, makeRequest, PromiseManager } from '../lib/utils/all';

class UpdateView extends React.Component {

    constructor() {
        super();

        this.state = {
            updating: false,
            updateOutput: ""
        }

        this.promiseManager = new PromiseManager();
    }

    componentWillUnmount() {
        this.promiseManager.cancelCancelablePromises();
    }

    requestUpdate(){
        
        this.setState({
            updating: true
        });

        let updateServicePort = 9000;
        if(window.location.protocol === "https:"){
            updateServicePort = 9443;
        }

        let updateUrl = window.location.protocol + "//" + window.location.hostname + ":" + updateServicePort + "/update";
        
        if(orchest.environment === "development"){
            updateUrl += "?dev=true";
        }
        
        let _this = this;

        let updatePromise = makeCancelable(makeRequest("GET", updateUrl, {}, function(){

            _this.setState({
                updateOutput: this.responseText
            })
            
        }), this.promiseManager);

        updatePromise.promise.then(() => {
            this.setState({
                updating: false
            })
        });
    }

    render() {
        return <div className={"view-page update-page"}>
            <h2>Update Orchest</h2>
            <p className="push-down"><i>Update Orchest to the latest version.</i></p>

            <MDCButtonReact classNames={['push-down']} label="Start update" icon="system_update_alt" disabled={this.state.updating} onClick={this.requestUpdate.bind(this)} />

            {(() => {
                let elements = [];

                if(this.state.updating){
                    elements.push(<MDCLinearProgressReact classNames={["push-down"]} />);
                }
                if(this.state.updateOutput.length > 0){
                    elements.push(<div className="console-output">
                        {this.state.updateOutput}
                    </div>);
                }

                return elements;
            })()}

        </div>;
    }
}

export default UpdateView;