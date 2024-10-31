import { either } from '../adts.js'
import { compile } from '../compiling/compiler.js'
import { readJSON } from './jsonInput.js'
import { writeJSON } from './jsonOutput.js'

const main = async (process: NodeJS.Process): Promise<undefined> => {
  const jsonResult = await readJSON(process.stdin)
  const compilationResult = either.flatMap(jsonResult, compile)
  writeJSON(process.stdout, compilationResult)
}

await main(process)
