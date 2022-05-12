import type { OrchestConfig, OrchestUserConfig } from "../types";
import { chance } from "./common.mock";

const DEFAULT_CONFIG: OrchestConfig = {
  CLOUD: false,
  CLOUD_UNMODIFIABLE_CONFIG_VALUES: [
    "TELEMETRY_UUID",
    "TELEMETRY_DISABLED",
    "AUTH_ENABLED",
    "INTERCOM_USER_EMAIL",
  ],
  ENVIRONMENT_DEFAULTS: {
    base_image: "orchest/base-kernel-py:v2022.04.0",
    gpu_support: false,
    language: "python",
    name: "Python 3",
    setup_script:
      "#!/bin/bash\n\n# Install any dependencies you have in this shell script,\n# see https://docs.orchest.io/en/latest/fundamentals/environments.html#install-packages\n\n# E.g. mamba install -y tensorflow\n\n",
  },
  FLASK_ENV: "development",
  GPU_ENABLED_INSTANCE: false,
  INTERCOM_APP_ID: chance.guid(),
  INTERCOM_DEFAULT_SIGNUP_DATE: "1577833200",
  ORCHEST_SOCKETIO_ENV_IMG_BUILDING_NAMESPACE: "/environment_image_builds",
  ORCHEST_SOCKETIO_JUPYTER_IMG_BUILDING_NAMESPACE: "/jupyter_image_builds",
  ORCHEST_WEB_URLS: {
    github: "https://github.com/orchest/orchest",
    orchest_examples_json:
      "https://raw.githubusercontent.com/orchest/orchest-examples/main/orchest_examples_data.json",
    orchest_examples_repo: "https://github.com/orchest/orchest-examples",
    orchest_update_info_json:
      "https://update-info.orchest.io/api/orchest/update-info/v3?version=v2022.04.0",
    readthedocs: "https://docs.orchest.io/en/stable",
    slack:
      "https://join.slack.com/t/orchest/shared_invite/zt-g6wooj3r-6XI8TCWJrXvUnXKdIKU_8w",
    website: "https://www.orchest.io",
  },
  PIPELINE_PARAMETERS_RESERVED_KEY: "pipeline_parameters",
  TELEMETRY_DISABLED: true,
};

const DEFAULT_USER_CONFIG: OrchestUserConfig = {
  AUTH_ENABLED: false,
  INTERCOM_USER_EMAIL: chance.email(),
  MAX_INTERACTIVE_RUNS_PARALLELISM: 1,
  MAX_JOB_RUNS_PARALLELISM: 1,
  TELEMETRY_DISABLED: true,
  TELEMETRY_UUID: chance.guid(),
};

let configCollection: {
  config: OrchestConfig;
  user_config: OrchestUserConfig;
} = {
  config: DEFAULT_CONFIG,
  user_config: DEFAULT_USER_CONFIG,
};

const generateMockConfig = () => {
  return {
    get() {
      return configCollection;
    },
    set({
      config,
      user_config,
    }: {
      config?: OrchestConfig | ((config: OrchestConfig) => OrchestConfig);
      user_config?:
        | OrchestUserConfig
        | ((user_config: OrchestUserConfig) => OrchestUserConfig);
    }) {
      if (config) {
        const mutatedConfig =
          config instanceof Function ? config(configCollection.config) : config;
        configCollection.config = mutatedConfig;
      }

      if (user_config) {
        const mutatedUserConfig =
          user_config instanceof Function
            ? user_config(configCollection.user_config)
            : user_config;
        configCollection.user_config = mutatedUserConfig;
      }

      return configCollection;
    },
    reset() {
      configCollection = {
        config: DEFAULT_CONFIG,
        user_config: DEFAULT_USER_CONFIG,
      };
    },
  };
};

export const mockConfig = generateMockConfig();
