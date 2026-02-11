import type { UpdateEnvelope } from "../daycare/types";

type UpdateSequencerArgs = {
  onBatch: (updates: UpdateEnvelope[]) => void;
  onHole: () => void;
  batchDelayMs?: number;
  holeTimeoutMs?: number;
};

// Batches consecutive SSE updates and detects missing seqno holes.
// - 100ms debounce for batching consecutive updates
// - 5s timeout for missing seqno (hole detection)
// - On hole timeout: triggers session restart (re-fetch all state)
export class UpdateSequencer {
  private currentSeqno: number;
  private buffer: Map<number, UpdateEnvelope> = new Map();
  private batchQueue: UpdateEnvelope[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private holeTimer: ReturnType<typeof setTimeout> | null = null;
  private onBatch: (updates: UpdateEnvelope[]) => void;
  private onHole: () => void;
  private batchDelayMs: number;
  private holeTimeoutMs: number;
  private destroyed = false;

  constructor(args: UpdateSequencerArgs, initialSeqno = 0) {
    this.currentSeqno = initialSeqno;
    this.onBatch = args.onBatch;
    this.onHole = args.onHole;
    this.batchDelayMs = args.batchDelayMs ?? 100;
    this.holeTimeoutMs = args.holeTimeoutMs ?? 5000;
  }

  push(update: UpdateEnvelope): void {
    if (this.destroyed) return;

    const seqno = update.seqno;

    // Already processed or out of order — ignore
    if (seqno <= this.currentSeqno) return;

    // Expected next seqno — enqueue for batch
    if (seqno === this.currentSeqno + 1) {
      this.currentSeqno = seqno;
      this.batchQueue.push(update);
      this.clearHoleTimer();

      // Drain any buffered updates that are now sequential
      this.drainBuffer();

      // Schedule batch flush
      this.scheduleBatchFlush();
    } else {
      // Gap detected — buffer this update and start hole timer
      this.buffer.set(seqno, update);
      this.startHoleTimer();
    }
  }

  get seqno(): number {
    return this.currentSeqno;
  }

  reset(seqno: number): void {
    this.currentSeqno = seqno;
    this.buffer.clear();
    this.batchQueue = [];
    this.clearBatchTimer();
    this.clearHoleTimer();
  }

  destroy(): void {
    this.destroyed = true;
    this.clearBatchTimer();
    this.clearHoleTimer();
    this.buffer.clear();
    this.batchQueue = [];
  }

  private drainBuffer(): void {
    let next = this.currentSeqno + 1;
    while (this.buffer.has(next)) {
      const update = this.buffer.get(next)!;
      this.buffer.delete(next);
      this.batchQueue.push(update);
      this.currentSeqno = next;
      next++;
    }

    // If there are still buffered items beyond what we drained, a hole remains
    if (this.buffer.size > 0) {
      this.startHoleTimer();
    }
  }

  private scheduleBatchFlush(): void {
    if (this.batchTimer !== null) return;
    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      this.flushBatch();
    }, this.batchDelayMs);
  }

  private flushBatch(): void {
    if (this.batchQueue.length === 0) return;
    const batch = this.batchQueue;
    this.batchQueue = [];
    this.onBatch(batch);
  }

  private startHoleTimer(): void {
    if (this.holeTimer !== null) return;
    this.holeTimer = setTimeout(() => {
      this.holeTimer = null;
      if (!this.destroyed) {
        this.onHole();
      }
    }, this.holeTimeoutMs);
  }

  private clearHoleTimer(): void {
    if (this.holeTimer !== null) {
      clearTimeout(this.holeTimer);
      this.holeTimer = null;
    }
  }

  private clearBatchTimer(): void {
    if (this.batchTimer !== null) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }
}
