import { SyncChange } from './SyncChange';

export type RecvMsg = ReplyMsg | BcastMsg | ErrorMsg;

type ReplyMsg = { replyTo: number; change: SyncChange };
type BcastMsg = { change: SyncChange };
type ErrorMsg = { error: string; details: string };
