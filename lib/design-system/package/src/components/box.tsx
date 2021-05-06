import { css, styled, CSS } from "../core";

const style: CSS = { include: "box" };

export const box = css(style);
export const Box = styled("div", style);
