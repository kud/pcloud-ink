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

test("an exact-width value is left alone", () => {
  expect(fit("abcdef", 6)).toBe("abcdef")
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
