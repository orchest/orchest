import * as React from "react";
import { OnboardingDialog } from "./OnboardingDialog";

export const Layout: React.FC = (props) => {
  return (
    <React.Fragment>
      {props.children}
      <OnboardingDialog />
    </React.Fragment>
  );
};
