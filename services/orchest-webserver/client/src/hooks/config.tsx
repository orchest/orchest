import * as React from "react";

export interface IConfigContext {
  config: "";
  userConfig: "";
}

const ConfigContext = React.createContext<IConfigContext>({
  config: null,
  userConfig: null,
});

export const useConfig = () => React.useContext(ConfigContext);

export interface IConfigProviderProps extends IConfigContext {}

export const ConfigProvider: React.FC<IConfigProviderProps> = ({
  children,
  ...value
}) => <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
