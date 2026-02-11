import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UpdateSequencer } from "./UpdateSequencer";
import type { UpdateEnvelope } from "../daycare/types";

function makeUpdate(seqno: number): UpdateEnvelope {
  return {
    id: `update-${seqno}`,
    userId: "user-1",
    seqno,
    eventType: "message.created",
    payload: { message: { id: `msg-${seqno}` } },
    createdAt: Date.now(),
  };
}

describe("UpdateSequencer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("sequential delivery", () => {
    it("delivers updates in batch after debounce delay", () => {
      const onBatch = vi.fn();
      const onHole = vi.fn();
      const seq = new UpdateSequencer(
        { onBatch, onHole, batchDelayMs: 100 },
        0,
      );

      seq.push(makeUpdate(1));
      seq.push(makeUpdate(2));
      seq.push(makeUpdate(3));

      // Not yet flushed
      expect(onBatch).not.toHaveBeenCalled();

      // Advance past batch delay
      vi.advanceTimersByTime(100);

      expect(onBatch).toHaveBeenCalledOnce();
      const batch = onBatch.mock.calls[0][0] as UpdateEnvelope[];
      expect(batch).toHaveLength(3);
      expect(batch[0].seqno).toBe(1);
      expect(batch[1].seqno).toBe(2);
      expect(batch[2].seqno).toBe(3);

      seq.destroy();
    });

    it("ignores duplicate seqno", () => {
      const onBatch = vi.fn();
      const seq = new UpdateSequencer(
        { onBatch, onHole: vi.fn(), batchDelayMs: 100 },
        0,
      );

      seq.push(makeUpdate(1));
      seq.push(makeUpdate(1)); // duplicate
      seq.push(makeUpdate(2));

      vi.advanceTimersByTime(100);

      const batch = onBatch.mock.calls[0][0] as UpdateEnvelope[];
      expect(batch).toHaveLength(2);
      expect(batch[0].seqno).toBe(1);
      expect(batch[1].seqno).toBe(2);

      seq.destroy();
    });

    it("ignores updates with seqno at or below current", () => {
      const onBatch = vi.fn();
      const seq = new UpdateSequencer(
        { onBatch, onHole: vi.fn(), batchDelayMs: 100 },
        5,
      );

      seq.push(makeUpdate(3)); // old
      seq.push(makeUpdate(5)); // current (already processed)
      seq.push(makeUpdate(6)); // next expected

      vi.advanceTimersByTime(100);

      expect(onBatch).toHaveBeenCalledOnce();
      const batch = onBatch.mock.calls[0][0] as UpdateEnvelope[];
      expect(batch).toHaveLength(1);
      expect(batch[0].seqno).toBe(6);

      seq.destroy();
    });

    it("tracks seqno correctly", () => {
      const seq = new UpdateSequencer(
        { onBatch: vi.fn(), onHole: vi.fn(), batchDelayMs: 100 },
        0,
      );

      expect(seq.seqno).toBe(0);

      seq.push(makeUpdate(1));
      expect(seq.seqno).toBe(1);

      seq.push(makeUpdate(2));
      expect(seq.seqno).toBe(2);

      seq.destroy();
    });
  });

  describe("hole detection", () => {
    it("triggers onHole when gap detected after timeout", () => {
      const onBatch = vi.fn();
      const onHole = vi.fn();
      const seq = new UpdateSequencer(
        { onBatch, onHole, batchDelayMs: 100, holeTimeoutMs: 5000 },
        0,
      );

      seq.push(makeUpdate(1));
      // Skip seqno 2, push seqno 3
      seq.push(makeUpdate(3));

      // seqno 1 should be queued for batch, seqno 3 buffered
      vi.advanceTimersByTime(100);
      expect(onBatch).toHaveBeenCalledOnce();
      const batch = onBatch.mock.calls[0][0] as UpdateEnvelope[];
      expect(batch).toHaveLength(1);
      expect(batch[0].seqno).toBe(1);

      // Hole not triggered yet
      expect(onHole).not.toHaveBeenCalled();

      // Advance to hole timeout
      vi.advanceTimersByTime(5000);
      expect(onHole).toHaveBeenCalledOnce();

      seq.destroy();
    });

    it("resolves hole when missing update arrives before timeout", () => {
      const onBatch = vi.fn();
      const onHole = vi.fn();
      const seq = new UpdateSequencer(
        { onBatch, onHole, batchDelayMs: 100, holeTimeoutMs: 5000 },
        0,
      );

      seq.push(makeUpdate(1));
      seq.push(makeUpdate(3)); // gap: missing 2

      vi.advanceTimersByTime(100);
      onBatch.mockClear();

      // Fill the gap before timeout
      vi.advanceTimersByTime(2000);
      seq.push(makeUpdate(2));

      vi.advanceTimersByTime(100);

      // Should have delivered seqno 2 and 3 in batch
      expect(onBatch).toHaveBeenCalledOnce();
      const batch = onBatch.mock.calls[0][0] as UpdateEnvelope[];
      expect(batch).toHaveLength(2);
      expect(batch[0].seqno).toBe(2);
      expect(batch[1].seqno).toBe(3);

      // Hole should not have triggered
      vi.advanceTimersByTime(5000);
      expect(onHole).not.toHaveBeenCalled();

      seq.destroy();
    });
  });

  describe("batch flushing", () => {
    it("flushes separate batches for non-contiguous bursts", () => {
      const onBatch = vi.fn();
      const seq = new UpdateSequencer(
        { onBatch, onHole: vi.fn(), batchDelayMs: 100 },
        0,
      );

      seq.push(makeUpdate(1));
      seq.push(makeUpdate(2));

      vi.advanceTimersByTime(100);
      expect(onBatch).toHaveBeenCalledOnce();
      expect((onBatch.mock.calls[0][0] as UpdateEnvelope[]).length).toBe(2);

      onBatch.mockClear();

      seq.push(makeUpdate(3));
      seq.push(makeUpdate(4));

      vi.advanceTimersByTime(100);
      expect(onBatch).toHaveBeenCalledOnce();
      expect((onBatch.mock.calls[0][0] as UpdateEnvelope[]).length).toBe(2);

      seq.destroy();
    });
  });

  describe("reset", () => {
    it("clears buffer and resets seqno", () => {
      const onBatch = vi.fn();
      const onHole = vi.fn();
      const seq = new UpdateSequencer(
        { onBatch, onHole, batchDelayMs: 100, holeTimeoutMs: 5000 },
        0,
      );

      seq.push(makeUpdate(1));
      seq.push(makeUpdate(3)); // gap

      seq.reset(10);
      expect(seq.seqno).toBe(10);

      // Hole timer should be cleared
      vi.advanceTimersByTime(5000);
      expect(onHole).not.toHaveBeenCalled();

      // Old updates should not flush
      vi.advanceTimersByTime(100);
      expect(onBatch).not.toHaveBeenCalled();

      // New updates from seqno 11 should work
      seq.push(makeUpdate(11));
      vi.advanceTimersByTime(100);
      expect(onBatch).toHaveBeenCalledOnce();

      seq.destroy();
    });
  });

  describe("destroy", () => {
    it("stops processing after destroy", () => {
      const onBatch = vi.fn();
      const onHole = vi.fn();
      const seq = new UpdateSequencer(
        { onBatch, onHole, batchDelayMs: 100, holeTimeoutMs: 5000 },
        0,
      );

      seq.push(makeUpdate(1));
      seq.destroy();

      vi.advanceTimersByTime(100);
      expect(onBatch).not.toHaveBeenCalled();

      // Pushing after destroy is a no-op
      seq.push(makeUpdate(2));
      vi.advanceTimersByTime(100);
      expect(onBatch).not.toHaveBeenCalled();
    });
  });
});
