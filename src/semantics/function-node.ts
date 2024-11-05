import { either, type Either } from '../adts.js'
import type { Panic, UnserializableValueError } from '../errors.js'
import { nodeTag, type SemanticGraph } from './semantic-graph.js'
import { type FunctionType } from './type-system/type-formats.js'

export type FunctionNode = {
  readonly [nodeTag]: 'function'
  readonly function: (value: SemanticGraph) => Either<Panic, SemanticGraph>
  readonly signature: FunctionType
}

export const isFunctionNode = (node: SemanticGraph) =>
  node[nodeTag] === 'function'

export const makeFunctionNode = (
  signature: FunctionType['signature'],
  f: (value: SemanticGraph) => Either<Panic, SemanticGraph>,
): FunctionNode => ({
  [nodeTag]: 'function',
  function: f,
  signature: {
    kind: 'function',
    name: '',
    signature,
  },
})

export const serializeFunctionNode = (
  _node: FunctionNode,
): Either<UnserializableValueError, never> =>
  either.makeLeft({
    kind: 'unserializableValue',
    message: 'functions cannot be serialized',
  })
