import React from 'react';
import ExperimentsView from './ExperimentsView';
import ProjectSelectionView from './ProjectSelectionView';


class ProjectSelectionViewExperiments extends React.Component {

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
          orchest.loadView(ExperimentsView, props);
        }} />;

    }
}

export default ProjectSelectionViewExperiments;