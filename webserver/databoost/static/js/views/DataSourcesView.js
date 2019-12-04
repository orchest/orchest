import React from 'react';

class DataSourcesView extends React.Component {
  componentWillUnmount() {
  }
  render() {
    return <div className={"view-page"}>
      <h2>Data Sources</h2>
      <p>Select which data sources are available to the pipeline.</p>
    </div>;
  }
}

export default DataSourcesView;