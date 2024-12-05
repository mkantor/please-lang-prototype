import { either, type Either } from '../../adts.js'
import { compile } from '../compiling.js'
import type { Atom, Molecule } from '../parsing.js'
import { parse } from '../parsing/parser.js'
import { evaluate } from '../runtime.js'
import type { Output } from '../semantics.js'
import { readString } from './input.js'
import { handleOutput } from './output.js'

type SimpleResult = Either<{ readonly message: string }, Atom | Molecule>

const main = async (process: NodeJS.Process): Promise<undefined> =>
  handleOutput(process, async () => {
    const sourceCode = await readString(process.stdin)

    // TODO: Cache intermediate representations to the filesystem.
    const syntaxTree: SimpleResult = parse(sourceCode)
    const program: SimpleResult = either.flatMap(syntaxTree, compile)
    const runtimeOutput: Either<{ readonly message: string }, Output> =
      either.flatMap(program, evaluate)

    return runtimeOutput
  })

await main(process)
