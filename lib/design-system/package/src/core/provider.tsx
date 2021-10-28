import { IdProvider } from "@radix-ui/react-id";
import * as React from "react";
import { globalStyles } from "./global";

export { useId } from "@radix-ui/react-id";

export const DesignSystemProvider: React.FC = ({ children }) => {
  globalStyles();
  return <IdProvider>{children}</IdProvider>;
};
