import { CameraPosition } from '../CameraPosition';
import { Scene } from '../api/SyncEngine/Scene';

interface RenderTree {
  camera: CameraPosition;
}

export class Renderer {
  render(scene: Scene, camera: CameraPosition): RenderTree {
    return { camera };
  }
}
