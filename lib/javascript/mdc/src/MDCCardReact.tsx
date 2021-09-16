import React from "react";

const MDCCardReact: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({ children, className, style }) => {
  return (
    <div className={`mdc-card ${className}`} style={style}>
      {children}
    </div>
  );
};

export { MDCCardReact };
