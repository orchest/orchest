import * as React from "react";
import { AppProps } from "next/app";
import { DesignSystemProvider } from "@orchest/design-system";

const App = ({ Component, pageProps }: AppProps) => (
  <DesignSystemProvider>
    <Component {...pageProps} />
  </DesignSystemProvider>
);

export default App;
