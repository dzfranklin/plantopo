import { SyncChange } from './SyncChange';
import { SyncOp } from './SyncOp';

export type OutgoingMsg = OpMsg | KeepaliveMsg;

export type IncomingMsg =
  | ConnectAcceptMsg
  | ReplyMsg
  | BcastMsg
  | ErrorMsg
  | KeepaliveMsg;

export interface OpMsg {
  type: 'op';
  seq: number;
  ops: Array<SyncOp>;
}

export interface KeepaliveMsg {
  type: 'keepalive';
}

export interface ConnectAcceptMsg {
  type: 'connectAccept';
  sessionId: number;
  fidBlockStart: number;
  fidBlockUntil: number;
  state: SyncChange;
}
export interface ReplyMsg {
  type: 'reply';
  replyTo: number;
  change: SyncChange;
}
export interface BcastMsg {
  type: 'bcast';
  change: SyncChange;
}
export interface ErrorMsg {
  type: 'error';
  error: string;
  details: string;
}
