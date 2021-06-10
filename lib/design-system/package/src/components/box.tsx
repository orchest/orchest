import type * as Polymorphic from "@radix-ui/react-polymorphic";
import { styled } from "../core";
import type { ICSSProp } from "../types";

const DEFAULT_TAG = "div";

export interface IBoxProps extends ICSSProp {}
export type TBoxComponent = Polymorphic.ForwardRefComponent<
  typeof DEFAULT_TAG,
  IBoxProps
>;

export const Box = styled(DEFAULT_TAG, { include: "box" });
