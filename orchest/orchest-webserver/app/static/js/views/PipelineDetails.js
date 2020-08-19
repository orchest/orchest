import React from 'react';
import MDCTabBarReact from '../lib/mdc-components/MDCTabBarReact';
import PipelineDetailsProperties from './PipelineDetailsProperties';
import PipelineDetailsLogs from './PipelineDetailsLogs';
import MDCButtonReact from '../lib/mdc-components/MDCButtonReact';


class PipelineDetails extends React.Component {

    constructor(props) {
        super(props);

        let index = 0;

        if(this.props.defaultViewIndex){
            index = this.props.defaultViewIndex;
        }
        
        this.state = {
            subviewIndex: index
        }
    }

    componentWillUnmount() {
        $(document).off("mouseup.connectionList");
        $(document).off("mousemove.connectionList");
        $(window).off("resize.pipelineDetails");
        $(window).off("keyup.pipelineDetails");
    }

    onOpenNotebook() {
        this.props.onOpenNotebook();
    }

    onOpenNotebookPreview() {
        this.props.onOpenNotebookPreview(this.props.step.uuid);
    }

    componentDidMount() {

        // overflow checks
        $(window).on("resize.pipelineDetails", this.overflowChecks.bind(this))
        this.overflowChecks();

    }

    overflowChecks() {
        $('.overflowable').each(function () {
            if ($(this).overflowing()) {
                $(this).addClass("overflown");
            } else {
                $(this).removeClass("overflown");
            }
        })
    }

    onSelectSubview(index){
        this.setState({
            subviewIndex: index
        })
        this.props.onChangeView(index);
    }

    render() {

        let subView = undefined;

        switch(this.state.subviewIndex){
            case 0:
                subView = <PipelineDetailsProperties readOnly={this.props.readOnly} onNameUpdate={this.props.onNameUpdate} onSave={this.props.onSave} connections={this.props.connections} step={this.props.step} onChange={this.props.onChange} />;
                break;
            case 1:
                subView = <PipelineDetailsLogs pipelineRun={this.props.pipelineRun} step={this.props.step} pipeline={this.props.pipeline} />
        }

        return <div className={"pipeline-details pane"}>
            <div className={"overflowable"}>
                <div className="input-group">
                    <MDCTabBarReact
                        ref={"tabBar"}
                        selectedIndex={this.state.subviewIndex}
                        items={[
                            'Properties',
                            'Logs'
                        ]}
                        icons={[
                            'tune',
                            'view_headline'
                        ]}
                        onChange={this.onSelectSubview.bind(this)}
                    />
                </div>
                
                {subView}
                
            </div>

            <div className={"action-buttons-bottom"}>

                {(() => {
                    if(!this.props.readOnly){
                        return <div className={"notebook-actions"}>
                            <MDCButtonReact icon="launch" classNames={["mdc-button--raised", "themed-secondary"]}  label="Open in Jupyter" onClick={this.onOpenNotebook.bind(this)} />
                        </div>
                    }else{
                        return <div className={"notebook-actions"}>
                            <MDCButtonReact icon="visibility" classNames={["mdc-button--raised", "themed-secondary"]}  label="View Notebook" onClick={this.onOpenNotebookPreview.bind(this)} />
                        </div>
                    }
                })()}

                <div className={"general-actions"}>
                    <MDCButtonReact icon="close" label="Close" onClick={this.props.onClose.bind(this)} />

                    {(() => {
                        if(!this.props.readOnly){
                            return <MDCButtonReact icon="delete" label="Delete" onClick={this.props.onDelete.bind(this)} />
                        }
                    })()}
                    
                </div>

            </div>

        </div>
    }
}

export default PipelineDetails;