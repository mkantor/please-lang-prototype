declare const _thisPropertyDoesNotExistAtRuntime: unique symbol
export type WithPhantomData<Value, PhantomData> = Value & {
  readonly [_thisPropertyDoesNotExistAtRuntime]: PhantomData
}

export const withPhantomData =
  <Data>() =>
  <Value>(value: Value): WithPhantomData<Value, Data> =>
    value as WithPhantomData<Value, Data>
