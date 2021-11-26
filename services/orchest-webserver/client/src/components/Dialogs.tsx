import { uuidv4 } from "@orchest/lib-utils";
import React from "react";
import BuildPendingDialog from "./BuildPendingDialog";
import ConfirmDialog from "./ConfirmDialog";

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

const Dialogs = (_, ref) => {
  const [dialogs, setDialogs] = React.useState([]);

  const requestBuild = (
    project_uuid,
    environmentValidationData,
    requestedFromView: string,
    onBuildComplete: () => void,
    onCancel
  ) => {
    let uuid = uuidv4();

    setDialogs((prevDialogs) => [
      ...prevDialogs,
      <BuildPendingDialog
        key={uuid}
        projectUuid={project_uuid}
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
};

export default React.forwardRef(Dialogs);
