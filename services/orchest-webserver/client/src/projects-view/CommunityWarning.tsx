import React from "react";

const CommunityWarning: React.FC<{ style?: React.CSSProperties }> = ({
  style = {},
}) => {
  return (
    <div className="examples-view-heading-section_warning" style={style}>
      <i className="material-icons">warning</i>
      <div className="examples-view-heading-section_warning-text">
        Warning: community contributed examples are not verified by Orchest and
        can contain malicious code.
      </div>
    </div>
  );
};

export { CommunityWarning };
