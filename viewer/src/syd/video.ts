// Symbol videos pack RGB in the left half and the alpha matte in the right half of each frame.
// Draw the left half, then multiply in the right half's luminance as alpha.
export class AlphaVideo {
  canvas = document.createElement('canvas');
  video = document.createElement('video');
  private ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  private matte = document.createElement('canvas');
  private raf = 0;
  constructor(src: string) {
    this.video.src = src; this.video.muted = true; this.video.playsInline = true; this.video.preload = 'auto'; this.video.crossOrigin = 'anonymous';
    this.canvas.className = 'vid';
    this.video.addEventListener('loadedmetadata', () => { this.canvas.width = this.video.videoWidth / 2; this.canvas.height = this.video.videoHeight; this.matte.width = this.canvas.width; this.matte.height = this.canvas.height; });
    this.video.addEventListener('loadeddata', () => this.draw());
  }
  draw() {
    const v = this.video, w = this.canvas.width, h = this.canvas.height; if (!w || !h || v.readyState < 2) return;
    const c = this.ctx; c.clearRect(0, 0, w, h); c.drawImage(v, 0, 0, w, h, 0, 0, w, h);
    const m = this.matte.getContext('2d', { willReadFrequently: true })!; m.drawImage(v, w, 0, w, h, 0, 0, w, h);
    const rgb = c.getImageData(0, 0, w, h), a = m.getImageData(0, 0, w, h).data, d = rgb.data;
    for (let i = 0; i < d.length; i += 4) d[i + 3] = a[i];
    c.putImageData(rgb, 0, 0);
  }
  play() { this.video.currentTime = 0; this.video.play().catch(() => {}); const loop = () => { this.draw(); if (!this.video.paused && !this.video.ended) this.raf = requestAnimationFrame(loop); }; cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(loop); }
  stop() { cancelAnimationFrame(this.raf); this.video.pause(); this.video.currentTime = 0; }
}
