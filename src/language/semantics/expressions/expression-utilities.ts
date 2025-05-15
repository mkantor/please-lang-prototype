import either, { type Either } from '@matt.kantor/either'
import option, { type Option } from '@matt.kantor/option'
import type { ElaborationError } from '../../errors.js'
import type { Atom, Molecule } from '../../parsing.js'
import type { ExpressionContext } from '../expression-elaboration.js'
import type { Expression } from '../expression.js'
import { isFunctionNode } from '../function-node.js'
import { stringifyKeyPathForEndUser } from '../key-path.js'
import {
  lookupPropertyOfObjectNode,
  makeObjectNode,
  type ObjectNode,
} from '../object-node.js'
import {
  applyKeyPathToSemanticGraph,
  isSemanticGraph,
  type SemanticGraph,
} from '../semantic-graph.js'

export const asSemanticGraph = (
  value: SemanticGraph | Molecule,
): SemanticGraph => (isSemanticGraph(value) ? value : makeObjectNode(value))

export const locateSelf = (context: ExpressionContext) =>
  option.match(applyKeyPathToSemanticGraph(context.program, context.location), {
    none: () =>
      either.makeLeft({
        kind: 'bug',
        message: `failed to locate self at \`${stringifyKeyPathForEndUser(
          context.location,
        )}\` in program`,
      }),
    some: either.makeRight,
  })

export const readArgumentsFromExpression = <
  const Specification extends readonly string[],
>(
  expression: Expression,
  specification: Specification,
): Either<ElaborationError, ParsedExpressionArguments<Specification>> => {
  if (expression[1] === undefined) {
    return either.makeLeft({
      kind: 'invalidExpression',
      message: `missing arguments object`,
    })
  } else if (typeof expression[1] === 'string') {
    return either.makeLeft({
      kind: 'invalidExpression',
      message: `found an atom instead of an arguments object`,
    })
  } else if (isFunctionNode(expression[1])) {
    return either.makeLeft({
      kind: 'invalidExpression',
      message: `found a function instead of an arguments object`,
    })
  } else {
    const expressionArguments: ObjectNode[string][] = []
    for (const [position, keyword] of specification.entries()) {
      const argument = lookupWithinMolecule(
        [keyword, String(position)],
        expression[1],
      )
      if (option.isNone(argument)) {
        const requiredKeySummary = `\`${keyword}\` or \`${position}\``
        return either.makeLeft({
          kind: 'invalidExpression',
          message: `missing required property ${requiredKeySummary}`,
        })
      } else {
        expressionArguments.push(argument.value)
      }
    }
    return either.makeRight(
      // This is correct since the above loop pushes one argument for each `specification` element.
      expressionArguments as ParsedExpressionArguments<Specification>,
    )
  }
}
type ParsedExpressionArguments<Specification extends readonly string[]> = {
  [Index in keyof Specification]: ObjectNode[string]
}

const lookupWithinMolecule = (
  keyAliases: readonly [Atom, ...(readonly Atom[])],
  molecule: Molecule | ObjectNode,
): Option<SemanticGraph> => {
  for (const key of keyAliases) {
    const result = lookupPropertyOfObjectNode(key, makeObjectNode(molecule))
    if (!option.isNone(result)) {
      return result
    }
  }
  return option.none
}
