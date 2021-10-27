import { configure } from "@testing-library/cypress";
import "./commands";

// https://github.com/testing-library/cypress-testing-library#config-testidattribute
configure({ testIdAttribute: "data-test-id" });
