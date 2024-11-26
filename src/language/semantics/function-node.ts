import { type Either } from '../../adts.js'
import type { Panic, UnserializableValueError } from '../errors.js'
import type { Molecule } from '../parsing.js'
import {
  nodeTag,
  type FullyElaboratedSemanticGraph,
  type PartiallyElaboratedSemanticGraph,
} from './semantic-graph.js'
import { type FunctionType } from './type-system/type-formats.js'

export type FunctionNode = {
  readonly [nodeTag]: 'function'
  readonly function: (
    value: FullyElaboratedSemanticGraph,
  ) => Either<Panic, FullyElaboratedSemanticGraph>
  readonly signature: FunctionType
  readonly serialize: () => Either<UnserializableValueError, Molecule>
}

export const isFunctionNode = (node: PartiallyElaboratedSemanticGraph) =>
  node[nodeTag] === 'function'

export const makeFunctionNode = (
  signature: FunctionType['signature'],
  serialize: FunctionNode['serialize'],
  f: FunctionNode['function'],
): FunctionNode => ({
  [nodeTag]: 'function',
  function: f,
  signature: {
    kind: 'function',
    name: '',
    signature,
  },
  serialize,
})

export const serializeFunctionNode = (
  node: FunctionNode,
): Either<UnserializableValueError, Molecule> => node.serialize()
