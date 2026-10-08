// Sync protocol (used by Android clients). Pure-TS, no third-party.

export type SyncOp =
  | { kind: 'bill.create'; id: string; payload: any }
  | { kind: 'bill.update'; id: string; payload: any }
  | { kind: 'expense.create'; id: string; payload: any }
  | { kind: 'shift.entry'; id: string; payload: any }
  | { kind: 'inventory.adjust'; id: string; payload: any };

export interface SyncBatch {
  deviceId: string;
  generatedAt: string;
  ops: SyncOp[];
}

export interface SyncResult {
  accepted: string[];
  rejected: Array<{ id: string; reason: string }>;
  serverTime: string;
}
