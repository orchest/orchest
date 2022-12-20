import { useOrchestConfigsApi } from "@/api/system-config/useOrchestConfigsApi";
import React from "react";
import { useIntercom } from "react-use-intercom";

export const useInitIntercom = () => {
  const { boot } = useIntercom();
  const config = useOrchestConfigsApi((state) => state.config);
  const userConfig = useOrchestConfigsApi((state) => state.userConfig);

  React.useEffect(() => {
    if (!config || !userConfig) return;
    if (config.CLOUD === true) {
      boot({
        email: userConfig.INTERCOM_USER_EMAIL,
        createdAt: config.INTERCOM_DEFAULT_SIGNUP_DATE,
        alignment: "right",
      });
    }
  }, [config, userConfig, boot]);
};
