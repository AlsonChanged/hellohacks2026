import { describe, expect, it } from "vitest";
import { parseFollowerCount } from "./followers";

describe("parseFollowerCount", () => {
  const cases: [unknown, number | null][] = [
    [1250, 1250],
    ["1,250", 1250],
    ["1.2K", 1200],
    ["12.5K", 12500],
    ["1M", 1_000_000],
    ["1.25K followers", 1250],
    [undefined, null],
    ["abc", null],
    [null, null],
    [-5, null],
    [NaN, null],
    ["-1.2K", null],
    ["0", 0],
    [0, 0],
    ["1B", 1_000_000_000],
  ];

  it.each(cases)("parses %j -> %j", (input, expected) => {
    expect(parseFollowerCount(input)).toBe(expected);
  });
});
