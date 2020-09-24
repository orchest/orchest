import React, { Fragment } from 'react';
import MDCButtonReact from '../lib/mdc-components/MDCButtonReact';
import MDCLinearProgressReact from '../lib/mdc-components/MDCLinearProgressReact';
import { makeCancelable, makeRequest, PromiseManager } from '../lib/utils/all';

class UpdateView extends React.Component {

    constructor() {
        super();

        this.state = {
            updating: false,
            updateOutput: "",
            updateServiceAvailibility: "unknown",
        }

        let updateServicePort = 9000;
        if(window.location.protocol === "https:"){
            updateServicePort = 9443;
        }
        this.updateHost = window.location.protocol + "//" + window.location.hostname + ":" + updateServicePort;
        this.updateUrl = this.updateHost + "/update";
        
        if(orchest.environment === "development"){
            this.updateUrl += "?dev=true";
        }

        this.promiseManager = new PromiseManager();

        this.isUpdateServiceOnline()
    }

    componentWillUnmount() {
        
        this.promiseManager.cancelCancelablePromises();
    }

    isUpdateServiceOnline(){
        makeRequest("GET", this.updateHost + "/heartbeat", {}, undefined, 1000).then(() => {
            console.log("Update service available")
            this.setState({
                updateServiceAvailibility: "online"
            })
        }).catch(() => {
            console.warn("Update service unavailable")
            this.setState({
                updateServiceAvailibility: "offline"
            })
        })
    }

    requestUpdate(){
        
        this.setState({
            updating: true,
            updateOutput: ""
        });
        
        let _this = this;

        let updatePromise = makeCancelable(makeRequest("GET", this.updateUrl, {}, function(){

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
            <p className="push-down">Update Orchest to the latest version.</p>
            
            {(() => {

                if(this.state.updateServiceAvailibility === "unknown"){

                }else if(this.state.updateServiceAvailibility === "online"){

                    let elements = [];

                    if(this.state.updating){
                        elements.push(<MDCLinearProgressReact key="0" classNames={["push-down"]} />);
                    }
                    if(this.state.updateOutput.length > 0){
                        elements.push(<div key="1" className="console-output">
                            {this.state.updateOutput}
                        </div>);
                    }

                    return <Fragment>
                            <MDCButtonReact classNames={['push-down']} label="Start update" icon="system_update_alt" disabled={this.state.updating} onClick={this.requestUpdate.bind(this)} />

                            {elements}

                        </Fragment>
                }else{
                    return <Fragment>
                        <p className="push-down"><i>Update service is not running. To update run the following update command:</i></p>
                        <div className="console-output">
                            &lt;repo&gt;/orchest/scripts/update.sh
                        </div>
                    </Fragment>
                }

            })()}

            

        </div>;
    }
}

export default UpdateView;