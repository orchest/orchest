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
        }

        

        this.promiseManager = new PromiseManager();

        // async callback state
        this.numberOfPollTries = 0;
        this.numberOfPollTriesLimit = 50;
    }

    componentWillUnmount() {
        this.promiseManager.cancelCancelablePromises();
    }

    heartbeatPoll() {

        this.numberOfPollTries++;
        if (this.numberOfPollTries > this.numberOfPollTriesLimit) {
            console.error("Tried " + this.numberOfPollTriesLimit + " times but could not connect to update server.");
            return;
        }

        makeRequest("GET", "/update-server/heartbeat", {}, undefined, 1000).then(() => {
            console.log("Update service available");

            this.requestUpdate();

        }).catch(() => {
            console.warn("Update service unavailable");
            console.log("Retrying in one second.");

            setTimeout(() => {
                this.heartbeatPoll();
            }, 1000);
        })
    }

    startUpdateTrigger() {

        this.setState({
            updating: true,
            updateOutput: ""
        });

        makeRequest("GET", "/async/spawn-update-server", {}).then(() => {
            console.log("Spawned update-server, start polling update-server.");

            this.numberOfPollTries = 0;
            this.heartbeatPoll();

        }).catch((e) => {
            console.log("Failed to trigger update", e);
        });

    }

    requestUpdate() {

        let _this = this;

        let updateUrl = "/update-server/update";

        if (orchest.environment === "development") {
            updateUrl += "?mode=dev";
        }

        let updatePromise = makeCancelable(makeRequest("GET", updateUrl, {}, function () {

            _this.setState({
                updateOutput: this.responseText
            })

        }, 0), this.promiseManager); // 0 means no timeout.

        updatePromise.promise.then((response) => {

            this.setState({
                updateOutput: response,
                updating: false
            })

        });
    }

    render() {
        return <div className={"view-page update-page"}>
            <h2>Update Orchest</h2>
            <p className="push-down">Update Orchest to the latest version.</p>

            {(() => {

                let elements = [];

                if (this.state.updating) {
                    elements.push(<MDCLinearProgressReact key="0" classNames={["push-down"]} />);
                }
                if (this.state.updateOutput.length > 0) {
                    elements.push(<div key="1" className="console-output">
                        {this.state.updateOutput}
                    </div>);
                }

                return <Fragment>
                    <MDCButtonReact classNames={['push-down']} label="Start update" icon="system_update_alt" disabled={this.state.updating} onClick={this.startUpdateTrigger.bind(this)} />

                    {elements}

                </Fragment>

            })()}



        </div>;
    }
}

export default UpdateView;