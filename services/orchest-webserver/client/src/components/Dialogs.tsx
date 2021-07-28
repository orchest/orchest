import * as React from "react";
import AlertDialog from "./AlertDialog";
import { uuidv4 } from "@orchest/lib-utils";
import ConfirmDialog from "./ConfirmDialog";
import BuildPendingDialog from "./BuildPendingDialog";

function newslines2breaks(lines: string) {
  if (lines === undefined) {
    return [];
  }

  // subtitute newlines for line breaks
  let linesArr = lines.split("\n");

  let lineElements = linesArr.map((line, index) => {
    if (index !== linesArr.length - 1) {
      return (
        <React.Fragment key={index}>
          {line}
          <br />
        </React.Fragment>
      );
    } else {
      return <React.Fragment key={index}>{line}</React.Fragment>;
    }
  });
  return lineElements;
}

const Dialogs = React.forwardRef((_, ref) => {
  const [dialogs, setDialogs] = React.useState([]);

  const requestBuild = (
    project_uuid,
    environmentValidationData,
    requestedFromView,
    onBuildComplete,
    onCancel
  ) => {
    let uuid = uuidv4();

    setDialogs((prevDialogs) => [
      ...prevDialogs,
      <BuildPendingDialog
        key={uuid}
        project_uuid={project_uuid}
        environmentValidationData={environmentValidationData}
        requestedFromView={requestedFromView}
        onBuildComplete={() => {
          onBuildComplete();
        }}
        onCancel={onCancel}
        onClose={() => {
          remove(uuid);
        }}
      />,
    ]);
  };

  const alert = (title, content, onClose) => {
    let uuid = uuidv4();

    if (typeof content == "string") {
      content = newslines2breaks(content);
    }

    setDialogs((prevDialogs) => [
      ...prevDialogs,
      <AlertDialog
        key={uuid}
        onClose={() => {
          if (onClose) {
            onClose();
          }
          remove(uuid);
        }}
        title={title}
        content={content}
      />,
    ]);
  };

  const confirm = (title, content, onConfirm, onCancel) => {
    let uuid = uuidv4();

    if (typeof content == "string") {
      content = newslines2breaks(content);
    }

    setDialogs((prevDialogs) => [
      ...prevDialogs,
      <ConfirmDialog
        key={uuid}
        title={title}
        content={content}
        onConfirm={() => {
          if (onConfirm) {
            onConfirm();
          }
        }}
        onClose={() => {
          if (onCancel) {
            onCancel();
          }
          remove(uuid);
        }}
      />,
    ]);
  };

  const remove = (uuid) => {
    setDialogs((prevDialogs) =>
      prevDialogs.filter((item) => item.key !== uuid)
    );
  };

  React.useImperativeHandle(ref, () => ({
    alert,
    confirm,
    remove,
    requestBuild,
  }));

  // return dialogs;
  return <React.Fragment>{dialogs.length > 0 ? dialogs : null}</React.Fragment>;
});

export default Dialogs;
