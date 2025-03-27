import { exec } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import test, { suite } from 'node:test'

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
    const exampleFilePath = path.join(exampleDirectoryPath, exampleFileName)
    // TODO: Use snapshot testing instead of merely checking for errors.
    test(
      exampleFileName,
      () =>
        new Promise((resolve, reject) => {
          const _childProcess = exec(
            `cat "${exampleFilePath}" | node "${pleasePath}" --output-format=plz`,
            (error, _stdout, _stderr) => {
              // `error` is an `ExecError` when exit status is nonzero.
              if (error !== null) {
                reject(error)
              } else {
                resolve(undefined)
              }
            },
          )
        }),
    )
  }
})
