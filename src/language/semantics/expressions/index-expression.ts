import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../errors.js'
import { isKeywordExpressionWithArgument } from '../expression.js'
import { keyPathFromObjectNodeOrMolecule } from '../key-path.js'
import {
  isObjectNode,
  makeObjectNode,
  type ObjectNode,
} from '../object-node.js'
import { type SemanticGraph } from '../semantic-graph.js'
import { readArgumentsFromExpression } from './expression-utilities.js'

export type IndexExpression = ObjectNode & {
  readonly 0: '@index'
  readonly 1: {
    readonly object: ObjectNode
    readonly query: ObjectNode
  }
}

export const readIndexExpression = (
  node: SemanticGraph,
): Either<ElaborationError, IndexExpression> =>
  isKeywordExpressionWithArgument('@index', node)
    ? either.flatMap(
        readArgumentsFromExpression(node, ['object', 'query']),
        ([object, query]) => {
          if (!isObjectNode(object)) {
            return either.makeLeft({
              kind: 'invalidExpression',
              message: 'object must be an object',
            })
          } else if (!isObjectNode(query)) {
            return either.makeLeft({
              kind: 'invalidExpression',
              message: 'query must be an object',
            })
          } else {
            return either.map(
              keyPathFromObjectNodeOrMolecule(query),
              _validKeyPath => makeIndexExpression({ object, query }),
            )
          }
        },
      )
    : either.makeLeft({
        kind: 'invalidExpression',
        message: 'not an `@index` expression',
      })

export const makeIndexExpression = ({
  query,
  object,
}: {
  readonly query: ObjectNode
  readonly object: ObjectNode
}): IndexExpression =>
  makeObjectNode({
    0: '@index',
    1: makeObjectNode({
      object,
      query,
    }),
  })
