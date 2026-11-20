// Privileged (host-side) helpers for SoundChat.
//
// This module runs on the host (Bun), not in the sandboxed action worker, so
// it may use the filesystem and fetch. It exposes three typed contracts:
//
//   zip:buildSoundchatExport — assembles the GitHub source zip (store-only
//                              ZIP built by hand: local headers, central
//                              directory, CRC-32) from the text manifest in
//                              export-manifest.ts plus the four background
//                              WebP illustrations read from disk.
//   zip:putExportBlob        — stores the built zip bytes (blob mirror/cache
//                              used by the download path).
//   zip:getExportBlob        — reads stored zip bytes back for download.
//
// Action code never imports this file; it imports the descriptors from
// "@space/privileged" (generated from the contracts below) and calls
// ctx.executePrivileged(...).

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { definePrivilegedContracts, definePrivilegedHandlers, z } from "@hatch/space-sdk";
import { SOURCE_BINARY_FILES, SOURCE_TEXT_FILES } from "./export-manifest";

export const ZipContracts = definePrivilegedContracts({
  "zip:buildSoundchatExport": {
    request: z.object({ version: z.string().min(1).max(40) }),
    response: z.object({ dataBase64: z.string(), byteLength: z.number().int().nonnegative() }),
    timeoutMs: 60000,
  },
  "zip:putExportBlob": {
    request: z.object({
      blobKey: z.string().min(1).max(300),
      bytesBase64: z.string(),
      contentType: z.string().min(1).max(120),
    }),
    response: z.object({ ok: z.literal(true), byteLength: z.number().int().nonnegative() }),
    timeoutMs: 60000,
  },
  "zip:getExportBlob": {
    request: z.object({ blobKey: z.string().min(1).max(300) }),
    response: z.object({
      dataBase64: z.string(),
      contentType: z.string(),
      byteLength: z.number().int().nonnegative(),
    }),
    timeoutMs: 60000,
  },
});

// ---------------------------------------------------------------------------
// Host context helpers (the daemon may pass helpers as a second argument;
// every use is optional and falls back to plain Bun fs/fetch below).
// ---------------------------------------------------------------------------

interface HostCtx {
  spaceDir?: string;
  readAssetFile?: (name: string) => Promise<Uint8Array | string>;
  fetchUrlAsBytes?: (url: string) => Promise<Uint8Array>;
  blobs?: {
    put?: (key: string, data: Uint8Array, options?: { contentType?: string }) => Promise<void>;
    get?: (key: string) => Promise<Uint8Array | null>;
  };
}

function spaceRoot(host?: HostCtx): string {
  if (host?.spaceDir) return host.spaceDir;
  // server/src/privileged.ts -> the space root is two directories up.
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

const ASSET_FILES: Record<string, string> = {
  pot: "bg-pot-leaf.webp",
  mushroom: "bg-mushroom.webp",
  skull: "bg-skull.webp",
  reaper: "bg-reaper.webp",
};

async function readBinaryAsset(asset: string, host?: HostCtx): Promise<Uint8Array> {
  const fileName = ASSET_FILES[asset];
  if (!fileName) throw new Error(`Unknown background asset: ${asset}`);
  if (host?.readAssetFile) {
    try {
      const data = await host.readAssetFile(fileName);
      return typeof data === "string" ? new TextEncoder().encode(data) : data;
    } catch {
      // fall through to the filesystem copy
    }
  }
  const path = join(spaceRoot(host), "client", "src", "assets", fileName);
  return new Uint8Array(await readFile(path));
}

// ---------------------------------------------------------------------------
// Minimal ZIP writer (store-only, no compression) with CRC-32.
// ---------------------------------------------------------------------------

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (CRC_TABLE[(crc ^ (data[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  const time =
    ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() >> 1) & 0x1f);
  const date =
    (((Math.max(1980, d.getFullYear()) - 1980) & 0x7f) << 9) |
    (((d.getMonth() + 1) & 0xf) << 5) |
    (d.getDate() & 0x1f);
  return { time, date };
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const now = dosDateTime(new Date());
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // store
    local.setUint16(10, now.time, true);
    local.setUint16(12, now.date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    const localBytes = new Uint8Array(local.buffer);
    chunks.push(localBytes, nameBytes, entry.data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, now.time, true);
    cd.setUint16(14, now.date, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, size, true);
    cd.setUint32(24, size, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nameBytes);

    offset += localBytes.length + nameBytes.length + size;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of central) centralSize += c.length;

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, centralStart, true);

  const total = centralStart + centralSize + 22;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of [...chunks, ...central]) {
    out.set(c, pos);
    pos += c.length;
  }
  out.set(new Uint8Array(end.buffer), pos);
  return out;
}

// ---------------------------------------------------------------------------
// Export blob mirror: a small on-disk cache under the space root so the
// privileged get path can round-trip what put stored, independent of the
// worker's blob index. The action ALSO stores via ctx.blobs (the durable
// copy behind downloadUrl); this mirror is the fallback byte source.
// ---------------------------------------------------------------------------

function cachePathForKey(root: string, blobKey: string): string {
  const safe = blobKey.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return join(root, ".export-cache", safe);
}

function blobObjectPath(root: string, blobKey: string): string {
  const objectId = createHash("sha256").update(blobKey, "utf8").digest("hex");
  return join(root, "blobs", "objects", objectId.slice(0, 2), objectId);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const ZipHandlers = definePrivilegedHandlers(ZipContracts, {
  "zip:buildSoundchatExport": async (args, host?: HostCtx) => {
    const encoder = new TextEncoder();
    const entries: ZipEntry[] = [];
    const top = "soundchat-v2";
    entries.push({
      name: `${top}/VERSION.txt`,
      data: encoder.encode(
        `SoundChat ${args.version}\nExported ${new Date().toISOString()}\nSource export for GitHub — see README.md and docs/TERMUX_GITHUB_UPLOAD.md.\n`,
      ),
    });
    for (const f of SOURCE_TEXT_FILES) {
      entries.push({ name: `${top}/${f.path}`, data: encoder.encode(f.content) });
    }
    for (const f of SOURCE_BINARY_FILES) {
      entries.push({ name: `${top}/${f.path}`, data: await readBinaryAsset(f.asset, host) });
    }
    const zip = buildZip(entries);
    return { dataBase64: Buffer.from(zip).toString("base64"), byteLength: zip.length };
  },

  "zip:putExportBlob": async (args, host?: HostCtx) => {
    const bytes = new Uint8Array(Buffer.from(args.bytesBase64, "base64"));
    if (host?.blobs?.put) {
      try {
        await host.blobs.put(args.blobKey, bytes, { contentType: args.contentType });
        return { ok: true as const, byteLength: bytes.length };
      } catch {
        // fall through to the mirror cache
      }
    }
    const root = spaceRoot(host);
    const cachePath = cachePathForKey(root, args.blobKey);
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, bytes);
    return { ok: true as const, byteLength: bytes.length };
  },

  "zip:getExportBlob": async (args, host?: HostCtx) => {
    const root = spaceRoot(host);
    if (host?.blobs?.get) {
      try {
        const data = await host.blobs.get(args.blobKey);
        if (data) {
          return {
            dataBase64: Buffer.from(data).toString("base64"),
            contentType: "application/zip",
            byteLength: data.length,
          };
        }
      } catch {
        // fall through to disk sources
      }
    }
    // 1) mirror cache written by zip:putExportBlob
    try {
      const data = new Uint8Array(await readFile(cachePathForKey(root, args.blobKey)));
      return {
        dataBase64: Buffer.from(data).toString("base64"),
        contentType: "application/zip",
        byteLength: data.length,
      };
    } catch {
      // 2) the worker blob store's object file for this key
    }
    const data = new Uint8Array(await readFile(blobObjectPath(root, args.blobKey)));
    return {
      dataBase64: Buffer.from(data).toString("base64"),
      contentType: "application/zip",
      byteLength: data.length,
    };
  },
});
