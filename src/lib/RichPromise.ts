async function sequentialMap<T, U>(
  array: T[],
  asyncFn: (item: T, index: number) => Promise<U>
): Promise<U[]> {
  const results: U[] = [];
  for (let i = 0; i < array.length; i++) {
    results.push(await asyncFn(array[i], i));
  }
  return results;
}

async function sequentiallyFlatMap<T, U>(
    array: T[],
    asyncFn: (item: T, index: number) => Promise<U[]>
): Promise<U[]> {
    const results: U[] = [];
    for (let i = 0; i < array.length; i++) {
        const items = await asyncFn(array[i], i);
        results.push(...items);
    }

    return results;
}

export { sequentiallyFlatMap, sequentialMap };
