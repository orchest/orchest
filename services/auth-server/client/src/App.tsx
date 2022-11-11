import { fetcher } from "@orchest/lib-utils";
import React from "react";
import Admin from "./views/Admin";
import Login from "./views/Login";

type Config = {
  CLOUD: boolean;
  CLOUD_URL: string;
  GITHUB_URL: string;
  DOCUMENTATION_URL: string;
  VIDEOS_URL: string;
};

const App: React.FC<{ view: string; queryArgs: string }> = ({
  view,
  queryArgs,
}) => {
  const [config, setConfig] = React.useState<Config>();

  React.useEffect(() => {
    const fetchConfig = async () => {
      const response = await fetcher<Config>("/login/server-config");
      setConfig(response);
    };
    fetchConfig();
  }, []);

  if (!config) {
    console.log("The given view is not defined: " + view);
    return null;
  }

  if (view === "/login")
    return (
      <Login
        cloud={config.CLOUD}
        cloudUrl={config.CLOUD_URL}
        githubUrl={config.GITHUB_URL}
        documentationUrl={config.DOCUMENTATION_URL}
        videosUrl={config.VIDEOS_URL}
        queryArgs={queryArgs}
      />
    );
  if (view === "/login/admin") return <Admin />;
  return null;
};

export default App;
