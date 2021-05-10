import * as React from "react";
import { flex, Alert, IconLightBulb, Link } from "@orchest/design-system";

const Index = () => (
  <main
    className={flex({
      css: {
        margin: "0 auto",
        padding: "$4",
        maxWidth: "$3xl",
        flexDirection: "column",
        gap: "$4",
      },
    })}
  >
    <h1>Design System Sandbox</h1>

    <h2>Components</h2>

    <h3>Alert</h3>
    <Alert
      status="info"
      title="Info"
      description="A project is simply a directory of files. It can even be fully versioned using git!"
    />
    <Alert
      icon={<IconLightBulb />}
      status="info"
      title="Info"
      description={[
        "Put data in the /data directory to share data between pipelines.",
      ]}
    />
    <Alert
      status="info"
      title="Info"
      description={[
        <>
          Use the integrated <Link href="#">file manager</Link> to upload and
          download your files.
        </>,
        "You can import your existing projects and make them into pipelines.",
        "Private git repositories can be managed in Orchest using local git credentials.",
      ]}
    />
    <Alert
      icon={<IconLightBulb />}
      status="info"
      title="Info"
      description={[
        <>
          Use the integrated <Link href="#">file manager</Link> to upload and
          download your files.
        </>,
        "You can import your existing projects and make them into pipelines.",
        "Private git repositories can be managed in Orchest using local git credentials.",
      ]}
    />
  </main>
);

export default Index;
