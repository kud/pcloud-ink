import { test, expect } from "vitest"
import { fit } from "./fit.js"

// The bug this exists for: padEnd never shortens, so a trashed file called
// '"8 Folders" from 30 Jul 2026 16:00.zip' ran straight through the size column.
test("a value longer than its column is truncated, not allowed to overflow", () => {
  expect(fit("a-very-long-file-name.zip", 10)).toHaveLength(10)
  expect(fit("a-very-long-file-name.zip", 10)).toBe("a-very-l… ")
})

test("a short value is padded to the exact width", () => {
  expect(fit("ab", 6)).toBe("ab    ")
  expect(fit("ab", 6)).toHaveLength(6)
})

// Returning an exact-width value untouched is what printed
// "…16:00.zip0 Bytes": the name filled its column exactly, so the size began
// in the very next cell. The last character is always a gutter.
test("an exact-width value still yields a gutter", () => {
  expect(fit("abcdef", 6)).toBe("abcd… ")
  expect(fit("abcdef", 6)).toHaveLength(6)
  expect(fit("abcdef", 6).endsWith(" ")).toBe(true)
})

test("every result long enough to have one ends in a gutter", () => {
  for (const text of ["a", "abcdef", "abcdefghijklmnop"]) {
    expect(fit(text, 8).endsWith(" ")).toBe(true)
  }
})

// Whatever the input, the column is the width it claims — that invariant is
// what keeps every row's later columns aligned with each other.
test("the result is always exactly the requested width", () => {
  for (const text of ["", "a", "abcdef", "abcdefghijklmnop"]) {
    for (const width of [1, 2, 3, 8, 20]) {
      expect(fit(text, width)).toHaveLength(width)
    }
  }
})

test("a nonsensical width yields nothing rather than throwing", () => {
  expect(fit("abc", 0)).toBe("")
  expect(fit("abc", -3)).toBe("")
})
