import * as React from "react";
import { IdProvider } from "@radix-ui/react-id";
import { globalStyles } from "./global";

export { useId } from "@radix-ui/react-id";

export const DesignSystemProvider: React.FC = ({ children }) => {
  globalStyles();
  return <IdProvider>{children}</IdProvider>;
};
