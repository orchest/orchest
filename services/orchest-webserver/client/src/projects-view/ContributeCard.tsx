import React from "react";
import { MDCButtonReact, MDCCardReact } from "@orchest/lib-mdc";

const ContributeCard: React.FC<{ style?: React.CSSProperties }> = ({
  style = {},
}) => {
  const onClick = () => {
    window.open(
      "https://github.com/orchest/orchest-examples",
      "_blank",
      "noopener,noreferrer"
    );
  };
  return (
    <MDCCardReact className="contribute-card" style={style}>
      <h4 className="contribute-card-title">Contribute your own example!</h4>
      <div className="contribute-card-description">
        <p>
          Help others get started by sharing your Orchest pipelines. The best
          pipelines will get featured.
        </p>
        <p>Start sharing simply by uploading your project to GitHub.</p>
      </div>
      <div className="contribute-button-container">
        <MDCButtonReact
          label="SUBMIT EXAMPLE"
          icon="open_in_new"
          classNames={["contribute-button"]}
          onClick={onClick}
        />
      </div>
    </MDCCardReact>
  );
};

export { ContributeCard };
