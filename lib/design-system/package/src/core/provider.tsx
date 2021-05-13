import * as React from "react";
import { IdProvider } from "@radix-ui/react-id";
import { globalStyles } from "./global";

export const DesignSystemProvider: React.FC = ({ children }) => {
  globalStyles();
  return <IdProvider>{children}</IdProvider>;
};
