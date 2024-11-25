import { makeSome, match, none, type None, type Option } from './option.js'

export const filter = <Value, NarrowedValue extends Value>(
  option: Option<Value>,
  predicate: (value: Value) => value is NarrowedValue,
): Option<NarrowedValue> =>
  flatMap(option, value => fromPredicate(value, predicate))

export const fromPredicate = <InputValue, Value extends InputValue>(
  value: InputValue,
  predicate: (value: InputValue) => value is Value,
): Option<Value> => (predicate(value) ? makeSome(value) : none)

export const flatMap = <Value, NewValue>(
  option: Option<Value>,
  f: (value: Value) => Option<NewValue>,
): Option<NewValue> => match(option, { none: () => none, some: f })

export const isNone = (option: Option<unknown>): option is None =>
  match(option, { none: () => true, some: _ => false })

export const map = <Value, NewValue>(
  option: Option<Value>,
  f: (value: Value) => NewValue,
): Option<NewValue> =>
  match(option, {
    none: (): Option<NewValue> => none,
    some: value => makeSome(f(value)),
  })
