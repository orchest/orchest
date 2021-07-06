export type TServiceTemplate = {
  label: string;
  icon?: React.ReactNode;
  config?: Partial<Record<"command" | "image" | "name", string>> & {
    binds?: { [key: string]: string };
    env_variables?: { [key: string]: string };
    ports?: number[];
    preserve_base_path?: boolean;
    entrypoint?: string;
    scope?: ("interactive" | "noninteractive")[];
  };
};

export type TServiceTemplates = {
  [key: string]: TServiceTemplate;
};

export type TServiceTemplatesDialogProps = {
  onSelection?: (templateConfig: TServiceTemplate["config"]) => void;
};
