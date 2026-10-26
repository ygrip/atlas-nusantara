import { DataTexture, NearestFilter, RedFormat, Vector2, Vector4 } from 'three';

export interface IndexedRegion { id: number; bbox: [number, number, number, number]; rings: Vector2[][] }

/**
 * Region identities rasterised over a configurable map-plane rectangle.
 * Province detail gets its own high-resolution window rather than stretching national pixels over a city.
 */
export class RegionIndex {
  readonly texture: DataTexture;
  readonly bounds = new Vector4(0, 0, 1000, 500);
  private readonly ids: Uint8Array;

  constructor(private readonly width: number, private readonly height: number) {
    this.ids = new Uint8Array(width * height);
    this.texture = new DataTexture(this.ids, width, height, RedFormat);
    this.texture.magFilter = NearestFilter;
    this.texture.minFilter = NearestFilter;
    this.texture.needsUpdate = true;
  }

  set(regions: IndexedRegion[], rectangle: [number, number, number, number] = [0, 0, 1000, 500]): void {
    this.ids.fill(0);
    this.bounds.set(...rectangle);
    if (regions.length === 0) { this.texture.needsUpdate = true; return; }
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw Error('Region index canvas unavailable');
    const scaleX = this.width / this.bounds.z;
    const scaleY = this.height / this.bounds.w;
    for (const region of regions) {
      const left = Math.max(0, Math.floor((region.bbox[0] - this.bounds.x) * scaleX) - 1);
      const top = Math.max(0, Math.floor((region.bbox[1] - this.bounds.y) * scaleY) - 1);
      const right = Math.min(this.width, Math.ceil((region.bbox[2] - this.bounds.x) * scaleX) + 1);
      const bottom = Math.min(this.height, Math.ceil((region.bbox[3] - this.bounds.y) * scaleY) + 1);
      const width = right - left;
      const height = bottom - top;
      if (width <= 0 || height <= 0) continue;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(left, top, width, height);
      context.setTransform(scaleX, 0, 0, scaleY, -this.bounds.x * scaleX, -this.bounds.y * scaleY);
      context.fillStyle = '#fff';
      context.beginPath();
      for (const ring of region.rings) {
        ring.forEach((point, index) => {
          if (index === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        context.closePath();
      }
      context.fill('evenodd');
      const pixels = context.getImageData(left, top, width, height).data;
      for (let row = 0; row < height; row++) {
        for (let column = 0; column < width; column++) {
          if (pixels[(row * width + column) * 4] >= 128) this.ids[(top + row) * this.width + left + column] = region.id;
        }
      }
    }
    this.texture.needsUpdate = true;
  }

  sample(x: number, y: number): number {
    const u = (x - this.bounds.x) / this.bounds.z;
    const v = (y - this.bounds.y) / this.bounds.w;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return 0;
    return this.ids[Math.floor(v * this.height) * this.width + Math.floor(u * this.width)];
  }

  dispose(): void { this.texture.dispose(); }
}
