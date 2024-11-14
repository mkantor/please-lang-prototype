import { either } from '../adts.js'
import { parse } from '../parsing/parser.js'
import { readString } from './input.js'
import { writeJSON } from './output.js'

const main = async (process: NodeJS.Process): Promise<undefined> => {
  const sourceCode = await readString(process.stdin)
  const parseResult = parse(sourceCode)
  either.match(parseResult, {
    left: error => {
      throw new Error(error.message) // TODO: improve error reporting
    },
    right: output => {
      writeJSON(process.stdout, output)
    },
  })
}

await main(process)
