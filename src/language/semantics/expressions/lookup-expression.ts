import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../errors.js'
import type { Molecule } from '../../parsing.js'
import { isSpecificExpression } from '../expression.js'
import { isFunctionNode } from '../function-node.js'
import {
  keyPathFromObjectNodeOrMolecule,
  keyPathToMolecule,
} from '../key-path.js'
import {
  makeObjectNode,
  makeUnelaboratedObjectNode,
  type ObjectNode,
} from '../object-node.js'
import { type SemanticGraph, type unelaboratedKey } from '../semantic-graph.js'
import {
  asSemanticGraph,
  readArgumentsFromExpression,
} from './expression-utilities.js'

export type LookupExpression = ObjectNode & {
  readonly 0: '@lookup'
  readonly query: ObjectNode | Molecule
}

export const readLookupExpression = (
  node: SemanticGraph | Molecule,
): Either<ElaborationError, LookupExpression> =>
  isSpecificExpression('@lookup', node)
    ? either.flatMap(
        readArgumentsFromExpression(node, [['query', '1']]),
        ([q]) => {
          const query = asSemanticGraph(q)
          if (isFunctionNode(query)) {
            return either.makeLeft({
              kind: 'invalidExpression',
              message: 'query cannot be a function',
            })
          } else {
            const canonicalizedQuery =
              typeof query === 'string'
                ? makeObjectNode(keyPathToMolecule(query.split('.')))
                : query

            return either.map(
              keyPathFromObjectNodeOrMolecule(canonicalizedQuery),
              _keyPath => makeLookupExpression(canonicalizedQuery),
            )
          }
        },
      )
    : either.makeLeft({
        kind: 'invalidExpression',
        message: 'not an expression',
      })

export const makeLookupExpression = (
  query: ObjectNode | Molecule,
): LookupExpression & { readonly [unelaboratedKey]: true } =>
  makeUnelaboratedObjectNode({
    0: '@lookup',
    query,
  })
