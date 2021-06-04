// @ts-check

import React from "react";

import {
  IconPostgreSQL,
  IconRedis,
  IconStreamlit,
  IconTensorBoard,
  IconVSCode,
} from "@/icons";

import { IconDraftOutline } from "@orchest/design-system";

/**
 * @typedef {{binds?: {[key: string]: string}}} TServiceConfigBinds
 * @typedef {{env_variables?: {[key: string]: string}}} TServiceConfigEnv
 * @typedef {{ports?: number[]}} TServiceConfigPorts
 * @typedef {{preserve_base_path?: boolean}} TServiceConfigPreserveBasePath
 * @typedef {{entrypoint?: string}} TServiceConfigEntrypoint
 * @typedef {{scope?: ("interactive"|"noninteractive")[]}} TServiceConfigScope
 * @typedef { Partial<Record<"command"|"image"|"name", string>>
 *  & TServiceConfigBinds
 *  & TServiceConfigEnv
 *  & TServiceConfigPorts
 *  & TServiceConfigScope
 *  & TServiceConfigPreserveBasePath
 *  & TServiceConfigEntrypoint
 * } TServiceConfig
 * @type {{[key: string]: {label: string, icon?: React.ReactNode, config?: TServiceConfig}}} servicesTemplates */
export const servicesTemplates = {
  tensorboard: {
    label: "TensorBoard",
    icon: <IconTensorBoard />,
    config: {
      binds: {
        "/data": "/data",
      },
      entrypoint: "bash",
      command: "-c 'umask 002 && tensorboard --logdir /data --bind_all'",
      image: "tensorflow/tensorflow",
      name: "tensorboard",
      ports: [6006],
      scope: ["interactive"],
    },
  },
  streamlit: {
    label: "Streamlit",
    icon: <IconStreamlit />,
    config: {
      binds: {
        "/data": "/data",
        "/project-dir": "/usr/src/app/src",
      },
      command:
        "-c 'umask 002 && touch /usr/src/app/src/streamlit.py && streamlit run src/streamlit.py'",
      entrypoint: "bash",
      env_variables: {
        STREAMLIT_SERVER_BASE_URL_PATH: "$BASE_PATH_PREFIX_8501",
      },
      image: "orchest/streamlit",
      name: "streamlit",
      ports: [8501],
      preserve_base_path: true,
      scope: ["interactive", "noninteractive"],
    },
  },
  vscode: {
    label: "VSCode",
    icon: <IconVSCode />,
    config: {
      binds: {
        "/project-dir": "/home/coder/code-server",
      },
      entrypoint: "bash",
      command:
        "-c 'umask 002 && code-server --auth none --bind-addr 0.0.0.0:8080 /home/coder/code-server'",
      image: "codercom/code-server:latest",
      name: "code-server",
      ports: [8080],
      scope: ["interactive"],
    },
  },
  postgressql: {
    label: "PostgresSQL",
    icon: <IconPostgreSQL />,
    config: {
      env_variables: {
        POSTGRES_HOST_AUTH_METHOD: "trust",
      },
      image: "postgres",
      name: "postgres",
      scope: ["interactive", "noninteractive"],
    },
  },
  redis: {
    label: "Redis",
    icon: <IconRedis />,
    config: {
      image: "redis",
      name: "redis",
      scope: ["interactive", "noninteractive"],
    },
  },
  empty: {
    label: "Create custom service",
    icon: <IconDraftOutline />,
  },
};
