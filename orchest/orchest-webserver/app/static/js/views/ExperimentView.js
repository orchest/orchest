import React from 'react';
import MDCTabBarReact from '../mdc-components/MDCTabBarReact';
import MDCDataTableReact from '../mdc-components/MDCDataTableReact';
import MDCTextFieldReact from '../mdc-components/MDCTextFieldReact';
import ParameterEditor from '../components/ParameterEditor';
import SearchableTable from '../components/SearchableTable';

class ExperimentView extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            'selectedTabIndex': 0,
            'parameterizedSteps': this.props.parameterizedSteps,
            'selectedIndices': [0, 0],
            'pipelineRuns': [[1, "lr: 0.01", "Completed"], [2, "lr: 0.02", "Running"]]
        }

    }

    onSelectSubview(index) {
        this.setState({
            selectedTabIndex: index
        })
    }

    componentDidMount(){

    }

    onPipelineRunsSelectionChanged(selectedIndices){
        this.setState({
            selectedIndices: selectedIndices
        })
    }

    render() {

        let tabView = undefined;

        switch (this.state.selectedTabIndex) {
            case 0:
                tabView = <div className="pipeline-tab-view existing-pipeline-runs">

                    <SearchableTable rows={this.state.pipelineRuns} headers={['ID', 'Parameters', 'Status']} selectedIndices={this.state.selectedIndices} onSelectionChanged={this.onPipelineRunsSelectionChanged.bind(this)} />

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
                ref={"tabBar"}
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