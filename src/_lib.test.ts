import assert from 'node:assert'
import test, { suite } from 'node:test'

type UnknownFunction = (...args: never) => unknown

export const testCases =
  <Input, Output>(
    // Validate that `Output` is not a function. This avoids unsafe `typeof` narrowing within the
    // implementation.
    functionToTest: (
      input: Input,
    ) => Output extends UnknownFunction ? never : Output,
    testName: (input: Input) => string,
  ) =>
  (
    suiteName: string,
    cases: readonly (readonly [
      input: Input,
      check: Output | ((output: Output) => void),
    ])[],
  ) =>
    suite(suiteName, _ =>
      cases.forEach(([input, check]) =>
        test(testName(input), () => {
          const output = functionToTest(input)
          const widenedCheck: unknown = check
          // This narrowing is only safe because `Output` cannot be a function.
          if (typeof widenedCheck === 'function') {
            widenedCheck(output)
          } else {
            assert.deepEqual(output, check)
          }
        }),
      ),
    )
