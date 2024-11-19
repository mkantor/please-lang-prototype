import * as combinators from './parsing/combinators.js'
import * as constructors from './parsing/constructors.js'

export const parser = { ...combinators, ...constructors }
export type { Parser } from './parsing/parser.js'
