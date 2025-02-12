import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../errors.js'
import type { Molecule } from '../../parsing.js'
import { isSpecificExpression } from '../expression.js'
import { keyPathFromObjectNodeOrMolecule } from '../key-path.js'
import {
  isObjectNode,
  makeObjectNode,
  type ObjectNode,
} from '../object-node.js'
import { type SemanticGraph } from '../semantic-graph.js'
import {
  asSemanticGraph,
  readArgumentsFromExpression,
} from './expression-utilities.js'

export type IndexExpression = ObjectNode & {
  readonly 0: '@index'
  readonly object: ObjectNode | Molecule
  readonly query: ObjectNode | Molecule
}

export const readIndexExpression = (
  node: SemanticGraph | Molecule,
): Either<ElaborationError, IndexExpression> =>
  isSpecificExpression('@index', node)
    ? either.flatMap(
        readArgumentsFromExpression(node, [
          ['object', '1'],
          ['query', '2'],
        ]),
        ([o, q]) => {
          const object = asSemanticGraph(o)
          const query = asSemanticGraph(q)
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
        message: 'not an expression',
      })

export const makeIndexExpression = ({
  query,
  object,
}: {
  readonly query: ObjectNode | Molecule
  readonly object: ObjectNode | Molecule
}): IndexExpression =>
  makeObjectNode({
    0: '@index',
    object,
    query,
  })
