export type TOnboardingDialogCarouselSlide = { title: string } & (
  | { variant?: never; code?: never; icons?: never; description?: never }
  | { variant: "pipeline-diagram" }
  | {
      variant: "icons";
      description: string;
      icons: { icon: string; label: string }[];
    }
  | {
      variant: "code";
      description: string;
      code: { title: string; lines: string[] };
    }
  | ({
      variant: "end";
    } & Record<
      "description",
      { withQuickstart: string; withoutQuickstart: string }
    >)
);

/**
 * ⚠️ IMPORTANT: PLEASE READ
 *
 * When changing content, please make sure that the dialog doesn't "jump" in
 * height. If it does, please modify the value below.
 */
export const ONBOARDING_DIALOG_CAROUSEL_MIN_HEIGHT = "16rem";

export const onboardingDialogCarouselSlides: TOnboardingDialogCarouselSlide[] = [
  {
    variant: "icons",
    title: "Discover Orchest",
    description: "Find out more about the core concepts.",
    icons: [
      { icon: "device_hub", label: "Pipelines" },
      { icon: "pending_actions", label: "Jobs" },
      { icon: "view_comfy", label: "Environments" },
    ],
  },
  { variant: "pipeline-diagram", title: "Pipelines" },
  {
    variant: "icons",
    title: "Jobs",
    description: "Flexibly run data pipelines.",
    icons: [
      { icon: "pending_actions", label: "Scheduled runs" },
      { icon: "history", label: "Track history" },
      { icon: "tune", label: "Parameterized" },
    ],
  },
  {
    variant: "code",
    title: "Environments",
    description: "The power of container images, without the hassle.",
    code: {
      title: "Container Image",
      lines: [
        "pip install -r requirements.txt",
        "conda install tensorflow",
        "sudo apt-get install graphviz",
      ],
    },
  },
  {
    variant: "end",
    title: "Get Started",
    description: {
      withQuickstart:
        "Check out the Quickstart pipeline to see it all in action 🚀",
      withoutQuickstart: "Create your first project to see it all in action 🚀",
    },
  },
];
