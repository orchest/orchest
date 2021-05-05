import * as React from "react";
import { Alert } from "@orchest/design-system";

const Index = () => (
  <main>
    <h1>Design System Sandbox</h1>

    <h2>Components</h2>

    <h3>Alert</h3>
    <Alert
      status="info"
      title="Info"
      description="A project is simply a directory of files. It can even be fully versioned using git!"
    />
    <Alert
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
        "Use the integrated file manager to upload and download your files.",
        "You can import your existing projects and make them into pipelines.",
        "Private git repositories can be managed in Orchest using local git credentials.",
      ]}
    />
  </main>
);

export default Index;
