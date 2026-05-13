import option, { type Option } from '@matt.kantor/option'

const orderedRecordTag = Symbol('orderedRecordTag')

export type OrderedRecord<Value> = {
  readonly [orderedRecordTag]: true
  readonly entries: readonly (readonly [string, Value])[]
}

const fromUniqueEntries = <Value>(
  entries: readonly (readonly [string, Value])[],
): OrderedRecord<Value> => ({
  [orderedRecordTag]: true,
  entries,
})

export const empty: OrderedRecord<never> = fromUniqueEntries([])

/**
 * Create an `OrderedRecord`.
 *
 * Behavior in the face of duplicate keys is the same as building up an
 * `OrderedRecord` with repeated `set` calls: the first occurrence determines
 * the position and the last occurrence determines the value.
 */
export const make = <Value>(
  source: Iterable<readonly [string, Value]>,
): OrderedRecord<Value> => {
  const sourceArray = [...source]
  const orderedUniqueKeys = sourceArray
    .map(([key, _value]) => key)
    .filter((key, index, allKeys) => allKeys.indexOf(key) === index)
  const dedupedEntries = orderedUniqueKeys.map(key => {
    const lastOccurrence = sourceArray.findLast(
      ([sourceKey, _sourceValue]) => sourceKey === key,
    )
    if (lastOccurrence === undefined) {
      throw new Error(
        'Key disappeared between `filter` and `findLast`. This is a bug!',
      )
    }
    return [key, lastOccurrence[1]] as const
  })
  return fromUniqueEntries(dedupedEntries)
}

export const isOrderedRecord = (
  value: unknown,
): value is OrderedRecord<unknown> =>
  typeof value === 'object' && value !== null && orderedRecordTag in value

export const get = <Value>(
  record: OrderedRecord<Value>,
  key: string,
): Option<Value> => {
  const entry = record.entries.find(
    ([keyInRecord, _valueInRecord]) => keyInRecord === key,
  )
  return entry === undefined ? option.none : option.makeSome(entry[1])
}

export const has = (
  record: OrderedRecord<unknown>,
  keyToFind: string,
): boolean => record.entries.some(([key, _value]) => key === keyToFind)

export const keys = (record: OrderedRecord<unknown>): readonly string[] =>
  record.entries.map(([key, _value]) => key)

export const values = <Value>(record: OrderedRecord<Value>): readonly Value[] =>
  record.entries.map(([_key, value]) => value)

export const size = (record: OrderedRecord<unknown>): number =>
  record.entries.length

/**
 * Return a new `OrderedRecord` with `key` mapped to `value`. If `key` is
 * already present, its position is preserved and only the value is replaced. If
 * `key` is new, it's appended to the end.
 */
export const set = <Value>(
  record: OrderedRecord<Value>,
  key: string,
  value: Value,
): OrderedRecord<Value> => {
  const existingIndex = record.entries.findIndex(
    ([existingKey, _existingValue]) => existingKey === key,
  )
  return existingIndex === -1 ?
      fromUniqueEntries([...record.entries, [key, value]])
    : fromUniqueEntries(
        record.entries.map((entry, index) =>
          index === existingIndex ? [key, value] : entry,
        ),
      )
}

export const remove = <Value>(
  record: OrderedRecord<Value>,
  keyToRemove: string,
): OrderedRecord<Value> =>
  fromUniqueEntries(
    record.entries.filter(([key, _value]) => key !== keyToRemove),
  )

/**
 * Overlay `second` onto `first`. Keys present in both records keep their
 * position from `first` but take their value from `second`.
 */
export const merge = <Value>(
  first: OrderedRecord<Value>,
  second: OrderedRecord<Value>,
): OrderedRecord<Value> => {
  const updatedFirst = first.entries.map(
    ([key1, value1]) =>
      second.entries.find(([key2, _value2]) => key2 === key1) ??
      ([key1, value1] as const),
  )
  const newKeysFromSecond = second.entries.filter(
    ([key2, _value2]) =>
      !first.entries.some(([key1, _value1]) => key1 === key2),
  )
  return fromUniqueEntries([...updatedFirst, ...newKeysFromSecond])
}

export const mapValues = <Value, NewValue>(
  record: OrderedRecord<Value>,
  transform: (value: Value, key: string) => NewValue,
): OrderedRecord<NewValue> =>
  fromUniqueEntries(
    record.entries.map(([key, value]) => [key, transform(value, key)]),
  )

export const mapKeys = <Value>(
  record: OrderedRecord<Value>,
  transform: (key: string, value: Value) => string,
): OrderedRecord<Value> =>
  fromUniqueEntries(
    record.entries.map(([key, value]) => [transform(key, value), value]),
  )

export const filter = <Value>(
  record: OrderedRecord<Value>,
  predicate: (value: Value, key: string) => boolean,
): OrderedRecord<Value> =>
  fromUniqueEntries(
    record.entries.filter(([key, value]) => predicate(value, key)),
  )
