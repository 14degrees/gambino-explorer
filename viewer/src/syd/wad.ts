// Parse a syd .wad.xml package: XML wrapping JSON blobs.
export type Frame = { frame: { x: number; y: number; w: number; h: number }; sourceSize: { w: number; h: number }; spriteSourceSize: { x: number; y: number; w: number; h: number }; ninePatch?: any };
export type SpriteSheet = { frames: Frame[]; meta: { image: string } };
export type Glyph = { x: number; y: number; w: number; h: number; xo: number; yo: number; xa: number };
export type Font = { base: number; lineHeight: number; page: string; chars: Record<number, Glyph> };
export type Node = { type: string; properties?: Record<string, any>; children?: number[]; actions?: number[]; stateMachine?: number; effect?: string[]; blend?: { destinationFactor?: string } };
export type Scene = { nodes: Node[]; actions?: any[]; states?: any[]; transitions?: any[]; rules?: any[] };
export type Wad = {
  scenes: Record<string, Scene>;
  sprites: Record<string, SpriteSheet>;
  fonts: Record<string, Font>;
  textures: Record<string, { webp?: string; png?: string }>; // texture id -> hashed CDN paths
  videos: Record<string, { webm?: string; mp4?: string }>;
  audio: Record<string, { ogg?: string; mp3?: string }>;
};

export function parseWad(xml: string): Wad {
  const blocks = (tag: string) => [...xml.matchAll(new RegExp(`<${tag} id="([^"]+)">(.*?)</${tag}>`, 'gs'))];
  const w: Wad = { scenes: {}, sprites: {}, fonts: {}, textures: {}, videos: {}, audio: {} };
  for (const [, id, body] of blocks('scene')) { try { w.scenes[id] = JSON.parse(body).resource; } catch {} }
  for (const [, id, body] of blocks('sprite')) { try { w.sprites[id] = JSON.parse(body).resource; } catch {} }
  for (const [, id, body] of blocks('font')) {
    const common = /<common base="(\d+)" lineHeight="(\d+)"/.exec(body);
    const page = /<page file="([^"]+)"/.exec(body)?.[1];
    if (!common || !page) continue;
    const chars: Record<number, Glyph> = {};
    for (const m of body.matchAll(/<char ([^>]*)\/>/g)) {
      const a: Record<string, number> = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map(([, k, v]) => [k, Number(v)]));
      chars[a.id] = { x: a.x ?? 0, y: a.y ?? 0, w: a.width ?? 0, h: a.height ?? 0, xo: a.xoffset ?? 0, yo: a.yoffset ?? 0, xa: a.xadvance ?? 0 };
    }
    w.fonts[id] = { base: +common[1], lineHeight: +common[2], page, chars };
  }
  const sources = (body: string) => [...body.matchAll(/<(?:source|webgl) path="([^"]+)" type="([^"]+)"/g)].map(([, p, t]) => ({ path: p, type: t }));
  for (const [, id, body] of blocks('texture')) { const t: any = {}; for (const s of sources(body)) t[s.type.endsWith('webp') ? 'webp' : 'png'] = s.path; w.textures[id] = t; }
  for (const [, id, body] of blocks('video')) { const t: any = {}; for (const s of sources(body)) t[s.type.endsWith('webm') ? 'webm' : 'mp4'] = s.path; w.videos[id] = t; }
  for (const [, id, body] of blocks('audio')) { const t: any = {}; for (const s of sources(body)) t[s.type.endsWith('ogg') ? 'ogg' : 'mp3'] = s.path; w.audio[id] = t; }
  return w;
}

// Merge several packages (slot + slot_bg) into one namespace.
export function mergeWads(...wads: Wad[]): Wad {
  const out: Wad = { scenes: {}, sprites: {}, fonts: {}, textures: {}, videos: {}, audio: {} };
  for (const w of wads) for (const k of Object.keys(out) as (keyof Wad)[]) Object.assign(out[k], w[k]);
  return out;
}

export const cdn = (hashedPath: string) => '/cdn/' + hashedPath.split('/').map(encodeURIComponent).join('/');
