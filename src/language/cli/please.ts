import either from '@matt.kantor/either'
import { compile } from '../compiling.js'
import { parse } from '../parsing/parser.js'
import { evaluate } from '../runtime.js'
import { readString } from './input.js'
import { handleOutput } from './output.js'

const main = async (process: NodeJS.Process): Promise<undefined> =>
  handleOutput(process, async () => {
    const sourceCode = await readString(process.stdin)

    // TODO: Cache intermediate representations to the filesystem.
    const syntaxTree = parse(sourceCode)
    const program = either.flatMap(syntaxTree, compile)
    const runtimeOutput = either.flatMap(program, evaluate)

    return runtimeOutput
  })

await main(process)
