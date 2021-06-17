export type TOnboardingDialogSlide = { title: string; description?: string } & (
  | { variant?: never; code?: never; icons?: never }
  | { variant: "pipeline-diagram" }
  | {
      variant: "icons";
      icons: { icon: string; label: string }[];
    }
  | {
      variant: "code";
      code: { title: string; lines: string[] };
    }
);
