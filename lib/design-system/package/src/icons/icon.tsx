import { css } from "../core";
import { ICSSProp } from "../types";

export const icon = css({ verticalAlign: "middle" });

export type IIconRef = SVGSVGElement;
export interface IIconProps extends ICSSProp, React.SVGProps<IIconRef> {}
