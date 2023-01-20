import { useCurrentQuery, useNavigate } from "@/hooks/useCustomRoute";
import Tabs from "@mui/material/Tabs";
import React, { PropsWithChildren } from "react";

export type NavigationTabsProps = PropsWithChildren<{
  defaultTab?: string;
}>;

/** Renders a `<Tabs>` component that navigates to value of the tab on change. */
export const NavigationTabs = ({
  children,
  defaultTab,
}: NavigationTabsProps) => {
  const navigate = useNavigate();
  const { tab } = useCurrentQuery();

  const handleChange = (value: string) => navigate({ query: { tab: value } });

  return (
    <Tabs
      value={tab ?? defaultTab}
      onChange={(_, value: string) => handleChange(value)}
      aria-label="navigation tabs"
    >
      {children}
    </Tabs>
  );
};
