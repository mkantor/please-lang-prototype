import { exec } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import test, { snapshot, suite } from 'node:test'

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

    for (const commandLineArguments of setsOfCommandLineArguments) {
      const exampleFilePath = path.join(exampleDirectoryPath, exampleFileName)
      test(
        exampleFileName.concat(
          commandLineArguments === '' ? '' : ` ${commandLineArguments}`,
        ),
        _ =>
          new Promise((resolve, reject) => {
            const _childProcess = exec(
              `cat "${exampleFilePath}" | node "${pleasePath}" --no-color --output-format=plz ${commandLineArguments}`,
              (error, stdout, stderr) => {
                // `error` is an `ExecException` when exit status is nonzero.
                if (error !== null) {
                  reject(error)
                } else {
                  Promise.all([
                    test('stdout', t =>
                      t.assert.snapshot(stdout, snapshotOptions)),
                    test('stderr', t =>
                      t.assert.snapshot(stderr, snapshotOptions)),
                  ])
                    .then(_ => resolve(undefined))
                    .catch(reject)
                }
              },
            )
          }),
      )
    }
  }
})

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
