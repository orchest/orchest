import { MDCRipple } from '@material/ripple';
import React from 'react';
import MDCTabBarReact from '../mdc-components/MDCTabBarReact';
import PipelineDetailsProperties from './PipelineDetailsProperties';
import PipelineDetailsLogs from './PipelineDetailsLogs';
import MDCButtonReact from '../mdc-components/MDCButtonReact';


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
        this.props.onOpenNotebook(this);
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
                subView = <PipelineDetailsProperties onNameUpdate={this.props.onNameUpdate} onSave={this.props.onSave} connections={this.props.connections} step={this.props.step} onChange={this.props.onChange} />;
                break;
            case 1:
                subView = <PipelineDetailsLogs />
        }

        return <div className={"pipeline-details pane"}>
            <div className={"overflowable"}>
                <div className="input-group">
                    <MDCTabBarReact
                        selectedIndex={this.state.subviewIndex}
                        items={[
                            'Properties',
                            'Logs'
                        ]}
                        icons={[
                            'tune',
                            'receipt'
                        ]}
                        onChange={this.onSelectSubview.bind(this)}
                    />
                </div>
                
                {subView}
                
            </div>

            <div className={"action-buttons-bottom"}>

                <div className={"notebook-actions"}>
                    <MDCButtonReact icon="launch" label="Open notebook" onClick={this.onOpenNotebook.bind(this)} />
                </div>

                <div className={"general-actions"}>
                    <MDCButtonReact icon="close" label="Close" onClick={this.props.onClose.bind(this)} />

                    <MDCButtonReact icon="delete" label="Delete" onClick={this.props.onDelete.bind(this)} />
                </div>

            </div>

        </div>
    }
}

export default PipelineDetails;