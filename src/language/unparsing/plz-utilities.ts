import either, { type Either, type Right } from '@matt.kantor/either'
import option from '@matt.kantor/option'
import parsing from '@matt.kantor/parsing'
import { styleText } from 'node:util'
import type { UnserializableValueError } from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import { unquotedAtomParser } from '../parsing/atom.js'
import {
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
import { functionColor, keyColor, punctuation } from './unparsing-utilities.js'

export const moleculeUnparser =
  (
    unparseAtomOrMolecule: UnparseAtomOrMolecule,
    unparseSugarFreeMolecule: (
      expression: Molecule,
      unparseAtomOrMolecule: UnparseAtomOrMolecule,
    ) => Either<UnserializableValueError, string>,
  ) =>
  (value: Molecule): Either<UnserializableValueError, string> => {
    switch (value['0']) {
      case '@apply':
        return either.match(readApplyExpression(value), {
          left: _ => unparseSugarFreeMolecule(value, unparseAtomOrMolecule),
          right: applyExpression =>
            unparseSugaredApply(applyExpression, unparseAtomOrMolecule),
        })
      case '@function':
        return either.match(readFunctionExpression(value), {
          left: _ => unparseSugarFreeMolecule(value, unparseAtomOrMolecule),
          right: functionExpression =>
            unparseSugaredFunction(functionExpression, unparseAtomOrMolecule),
        })
      case '@index':
        return either.match(readIndexExpression(value), {
          left: _ => unparseSugarFreeMolecule(value, unparseAtomOrMolecule),
          right: indexExpression =>
            unparseSugaredIndex(indexExpression, unparseAtomOrMolecule),
        })
      case '@lookup':
        return either.match(readLookupExpression(value), {
          left: _ => unparseSugarFreeMolecule(value, unparseAtomOrMolecule),
          right: lookupExpression =>
            unparseSugaredLookup(lookupExpression, unparseAtomOrMolecule),
        })
      default:
        if (isExpression(value)) {
          const result = unparseSugaredGeneralizedKeywordExpression(
            value,
            unparseAtomOrMolecule,
          )
          return either.flatMapLeft(result, _ =>
            unparseSugarFreeMolecule(value, unparseAtomOrMolecule),
          )
        } else {
          return unparseSugarFreeMolecule(value, unparseAtomOrMolecule)
        }
    }
  }

export const moleculeAsKeyValuePairStrings = (
  value: Molecule,
  unparseAtomOrMolecule: UnparseAtomOrMolecule,
  options: { readonly ordinalKeys: 'omit' | 'preserve' },
): Either<UnserializableValueError, readonly string[]> => {
  const { colon, openGroupingParenthesis, closeGroupingParenthesis } =
    punctuation(styleText)
  const entries = Object.entries(value)

  const keyValuePairsAsStrings: string[] = []
  let ordinalPropertyKeyCounter = 0n
  for (const [propertyKey, propertyValue] of entries) {
    const valueAsStringResult = unparseAtomOrMolecule(propertyValue)
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
        needsParenthesesAsSecondInfixOperandOrImmediatelyAppliedFunction(
          propertyValue,
        ) && entries.length !== 1
          ? openGroupingParenthesis.concat(
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
    /^@[^@]/.test(atom)
      ? styleText(['bold', 'underline'], quoteAtomIfNecessary(atom))
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
  isSemanticGraph(nodeOrMolecule)
    ? serialize(nodeOrMolecule)
    : either.makeRight(nodeOrMolecule)

type UnparseAtomOrMolecule = (
  value: Atom | Molecule,
) => Either<UnserializableValueError, string>

const escapeStringContents = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')

const unparseSugaredApply = (
  expression: ApplyExpression,
  unparseAtomOrMolecule: UnparseAtomOrMolecule,
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
        either.flatMap(serializeIfNeeded(operand1), unparseAtomOrMolecule),
        unparsedOperand1 =>
          needsParenthesesAsFirstInfixOperand(operand1)
            ? openGroupingParenthesis.concat(
                unparsedOperand1,
                closeGroupingParenthesis,
              )
            : unparsedOperand1,
      )
      const unparsedOperand2 = either.map(
        either.flatMap(serializeIfNeeded(operand2), unparseAtomOrMolecule),
        unparsedOperand2 =>
          needsParenthesesAsSecondInfixOperandOrImmediatelyAppliedFunction(
            operand2,
          )
            ? openGroupingParenthesis.concat(
                unparsedOperand2,
                closeGroupingParenthesis,
              )
            : unparsedOperand2,
      )

      // Operators omit the leading `:`, but otherwise look like lookups
      // (possibly followed by indexes).
      const unparsedOperator = styleText(
        functionColor,
        operatorLookupKey,
      ).concat(
        option.match(operatorIndexExpression, {
          some: operatorIndexExpression =>
            either.unwrapOrElse(
              unparseKeyPathOfSugaredIndex(
                operatorIndexExpression[1].query,
                functionColor,
              ),
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
        unparseAtomOrMolecule,
      ),
      unparsedFunction =>
        needsParenthesesAsSecondInfixOperandOrImmediatelyAppliedFunction(
          expression[1].function,
        )
          ? openGroupingParenthesis.concat(
              unparsedFunction,
              closeGroupingParenthesis,
            )
          : unparsedFunction,
    )
    const unparsedArgument = either.flatMap(
      serializeIfNeeded(expression[1].argument),
      unparseAtomOrMolecule,
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
  unparseAtomOrMolecule: UnparseAtomOrMolecule,
) =>
  either.flatMap(serializeIfNeeded(expression[1].body), serializedBody =>
    either.map(unparseAtomOrMolecule(serializedBody), bodyAsString =>
      [
        styleText(keyColor, expression[1].parameter),
        punctuation(styleText).arrow,
        bodyAsString,
      ].join(' '),
    ),
  )

const unparseSugaredIndex = (
  expression: IndexExpression,
  unparseAtomOrMolecule: UnparseAtomOrMolecule,
) => {
  const objectUnparseResult = either.flatMap(
    serializeIfNeeded(expression[1].object),
    unparseAtomOrMolecule,
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
        unparseKeyPathOfSugaredIndex(expression[1].query, keyColor),
        unparsedKeyPath => unparsedObject.concat(unparsedKeyPath),
      )
    }
  })
}

const unparseKeyPathOfSugaredIndex = (
  query: ObjectNode | Molecule,
  color: typeof keyColor | typeof functionColor,
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
        color,
        dot.concat(keyPath.map(quoteKeyPathComponentIfNecessary).join(dot)),
      ),
    )
  }
}

const unparseSugaredLookup = (
  expression: LookupExpression,
  _unparseAtomOrMolecule: UnparseAtomOrMolecule,
) =>
  either.makeRight(
    styleText(
      keyColor,
      punctuation(styleText).colon.concat(
        quoteKeyPathComponentIfNecessary(expression[1].key),
      ),
    ),
  )

const unparseSugaredGeneralizedKeywordExpression = (
  expression: Expression,
  unparseAtomOrMolecule: UnparseAtomOrMolecule,
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
          unparseAtomOrMolecule,
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
        } as const),
    )
  })

const needsParenthesesAsFirstInfixOperand = (
  expression: SemanticGraph | Molecule,
) => either.isRight(readFunctionExpression(expression))

const needsParenthesesAsSecondInfixOperandOrImmediatelyAppliedFunction = (
  expression: SemanticGraph | Molecule,
) =>
  either.isRight(readFunctionExpression(expression)) ||
  either.isRight(
    either.flatMap(readApplyExpression(expression), readInfixOperation),
  )
