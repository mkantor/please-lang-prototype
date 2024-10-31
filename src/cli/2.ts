import { either } from '../adts.js'
import { evaluate } from '../runtime.js'
import { readJSON } from './jsonInput.js'
import { writeJSON } from './jsonOutput.js'

const main = async (process: NodeJS.Process): Promise<undefined> => {
  const jsonResult = await readJSON(process.stdin)
  const runtimeResult = either.flatMap(jsonResult, evaluate)
  either.match(runtimeResult, {
    left: error => {
      throw new Error(error.message) // TODO: improve error reporting
    },
    right: output => {
      writeJSON(process.stdout, output)
    },
  })
}

await main(process)
