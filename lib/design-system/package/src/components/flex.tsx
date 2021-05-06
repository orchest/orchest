import { css, styled, CSS } from "../core";

const style: CSS = { include: "box", display: "flex" };

export const flex = css(style);
export const Flex = styled("div", style);
