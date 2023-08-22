import { FInsertPlace } from '@/sync/SyncEngine';

export type EditStartEvent = {
  type: 'createRoute';
  insertAt: FInsertPlace;
};

export class EditStartChannel {
  on: ((event: EditStartEvent) => void) | undefined;
  emit(event: EditStartEvent) {
    this.on?.(event);
  }
}
