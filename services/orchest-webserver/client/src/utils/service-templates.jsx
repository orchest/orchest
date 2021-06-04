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
 * @typedef {{scope?: ("interactive"|"noninteractive")[]}} TServiceConfigScope
 * @typedef { Partial<Record<"command"|"image"|"name", string>>
 *  & TServiceConfigBinds
 *  & TServiceConfigEnv
 *  & TServiceConfigPorts
 *  & TServiceConfigScope
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
      command: "tensorboard --logdir /data --bind_all",
      image: "tensorflow/tensorflow",
      name: "tensorboard",
      ports: [6006],
      scope: ["interactive"],
    },
  },
  streamlit: { label: "Streamlit", icon: <IconStreamlit /> },
  vscode: {
    label: "VSCode",
    icon: <IconVSCode />,
    config: {
      binds: {
        "/project-dir": "/home/coder/project",
      },
      command: "code-server --auth none",
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
