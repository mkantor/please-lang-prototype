import assert from 'node:assert'
import test, { suite } from 'node:test'

// Disable colors. This yields more readable test failure messages, at the cost
// of not being able to test colors.
delete process.env['FORCE_COLOR']
process.env['NO_COLOR'] = 'true'

type UnknownFunction = (...args: never) => unknown

const testNameLengthLimit = 100

export const testCases =
  <Input, Output>(
    // Validate that `Output` is not a function. This avoids unsafe `typeof`
    // narrowing within the implementation.
    functionToTest: (
      input: Input,
    ) => Output extends UnknownFunction ? never : Output,
    getTestName: (input: Input) => string,
  ) =>
  (
    suiteName: string,
    cases: readonly (readonly [
      input: Input,
      check: Output | ((output: Output) => void),
    ])[],
  ) =>
    suite(suiteName, _ =>
      cases.forEach(([input, check]) => {
        const testName = getTestName(input)
        test(
          testName.length > testNameLengthLimit ?
            `${testName.slice(0, testNameLengthLimit - 1)}…`
          : testName,
          () => {
            const output = functionToTest(input)
            const widenedCheck: unknown = check
            // This narrowing is only safe because `Output` cannot be a
            // function.
            if (typeof widenedCheck === 'function') {
              widenedCheck(output)
            } else {
              assert.deepEqual(output, check)
            }
          },
        )
      }),
    )
