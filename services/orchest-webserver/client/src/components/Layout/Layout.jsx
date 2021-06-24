// @ts-check
import React from "react";
import { OnboardingDialog } from "./OnboardingDialog";

/** @type React.FC<{}> */
export const Layout = (props) => {
  return (
    <React.Fragment>
      {props.children}
      <OnboardingDialog />
    </React.Fragment>
  );
};
