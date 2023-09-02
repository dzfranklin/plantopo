import { SyncEngine } from '../../api/SyncEngine';
import { InteractionHandler, InteractionEvent } from './InteractionManager';

export class MaplibreHandlerStub implements InteractionHandler {
  cursor?: string | undefined;

  onDrag(
    _evt: InteractionEvent,
    _delta: [number, number],
    _engine: SyncEngine,
  ): boolean {
    this.cursor = 'grab';
    return true;
  }

  onDragEnd(_evt: InteractionEvent, _engine: SyncEngine): boolean {
    this.cursor = undefined;
    return true;
  }
}
