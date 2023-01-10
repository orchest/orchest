import { omit } from "../record";

describe("omit", () => {
  it("removes the specified properties without mutating the original object.", () => {
    const object = { foo: 0, bar: 1, zoo: 2, car: 3 };
    expect(omit(object, "bar", "car")).toEqual({ foo: 0, zoo: 2 });
    expect(object).toEqual(object);
  });
});
