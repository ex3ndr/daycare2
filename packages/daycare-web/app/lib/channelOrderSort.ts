type ChannelLike = { id: string; name: string };

export function channelOrderSort<T extends ChannelLike>(channels: T[], order: string[]): T[] {
  const indexed = new Map(order.map((id, i) => [id, i]));
  return [...channels].sort((a, b) => {
    const ai = indexed.get(a.id) ?? Infinity;
    const bi = indexed.get(b.id) ?? Infinity;
    if (ai === Infinity && bi === Infinity) return a.name.localeCompare(b.name);
    return ai - bi;
  });
}
