import * as React from "react";
import {
  Alert,
  IconLightBulb,
  Link,
  IconWarning,
  Flex,
  Text,
  IconButton,
  IconChevronRight,
  Box,
  IconChevronLeft,
  LogoBrand,
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@orchest/design-system";

const Index = () => (
  <Flex
    as="main"
    css={{
      margin: "0 auto",
      padding: "$4",
      maxWidth: "$3xl",
      flexDirection: "column",
      gap: "$4",
    }}
  >
    <h1>Design System Sandbox</h1>
    <h2>Components</h2>
    <h3>Alert</h3>
    <h4>Info</h4>
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
    <h4>Warning</h4>
    <Alert
      status="warning"
      title="Warning"
      description="A project is simply a directory of files. It can even be fully versioned using git!"
    />
    <Alert
      icon={<IconWarning />}
      status="warning"
      title="Warning"
      description={[
        "Put data in the /data directory to share data between pipelines.",
      ]}
    />
    <Alert
      status="warning"
      title="Warning"
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
      icon={<IconWarning />}
      status="warning"
      title="Warning"
      description={[
        <>
          Use the integrated <Link href="#">file manager</Link> to upload and
          download your files.
        </>,
        "You can import your existing projects and make them into pipelines.",
        "Private git repositories can be managed in Orchest using local git credentials.",
      ]}
    />
    <h3>Dialog</h3>
    <Dialog>
      <DialogTrigger>Open Dialog</DialogTrigger>
      <DialogContent>Test</DialogContent>
    </Dialog>
    <h3>Flex</h3>
    <Text>A basic flex-layout primitive</Text>
    <Flex
      css={{
        gap: "$4",
        "> *": {
          backgroundColor: "$primary",
          width: "$space$12",
          height: "$space$12",
        },
      }}
    >
      <Box />
      <Box />
      <Box />
      <Box />
    </Flex>
    <h3>Icon Button</h3>
    <h4>Ghost</h4>
    <Box role="group">
      <IconButton variant="ghost" label="Previous">
        <IconChevronLeft />
      </IconButton>
      <IconButton variant="ghost" label="Next">
        <IconChevronRight />
      </IconButton>
    </Box>
    <h3>Link</h3>
    <Link href="#">Traditional anchor tag</Link>{" "}
    <Link as="button" onClick={() => alert("hello!")}>
      Button disguised as a link
    </Link>
    <h3>Text</h3>
    <Text size="xs">xs</Text>
    <Text size="sm">sm</Text>
    <Text>base</Text>
    <Text size="lg">lg</Text>
    <Text size="xl">xl</Text>
    <Text size="2xl">2xl</Text>
    <h2>Logos</h2>
    <LogoBrand />
  </Flex>
);

export default Index;
