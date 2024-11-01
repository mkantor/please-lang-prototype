import { either, type Either } from '../adts.js'
import type { Panic, UnserializableValueError } from '../errors.js'
import { nodeTag, type SemanticGraph } from './semantic-graph.js'

export type FunctionNode = {
  readonly [nodeTag]: 'function'
  readonly function: (value: SemanticGraph) => Either<Panic, SemanticGraph>
  // TODO: model the function's type signature as data in here?
}

export const isFunctionNode = (node: SemanticGraph) =>
  node[nodeTag] === 'function'

export const makeFunctionNode = (
  f: (value: SemanticGraph) => Either<Panic, SemanticGraph>,
): FunctionNode => ({ [nodeTag]: 'function', function: f })

export const serializeFunctionNode = (
  _node: FunctionNode,
): Either<UnserializableValueError, never> =>
  either.makeLeft({
    kind: 'unserializableValue',
    message: 'functions cannot be serialized',
  })
