import either from '@matt.kantor/either'
import { exec } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import test, { snapshot, suite } from 'node:test'
import stripAnsi from 'strip-ansi'
import { parse } from './language/parsing/parser.js'
import { prettyPlz, unparse } from './language/unparsing.js'

// All examples will be tested with no additional command-line arguments. To
// also test with specific sets of arguments, add them here:
const additionalCommandLineArguments: Readonly<
  Record<string, readonly string[]>
> = {
  'fibonacci.plz': [
    '--input=0',
    '--input=1',
    '--input=2',
    '--input=10',
    '--input="not a number"',
    '--input=-1',
  ],
  // It'd be nice to test CLI arguments for `lookup-environment-variable.plz`
  // too, but I'd need to set a stable/known environment variable to keep the
  // tests portable across different systems.
}

snapshot.setResolveSnapshotPath(_ =>
  path.join(import.meta.dirname, '..', 'examples', '.snapshot'),
)

const exampleDirectoryPath = path.join(import.meta.dirname, '..', 'examples')
const pleasePath = path.join(
  import.meta.dirname,
  'language',
  'cli',
  'please.js',
)

suite('examples', async () => {
  const exampleFileNames = (await fs.readdir(exampleDirectoryPath)).filter(
    fileName => fileName.endsWith('.plz'),
  )
  for (const exampleFileName of exampleFileNames) {
    const setsOfCommandLineArguments = [
      '', // Always test with no arguments.
      ...(additionalCommandLineArguments[exampleFileName] ?? []),
    ] as const

    const exampleFilePath = path.join(exampleDirectoryPath, exampleFileName)
    await test(exampleFileName, async _ => {
      await snapshotTestRoundtrippedSourceCode(exampleFilePath)
      for (const commandLineArguments of setsOfCommandLineArguments) {
        await snapshotTestProgramOutput(exampleFilePath, commandLineArguments)
      }
    })
  }
})

const snapshotTestProgramOutput = async (
  filePath: string,
  commandLineArguments: string,
) =>
  new Promise((resolve, reject) => {
    // Go through the command line to exercise as much as possible.
    exec(
      `cat "${filePath}" | node "${pleasePath}" --no-color --output-format=plz ${commandLineArguments}`,
      (error, stdout, stderr): undefined => {
        // `error` is an `ExecException` when exit status is nonzero.
        if (error !== null) {
          reject(error)
        } else {
          const testNamePrefix =
            commandLineArguments === '' ? '' : `${commandLineArguments} > `
          Promise.all([
            test(`${testNamePrefix}stdout`, t =>
              t.assert.snapshot(stdout, snapshotOptions)),
            test(`${testNamePrefix}stderr`, t =>
              t.assert.snapshot(stderr, snapshotOptions)),
          ])
            .then(resolve)
            .catch(reject)
        }
      },
    )
  })

const snapshotTestRoundtrippedSourceCode = async (filePath: string) => {
  const sourceCode = await fs.readFile(filePath, {
    encoding: 'utf-8',
  })

  const roundTrippedSyntaxTreeOrError = either.flatMap(
    parse(sourceCode),
    parsedProgram => either.map(unparse(parsedProgram, prettyPlz), stripAnsi),
  ).value

  return test('roundtripped syntax tree', t =>
    t.assert.snapshot(roundTrippedSyntaxTreeOrError, snapshotOptions))
}

// Expect snapshots to already be strings.
const snapshotOptions = {
  serializers: [
    (value: unknown) => {
      if (typeof value !== 'string') {
        throw new Error(
          `snapshot was not a string (was \`${JSON.stringify(value)}\`)`,
        )
      } else {
        return value
      }
    },
  ],
}
