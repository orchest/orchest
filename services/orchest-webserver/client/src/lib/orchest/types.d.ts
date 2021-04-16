import * as React from "react";
import { PersistentLocalConfig, RefManager } from "@orchest/lib-utils";

interface IOrchestConfig {
  config?: {
    CLOUD: boolean;
    CLOUD_UNMODIFIABLE_CONFIG_VALUES?: string[] | null;
    ENVIRONMENT_DEFAULTS: {
      base_image: string;
      gpu_support: boolean;
      language: string;
      name: string;
      setup_script: string;
    };
    FLASK_ENV: string;
    GPU_ENABLED_INSTANCE: boolean;
    GPU_REQUEST_URL: string;
    INTERCOM_APP_ID: string;
    INTERCOM_DEFAULT_SIGNUP_DATE: string;
    INTERCOM_USER_EMAIL: string;
    ORCHEST_SOCKETIO_ENV_BUILDING_NAMESPACE: string;
    ORCHEST_SOCKETIO_JUPYTER_BUILDING_NAMESPACE: string;
    ORCHEST_WEB_URLS: {
      github: string;
      readthedocs: string;
      slack: string;
      website: string;
    };
    PIPELINE_PARAMETERS_RESERVED_KEY: string;
    TELEMETRY_DISABLED: boolean;
  };
  user_config?: {
    TELEMETRY_UUID: string;
  };
}

export interface IOrchestContext extends IOrchestConfig {
  isLoading: boolean;
  refManager: RefManager;
  browserConfig: PersistentLocalConfig;
  loadView: (TagName, dynamicProps, onCancelled) => void;
  alert: (title, content, onClose) => void;
  confirm: (title, content, onConfirm, onCancel) => void;
  requestBuild: (
    project_uuid,
    environmentValidationData,
    requestedFromView,
    onBuildComplete,
    onCancel
  ) => void;
  handleToggleDrawer: () => void;
  handleDrawerOpen: (open) => void;
  setProject: (projectUUID) => void;
  getProject: () => Promise<any>;
  invalidateProjects: () => void;
  view: any;
  activeViewName: string;
  drawerOpen: boolean;
  selectedProject: string;
  projectSelectorHash: string;
  TagName: any;
  dynamicProps: any;
}

export interface IOrchestProviderProps extends IOrchestConfig {}
