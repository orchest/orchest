import React from "react";

class FileManagerView extends React.Component {
  componentWillUnmount() {}

  componentDidMount() {}

  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div className={"view-page no-padding"}>
        <iframe
          className={"borderless fullsize"}
          src="/container-file-manager"
        ></iframe>
      </div>
    );
  }
}

export default FileManagerView;
