import { parse } from '../parsing/parser.js'
import { readString } from './input.js'
import { handleOutput } from './output.js'

const main = async (process: NodeJS.Process): Promise<undefined> =>
  handleOutput(process, async () => {
    const sourceCode = await readString(process.stdin)
    return parse(sourceCode)
  })

await main(process)
