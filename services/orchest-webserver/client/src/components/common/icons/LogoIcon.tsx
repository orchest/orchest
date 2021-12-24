import React from "react";

/**
 * /public/image/logo.svg
 */
export const LogoIcon: React.FC<{
  style?: React.CSSProperties;
  color?: string;
  className?: string;
  size?: number;
}> = ({ color = "currentColor", className = "", size = 24, style }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 64 64"
      className={className}
      style={style}
    >
      <path
        fill={color}
        fillRule="evenodd"
        d="M11.846 5.95h28.728a6.024 6.024 0 016.024 6.025v27.972a6.024 6.024 0 01-6.024 6.024H11.846a6.024 6.024 0 01-6.024-6.024V11.975a6.024 6.024 0 016.024-6.024zm0 3.013a3.012 3.012 0 00-3.012 3.012v27.972a3.012 3.012 0 003.012 3.012h28.728a3.012 3.012 0 003.012-3.012V11.975a3.012 3.012 0 00-3.012-3.012H11.846z"
        clipRule="evenodd"
      ></path>
      <path
        fill={color}
        fillRule="evenodd"
        d="M23.934 18.038h28.728a6.024 6.024 0 016.024 6.024v27.973a6.024 6.024 0 01-6.024 6.024H23.934a6.024 6.024 0 01-6.024-6.024V24.062a6.024 6.024 0 016.024-6.024zm0 3.012a3.012 3.012 0 00-3.012 3.012v27.973a3.012 3.012 0 003.012 3.012h28.728a3.012 3.012 0 003.012-3.012V24.062a3.012 3.012 0 00-3.012-3.012H23.934z"
        clipRule="evenodd"
      ></path>
    </svg>
  );
};
