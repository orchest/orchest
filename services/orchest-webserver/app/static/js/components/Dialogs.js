import React from "react";
import AlertDialog from "./AlertDialog";
import { uuidv4 } from "../lib/utils/all";
import ConfirmDialog from "./ConfirmDialog";

class Dialogs extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      dialogs: [],
    };
  }

  alert(title, content) {
    let uuid = uuidv4();
    this.state.dialogs.push(
      <AlertDialog
        uuid={uuid}
        onClose={() => {
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

  confirm(title, content, onConfirm) {
    let uuid = uuidv4();
    this.state.dialogs.push(
      <ConfirmDialog
        onConfirm={onConfirm}
        uuid={uuid}
        onClose={() => {
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
    if (this.state.dialogs.length > 0) {
      return this.state.dialogs[this.state.dialogs.length - 1];
    } else {
      return null;
    }
  }
}

export default Dialogs;
