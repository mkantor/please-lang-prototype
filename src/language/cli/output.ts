import kleur from 'kleur'
import { parseArgs } from 'util'
import { either, type Either } from '../../adts.js'
import { withPhantomData } from '../../phantom-data.js'
import { type Molecule } from '../parsing.js'
import { type Canonicalized, type SyntaxTree } from '../parsing/syntax-tree.js'

export const handleOutput = async (
  process: NodeJS.Process,
  command: () => Promise<Either<{ readonly message: string }, SyntaxTree>>,
): Promise<undefined> => {
  const args = parseArgs({
    args: process.argv.slice(2), // remove `execPath` and `filename`
    strict: false,
    options: {
      'output-format': { type: 'string' },
    },
  })
  if (args.values['output-format'] === undefined) {
    throw new Error('Missing required option: --output-format')
  } else if (args.values['output-format'] !== 'json') {
    throw new Error(
      `Unsupported output format: "${args.values['output-format']}"`,
    )
  } else {
    const result = await command()
    return either.match(result, {
      left: error => {
        throw new Error(error.message) // TODO: Improve error reporting.
      },
      right: output => {
        writeJSON(process.stdout, output)
        return undefined
      },
    })
  }
}

export const writeJSON = (
  writeStream: NodeJS.WritableStream,
  output: SyntaxTree,
): void => {
  writeStream.write(stringifyAsPrettyJSON(output))

  // Writing a newline ensures that output is flushed before terminating, otherwise nothing may be
  // printed to the console. See:
  //  - <https://github.com/nodejs/node/issues/6379>
  //  - <https://github.com/nodejs/node/issues/6456>
  //  - <https://github.com/nodejs/node/issues/2972>
  //  - …and many other near-duplicate issues
  //
  // I've tried other workarounds such as explicitly terminating via `process.exit`, passing a
  // callback to `writeStream.write` (ensuring the returned `Promise` is not resolved until it is
  // called), and explicitly calling `writeStream.end`/`writeStream.uncork` and so far this is the
  // only workaround which reliably results in the desired behavior.
  writeStream.write('\n')
}

const indent = (spaces: number, textToIndent: string) => {
  const indentation = ' '.repeat(spaces)
  return (indentation + textToIndent).replace(/(\r?\n)/g, `$1${indentation}`)
}

const quote = kleur.dim('"')
const colon = kleur.dim(':')
const comma = kleur.dim(',')
const openBrace = kleur.dim('{')
const closeBrace = kleur.dim('}')

const escapeStringContents = (value: string) =>
  value.replace('\\', '\\\\').replace('"', '\\"')

const key = (value: string): string =>
  quote + kleur.bold(escapeStringContents(value)) + quote

const string = (value: string): string =>
  quote +
  escapeStringContents(
    /^@[^@]/.test(value) ? kleur.bold(kleur.underline(value)) : value,
  ) +
  quote

const object = (value: Molecule): string => {
  const entries = Object.entries(value)
  if (entries.length === 0) {
    return openBrace + closeBrace
  } else {
    const keyValuePairs: string = Object.entries(value)
      .map(
        ([propertyKey, propertyValue]) =>
          key(propertyKey) +
          colon +
          ' ' +
          stringifyAsPrettyJSON(
            withPhantomData<Canonicalized>()(propertyValue),
          ),
      )
      .join(comma + '\n')

    return openBrace + '\n' + indent(2, keyValuePairs) + '\n' + closeBrace
  }
}

const stringifyAsPrettyJSON = (output: SyntaxTree) => {
  return typeof output === 'string' ? string(output) : object(output)
}
