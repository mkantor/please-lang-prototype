import either, { type Either } from '@matt.kantor/either'
import { type Option } from '@matt.kantor/option'
import type { Writable } from '../../utility-types.js'
import type {
  Bug,
  DependencyUnavailable,
  Panic,
  TypeMismatchError,
  UnserializableValueError,
} from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import type { ObjectNode } from './object-node.js'
import { nodeTag } from './semantic-graph-node-tag.js'
import { serialize, type Output, type SemanticGraph } from './semantic-graph.js'
import { type FunctionType } from './type-system/type-formats.js'

export type FunctionNode = ((
  value: SemanticGraph,
) => Either<
  DependencyUnavailable | TypeMismatchError | Panic | Bug,
  SemanticGraph
>) & {
  readonly [nodeTag]: 'function'
  readonly parameterName: Option<Atom>
  readonly signature: FunctionType['signature']
  readonly serialize: () => Either<UnserializableValueError, ObjectNode>
}

export const isFunctionNode = (node: Molecule | SemanticGraph) =>
  typeof node === 'function' && node[nodeTag] === 'function'

export const makeFunctionNode = (
  signature: FunctionType['signature'],
  serialize: FunctionNode['serialize'],
  parameterName: Option<Atom>,
  f: (
    value: SemanticGraph,
  ) => Either<
    DependencyUnavailable | TypeMismatchError | Panic | Bug,
    SemanticGraph
  >,
): FunctionNode => {
  const node: ((
    value: SemanticGraph,
  ) => Either<
    DependencyUnavailable | TypeMismatchError | Panic | Bug,
    SemanticGraph
  >) &
    Writable<FunctionNode> = value => f(value)
  node[nodeTag] = 'function'
  node.parameterName = parameterName
  node.signature = signature
  node.serialize = serialize
  return node
}

export const serializeFunctionNode = (
  node: FunctionNode,
): Either<UnserializableValueError, Output> =>
  either.flatMap(node.serialize(), serialize)
