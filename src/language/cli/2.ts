import { canonicalize } from '../parsing.js'
import { evaluate } from '../runtime.js'
import { handleInput } from './input.js'
import { handleOutput } from './output.js'

const main = async (process: NodeJS.Process): Promise<undefined> =>
  handleOutput(process, () =>
    handleInput(process, input => evaluate(canonicalize(input))),
  )

await main(process)
