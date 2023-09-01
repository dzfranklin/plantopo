import { SyncEngine } from '../../api/SyncEngine';
import { InteractionEvent, InteractionHandler } from './InteractionManager';
import * as GeoJSON from 'geojson';

export class CreateFeatureHandler implements InteractionHandler {
  onPress(evt: InteractionEvent, engine: SyncEngine): boolean {
    const geometry: GeoJSON.Point = {
      type: 'Point',
      coordinates: evt.unproject(),
    };
    engine.fCreate({
      geometry,
    });
    return true;
  }
}
