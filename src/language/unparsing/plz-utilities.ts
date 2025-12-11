import either, { type Either, type Right } from '@matt.kantor/either'
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
  type SemanticGraph,
} from '../semantics.js'
import { punctuation } from './unparsing-utilities.js'

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
  const { colon } = punctuation(styleText)
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
      keyValuePairsAsStrings.push(valueAsStringResult.value)
      ordinalPropertyKeyCounter += 1n
    } else {
      keyValuePairsAsStrings.push(
        styleText('cyan', quoteAtomIfNecessary(propertyKey).concat(colon))
          .concat(' ')
          .concat(valueAsStringResult.value),
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
    return quote.concat(escapeStringContents(value)).concat(quote)
  } else {
    return value
  }
}

const quoteKeyPathComponentIfNecessary = (value: string): string => {
  const { quote } = punctuation(styleText)
  const unquotedAtomResult = parsing.parse(unquotedAtomParser, value)
  if (either.isLeft(unquotedAtomResult) || value.includes('.')) {
    return quote.concat(escapeStringContents(value)).concat(quote)
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
  const { closeParenthesis, openParenthesis } = punctuation(styleText)
  return either.flatMap(
    either.map(
      either.flatMap(
        serializeIfNeeded(expression[1].function),
        unparseAtomOrMolecule,
      ),
      unparsedFunction =>
        either.isRight(readFunctionExpression(expression[1].function))
          ? // Immediately-applied function expressions need parentheses.
            openParenthesis.concat(unparsedFunction).concat(closeParenthesis)
          : unparsedFunction,
    ),
    unparsedFunction =>
      either.map(
        either.flatMap(
          serializeIfNeeded(expression[1].argument),
          unparseAtomOrMolecule,
        ),
        unparsedArgument =>
          unparsedFunction
            .concat(openParenthesis)
            .concat(unparsedArgument)
            .concat(closeParenthesis),
      ),
  )
}

const unparseSugaredFunction = (
  expression: FunctionExpression,
  unparseAtomOrMolecule: UnparseAtomOrMolecule,
) =>
  either.flatMap(serializeIfNeeded(expression[1].body), serializedBody =>
    either.map(unparseAtomOrMolecule(serializedBody), bodyAsString =>
      [
        styleText('cyan', expression[1].parameter),
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
        message: 'Invalid index expression',
      })
    } else {
      const keyPath = Object.entries(expression[1].query).reduce(
        (accumulator: KeyPath | 'invalid', [key, value]) => {
          if (accumulator === 'invalid') {
            return accumulator
          } else {
            if (
              key === String(accumulator.length) &&
              typeof value === 'string'
            ) {
              return [...accumulator, value]
            } else {
              return 'invalid'
            }
          }
        },
        [],
      )

      if (
        keyPath === 'invalid' ||
        Object.keys(expression[1].query).length !== keyPath.length
      ) {
        return either.makeLeft({
          kind: 'unserializableValue',
          message: 'invalid key path',
        })
      } else {
        const { dot } = punctuation(styleText)
        return either.makeRight(
          unparsedObject
            .concat(dot)
            .concat(keyPath.map(quoteKeyPathComponentIfNecessary).join(dot)),
        )
      }
    }
  })
}

const unparseSugaredLookup = (
  expression: LookupExpression,
  _unparseAtomOrMolecule: UnparseAtomOrMolecule,
) =>
  either.makeRight(
    styleText(
      'cyan',
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
    // Not every valid keyword expression can be expressed with the
    // generalized sugar, e.g. if there are any additional properties
    // besides the keyword and its argument, or if the keyword requires
    // quotation (which won't be the case for any built-in keywords, but
    // maybe eventually users will be able to create custom keywords).
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
        unparsedArgument =>
          unparsedKeyword.concat(' ').concat(unparsedArgument),
      )
    } else {
      return either.makeRight(unparsedKeyword)
    }
  }
}
