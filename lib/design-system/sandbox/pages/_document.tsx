import * as React from "react";
import NextDocument, { Html, Head, Main, NextScript } from "next/document";
import { getCssString } from "@orchest/design-system";

export default class Document extends NextDocument {
  render() {
    return (
      <Html lang="en">
        <Head>
          <style
            id="stitches"
            dangerouslySetInnerHTML={{ __html: getCssString() }}
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
