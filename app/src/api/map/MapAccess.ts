import { User } from '../account/User';

export type GeneralAccessLevel = 'restricted' | 'public';

export type GeneralAccessRole = 'viewer' | 'editor';

export type UserAccessRole = 'viewer' | 'editor' | 'owner';

export type InviteRole = 'viewer' | 'editor';

export interface UserAccessEntry extends User {
  role: UserAccessRole;
}

export interface PutUserAccessEntry {
  id: number;
  role: UserAccessRole | null;
}

export interface PendingInvite {
  email: string;
  role: UserAccessRole;
}

export interface MapAccess {
  id: number;
  owner: User;
  generalAccessLevel: GeneralAccessLevel;
  generalAccessRole: GeneralAccessRole;
  userAccess: UserAccessEntry[];
  pendingInvites: PendingInvite[];
}

export interface PutMapAccess {
  id: number;
  generalAccessLevel?: GeneralAccessLevel;
  generalAccessRole?: GeneralAccessRole;
  userAccess?: PutUserAccessEntry[];
}
