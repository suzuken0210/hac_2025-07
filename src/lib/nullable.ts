type Nullable<T> = T | null;
const mapNullable = <T, U>(value: Nullable<T>, fn: (v: T) => U): Nullable<U> => {
  return value === null ? null : fn(value);
};

export {
  mapNullable, Nullable
};

