import React from "react";
import { themeIcons } from "seti-icons";

export const getIcon = themeIcons({
  blue: "#268bd2",
  grey: "#657b83",
  "grey-light": "#839496",
  green: "#859900",
  orange: "#cb4b16",
  pink: "#d33682",
  purple: "#6c71c4",
  red: "#dc322f",
  white: "black",
  yellow: "#b58900",
  ignore: "#586e75",
});

// seti-icon didn't export ThemedIcon, it's a workaround
type ThemedIcon = { svg: string; color: string };

function isReactElement<T>(element: JSX.Element | T): element is JSX.Element {
  return React.isValidElement(element);
}

export const SVGFileIcon = ({
  icon,
  size = "22px",
}: {
  icon: JSX.Element | { svg: string; color: string };
  size?: string;
}) => {
  if (isReactElement<ThemedIcon>(icon)) return icon;

  // if not a JSX.Element, it's themed icon

  // Put in SVG spec
  let image = icon.svg;
  image = image.replace(
    "<svg",
    `<svg width='${size}' height='${size}' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' version='1.1'`
  );
  image = image.replace(/<path/g, `<path fill='${icon.color}'`);
  return (
    <img
      alt="Filetype icon"
      src={`data:image/svg+xml;utf8,${encodeURIComponent(image)}`}
    />
  );
};
