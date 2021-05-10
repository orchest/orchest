import { css, styled } from "../core";
import { CSS } from "../types";

const style: CSS = { include: "box" };

export const box = css(style);
export const Box = styled("div", style);
