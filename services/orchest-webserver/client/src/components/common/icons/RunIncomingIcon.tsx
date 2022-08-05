import React from "react";

export const RunIncomingIcon = ({
  color = "currentColor",
  className = "",
  size = 24,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      className={className}
    >
      <path
        fill={color}
        d="M13 8.64L18.27 12 13 15.36V8.64zM11 5v14l11-7-11-7z"
      ></path>
      <path
        fill={color}
        fillRule="evenodd"
        d="M10 12L6 9v2H2v2h4v2l4-3z"
        clipRule="evenodd"
      ></path>
    </svg>
  );
};
