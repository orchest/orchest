import * as React from "react";
import type { InferGetStaticPropsType } from "next";
import {
  Alert,
  AlertHeader,
  AlertDescription,
  AlertControls,
  Box,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Flex,
  IconButton,
  IconChevronLeftOutline,
  IconChevronRightOutline,
  IconLightBulbOutline,
  IconWarningOutline,
  IconCheckCircleOutline,
  IconCheckSolid,
  IconClockOutline,
  IconClockSolid,
  IconCrossCircleOutline,
  IconCrossSolid,
  IconDraftCircleOutline,
  IconDraftOutline,
  IconServicesSolid,
  Link,
  LogoBrand,
  Text,
} from "@orchest/design-system";
import { getAssets } from "../lib/assets";
import { AssetList, AssetListItem } from "../components/asset-list";

export const getStaticProps = async () => ({
  props: {
    assets: getAssets(),
  },
});

const Index: React.FC<InferGetStaticPropsType<typeof getStaticProps>> = ({
  assets,
}) => (
  <Flex
    as="main"
    direction="column"
    gap="8"
    css={{
      margin: "0 auto",
      padding: "$4",
      maxWidth: "$3xl",
    }}
  >
    <h1>Design System Sandbox</h1>
    <h2>Assets</h2>
    <h3>Badges</h3>
    <AssetList>
      {assets.badges.map((imgProps) => (
        <AssetListItem key={imgProps.src}>
          <img {...imgProps} />
        </AssetListItem>
      ))}
    </AssetList>
    <h3>Meta</h3>
    <h4>Favicons</h4>
    <AssetList>
      {assets.favicons.map(({ height, width, ...imgProps }) => (
        <AssetListItem key={imgProps.src}>
          {/* We don't really need to display our favicons at true size,
          so let's scale them down by 4 */}
          <img height={height / 4} width={width / 4} {...imgProps} />
        </AssetListItem>
      ))}
    </AssetList>
    <h4>Open Graph</h4>
    <AssetList css={assets.og.length === 1 && { justifyContent: "center" }}>
      {assets.og.map(({ height, width, ...imgProps }) => (
        <AssetListItem key={imgProps.src}>
          {/* We don't really need to display our og-image at true size,
          so let's scale it down by 3 */}
          <img height={height / 3} width={width / 3} {...imgProps} />
        </AssetListItem>
      ))}
    </AssetList>
    <h2>Icons</h2>
    <AssetList>
      {[
        <IconCheckSolid />,
        <IconCrossSolid />,
        <IconClockSolid />,
        <IconServicesSolid />,
        <IconChevronLeftOutline />,
        <IconChevronRightOutline />,
        <IconClockOutline />,
        <IconDraftOutline />,
        <IconLightBulbOutline />,
        <IconWarningOutline />,
        <IconCheckCircleOutline />,
        <IconDraftCircleOutline />,
        <IconCrossCircleOutline />,
      ].map((icon, i) => (
        <AssetListItem key={`icon-${i}`}>{icon}</AssetListItem>
      ))}
    </AssetList>
    <h2>Logos</h2>
    <AssetList css={{ justifyContent: "center" }}>
      <AssetListItem>
        <LogoBrand />
      </AssetListItem>
    </AssetList>
    <h2>Components</h2>
    <h3>Alert</h3>
    <h4>Info</h4>
    <Alert status="info">
      <AlertHeader>Info</AlertHeader>
      <AlertDescription>
        A project is simply a directory of files. It can even be fully versioned
        using git!
      </AlertDescription>
    </Alert>
    <Alert status="info">
      <AlertHeader>
        <IconLightBulbOutline />
        Info
      </AlertHeader>
      <AlertDescription>
        {["Put data in the /data directory to share data between pipelines."]}
      </AlertDescription>
      <AlertControls />
    </Alert>
    <Alert status="info">
      <AlertHeader>Info</AlertHeader>
      <AlertDescription>
        {[
          <React.Fragment key={"some-key"}>
            Use the integrated <Link href="#">file manager</Link> to upload and
            download your files.
          </React.Fragment>,
          "You can import your existing projects and make them into pipelines.",
          "Private git repositories can be managed in Orchest using local git credentials.",
        ]}
      </AlertDescription>
      <AlertControls />
    </Alert>
    <Alert status="info">
      <AlertHeader>
        <IconLightBulbOutline />
        Info
      </AlertHeader>
      <AlertDescription>
        {[
          <React.Fragment key={"some-key"}>
            Use the integrated <Link href="#">file manager</Link> to upload and
            download your files.
          </React.Fragment>,
          "You can import your existing projects and make them into pipelines.",
          "Private git repositories can be managed in Orchest using local git credentials.",
        ]}
      </AlertDescription>
      <AlertControls />
    </Alert>
    <h4>Warning</h4>
    <Alert status="warning">
      <AlertHeader>Info</AlertHeader>
      <AlertDescription>
        A project is simply a directory of files. It can even be fully versioned
        using git!
      </AlertDescription>
    </Alert>
    <Alert status="warning">
      <AlertHeader>
        <IconWarningOutline />
        Info
      </AlertHeader>
      <AlertDescription>
        {["Put data in the /data directory to share data between pipelines."]}
      </AlertDescription>
      <AlertControls />
    </Alert>
    <Alert status="warning">
      <AlertHeader>Info</AlertHeader>
      <AlertDescription>
        {[
          <React.Fragment key={"some-key"}>
            Use the integrated <Link href="#">file manager</Link> to upload and
            download your files.
          </React.Fragment>,
          "You can import your existing projects and make them into pipelines.",
          "Private git repositories can be managed in Orchest using local git credentials.",
        ]}
      </AlertDescription>
      <AlertControls />
    </Alert>
    <Alert status="warning">
      <AlertHeader>
        <IconWarningOutline />
        Info
      </AlertHeader>
      <AlertDescription>
        {[
          <React.Fragment key={"some-key"}>
            Use the integrated <Link href="#">file manager</Link> to upload and
            download your files.
          </React.Fragment>,
          "You can import your existing projects and make them into pipelines.",
          "Private git repositories can be managed in Orchest using local git credentials.",
        ]}
      </AlertDescription>
      <AlertControls />
    </Alert>
    <h3>Dialog</h3>
    <Dialog>
      <DialogTrigger>Open Dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Text>Some Content</Text>
        </DialogBody>
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <h3>Flex</h3>
    <Text>A basic flex-layout primitive</Text>
    <Flex
      gap="4"
      css={{
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
    <h4>Solid (Default)</h4>
    <Flex direction="row" gap="2" role="group" css={{ alignItems: "center" }}>
      <IconButton variant="solid" label="Previous">
        <IconChevronLeftOutline />
      </IconButton>
      <IconButton variant="solid" label="Next" size="3">
        <IconChevronRightOutline />
      </IconButton>
    </Flex>
    <h4>Ghost</h4>
    <Flex direction="row" gap="2" role="group" css={{ alignItems: "center" }}>
      <IconButton variant="ghost" label="Previous">
        <IconChevronLeftOutline />
      </IconButton>
      <IconButton variant="ghost" label="Next" size="3">
        <IconChevronRightOutline />
      </IconButton>
    </Flex>
    <h4>Rounded</h4>
    <Flex direction="row" gap="2" role="group" css={{ alignItems: "center" }}>
      <IconButton rounded variant="solid" label="Previous">
        <IconChevronLeftOutline />
      </IconButton>
      <IconButton rounded variant="ghost" label="Next" size="3">
        <IconChevronRightOutline />
      </IconButton>
    </Flex>
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
  </Flex>
);

export default Index;
