import React from "react";
import AlertDialog from "./AlertDialog";
import { uuidv4 } from "../lib/utils/all";
import ConfirmDialog from "./ConfirmDialog";
import BuildPendingDialog from "./BuildPendingDialog";

class Dialogs extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      dialogs: [],
    };
  }

  requestBuild(
    project_uuid,
    environmentValidationData,
    requestedFromView,
    onBuildComplete,
    onCancel
  ) {
    let uuid = uuidv4();
    this.state.dialogs.push(
      <BuildPendingDialog
        key={uuid}
        uuid={uuid}
        project_uuid={project_uuid}
        environmentValidationData={environmentValidationData}
        requestedFromView={requestedFromView}
        onBuildComplete={onBuildComplete}
        onCancel={onCancel}
        onClose={() => {
          this.remove(uuid);
        }}
      />
    );

    this.setState({
      dialogs: this.state.dialogs,
    });
  }

  alert(title, content, onClose) {
    let uuid = uuidv4();
    this.state.dialogs.push(
      <AlertDialog
        key={uuid}
        uuid={uuid}
        onClose={() => {
          if (onClose) {
            onClose();
          }
          this.remove(uuid);
        }}
        title={title}
        content={content}
      />
    );

    this.setState({
      dialogs: this.state.dialogs,
    });
  }

  confirm(title, content, onConfirm, onCancel) {
    let uuid = uuidv4();
    this.state.dialogs.push(
      <ConfirmDialog
        key={uuid}
        uuid={uuid}
        title={title}
        content={content}
        onConfirm={() => {
          if (onConfirm) {
            onConfirm();
          }
        }}
        onCancel={() => {
          if (onCancel) {
            onCancel();
          }
        }}
        onClose={() => {
          this.remove(uuid);
        }}
      />
    );

    this.setState({
      dialogs: this.state.dialogs,
    });
  }

  remove(uuid) {
    let index;
    for (let x = 0; x < this.state.dialogs.length; x++) {
      if (this.state.dialogs[x].props.uuid == uuid) {
        index = x;
        break;
      }
    }

    this.state.dialogs.splice(index, 1);

    this.setState({
      dialogs: this.state.dialogs,
    });
  }

  render() {
    return this.state.dialogs;
  }
}

export default Dialogs;
