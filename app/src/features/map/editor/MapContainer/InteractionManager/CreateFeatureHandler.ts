import { EditorEngine } from '../../engine/EditorEngine';
import { InteractionEvent, InteractionHandler } from './InteractionManager';

export class CreateFeatureHandler implements InteractionHandler {
  cursor = 'crosshair';

  onPress(evt: InteractionEvent, engine: EditorEngine): boolean {
    switch (engine.scene.activeTool) {
      case 'point': {
        const fid = engine.createFeature({
          geometry: {
            type: 'Point',
            coordinates: evt.unproject(),
          },
        });
        engine.setActiveFeature(fid);
        return true;
      }
      case 'line': {
        if (engine.scene.activeFeature?.geometry?.type === 'LineString') {
          // Edit instead
          return false;
        }
        const fid = engine.createFeature({
          geometry: {
            type: 'LineString',
            coordinates: [evt.unproject()],
          },
        });
        engine.setActiveFeature(fid);
        return true;
      }
    }
  }
}
