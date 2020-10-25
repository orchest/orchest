import React from 'react';
import PipelinesView from './PipelinesView';
import ProjectSelectionView from './ProjectSelectionView';

class ProjectSelectionViewPipelines extends React.Component {

    componentWillUnmount() {
    }

    constructor(props) {
        super(props);
    }

    componentWillUnmount(){
    }

    componentDidMount() {
    }

    render() {
        return <ProjectSelectionView onSelectProject={(props) => {
          orchest.loadView(PipelinesView, props);
        }} />;

    }
}

export default ProjectSelectionViewPipelines;