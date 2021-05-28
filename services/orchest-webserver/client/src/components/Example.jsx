// @ts-check
import { styled } from "@orchest/design-system";

const ExampleComponent = styled("div", { color: "red" });

export const ExampleConsumer = () => (
  <ExampleComponent as="p">
    <p>Test</p>
  </ExampleComponent>
);
