import { User } from '@/features/account/api/User';

export type GeneralAccessLevel = 'restricted' | 'public';

export type GeneralAccessRole = 'viewer' | 'editor';

export type UserAccessRole = 'editor' | 'viewer';

export interface UserAccessEntry {
  user: User;
  role: UserAccessRole;
}

export type PutUserAccessEntry = SetUserAccess | DeleteUserAccess;

export interface SetUserAccess {
  role: UserAccessRole;
}

export interface DeleteUserAccess {
  delete: true;
}

export interface PendingInvite {
  email: string;
  role: UserAccessRole;
}

export interface InviteRequest {
  email: string;
  role: UserAccessRole;
  notify: boolean;
  notifyMessage?: string;
}

export interface MapAccess {
  mapId: string;
  owner: User;
  generalAccessLevel: GeneralAccessLevel;
  generalAccessRole: GeneralAccessRole;
  userAccess: UserAccessEntry[];
  pendingInvites: PendingInvite[];
}

export interface PutMapAccessRequest {
  owner?: string;
  generalAccessLevel?: GeneralAccessLevel;
  generalAccessRole?: GeneralAccessRole;
  userAccess?: Record<string, PutUserAccessEntry>; // by userId
  invite?: InviteRequest[];
}

export interface RequestMapAccessRequest {
  requestedRole: UserAccessRole;
  message?: string;
}
