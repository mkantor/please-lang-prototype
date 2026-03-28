import either, { type Either } from '@matt.kantor/either'
import assert from 'node:assert'
import test, { suite } from 'node:test'
import { compile } from './language/compiling.js'
import type {
  CompilationError,
  ParseError,
  RuntimeError,
} from './language/errors.js'
import type { Atom, Molecule } from './language/parsing.js'
import { parse } from './language/parsing/parser.js'
import { evaluate } from './language/runtime.js'
import {
  inlinePlz,
  prettyPlz,
  unparse,
  type Notation,
} from './language/unparsing.js'

// Disable colors. This yields more readable test failure messages, at the cost
// of not being able to test colors.
delete process.env['FORCE_COLOR']
process.env['NO_COLOR'] = 'true'

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

export const parseAndCompileAndRun = (input: string) => {
  const syntaxTree: ProgramResult = parse(input)
  const program: ProgramResult = either.flatMap(syntaxTree, compile)
  const runtimeOutput: ProgramResult = either.flatMap(program, evaluate)
  return runtimeOutput
}

const unparseAndRoundtripWithMultipleNotations = <Error, Value>(
  f: (input: string) => Either<Error, Value>,
) => {
  const roundtripper = unparseAndRoundtripWithSpecificNotation(f)
  return (value: Atom | Molecule) => {
    const unparseAndRoundtripValue = roundtripper(value)
    const roundtrippedOutputs = either.flatMap(
      unparseAndRoundtripValue(prettyPlz),
      outputFromPretty =>
        either.map(
          unparseAndRoundtripValue(inlinePlz),
          outputFromInline => [outputFromPretty, outputFromInline] as const,
        ),
    )
    return either.flatMap(
      roundtrippedOutputs,
      ([outputFromPretty, outputFromInline]) =>
        either.map(
          either.tryCatch(() =>
            assert.deepEqual(outputFromPretty, outputFromInline),
          ),
          _ => outputFromPretty,
        ),
    )
  }
}

const unparseAndRoundtripWithSpecificNotation =
  <Error, Value>(f: (input: string) => Either<Error, Value>) =>
  (value: Atom | Molecule) =>
  (notation: Notation) =>
    either.flatMap(unparse(value, notation), f)

export const unparseAndRoundtrip = unparseAndRoundtripWithMultipleNotations(
  parseAndCompileAndRun,
)

export type ProgramResult = Either<
  ParseError | CompilationError | RuntimeError,
  Atom | Molecule
>

type UnknownFunction = (...args: never) => unknown
