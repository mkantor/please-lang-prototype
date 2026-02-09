import either, { type Either, type Right } from '@matt.kantor/either'
import option from '@matt.kantor/option'
import parsing from '@matt.kantor/parsing'
import { styleText } from 'node:util'
import type { UnserializableValueError } from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import { unquotedAtomParser } from '../parsing/atom.js'
import {
  asSemanticGraph,
  isExpression,
  isSemanticGraph,
  readApplyExpression,
  readFunctionExpression,
  readIndexExpression,
  readLookupExpression,
  serialize,
  type ApplyExpression,
  type Expression,
  type FunctionExpression,
  type IndexExpression,
  type KeyPath,
  type LookupExpression,
  type ObjectNode,
  type SemanticGraph,
} from '../semantics.js'
import { applyColor, keyColor, punctuation } from './unparsing-utilities.js'

export type SemanticContext = 'apply' | 'default'

type Context = {
  readonly unparseAtomOrMolecule: UnparseAtomOrMolecule
  readonly semanticContext: SemanticContext
}

export type UnparseAtomOrMolecule = (
  semanticContext: SemanticContext,
) => (value: Atom | Molecule) => Either<UnserializableValueError, string>

export const moleculeUnparser =
  (semanticContext: SemanticContext) =>
  (
    unparseAtomOrMolecule: UnparseAtomOrMolecule,
    unparseSugarFreeMolecule: (
      expression: Molecule,
      context: Context,
    ) => Either<UnserializableValueError, string>,
  ) =>
  (value: Molecule): Either<UnserializableValueError, string> => {
    const context: Context = {
      unparseAtomOrMolecule,
      semanticContext,
    }
    switch (value['0']) {
      case '@apply':
        return either.match(readApplyExpression(asSemanticGraph(value)), {
          left: _ => unparseSugarFreeMolecule(value, context),
          right: applyExpression =>
            unparseSugaredApply(applyExpression, context),
        })
      case '@function':
        return either.match(readFunctionExpression(asSemanticGraph(value)), {
          left: _ => unparseSugarFreeMolecule(value, context),
          right: functionExpression =>
            unparseSugaredFunction(functionExpression, context),
        })
      case '@index':
        return either.match(readIndexExpression(asSemanticGraph(value)), {
          left: _ => unparseSugarFreeMolecule(value, context),
          right: indexExpression =>
            unparseSugaredIndex(indexExpression, context),
        })
      case '@lookup':
        return either.match(readLookupExpression(asSemanticGraph(value)), {
          left: _ => unparseSugarFreeMolecule(value, context),
          right: lookupExpression =>
            unparseSugaredLookup(lookupExpression, context),
        })
      default:
        const potentialKeywordExpression = asSemanticGraph(value)
        if (isExpression(potentialKeywordExpression)) {
          const result = unparseSugaredGeneralizedKeywordExpression(
            potentialKeywordExpression,
            context,
          )
          return either.flatMapLeft(result, _ =>
            unparseSugarFreeMolecule(value, context),
          )
        } else {
          return unparseSugarFreeMolecule(value, context)
        }
    }
  }

export const moleculeAsKeyValuePairStrings = (
  value: Molecule,
  { unparseAtomOrMolecule, semanticContext }: Context,
  options: { readonly ordinalKeys: 'omit' | 'preserve' },
): Either<UnserializableValueError, readonly string[]> => {
  const { colon, openGroupingParenthesis, closeGroupingParenthesis } =
    punctuation(styleText)
  const entries = Object.entries(value)

  const keyValuePairsAsStrings: string[] = []
  let ordinalPropertyKeyCounter = 0n
  for (const [propertyKey, propertyValue] of entries) {
    const valueAsStringResult =
      unparseAtomOrMolecule(semanticContext)(propertyValue)
    if (either.isLeft(valueAsStringResult)) {
      return valueAsStringResult
    }

    // Omit ordinal property keys:
    if (
      propertyKey === String(ordinalPropertyKeyCounter) &&
      options.ordinalKeys === 'omit'
    ) {
      keyValuePairsAsStrings.push(
        // If the property value is something like an anonymous function or an
        // infix operation then it needs parentheses when the key is omitted. We
        // can skip the parentheses when this is the only property.
        (
          needsParenthesesAsSecondInfixOperandOrImmediatelyAppliedFunction(
            propertyValue,
          ) && entries.length !== 1
        ) ?
          openGroupingParenthesis.concat(
            valueAsStringResult.value,
            closeGroupingParenthesis,
          )
        : valueAsStringResult.value,
      )
      ordinalPropertyKeyCounter += 1n
    } else {
      keyValuePairsAsStrings.push(
        styleText(
          keyColor,
          quoteAtomIfNecessary(propertyKey).concat(colon),
        ).concat(' ', valueAsStringResult.value),
      )
    }
  }
  return either.makeRight(keyValuePairsAsStrings)
}

export const unparseAtom = (atom: string): Right<string> =>
  either.makeRight(
    /^@[^@]/.test(atom) ?
      styleText(['bold', 'underline'], quoteAtomIfNecessary(atom))
    : quoteAtomIfNecessary(atom),
  )

const requiresQuotation = (atom: string): boolean =>
  either.isLeft(parsing.parse(unquotedAtomParser, atom))

const quoteAtomIfNecessary = (value: string): string => {
  const { quote } = punctuation(styleText)
  if (requiresQuotation(value)) {
    return quote.concat(escapeStringContents(value), quote)
  } else {
    return value
  }
}

const quoteKeyPathComponentIfNecessary = (value: string): string => {
  const { quote } = punctuation(styleText)
  const unquotedAtomResult = parsing.parse(unquotedAtomParser, value)
  if (either.isLeft(unquotedAtomResult) || value.includes('.')) {
    return quote.concat(escapeStringContents(value), quote)
  } else {
    return value
  }
}

const serializeIfNeeded = (
  nodeOrMolecule: SemanticGraph | Molecule,
): Either<UnserializableValueError, Atom | Molecule> =>
  isSemanticGraph(nodeOrMolecule) ?
    serialize(nodeOrMolecule)
  : either.makeRight(nodeOrMolecule)

const escapeStringContents = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')

const unparseSugaredApply = (
  expression: ApplyExpression,
  { unparseAtomOrMolecule, semanticContext }: Context,
) => {
  const {
    openGroupingParenthesis,
    closeGroupingParenthesis,
    openApplyParenthesis,
    closeApplyParenthesis,
  } = punctuation(styleText)

  const infixSugaredApply = either.flatMap(
    readInfixOperation(expression),
    ({ operand1, operatorLookupKey, operatorIndexExpression, operand2 }) => {
      // Infix syntax is probably appropriate.
      const unparsedOperand1 = either.map(
        either.flatMap(
          serializeIfNeeded(operand1),
          unparseAtomOrMolecule(semanticContext),
        ),
        unparsedOperand1 =>
          needsParenthesesAsFirstInfixOperand(operand1) ?
            openGroupingParenthesis.concat(
              unparsedOperand1,
              closeGroupingParenthesis,
            )
          : unparsedOperand1,
      )
      const unparsedOperand2 = either.map(
        either.flatMap(
          serializeIfNeeded(operand2),
          unparseAtomOrMolecule(semanticContext),
        ),
        unparsedOperand2 =>
          (
            needsParenthesesAsSecondInfixOperandOrImmediatelyAppliedFunction(
              operand2,
            )
          ) ?
            openGroupingParenthesis.concat(
              unparsedOperand2,
              closeGroupingParenthesis,
            )
          : unparsedOperand2,
      )

      // Operators omit the leading `:`, but otherwise look like lookups
      // (possibly followed by indexes).
      const unparsedOperator = styleText(applyColor, operatorLookupKey).concat(
        option.match(operatorIndexExpression, {
          some: operatorIndexExpression =>
            either.unwrapOrElse(
              unparseKeyPathOfSugaredIndex(operatorIndexExpression[1].query, {
                unparseAtomOrMolecule,
                semanticContext: 'apply',
              }),
              _ => '',
            ),
          none: _ => '',
        }),
      )

      return either.flatMap(unparsedOperand1, unparsedOperand1 =>
        either.map(unparsedOperand2, unparsedOperand2 =>
          unparsedOperand1.concat(' ', unparsedOperator, ' ', unparsedOperand2),
        ),
      )
    },
  )

  return either.flatMapLeft(infixSugaredApply, _ => {
    // Fall back to non-infix syntax.
    const unparsedFunction = either.map(
      either.flatMap(
        serializeIfNeeded(expression[1].function),
        unparseAtomOrMolecule('apply'),
      ),
      unparsedFunction =>
        (
          needsParenthesesAsSecondInfixOperandOrImmediatelyAppliedFunction(
            expression[1].function,
          )
        ) ?
          // It's an immediately-applied anonymous function.
          openGroupingParenthesis.concat(
            unparsedFunction,
            closeGroupingParenthesis,
          )
        : unparsedFunction,
    )
    const unparsedArgument = either.flatMap(
      serializeIfNeeded(expression[1].argument),
      unparseAtomOrMolecule(semanticContext),
    )
    return either.flatMap(unparsedFunction, unparsedFunction =>
      either.map(unparsedArgument, unparsedArgument =>
        unparsedFunction.concat(
          openApplyParenthesis,
          unparsedArgument,
          closeApplyParenthesis,
        ),
      ),
    )
  })
}

const unparseSugaredFunction = (
  expression: FunctionExpression,
  { unparseAtomOrMolecule }: Context,
) =>
  either.flatMap(serializeIfNeeded(expression[1].body), serializedBody =>
    either.map(unparseAtomOrMolecule('default')(serializedBody), bodyAsString =>
      [
        styleText(keyColor, expression[1].parameter),
        punctuation(styleText).arrow,
        bodyAsString,
      ].join(' '),
    ),
  )

const unparseSugaredIndex = (
  expression: IndexExpression,
  { unparseAtomOrMolecule, semanticContext }: Context,
) => {
  const objectUnparseResult = either.flatMap(
    serializeIfNeeded(expression[1].object),
    unparseAtomOrMolecule(semanticContext),
  )
  return either.flatMap(objectUnparseResult, unparsedObject => {
    if (typeof expression[1].query !== 'object') {
      // TODO: It would be nice if this were provably impossible.
      return either.makeLeft<UnserializableValueError>({
        kind: 'unserializableValue',
        message: 'invalid index expression',
      })
    } else {
      return either.map(
        unparseKeyPathOfSugaredIndex(expression[1].query, {
          unparseAtomOrMolecule,
          semanticContext,
        }),
        unparsedKeyPath => unparsedObject.concat(unparsedKeyPath),
      )
    }
  })
}

const unparseKeyPathOfSugaredIndex = (
  query: ObjectNode | Molecule,
  { semanticContext }: Context,
) => {
  const keyPath = Object.entries(query).reduce(
    (accumulator: KeyPath | 'invalid', [key, value]) => {
      if (accumulator === 'invalid') {
        return accumulator
      } else {
        if (key === String(accumulator.length) && typeof value === 'string') {
          return [...accumulator, value]
        } else {
          return 'invalid'
        }
      }
    },
    [],
  )

  if (keyPath === 'invalid' || Object.keys(query).length !== keyPath.length) {
    return either.makeLeft({
      kind: 'unserializableValue',
      message: 'invalid key path',
    })
  } else {
    const { dot } = punctuation(styleText)
    return either.makeRight(
      styleText(
        semanticContext === 'apply' ? applyColor : keyColor,
        dot.concat(keyPath.map(quoteKeyPathComponentIfNecessary).join(dot)),
      ),
    )
  }
}

const unparseSugaredLookup = (
  expression: LookupExpression,
  { semanticContext }: Context,
) =>
  either.makeRight(
    styleText(
      semanticContext === 'apply' ? applyColor : keyColor,
      punctuation(styleText).colon.concat(
        quoteKeyPathComponentIfNecessary(expression[1].key),
      ),
    ),
  )

const unparseSugaredGeneralizedKeywordExpression = (
  expression: Expression,
  { unparseAtomOrMolecule, semanticContext }: Context,
) => {
  if (
    // Not every valid keyword expression can be expressed with the generalized
    // sugar, e.g. if there are any additional properties besides the keyword
    // and its argument, or if the keyword requires quotation (which won't be
    // the case for any built-in keywords, but maybe eventually users will be
    // able to create custom keywords).
    requiresQuotation(expression['0'].substring(1)) ||
    Object.keys(expression).some(key => key !== '0' && key !== '1')
  ) {
    return either.makeLeft({
      kind: 'unserializableValue',
      message:
        'expression cannot be faithfully represented using generalized keyword expression sugar',
    })
  } else {
    const unparsedKeyword = styleText(['bold', 'underline'], expression['0'])
    if ('1' in expression) {
      return either.map(
        either.flatMap(
          serializeIfNeeded(expression['1']),
          unparseAtomOrMolecule(semanticContext),
        ),
        unparsedArgument => unparsedKeyword.concat(' ', unparsedArgument),
      )
    } else {
      return either.makeRight(unparsedKeyword)
    }
  }
}

/**
 * An apply should be written in infix notation if it is immediately applied
 * again to another operand and the function is a resolved via a lookup (it's
 * not anonymous).
 */
const readInfixOperation = (expression: ApplyExpression) =>
  either.flatMap(readApplyExpression(expression[1].function), innerApply => {
    // Support indexed lookups and bare lookups.
    const optionalOperatorIndexExpression = either.match(
      readIndexExpression(innerApply[1].function),
      {
        left: _ => option.none,
        right: option.makeSome,
      },
    )
    const lookupExpression = option.match(optionalOperatorIndexExpression, {
      none: _ => innerApply[1].function,
      some: operatorIndexExpression => operatorIndexExpression[1].object,
    })

    return either.map(
      readLookupExpression(lookupExpression),
      lookupExpression =>
        ({
          operand1: expression[1].argument,
          operatorLookupKey: lookupExpression[1].key,
          operatorIndexExpression: optionalOperatorIndexExpression,
          operand2: innerApply[1].argument,
        }) as const,
    )
  })

const needsParenthesesAsFirstInfixOperand = (
  expression: SemanticGraph | Molecule,
) => either.isRight(readFunctionExpression(asSemanticGraph(expression)))

const needsParenthesesAsSecondInfixOperandOrImmediatelyAppliedFunction = (
  expression: SemanticGraph | Molecule,
) =>
  either.isRight(readFunctionExpression(asSemanticGraph(expression))) ||
  either.isRight(
    either.flatMap(
      readApplyExpression(asSemanticGraph(expression)),
      readInfixOperation,
    ),
  )
