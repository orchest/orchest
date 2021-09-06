import "./commands";
import { configure } from "@testing-library/cypress";

// https://github.com/testing-library/cypress-testing-library#config-testidattribute
configure({ testIdAttribute: "data-test-id" });
