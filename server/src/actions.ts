// Actions for SoundChat.
//
// User-owned data (profile, contacts, conversations, messages, library)
// lives in ctx.db. Music catalog data (search + charts) is fetched live
// from Apple's iTunes APIs inside the actions and returned as suggestions;
// a track is only persisted when the user saves it or sends it in a chat,
// at which point its fields are snapshotted onto the row. Snap messages
// (user-captured photos / short videos) keep their media bytes in ctx.blobs
// and snapshot the filter, caption, and music-video track onto the row.

import { defineAction, z, type ActionsModule, type Ctx } from "@hatch/space-sdk";
import { ZipContracts } from "@space/privileged";
import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import * as schema from "./schema";

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

const trackOut = z.object({
  trackId: z.number(),
  title: z.string(),
  artist: z.string(),
  album: z.string(),
  artworkUrl: z.string(),
  previewUrl: z.string(),
  trackViewUrl: z.string(),
  durationMs: z.number(),
  genre: z.string().nullable(),
});

const trackIn = z.object({
  trackId: z.number().int().positive(),
  title: z.string().trim().min(1).max(300),
  artist: z.string().trim().min(1).max(300),
  album: z.string().trim().max(300),
  artworkUrl: z.string().url().max(2000),
  previewUrl: z.string().url().max(2000),
  trackViewUrl: z.string().url().max(2000),
  durationMs: z.number().int().min(0).max(3600000),
  genre: z.string().max(100).nullable().optional(),
});

type TrackOut = z.infer<typeof trackOut>;

// ---------------------------------------------------------------------------
// Snaps (camera photos / short videos sent in a chat)
// ---------------------------------------------------------------------------

// Filter ids the camera offers. The client renders the same list; photo
// filters are baked into the captured image, so the id is mostly a label —
// except "none", which means the snap was sent as recorded.
const SNAP_FILTER_IDS = [
  "none",
  "rainbow-pop",
  "big-eyes",
  "dog-days",
  "star-crown",
  "bubbles",
  "golden-hour",
  "pixel-party",
  "comic-pop",
  "cool-shades",
  "smart-specs",
  "undercover",
  "cat-days",
  "top-hat",
  "snapback",
  "flower-crown",
  "bling",
  "clown-nose",
  // Face lenses (drawn artwork positioned from face landmarks). The
  // "plus" ones are SoundChat Plus lenses, each also in a filter pack.
  "shades",
  "star-shades",
  "specs",
  "masquerade",
  "puppy",
  "kitty",
  "bunny",
  "crown",
  "halo",
  "heart-cheeks",
  "gold-chain",
  "monocle",
  // Pro rebuild: shaded artwork lenses, the beauty look, and the
  // face-warp lenses (Mega Eyes / Puffy Face bend the photo itself).
  "beauty",
  "neon",
  "butterfly",
  "devil",
  "mega-eyes",
  "puffy",
  "alien",
] as const;

const SNAP_FILTER_NAMES: Record<string, string> = {
  none: "Original",
  "rainbow-pop": "Rainbow Pop",
  "big-eyes": "Big Eyes",
  "dog-days": "Dog Days",
  "star-crown": "Star Crown",
  bubbles: "Bubbles",
  "golden-hour": "Golden Hour",
  "pixel-party": "Pixel Party",
  "comic-pop": "Comic Pop",
  "cool-shades": "Cool Shades",
  "smart-specs": "Smart Specs",
  undercover: "Undercover",
  "cat-days": "Cat Days",
  "top-hat": "Top Hat",
  snapback: "Snapback",
  "flower-crown": "Flower Crown",
  bling: "Bling Bling",
  "clown-nose": "Clown Nose",
  shades: "Black Shades",
  "star-shades": "Star Shades",
  specs: "Round Specs",
  masquerade: "Masquerade",
  puppy: "Puppy",
  kitty: "Kitty",
  bunny: "Bunny",
  crown: "Royal Crown",
  halo: "Angel Halo",
  "heart-cheeks": "Heart Cheeks",
  "gold-chain": "Gold Chain",
  monocle: "Fancy Monocle",
  beauty: "Beauty Glow",
  neon: "Neon Glow",
  butterfly: "Butterflies",
  devil: "Little Devil",
  "mega-eyes": "Mega Eyes",
  puffy: "Puffy Face",
  alien: "Alien",
};

const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
const MAX_SNAP_BYTES = 10 * 1024 * 1024; // ~10 MB of media per snap (free)
const PLUS_SNAP_BYTES = 32 * 1024 * 1024; // Plus snaps can be bigger (longer videos)
const MAX_SNAP_VIDEO_MS = 65000; // hard schema ceiling = the Plus cap + slack
const FREE_SNAP_VIDEO_MS = 20000; // free clips are capped at 15s in the camera; slack for uploads
const PLUS_SNAP_VIDEO_MS = 65000; // Plus clips are capped at 60s in the camera; slack for uploads

// ---------------------------------------------------------------------------
// SoundChat Plus — freemium entitlements (see the profile schema comment).
// The caps are enforced here, server-side; the client mirrors them for UX.
// ---------------------------------------------------------------------------

const PLUS_BACKGROUND_IDS: readonly string[] = ["galaxy", "neon-nights", "reaper-fog", "mushroom-glow"];
const FILTER_PACK_IDS: readonly string[] = ["party-pack", "royal-pack"];
const FREE_PLAYLIST_LIMIT = 3;
const FREE_OFFLINE_LIMIT = 10;

interface Entitlements {
  plus: boolean;
  packs: string[];
}

async function getEntitlements(ctx: Ctx): Promise<Entitlements> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select({
      plusActive: schema.profile.plusActive,
      ownedPacks: schema.profile.ownedPacks,
    })
    .from(schema.profile)
    .limit(1);
  const row = rows[0];
  if (!row) return { plus: false, packs: [] };
  return {
    plus: row.plusActive === 1,
    packs: (row.ownedPacks ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => FILTER_PACK_IDS.includes(s)),
  };
}

const snapMusicOut = z.object({
  trackId: z.number(),
  title: z.string(),
  artist: z.string(),
  previewUrl: z.string(),
  artworkUrl: z.string(),
  trackViewUrl: z.string(),
});

const snapOut = z.object({
  mediaUrl: z.string(),
  mediaKind: z.enum(["photo", "video"]),
  contentType: z.string(),
  durationMs: z.number(),
  filterId: z.string(),
  filterName: z.string(),
  caption: z.string().nullable(),
  musicTrack: snapMusicOut.nullable(),
  // True when the song is mixed into the video file itself (music-video
  // snaps recorded with the Web Audio mix); false for older snaps and the
  // attached-only fallback.
  musicInVideo: z.boolean(),
});

const CONTACT_COLORS = [
  "#FF4D2E",
  "#FFB03A",
  "#2EC4B6",
  "#4D96FF",
  "#B983FF",
  "#FF6B9D",
  "#6BCB77",
  "#F473B9",
];

function colorForName(name: string, seed: number): string {
  let hash = seed;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return CONTACT_COLORS[hash % CONTACT_COLORS.length] ?? "#FF4D2E";
}

// ---------------------------------------------------------------------------
// Disappearing messages
//
// Every chat has a timer (seconds, null = off). A new message snapshots
// expires_at = sent-at + timer. When a chat is read, expired messages that
// the user has not saved (kept = 0) are deleted for real — the row and, for
// snaps, the media blob — not just hidden. Saved messages never expire.
// Allowed timer values are shared by the per-chat and default settings.
// ---------------------------------------------------------------------------

const DISAPPEARING_OPTIONS = [10, 60, 300, 3600, 86400, 604800] as const;
const disappearingSecondsIn = z
  .number()
  .int()
  .nullable()
  .refine((v) => v === null || (DISAPPEARING_OPTIONS as readonly number[]).includes(v), {
    message: "Pick one of the disappearing timer options.",
  });

async function purgeExpiredRows(
  ctx: Ctx,
  conversationId?: number,
): Promise<number> {
  const db = ctx.db<typeof schema>();
  const now = new Date();
  const where = conversationId
    ? and(
        eq(schema.messages.conversationId, conversationId),
        eq(schema.messages.kept, 0),
        lt(schema.messages.expiresAt, now),
      )
    : and(eq(schema.messages.kept, 0), lt(schema.messages.expiresAt, now));
  const expired = await db
    .select({ id: schema.messages.id, mediaBlobKey: schema.messages.mediaBlobKey })
    .from(schema.messages)
    .where(where);
  if (expired.length === 0) return 0;
  await db.delete(schema.messages).where(
    inArray(
      schema.messages.id,
      expired.map((r) => r.id),
    ),
  );
  for (const r of expired) {
    if (r.mediaBlobKey) {
      try {
        await ctx.blobs.delete(r.mediaBlobKey);
      } catch {
        // Best-effort: the row is gone, which is what privacy depends on.
      }
    }
  }
  return expired.length;
}

async function expiresAtForConversation(
  ctx: Ctx,
  conversationId: number,
): Promise<Date | null> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select({ disappearingSeconds: schema.conversations.disappearingSeconds })
    .from(schema.conversations)
    .where(eq(schema.conversations.id, conversationId))
    .limit(1);
  const secs = rows[0]?.disappearingSeconds ?? null;
  if (secs == null || secs <= 0) return null;
  return new Date(Date.now() + secs * 1000);
}

async function defaultDisappearingSeconds(ctx: Ctx): Promise<number | null> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select({ value: schema.profile.defaultDisappearingSeconds })
    .from(schema.profile)
    .limit(1);
  const v = rows[0]?.value;
  return v === undefined ? 86400 : v;
}

function normalizeHandle(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

// ---------------------------------------------------------------------------
// iTunes catalog mapping
// ---------------------------------------------------------------------------

interface ItunesSearchResult {
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
  trackTimeMillis?: number;
  primaryGenreName?: string;
}

function mapSearchResult(r: ItunesSearchResult): TrackOut | null {
  if (
    r.kind !== "song" ||
    typeof r.trackId !== "number" ||
    !r.trackName ||
    !r.artistName ||
    !r.previewUrl ||
    !r.artworkUrl100 ||
    !r.trackViewUrl
  ) {
    return null;
  }
  return {
    trackId: r.trackId,
    title: r.trackName,
    artist: r.artistName,
    album: r.collectionName ?? "",
    artworkUrl: r.artworkUrl100.replace("100x100bb.jpg", "200x200bb.jpg"),
    previewUrl: r.previewUrl,
    trackViewUrl: r.trackViewUrl,
    durationMs: r.trackTimeMillis ?? 0,
    genre: r.primaryGenreName ?? null,
  };
}

async function searchItunes(term: string, limit: number): Promise<TrackOut[]> {
  const params = new URLSearchParams({
    term,
    media: "music",
    entity: "song",
    limit: String(limit),
    country: "US",
  });
  const res = await fetch(`https://itunes.apple.com/search?${params.toString()}`);
  if (!res.ok) throw new Error(`Music search failed (${res.status}). Try again in a moment.`);
  const data = (await res.json()) as { results?: ItunesSearchResult[] };
  const out: TrackOut[] = [];
  for (const r of data.results ?? []) {
    const mapped = mapSearchResult(r);
    if (mapped) out.push(mapped);
  }
  return out;
}

interface RssLabel {
  label?: string;
}
interface RssEntry {
  "im:name"?: RssLabel;
  "im:artist"?: RssLabel;
  "im:image"?: { label?: string }[];
  "im:collection"?: { "im:name"?: RssLabel };
  category?: { attributes?: { label?: string } };
  id?: { attributes?: { "im:id"?: string } };
  link?: { attributes?: { rel?: string; href?: string } }[];
}

function mapRssEntry(e: RssEntry): TrackOut | null {
  const idRaw = e.id?.attributes?.["im:id"];
  const trackId = idRaw ? Number(idRaw) : NaN;
  const title = e["im:name"]?.label;
  const artist = e["im:artist"]?.label;
  if (!Number.isFinite(trackId) || !title || !artist) return null;
  let previewUrl: string | null = null;
  let trackViewUrl: string | null = null;
  for (const link of e.link ?? []) {
    const rel = link.attributes?.rel;
    const href = link.attributes?.href;
    if (!href) continue;
    if (rel === "enclosure") previewUrl = href;
    if (rel === "alternate") trackViewUrl = href;
  }
  const images = e["im:image"] ?? [];
  const artworkUrl = images[images.length - 1]?.label ?? null;
  if (!previewUrl || !trackViewUrl || !artworkUrl) return null;
  return {
    trackId,
    title,
    artist,
    album: e["im:collection"]?.["im:name"]?.label ?? "",
    artworkUrl,
    previewUrl,
    trackViewUrl,
    durationMs: 0,
    genre: e.category?.attributes?.label ?? null,
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const Actions = {
  getProfile: defineAction({
    description: "Returns the user's SoundChat profile (or null before setup) plus library/chat counts.",
    request: z.object({}),
    response: z.object({
      profile: z
        .object({
          displayName: z.string(),
          handle: z.string(),
          background: z.string(),
          defaultDisappearingSeconds: z.number().nullable(),
        })
        .nullable(),
      plus: z.object({
        active: z.boolean(),
        since: z.string().nullable(),
        packs: z.array(z.string()),
      }),
      stats: z.object({
        contacts: z.number(),
        conversations: z.number(),
        messages: z.number(),
        savedTracks: z.number(),
      }),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      await purgeExpiredRows(ctx);
      const rows = await db.select().from(schema.profile).limit(1);
      const contactRows = await db.select({ id: schema.contacts.id }).from(schema.contacts);
      const convRows = await db.select({ id: schema.conversations.id }).from(schema.conversations);
      const msgRows = await db.select({ id: schema.messages.id }).from(schema.messages);
      const savedRows = await db
        .select({ id: schema.savedTracks.id })
        .from(schema.savedTracks)
        .where(eq(schema.savedTracks.saved, 1));
      const row = rows[0];
      return {
        profile: row
          ? {
              displayName: row.displayName,
              handle: row.handle,
              background: row.background ?? "classic",
              defaultDisappearingSeconds:
                row.defaultDisappearingSeconds === undefined
                  ? 86400
                  : row.defaultDisappearingSeconds,
            }
          : null,
        plus: {
          active: row?.plusActive === 1,
          since: row?.plusStartedAt ? row.plusStartedAt.toISOString() : null,
          packs: (row?.ownedPacks ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter((s) => FILTER_PACK_IDS.includes(s)),
        },
        stats: {
          contacts: contactRows.length,
          conversations: convRows.length,
          messages: msgRows.length,
          savedTracks: savedRows.length,
        },
      };
    },
  }),

  saveProfile: defineAction({
    description: "Creates or updates the user's SoundChat profile (display name and handle).",
    request: z.object({
      displayName: z.string().trim().min(1).max(60),
      handle: z.string().trim().min(1).max(40),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const handle = normalizeHandle(args.handle) ?? args.handle;
      const existing = await db.select().from(schema.profile).limit(1);
      if (existing.length > 0) {
        await db
          .update(schema.profile)
          .set({ displayName: args.displayName, handle, updatedAt: new Date() })
          .where(eq(schema.profile.id, 1));
      } else {
        await db.insert(schema.profile).values({ id: 1, displayName: args.displayName, handle });
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  saveBackground: defineAction({
    description: "Saves the user's chosen app background theme.",
    request: z.object({
      background: z.enum([
        "classic",
        "pot-neon",
        "pot-haze",
        "mushroom-trip",
        "mushroom-glow",
        "skull-gothic",
        "skull-bone",
        "reaper-moon",
        "reaper-fog",
        "galaxy",
        "sunset",
        "neon-nights",
        "forest",
      ]),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      if (PLUS_BACKGROUND_IDS.includes(args.background)) {
        const ent = await getEntitlements(ctx);
        if (!ent.plus) {
          throw new Error("That background is a SoundChat Plus exclusive — turn on Plus to use it.");
        }
      }
      const existing = await db.select().from(schema.profile).limit(1);
      if (existing.length > 0) {
        await db
          .update(schema.profile)
          .set({ background: args.background, updatedAt: new Date() })
          .where(eq(schema.profile.id, 1));
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setPlus: defineAction({
    description:
      "Turns SoundChat Plus on or off for the user (premium lenses, exclusive backgrounds, 60s videos, unlimited playlists/offline, Plus badge). Records the entitlement on the profile; no payment is processed — checkout is not live yet.",
    request: z.object({ active: z.boolean() }),
    response: z.object({ ok: z.boolean(), active: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db.select().from(schema.profile).limit(1);
      if (existing.length === 0) {
        throw new Error("Set up your profile first — Plus attaches to it.");
      }
      await db
        .update(schema.profile)
        .set({
          plusActive: args.active ? 1 : 0,
          plusStartedAt: args.active ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(schema.profile.id, 1));
      ctx.invalidateQueries();
      return { ok: true, active: args.active };
    },
  }),

  unlockFilterPack: defineAction({
    description:
      "Records ownership of a one-time filter pack (party-pack or royal-pack), unlocking its lenses forever without a Plus subscription. No payment is processed — checkout is not live yet.",
    request: z.object({ packId: z.enum(["party-pack", "royal-pack"]) }),
    response: z.object({ ok: z.boolean(), packs: z.array(z.string()) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db.select().from(schema.profile).limit(1);
      const row = existing[0];
      if (!row) {
        throw new Error("Set up your profile first — packs attach to it.");
      }
      const packs = (row.ownedPacks ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => FILTER_PACK_IDS.includes(s));
      if (!packs.includes(args.packId)) packs.push(args.packId);
      await db
        .update(schema.profile)
        .set({ ownedPacks: packs.join(","), updatedAt: new Date() })
        .where(eq(schema.profile.id, 1));
      ctx.invalidateQueries();
      return { ok: true, packs };
    },
  }),

  setDefaultDisappearingTimer: defineAction({
    description: "Sets the default disappearing-message timer (seconds, or null for off) that new chats start with.",
    request: z.object({ seconds: disappearingSecondsIn }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db.select().from(schema.profile).limit(1);
      if (existing.length > 0) {
        await db
          .update(schema.profile)
          .set({ defaultDisappearingSeconds: args.seconds, updatedAt: new Date() })
          .where(eq(schema.profile.id, 1));
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setConversationDisappearingTimer: defineAction({
    description: "Sets one chat's disappearing-message timer (seconds, or null for off). Applies to messages sent from now on; already-sent messages keep the expiry they were sent with.",
    request: z.object({
      conversationId: z.number().int().positive(),
      seconds: disappearingSecondsIn,
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.conversations)
        .set({ disappearingSeconds: args.seconds })
        .where(eq(schema.conversations.id, args.conversationId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setMessageKept: defineAction({
    description: "Saves a message so it never disappears (kept = true), or un-saves it so its timer applies again.",
    request: z.object({
      messageId: z.number().int().positive(),
      kept: z.boolean(),
    }),
    response: z.object({ ok: z.boolean(), kept: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.messages)
        .set({ kept: args.kept ? 1 : 0 })
        .where(eq(schema.messages.id, args.messageId));
      ctx.invalidateQueries();
      return { ok: true, kept: args.kept };
    },
  }),

  deleteMessageNow: defineAction({
    description: "Deletes a single message right away, including its snap photo/video file if it has one.",
    request: z.object({ messageId: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select({ mediaBlobKey: schema.messages.mediaBlobKey })
        .from(schema.messages)
        .where(eq(schema.messages.id, args.messageId))
        .limit(1);
      await db.delete(schema.messages).where(eq(schema.messages.id, args.messageId));
      const key = rows[0]?.mediaBlobKey;
      if (key) {
        try {
          await ctx.blobs.delete(key);
        } catch {
          // Best-effort; the row is already gone.
        }
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  purgeExpiredMessages: defineAction({
    description: "Deletes every expired, unsaved message across all chats right now and returns how many were removed.",
    request: z.object({}),
    response: z.object({ ok: z.boolean(), deleted: z.number() }),
    async handler(ctx) {
      const deleted = await purgeExpiredRows(ctx);
      if (deleted > 0) ctx.invalidateQueries();
      return { ok: true, deleted };
    },
  }),

  listContacts: defineAction({
    description: "Lists the user's contacts, newest first.",
    request: z.object({}),
    response: z.object({
      contacts: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          handle: z.string().nullable(),
          note: z.string().nullable(),
          color: z.string(),
          createdAt: z.string(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.contacts)
        .orderBy(desc(schema.contacts.createdAt));
      return {
        contacts: rows.map((r) => ({
          id: r.id,
          name: r.name,
          handle: r.handle,
          note: r.note,
          color: r.color,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  addContact: defineAction({
    description: "Adds a contact by name with an optional handle and note.",
    request: z.object({
      name: z.string().trim().min(1).max(80),
      handle: z.string().trim().max(40).optional(),
      note: z.string().trim().max(200).optional(),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db.select({ id: schema.contacts.id }).from(schema.contacts);
      const result = await db
        .insert(schema.contacts)
        .values({
          name: args.name,
          handle: normalizeHandle(args.handle),
          note: args.note?.trim() ? args.note.trim() : null,
          color: colorForName(args.name, existing.length),
        })
        .returning({ id: schema.contacts.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addContact: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateContact: defineAction({
    description: "Updates a contact's name, handle, or note.",
    request: z.object({
      id: z.number().int().positive(),
      name: z.string().trim().min(1).max(80),
      handle: z.string().trim().max(40).optional(),
      note: z.string().trim().max(200).optional(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.contacts)
        .set({
          name: args.name,
          handle: normalizeHandle(args.handle),
          note: args.note?.trim() ? args.note.trim() : null,
        })
        .where(eq(schema.contacts.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteContact: defineAction({
    description: "Deletes a contact along with its conversations and messages.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const convs = await db
        .select({ id: schema.conversations.id })
        .from(schema.conversations)
        .where(eq(schema.conversations.contactId, args.id));
      const snapRows =
        convs.length > 0
          ? await db
              .select({ mediaBlobKey: schema.messages.mediaBlobKey })
              .from(schema.messages)
              .where(
                inArray(
                  schema.messages.conversationId,
                  convs.map((c) => c.id),
                ),
              )
          : [];
      const statements: BatchItem<"sqlite">[] = [];
      if (convs.length > 0) {
        statements.push(
          db.delete(schema.messages).where(
            inArray(
              schema.messages.conversationId,
              convs.map((c) => c.id),
            ),
          ),
        );
        statements.push(
          db.delete(schema.conversationMembers).where(
            inArray(
              schema.conversationMembers.conversationId,
              convs.map((c) => c.id),
            ),
          ),
        );
        statements.push(
          db.delete(schema.conversations).where(eq(schema.conversations.contactId, args.id)),
        );
      }
      // Also remove this contact from any groups it was only a member of.
      statements.push(
        db
          .delete(schema.conversationMembers)
          .where(eq(schema.conversationMembers.contactId, args.id)),
      );
      statements.push(db.delete(schema.contacts).where(eq(schema.contacts.id, args.id)));
      const [first, ...rest] = statements;
      if (first) await db.batch([first, ...rest]);
      for (const r of snapRows) {
        if (r.mediaBlobKey) {
          try {
            await ctx.blobs.delete(r.mediaBlobKey);
          } catch {
            // Blob cleanup is best-effort; the rows are already gone.
          }
        }
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listConversations: defineAction({
    description: "Lists conversations (direct and group) with their people and most recent message, most recently active first.",
    request: z.object({}),
    response: z.object({
      conversations: z.array(
        z.object({
          id: z.number(),
          kind: z.enum(["direct", "group"]),
          title: z.string().nullable(),
          disappearingSeconds: z.number().nullable(),
          contact: z
            .object({
              id: z.number(),
              name: z.string(),
              handle: z.string().nullable(),
              color: z.string(),
            })
            .nullable(),
          members: z.array(
            z.object({
              id: z.number(),
              name: z.string(),
              handle: z.string().nullable(),
              color: z.string(),
            }),
          ),
          lastMessage: z
            .object({
              sender: z.enum(["me", "them"]),
              type: z.enum(["text", "track", "snap"]),
              preview: z.string(),
              createdAt: z.string(),
            })
            .nullable(),
          updatedAt: z.string(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      await purgeExpiredRows(ctx);
      const convs = await db
        .select()
        .from(schema.conversations)
        .orderBy(desc(schema.conversations.updatedAt));
      const contactRows = await db.select().from(schema.contacts);
      const contactById = new Map(contactRows.map((c) => [c.id, c]));
      const memberRows = await db.select().from(schema.conversationMembers);
      const membersByConv = new Map<number, typeof contactRows>();
      for (const mr of memberRows) {
        const c = contactById.get(mr.contactId);
        if (!c) continue;
        const list = membersByConv.get(mr.conversationId) ?? [];
        list.push(c);
        membersByConv.set(mr.conversationId, list);
      }
      const lite = (c: (typeof contactRows)[number]) => ({
        id: c.id,
        name: c.name,
        handle: c.handle,
        color: c.color,
      });
      const out = [];
      for (const conv of convs) {
        const isGroup = conv.kind === "group";
        const anchor = contactById.get(conv.contactId);
        if (!isGroup && !anchor) continue;
        const members = (membersByConv.get(conv.id) ?? []).map(lite);
        if (isGroup && members.length === 0) continue;
        const last = await db
          .select()
          .from(schema.messages)
          .where(eq(schema.messages.conversationId, conv.id))
          .orderBy(desc(schema.messages.id))
          .limit(1);
        const m = last[0];
        out.push({
          id: conv.id,
          kind: conv.kind,
          title: conv.title,
          disappearingSeconds: conv.disappearingSeconds ?? null,
          contact: !isGroup && anchor ? lite(anchor) : null,
          members: isGroup ? members : anchor ? [lite(anchor)] : [],
          lastMessage: m
            ? {
                sender: m.sender,
                type: m.type,
                preview:
                  m.type === "track"
                    ? `♪ ${m.trackTitle ?? "Song"} — ${m.artistName ?? ""}`
                    : m.type === "snap"
                      ? m.musicTrackId != null
                        ? `Music video snap · ${m.musicTitle ?? "song"}`
                        : m.mediaKind === "video"
                          ? "Video snap"
                          : "Photo snap"
                      : (m.text ?? ""),
                createdAt: m.createdAt.toISOString(),
              }
            : null,
          updatedAt: conv.updatedAt.toISOString(),
        });
      }
      return { conversations: out };
    },
  }),

  getOrCreateConversation: defineAction({
    description: "Returns the 1-to-1 conversation with a contact, creating it if none exists yet.",
    request: z.object({ contactId: z.number().int().positive() }),
    response: z.object({ conversationId: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select()
        .from(schema.conversations)
        .where(
          and(
            eq(schema.conversations.contactId, args.contactId),
            eq(schema.conversations.kind, "direct"),
          ),
        )
        .limit(1);
      const found = existing[0];
      if (found) return { conversationId: found.id };
      const contact = await db
        .select({ id: schema.contacts.id })
        .from(schema.contacts)
        .where(eq(schema.contacts.id, args.contactId))
        .limit(1);
      if (contact.length === 0) throw new Error("That contact no longer exists.");
      const result = await db
        .insert(schema.conversations)
        .values({
          contactId: args.contactId,
          disappearingSeconds: await defaultDisappearingSeconds(ctx),
        })
        .returning({ id: schema.conversations.id });
      const inserted = result[0];
      if (!inserted) throw new Error("getOrCreateConversation: insert returned no rows");
      ctx.invalidateQueries();
      return { conversationId: inserted.id };
    },
  }),

  createGroupConversation: defineAction({
    description: "Creates a group chat with two or more contacts, with an optional group name.",
    request: z.object({
      title: z.string().trim().max(60).optional(),
      contactIds: z.array(z.number().int().positive()).min(2).max(12),
    }),
    response: z.object({ conversationId: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const uniqueIds = [...new Set(args.contactIds)];
      if (uniqueIds.length < 2) throw new Error("Pick at least two people for a group chat.");
      const contacts = await db
        .select()
        .from(schema.contacts)
        .where(inArray(schema.contacts.id, uniqueIds));
      if (contacts.length !== uniqueIds.length) {
        throw new Error("One of those contacts no longer exists.");
      }
      const first = contacts[0];
      if (!first) throw new Error("Pick at least two people for a group chat.");
      const title =
        args.title?.trim() ||
        contacts
          .map((c) => c.name.split(/\s+/)[0] ?? c.name)
          .slice(0, 3)
          .join(", ") + (contacts.length > 3 ? ` +${contacts.length - 3}` : "");
      const result = await db
        .insert(schema.conversations)
        .values({
          contactId: first.id,
          kind: "group",
          title,
          disappearingSeconds: await defaultDisappearingSeconds(ctx),
        })
        .returning({ id: schema.conversations.id });
      const inserted = result[0];
      if (!inserted) throw new Error("createGroupConversation: insert returned no rows");
      const statements: BatchItem<"sqlite">[] = contacts.map((c) =>
        db
          .insert(schema.conversationMembers)
          .values({ conversationId: inserted.id, contactId: c.id }),
      );
      const [head, ...rest] = statements;
      if (head) await db.batch([head, ...rest]);
      ctx.invalidateQueries();
      return { conversationId: inserted.id };
    },
  }),

  listMessages: defineAction({
    description: "Lists all messages in a conversation, oldest first.",
    request: z.object({ conversationId: z.number().int().positive() }),
    response: z.object({
      disappearingSeconds: z.number().nullable(),
      messages: z.array(
        z.object({
          id: z.number(),
          sender: z.enum(["me", "them"]),
          senderContactId: z.number().nullable(),
          type: z.enum(["text", "track", "snap"]),
          text: z.string().nullable(),
          track: trackOut.nullable(),
          snap: snapOut.nullable(),
          createdAt: z.string(),
          expiresAt: z.string().nullable(),
          kept: z.boolean(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      // Disappearing messages are deleted for real before anything is read.
      await purgeExpiredRows(ctx, args.conversationId);
      const convRows = await db
        .select({ disappearingSeconds: schema.conversations.disappearingSeconds })
        .from(schema.conversations)
        .where(eq(schema.conversations.id, args.conversationId))
        .limit(1);
      const rows = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, args.conversationId))
        .orderBy(asc(schema.messages.id));
      const messages = [];
      for (const r of rows) {
        let snap: z.infer<typeof snapOut> | null = null;
        if (r.type === "snap" && r.mediaBlobKey && r.mediaKind) {
          snap = {
            mediaUrl: await ctx.blobs.getUrl(r.mediaBlobKey),
            mediaKind: r.mediaKind,
            contentType: r.mediaContentType ?? "",
            durationMs: r.mediaDurationMs ?? 0,
            filterId: r.filterId ?? "none",
            filterName: SNAP_FILTER_NAMES[r.filterId ?? "none"] ?? "Original",
            caption: r.caption,
            musicTrack:
              r.musicTrackId != null
                ? {
                    trackId: r.musicTrackId,
                    title: r.musicTitle ?? "Unknown song",
                    artist: r.musicArtist ?? "",
                    previewUrl: r.musicPreviewUrl ?? "",
                    artworkUrl: r.musicArtworkUrl ?? "",
                    trackViewUrl: r.musicTrackViewUrl ?? "",
                  }
                : null,
            musicInVideo: (r.musicInVideo ?? 0) === 1,
          };
        }
        messages.push({
          id: r.id,
          sender: r.sender,
          senderContactId: r.senderContactId ?? null,
          type: r.type,
          text: r.text,
          track:
            r.type === "track" && r.trackId != null
              ? {
                  trackId: r.trackId,
                  title: r.trackTitle ?? "Unknown song",
                  artist: r.artistName ?? "",
                  album: r.albumName ?? "",
                  artworkUrl: r.artworkUrl ?? "",
                  previewUrl: r.previewUrl ?? "",
                  trackViewUrl: r.trackViewUrl ?? "",
                  durationMs: r.durationMs ?? 0,
                  genre: null,
                }
              : null,
          snap,
          createdAt: r.createdAt.toISOString(),
          expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
          kept: r.kept === 1,
        });
      }
      return {
        disappearingSeconds: convRows[0]?.disappearingSeconds ?? null,
        messages,
      };
    },
  }),

  sendTextMessage: defineAction({
    description: "Sends a text message in a conversation, as the user or as the contact (for testing both sides).",
    request: z.object({
      conversationId: z.number().int().positive(),
      // The client encrypts message text on-device before sending (the
      // stored value is ciphertext), so the limit leaves room for the
      // encryption envelope over a 2,000-character message.
      text: z.string().trim().min(1).max(8000),
      sender: z.enum(["me", "them"]).default("me"),
      senderContactId: z.number().int().positive().nullable().optional(),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const result = await db
        .insert(schema.messages)
        .values({
          conversationId: args.conversationId,
          sender: args.sender,
          senderContactId: args.sender === "them" ? (args.senderContactId ?? null) : null,
          type: "text",
          text: args.text,
          expiresAt: await expiresAtForConversation(ctx, args.conversationId),
        })
        .returning({ id: schema.messages.id });
      const inserted = result[0];
      if (!inserted) throw new Error("sendTextMessage: insert returned no rows");
      await db
        .update(schema.conversations)
        .set({ updatedAt: new Date() })
        .where(eq(schema.conversations.id, args.conversationId));
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  sendTrackMessage: defineAction({
    description: "Shares a song (with playable preview) into a conversation as a track message.",
    request: z.object({
      conversationId: z.number().int().positive(),
      track: trackIn,
      sender: z.enum(["me", "them"]).default("me"),
      senderContactId: z.number().int().positive().nullable().optional(),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const t = args.track;
      const result = await db
        .insert(schema.messages)
        .values({
          conversationId: args.conversationId,
          sender: args.sender,
          senderContactId: args.sender === "them" ? (args.senderContactId ?? null) : null,
          type: "track",
          trackId: t.trackId,
          trackTitle: t.title,
          artistName: t.artist,
          albumName: t.album,
          artworkUrl: t.artworkUrl,
          previewUrl: t.previewUrl,
          trackViewUrl: t.trackViewUrl,
          durationMs: t.durationMs,
          expiresAt: await expiresAtForConversation(ctx, args.conversationId),
        })
        .returning({ id: schema.messages.id });
      const inserted = result[0];
      if (!inserted) throw new Error("sendTrackMessage: insert returned no rows");
      await db
        .update(schema.conversations)
        .set({ updatedAt: new Date() })
        .where(eq(schema.conversations.id, args.conversationId));
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  sendSnapMessage: defineAction({
    description:
      "Sends a camera snap (photo or short video, media sent as base64) into a conversation, with its filter, caption, optional music-video track, and whether the song was mixed into the video file itself.",
    request: z.object({
      conversationId: z.number().int().positive(),
      sender: z.enum(["me", "them"]).default("me"),
      senderContactId: z.number().int().positive().nullable().optional(),
      mediaKind: z.enum(["photo", "video"]),
      // Media as base64 (4/3 overhead). The ceiling fits a Plus-size snap
      // (32 MB); the handler re-checks the decoded byte size against the
      // sender's tier (10 MB free / 32 MB Plus).
      dataBase64: z.string().min(1).max(44_000_000),
      mimeType: z.string().trim().min(1).max(80),
      durationMs: z.number().int().min(0).max(MAX_SNAP_VIDEO_MS).default(0),
      filterId: z.enum(SNAP_FILTER_IDS).default("none"),
      // Captions are encrypted on-device before sending, like message text;
      // the limit leaves room for the encryption envelope over 140 chars.
      caption: z.string().trim().max(700).optional(),
      musicTrack: trackIn.nullable().optional(),
      // Music-video snaps: true when the song was mixed into the recorded
      // video file itself, so the card can say so accurately.
      musicInVideo: z.boolean().default(false),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const allowed: readonly string[] =
        args.mediaKind === "photo" ? PHOTO_MIME_TYPES : VIDEO_MIME_TYPES;
      if (!allowed.includes(args.mimeType)) {
        throw new Error(
          args.mediaKind === "photo"
            ? "That photo format isn't supported here — JPEG, PNG, or WebP works."
            : "That video format isn't supported here — MP4 or WebM works.",
        );
      }
      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(atob(args.dataBase64), (c) => c.charCodeAt(0));
      } catch {
        throw new Error("That snap's data came through garbled. Try capturing it again.");
      }
      if (bytes.length === 0) throw new Error("That snap came through empty. Try again.");
      const ent = await getEntitlements(ctx);
      const byteCap = ent.plus ? PLUS_SNAP_BYTES : MAX_SNAP_BYTES;
      if (bytes.length > byteCap) {
        throw new Error(
          ent.plus
            ? "That snap is too big to send (about 32 MB max). Try a shorter clip."
            : "That snap is too big to send (about 10 MB max). Try a shorter clip.",
        );
      }
      if (args.mediaKind === "video") {
        const durationCap = ent.plus ? PLUS_SNAP_VIDEO_MS : FREE_SNAP_VIDEO_MS;
        if (args.durationMs > durationCap) {
          throw new Error(
            ent.plus
              ? "That video is longer than a Plus snap (60 seconds max)."
              : "That video is longer than a free snap (15 seconds max) — SoundChat Plus stretches snaps to 60 seconds.",
          );
        }
      }
      const conv = await db
        .select({ id: schema.conversations.id })
        .from(schema.conversations)
        .where(eq(schema.conversations.id, args.conversationId))
        .limit(1);
      if (conv.length === 0) throw new Error("That chat no longer exists.");
      const ext =
        args.mimeType === "image/png"
          ? "png"
          : args.mimeType === "image/webp"
            ? "webp"
            : args.mimeType === "video/webm"
              ? "webm"
              : args.mimeType === "video/quicktime"
                ? "mov"
                : args.mediaKind === "photo"
                  ? "jpg"
                  : "mp4";
      const blobKey = `snaps/${args.conversationId}/${Date.now()}-${Math.floor(Math.random() * 1e9)}.${ext}`;
      await ctx.blobs.put(blobKey, bytes, { contentType: args.mimeType });
      const music = args.musicTrack ?? null;
      const result = await db
        .insert(schema.messages)
        .values({
          conversationId: args.conversationId,
          sender: args.sender,
          senderContactId: args.sender === "them" ? (args.senderContactId ?? null) : null,
          type: "snap",
          mediaBlobKey: blobKey,
          mediaKind: args.mediaKind,
          mediaContentType: args.mimeType,
          mediaDurationMs: args.mediaKind === "video" ? args.durationMs : 0,
          filterId: args.filterId,
          caption: args.caption?.trim() ? args.caption.trim() : null,
          musicTrackId: music?.trackId ?? null,
          musicTitle: music?.title ?? null,
          musicArtist: music?.artist ?? null,
          musicPreviewUrl: music?.previewUrl ?? null,
          musicArtworkUrl: music?.artworkUrl ?? null,
          musicTrackViewUrl: music?.trackViewUrl ?? null,
          musicInVideo: args.mediaKind === "video" && args.musicInVideo ? 1 : 0,
          expiresAt: await expiresAtForConversation(ctx, args.conversationId),
        })
        .returning({ id: schema.messages.id });
      const inserted = result[0];
      if (!inserted) throw new Error("sendSnapMessage: insert returned no rows");
      await db
        .update(schema.conversations)
        .set({ updatedAt: new Date() })
        .where(eq(schema.conversations.id, args.conversationId));
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  deleteConversation: defineAction({
    description: "Deletes a conversation and all of its messages (the contact stays).",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const snapRows = await db
        .select({ mediaBlobKey: schema.messages.mediaBlobKey })
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, args.id));
      await db.batch([
        db.delete(schema.messages).where(eq(schema.messages.conversationId, args.id)),
        db
          .delete(schema.conversationMembers)
          .where(eq(schema.conversationMembers.conversationId, args.id)),
        db.delete(schema.conversations).where(eq(schema.conversations.id, args.id)),
      ]);
      for (const r of snapRows) {
        if (r.mediaBlobKey) {
          try {
            await ctx.blobs.delete(r.mediaBlobKey);
          } catch {
            // Blob cleanup is best-effort; the rows are already gone.
          }
        }
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  searchTracks: defineAction({
    description: "Searches the Apple Music catalog for songs with playable 30-second previews.",
    request: z.object({
      query: z.string().trim().min(1).max(120),
      limit: z.number().int().min(1).max(50).default(25),
    }),
    response: z.object({ tracks: z.array(trackOut) }),
    async handler(_ctx, args) {
      const tracks = await searchItunes(args.query, args.limit);
      return { tracks };
    },
  }),

  getTopTracks: defineAction({
    description: "Returns the current US Top Songs chart with playable previews.",
    request: z.object({}),
    response: z.object({ tracks: z.array(trackOut) }),
    async handler() {
      try {
        const res = await fetch("https://itunes.apple.com/us/rss/topsongs/limit=30/json");
        if (!res.ok) throw new Error(`chart ${res.status}`);
        const data = (await res.json()) as { feed?: { entry?: RssEntry[] } };
        const tracks: TrackOut[] = [];
        for (const e of data.feed?.entry ?? []) {
          const mapped = mapRssEntry(e);
          if (mapped) tracks.push(mapped);
        }
        if (tracks.length > 0) return { tracks };
        throw new Error("chart empty");
      } catch {
        // Fallback: broad catalog search so the Music tab still works.
        const tracks = await searchItunes("pop hits", 25);
        return { tracks };
      }
    },
  }),

  listLibrary: defineAction({
    description: "Lists the user's saved songs and recently played songs, including which previews are downloaded for offline play.",
    request: z.object({}),
    response: z.object({
      saved: z.array(
        trackOut.extend({
          playCount: z.number(),
          offline: z.boolean(),
          offlineUrl: z.string().nullable(),
        }),
      ),
      recent: z.array(
        trackOut.extend({
          playCount: z.number(),
          offline: z.boolean(),
          offlineUrl: z.string().nullable(),
        }),
      ),
      savedTrackIds: z.array(z.number()),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.savedTracks);
      const toOut = async (r: (typeof rows)[number]) => ({
        trackId: r.trackId,
        title: r.title,
        artist: r.artist,
        album: r.album,
        artworkUrl: r.artworkUrl,
        previewUrl: r.previewUrl,
        trackViewUrl: r.trackViewUrl,
        durationMs: r.durationMs,
        genre: null,
        playCount: r.playCount,
        offline: r.previewBlobKey != null,
        offlineUrl: r.previewBlobKey ? await ctx.blobs.getUrl(r.previewBlobKey) : null,
      });
      const savedRows = rows
        .filter((r) => r.saved === 1)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const recentRows = rows
        .filter((r) => r.lastPlayedAt != null)
        .sort((a, b) => (b.lastPlayedAt?.getTime() ?? 0) - (a.lastPlayedAt?.getTime() ?? 0))
        .slice(0, 10);
      const saved = await Promise.all(savedRows.map(toOut));
      const recent = await Promise.all(recentRows.map(toOut));
      return { saved, recent, savedTrackIds: saved.map((t) => t.trackId) };
    },
  }),

  makeTrackOffline: defineAction({
    description:
      "Downloads a song's 30-second preview into SoundChat storage so it can play offline (from the app's own storage instead of Apple's servers). Also saves the song to the library.",
    request: z.object({ track: trackIn }),
    response: z.object({ ok: z.boolean(), sizeBytes: z.number(), offlineUrl: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const t = args.track;
      // Free accounts hold up to FREE_OFFLINE_LIMIT offline downloads;
      // re-downloading a song that's already offline doesn't count again.
      const ent = await getEntitlements(ctx);
      if (!ent.plus) {
        const offlineRows = await db
          .select({ trackId: schema.savedTracks.trackId, previewBlobKey: schema.savedTracks.previewBlobKey })
          .from(schema.savedTracks);
        const offlineIds = new Set(
          offlineRows.filter((r) => r.previewBlobKey != null).map((r) => r.trackId),
        );
        if (!offlineIds.has(t.trackId) && offlineIds.size >= FREE_OFFLINE_LIMIT) {
          throw new Error(
            `Free accounts get up to ${FREE_OFFLINE_LIMIT} offline downloads — SoundChat Plus makes them unlimited.`,
          );
        }
      }
      let res: Response;
      try {
        res = await fetch(t.previewUrl);
      } catch {
        throw new Error("Couldn't reach the preview to download it. Check your connection and try again.");
      }
      if (!res.ok) throw new Error(`The preview download failed (${res.status}). Try again in a moment.`);
      const contentType = res.headers.get("content-type") ?? "";
      if (
        contentType &&
        !contentType.includes("audio") &&
        !contentType.includes("octet-stream") &&
        !contentType.includes("mp4")
      ) {
        throw new Error("That link didn't return audio, so it can't be saved for offline play.");
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length === 0) throw new Error("That preview came back empty. Try again.");
      if (buf.length > 3 * 1024 * 1024) {
        throw new Error("That preview is bigger than expected for a 30-second clip, so it wasn't saved.");
      }
      const blobKey = `previews/${t.trackId}.m4a`;
      await ctx.blobs.put(blobKey, buf, { contentType: contentType || "audio/mp4" });
      const existing = await db
        .select()
        .from(schema.savedTracks)
        .where(eq(schema.savedTracks.trackId, t.trackId))
        .limit(1);
      const row = existing[0];
      if (row) {
        await db
          .update(schema.savedTracks)
          .set({ saved: 1, previewBlobKey: blobKey })
          .where(eq(schema.savedTracks.id, row.id));
      } else {
        await db.insert(schema.savedTracks).values({
          trackId: t.trackId,
          title: t.title,
          artist: t.artist,
          album: t.album,
          artworkUrl: t.artworkUrl,
          previewUrl: t.previewUrl,
          trackViewUrl: t.trackViewUrl,
          durationMs: t.durationMs,
          saved: 1,
          previewBlobKey: blobKey,
        });
      }
      ctx.invalidateQueries();
      return { ok: true, sizeBytes: buf.length, offlineUrl: await ctx.blobs.getUrl(blobKey) };
    },
  }),

  removeTrackOffline: defineAction({
    description: "Removes a song's downloaded offline preview (the song stays in the library).",
    request: z.object({ trackId: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select()
        .from(schema.savedTracks)
        .where(eq(schema.savedTracks.trackId, args.trackId))
        .limit(1);
      const row = existing[0];
      if (row?.previewBlobKey) {
        try {
          await ctx.blobs.delete(row.previewBlobKey);
        } catch {
          // Best-effort; clearing the pointer below is what matters.
        }
        await db
          .update(schema.savedTracks)
          .set({ previewBlobKey: null })
          .where(eq(schema.savedTracks.id, row.id));
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listPlaylists: defineAction({
    description: "Lists the user's playlists with their songs, in the order they were added.",
    request: z.object({}),
    response: z.object({
      playlists: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          createdAt: z.string(),
          tracks: z.array(trackOut),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const lists = await db
        .select()
        .from(schema.playlists)
        .orderBy(asc(schema.playlists.createdAt));
      const entries = await db
        .select()
        .from(schema.playlistTracks)
        .orderBy(asc(schema.playlistTracks.id));
      return {
        playlists: lists.map((p) => ({
          id: p.id,
          name: p.name,
          createdAt: p.createdAt.toISOString(),
          tracks: entries
            .filter((e) => e.playlistId === p.id)
            .map((e) => ({
              trackId: e.trackId,
              title: e.title,
              artist: e.artist,
              album: e.album,
              artworkUrl: e.artworkUrl,
              previewUrl: e.previewUrl,
              trackViewUrl: e.trackViewUrl,
              durationMs: e.durationMs,
              genre: null,
            })),
        })),
      };
    },
  }),

  createPlaylist: defineAction({
    description: "Creates a new empty playlist with the given name. Free accounts hold up to 3 playlists; SoundChat Plus is unlimited.",
    request: z.object({ name: z.string().trim().min(1).max(60) }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const ent = await getEntitlements(ctx);
      if (!ent.plus) {
        const existing = await db.select({ id: schema.playlists.id }).from(schema.playlists);
        if (existing.length >= FREE_PLAYLIST_LIMIT) {
          throw new Error(
            `Free accounts get up to ${FREE_PLAYLIST_LIMIT} playlists — SoundChat Plus makes them unlimited.`,
          );
        }
      }
      const result = await db
        .insert(schema.playlists)
        .values({ name: args.name })
        .returning({ id: schema.playlists.id });
      const inserted = result[0];
      if (!inserted) throw new Error("createPlaylist: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  renamePlaylist: defineAction({
    description: "Renames a playlist.",
    request: z.object({
      id: z.number().int().positive(),
      name: z.string().trim().min(1).max(60),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.playlists)
        .set({ name: args.name })
        .where(eq(schema.playlists.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deletePlaylist: defineAction({
    description: "Deletes a playlist and its song list (the songs stay in the library).",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db.batch([
        db.delete(schema.playlistTracks).where(eq(schema.playlistTracks.playlistId, args.id)),
        db.delete(schema.playlists).where(eq(schema.playlists.id, args.id)),
      ]);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  addTrackToPlaylist: defineAction({
    description: "Adds a song to a playlist (no duplicate if it's already in there).",
    request: z.object({
      playlistId: z.number().int().positive(),
      track: trackIn,
    }),
    response: z.object({ added: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const list = await db
        .select({ id: schema.playlists.id })
        .from(schema.playlists)
        .where(eq(schema.playlists.id, args.playlistId))
        .limit(1);
      if (list.length === 0) throw new Error("That playlist no longer exists.");
      const existing = await db
        .select({ id: schema.playlistTracks.id })
        .from(schema.playlistTracks)
        .where(
          and(
            eq(schema.playlistTracks.playlistId, args.playlistId),
            eq(schema.playlistTracks.trackId, args.track.trackId),
          ),
        )
        .limit(1);
      if (existing.length > 0) return { added: false };
      const t = args.track;
      await db.insert(schema.playlistTracks).values({
        playlistId: args.playlistId,
        trackId: t.trackId,
        title: t.title,
        artist: t.artist,
        album: t.album,
        artworkUrl: t.artworkUrl,
        previewUrl: t.previewUrl,
        trackViewUrl: t.trackViewUrl,
        durationMs: t.durationMs,
      });
      ctx.invalidateQueries();
      return { added: true };
    },
  }),

  removeTrackFromPlaylist: defineAction({
    description: "Removes a song from a playlist.",
    request: z.object({
      playlistId: z.number().int().positive(),
      trackId: z.number().int().positive(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.playlistTracks)
        .where(
          and(
            eq(schema.playlistTracks.playlistId, args.playlistId),
            eq(schema.playlistTracks.trackId, args.trackId),
          ),
        );
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  toggleSaveTrack: defineAction({
    description: "Saves a song to the library, or removes it if already saved.",
    request: z.object({ track: trackIn }),
    response: z.object({ saved: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const t = args.track;
      const existing = await db
        .select()
        .from(schema.savedTracks)
        .where(eq(schema.savedTracks.trackId, t.trackId))
        .limit(1);
      const row = existing[0];
      if (row && row.saved === 1) {
        if (row.playCount > 0) {
          await db
            .update(schema.savedTracks)
            .set({ saved: 0 })
            .where(eq(schema.savedTracks.id, row.id));
        } else {
          await db.delete(schema.savedTracks).where(eq(schema.savedTracks.id, row.id));
        }
        ctx.invalidateQueries();
        return { saved: false };
      }
      if (row) {
        await db
          .update(schema.savedTracks)
          .set({ saved: 1 })
          .where(eq(schema.savedTracks.id, row.id));
      } else {
        await db.insert(schema.savedTracks).values({
          trackId: t.trackId,
          title: t.title,
          artist: t.artist,
          album: t.album,
          artworkUrl: t.artworkUrl,
          previewUrl: t.previewUrl,
          trackViewUrl: t.trackViewUrl,
          durationMs: t.durationMs,
          saved: 1,
        });
      }
      ctx.invalidateQueries();
      return { saved: true };
    },
  }),

  logPlay: defineAction({
    description: "Records that the user played a song, updating play count and recently played.",
    request: z.object({ track: trackIn }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const t = args.track;
      const existing = await db
        .select()
        .from(schema.savedTracks)
        .where(eq(schema.savedTracks.trackId, t.trackId))
        .limit(1);
      const row = existing[0];
      if (row) {
        await db
          .update(schema.savedTracks)
          .set({ playCount: row.playCount + 1, lastPlayedAt: new Date() })
          .where(eq(schema.savedTracks.id, row.id));
      } else {
        await db.insert(schema.savedTracks).values({
          trackId: t.trackId,
          title: t.title,
          artist: t.artist,
          album: t.album,
          artworkUrl: t.artworkUrl,
          previewUrl: t.previewUrl,
          trackViewUrl: t.trackViewUrl,
          durationMs: t.durationMs,
          saved: 0,
          playCount: 1,
          lastPlayedAt: new Date(),
        });
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  exportSoundchatSource: defineAction({
    description:
      "Builds the SoundChat v2 source zip for GitHub, stores it as a downloadable file, and returns its name, size, and download URL.",
    request: z.object({}),
    response: z.object({
      ok: z.boolean(),
      version: z.string(),
      fileName: z.string(),
      sizeBytes: z.number(),
      blobKey: z.string(),
      downloadUrl: z.string(),
    }),
    privileged: [
      ZipContracts["zip:buildSoundchatExport"],
      ZipContracts["zip:putExportBlob"],
    ],
    async handler(ctx) {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(new Date());
      const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
      const version = `v2-${part("year")}${part("month")}${part("day")}-${part("hour")}${part("minute")}`;
      const fileName = "soundchat-v2-source.zip";
      const blobKey = "exports/soundchat-v2-source.zip";

      const built = await ctx.executePrivileged(ZipContracts["zip:buildSoundchatExport"], {
        version,
      });

      // Durable copy in artifact blob storage — this backs downloadUrl.
      const bytes = Uint8Array.from(atob(built.dataBase64), (c) => c.charCodeAt(0));
      await ctx.blobs.put(blobKey, bytes, { contentType: "application/zip" });

      // Mirror through the privileged blob helper for the byte-download path.
      try {
        await ctx.executePrivileged(ZipContracts["zip:putExportBlob"], {
          blobKey,
          bytesBase64: built.dataBase64,
          contentType: "application/zip",
        });
      } catch {
        // The ctx.blobs copy above is the source of truth; the mirror is a fallback.
      }

      const downloadUrl = await ctx.blobs.getUrl(blobKey);
      return {
        ok: true,
        version,
        fileName,
        sizeBytes: built.byteLength,
        blobKey,
        downloadUrl,
      };
    },
  }),

  getSoundchatExportDownload: defineAction({
    description:
      "Returns the stored SoundChat source zip bytes (base64) for an in-page download, with the blob download URL as a fallback.",
    request: z.object({ blobKey: z.string().trim().min(1).max(300) }),
    response: z.object({
      ok: z.boolean(),
      blobKey: z.string(),
      fileName: z.string(),
      contentType: z.string(),
      sizeBytes: z.number(),
      dataBase64: z.string().nullable(),
      downloadUrl: z.string().nullable(),
    }),
    privileged: [ZipContracts["zip:getExportBlob"]],
    async handler(ctx, args) {
      const fileName = "soundchat-v2-source.zip";
      let downloadUrl: string | null = null;
      try {
        downloadUrl = await ctx.blobs.getUrl(args.blobKey);
      } catch {
        downloadUrl = null;
      }
      try {
        const got = await ctx.executePrivileged(ZipContracts["zip:getExportBlob"], {
          blobKey: args.blobKey,
        });
        return {
          ok: true,
          blobKey: args.blobKey,
          fileName,
          contentType: got.contentType || "application/zip",
          sizeBytes: got.byteLength,
          dataBase64: got.dataBase64,
          downloadUrl,
        };
      } catch {
        if (!downloadUrl) {
          throw new Error("That export is not stored anymore. Build a fresh one and try again.");
        }
        const head = await ctx.blobs.head(args.blobKey);
        return {
          ok: true,
          blobKey: args.blobKey,
          fileName,
          contentType: head?.contentType ?? "application/zip",
          sizeBytes: head?.sizeBytes ?? 0,
          dataBase64: null,
          downloadUrl,
        };
      }
    },
  }),
} satisfies ActionsModule;
