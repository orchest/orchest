// @ts-check
import React from "react";
import { LayoutOnboardingDialog } from "./LayoutOnboardingDialog";

/** @type React.FC<{}> */
export const Layout = (props) => {
  return (
    <React.Fragment>
      <LayoutOnboardingDialog />
      {props.children}
    </React.Fragment>
  );
};
