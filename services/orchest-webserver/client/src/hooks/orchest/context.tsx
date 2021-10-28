import type { IOrchestContext } from "@/types";
import * as React from "react";

export const OrchestContext = React.createContext<IOrchestContext>(null);

export const useOrchest = () => React.useContext(OrchestContext);
