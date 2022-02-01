import { toValidFilename } from "../toValidFilename";

describe("toValidFilename", () => {
  it("should convert a string to a valid file name", () => {
    const outcome = toValidFilename("test file-name!");

    expect(outcome).toBe("test_file_name_");
  });
  it("should convert a string to a valid file name, separated by dashes", () => {
    const outcome = toValidFilename("test file-name!", "-");

    expect(outcome).toBe("test-file-name-");
  });
});
