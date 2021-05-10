import { css, styled } from "../core";
import { CSS } from "../types";

const style: CSS = { include: "box", display: "flex" };

export const flex = css(style);
export const Flex = styled("div", style);
