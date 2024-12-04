import { either, type Either } from '../../adts.js'
import { compile } from '../compiling.js'
import type { Atom, Molecule } from '../parsing.js'
import { parse } from '../parsing/parser.js'
import { evaluate } from '../runtime.js'
import { readString } from './input.js'
import { writeJSON } from './output.js'

type SimpleResult = Either<{ readonly message: string }, Atom | Molecule>

const main = async (process: NodeJS.Process): Promise<undefined> => {
  const sourceCode = await readString(process.stdin)

  // TODO: Cache intermediate representations to the filesystem.
  const syntaxTree: SimpleResult = parse(sourceCode)
  const program: SimpleResult = either.flatMap(syntaxTree, compile)
  const runtimeOutput: SimpleResult = either.flatMap(program, evaluate)

  either.match(runtimeOutput, {
    left: error => {
      throw new Error(error.message) // TODO: improve error reporting
    },
    right: output => {
      writeJSON(process.stdout, output)
    },
  })
}

await main(process)
