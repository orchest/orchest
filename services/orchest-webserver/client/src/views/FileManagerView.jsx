// @ts-check
import React from "react";
import { css } from "@orchest/design-system";

const fileManagerRoot = css({
  include: "box",
  padding: 0,
  overflowY: "auto",
  height: "100%",
});

const fileManagerIframe = css({
  include: "box",
  width: "100%",
  height: "100%",
  border: 0,
  display: "block",
});

const FileManagerView = () => (
  <div className={fileManagerRoot()}>
    <iframe className={fileManagerIframe()} src="/container-file-manager" />
  </div>
);

export default FileManagerView;
