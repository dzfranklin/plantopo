import { EditorEngine } from '../../engine/EditorEngine';
import { InteractionEvent, InteractionHandler } from './InteractionManager';

export class BaseActionHandler implements InteractionHandler {
  onPress(_evt: InteractionEvent, engine: EditorEngine): boolean {
    return engine.clearSelection();
  }
}
