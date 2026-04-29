import type { Either } from '@matt.kantor/either'
import either from '@matt.kantor/either'
import type { ElaborationError } from '../../errors.js'
import { isObjectNode, type ObjectNode } from '../object-node.js'
import type { SemanticGraph } from '../semantic-graph.js'

export type PanicExpression = ObjectNode & {
  readonly 0: '@panic'
}

export const readPanicExpression = (
  node: SemanticGraph,
): Either<ElaborationError, PanicExpression> =>
  isObjectNode(node) && node[0] === '@panic' ?
    either.makeRight({ ...node, 0: '@panic' })
  : either.makeLeft({
      kind: 'invalidExpression',
      message: 'not a `@panic` expression',
    })
