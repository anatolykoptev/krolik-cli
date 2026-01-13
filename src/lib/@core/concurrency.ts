/**
 * Run async tasks with limited concurrency
 */
export async function limitConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const queue = items.map((item, index) => ({ item, index }));
  const active: Promise<void>[] = [];

  const next = async (): Promise<void> => {
    if (queue.length === 0) return;
    const { item, index } = queue.shift()!;
    results[index] = await fn(item);
    await next();
  };

  for (let i = 0; i < Math.min(limit, items.length); i++) {
    active.push(next());
  }

  await Promise.all(active);
  return results;
}
