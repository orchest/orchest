import React from 'react';
import MDCTabBarReact from '../lib/mdc-components/MDCTabBarReact';
import MDCDataTableReact from '../lib/mdc-components/MDCDataTableReact';
import MDCTextFieldReact from '../lib/mdc-components/MDCTextFieldReact';
import ParameterEditor from '../components/ParameterEditor';
import SearchableTable from '../components/SearchableTable';
import { makeRequest, uuidv4, PromiseManager, makeCancelable, RefManager } from '../lib/utils/all';
import MDCButtonReact from '../lib/mdc-components/MDCButtonReact';
import ParamTree from '../components/ParamTree';
import PipelineView from './PipelineView';

class ExperimentView extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            'selectedTabIndex': 0,
            'parameterizedSteps': this.props.parameterizedSteps,
            'selectedIndices': [0, 0],
            'pipelineRuns': [],
            'refreshing': false,
        }

        this.promiseManager = new PromiseManager();
        this.refManager = new RefManager();

    }

    componentWillUnmount(){
        this.promiseManager.cancelCancelablePromises();
    }

    onSelectSubview(index) {
        this.setState({
            selectedTabIndex: index
        })
    }

    componentDidMount(){
        this.fetchPipelineRuns();
    }

    fetchPipelineRuns(){
        let fetchRunsPromise = makeCancelable(makeRequest("GET", "/catch/api-proxy/api/experiments/" + this.props.experiment.uuid), this.promiseManager);
        
        fetchRunsPromise.promise.then((response) => {
            
            let result = JSON.parse(response);

            this.setState({
                pipelineRuns: result.pipeline_runs,
                refreshing: false,
            });

        }).catch((e) => {
            if(!e.isCanceled){
                this.setState({
                    refreshing: false,
                });
            }
        })

        
    }

    reload(){
        this.setState({
            refreshing: true,
        });
        this.fetchPipelineRuns();
    }

    onPipelineRunsSelectionChanged(selectedIndices){
        this.setState({
            selectedIndices: selectedIndices
        })
    }

    formatPipelineParamJSON(paramJSON){
        let keyValuePairs = [];

        for(let key in paramJSON){
            let splitKey = key.split("#");
            let paramName = splitKey.slice(1).join("#");
            keyValuePairs.push(paramName + ": " + paramJSON[key]);
        }

        return keyValuePairs.join(", ");
    }

    pipelineRunsToTableData(pipelineRuns){
        let rows = [];

        for(let x = 0; x < pipelineRuns.length; x++){
            rows.push(
                [
                    pipelineRuns[x].pipeline_run_id,
                    this.formatPipelineParamJSON(pipelineRuns[x].parameters),
                    pipelineRuns[x].status,
                ]
            )
        }

        return rows;
    }

    parameterValueOverride(parameterizedSteps, parameters){
        for(let key in parameters){

            let splitKey = key.split("#");
            let stepUUID = splitKey[0];
            let paramKey = splitKey.slice(1).join("#");
            let paramValue = parameters[key];

            parameterizedSteps[stepUUID]['parameters'][paramKey] = paramValue;
        }

        return parameterizedSteps;
    }

    onDetailPipelineView(pipelineRun){

        orchest.loadView(PipelineView, { 
            pipelineRun: pipelineRun, 
            pipeline_uuid: pipelineRun.pipeline_uuid,
            project_uuid: pipelineRun.project_uuid,
            readOnly: true,
        });

    }

    detailRows(pipelineRuns){
        let detailElements = [];

        // override values in fields through param fields
        for(let x = 0; x < pipelineRuns.length; x++){
            let pipelineRun = pipelineRuns[x];
            let parameterizedSteps = JSON.parse(JSON.stringify(this.props.parameterizedSteps));
            
            parameterizedSteps = this.parameterValueOverride(parameterizedSteps, pipelineRun.parameters);
            
            detailElements.push(
                <div className="pipeline-run-detail">
                    <ParamTree parameterizedSteps={parameterizedSteps} />
                    <MDCButtonReact 
                        label="View pipeline" 
                        classNames={["mdc-button--raised", "themed-secondary"]} 
                        icon="visibility"
                        onClick={this.onDetailPipelineView.bind(this, pipelineRun)} />
                </div>
            )
        }

        return detailElements;
    }

    render() {

        let tabView = undefined;

        switch (this.state.selectedTabIndex) {
            case 0:
                tabView = <div className="pipeline-tab-view existing-pipeline-runs">

                    <SearchableTable rows={this.pipelineRunsToTableData(this.state.pipelineRuns)} detailRows={this.detailRows(this.state.pipelineRuns)} headers={['ID', 'Parameters', 'Status']} selectedIndices={this.state.selectedIndices} onSelectionChanged={this.onPipelineRunsSelectionChanged.bind(this)} />

                    <MDCButtonReact disabled={this.state.refreshing} label="Refresh" icon="refresh"  onClick={this.reload.bind(this)} />
                </div>
                
                break;
            case 1:
                tabView = <ParameterEditor readOnly parameterizedSteps={this.state.parameterizedSteps} />
                break;
        }

        return <div className="view-page experiment-view">
            <div className="columns top-labels">
                <div className="column">
                    <label>Experiment</label>
                    <h3>{this.props.experiment.name}</h3>
                </div>
                <div className="column">
                    <label>Pipeline</label>
                    <h3>{this.props.pipeline.name}</h3>
                </div>
            </div>            

            <MDCTabBarReact
                selectedIndex={this.state.selectedTabIndex}
                ref={this.refManager.nrefs.tabBar}
                items={[
                    'Pipeline runs ('+ this.state.pipelineRuns.length + ")",
                    'Parameters',
                ]}
                icons={[
                    'list',
                    'tune',
                ]}
                onChange={this.onSelectSubview.bind(this)}
            />

            <div className="tab-view">
                {tabView}
            </div>

        </div>;

    }
}

export default ExperimentView;