import { useCallback, useEffect, useMemo, useState } from "react";
import { channelOrderSort } from "@/app/lib/channelOrderSort";

function channelOrderKey(orgId: string): string {
  return `daycare:channelOrder:${orgId}`;
}

export function channelOrderRead(orgId: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(channelOrderKey(orgId)) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

export function channelOrderWrite(orgId: string, order: string[]): void {
  localStorage.setItem(channelOrderKey(orgId), JSON.stringify(order));
}

export function useChannelOrder<T extends { id: string; name: string }>(orgId: string, channels: T[]) {
  const [order, setOrder] = useState<string[]>(() => channelOrderRead(orgId));

  // Re-read order when orgId changes — no hook abstraction for localStorage
  useEffect(() => {
    setOrder(channelOrderRead(orgId));
  }, [orgId]);

  const sorted = useMemo(
    () => channelOrderSort(channels, order),
    [channels, order],
  );

  const reorder = useCallback(
    (fromId: string, toId: string) => {
      const currentIds = sorted.map((ch) => ch.id);
      const fromIdx = currentIds.indexOf(fromId);
      const toIdx = currentIds.indexOf(toId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

      const next = [...currentIds];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);

      setOrder(next);
      channelOrderWrite(orgId, next);
    },
    [orgId, sorted],
  );

  return { sorted, reorder };
}
