// Drizzle schema for SoundChat.
//
// Tables:
//   profile       — singleton row (id = 1): the user's own identity in the app.
//   contacts      — people the user chats with (user-entered).
//   conversations — one 1-to-1 thread per contact.
//   messages      — text, shared-track, or snap messages inside a
//                   conversation. Track messages snapshot the catalog fields
//                   so history survives catalog changes. Snap messages are
//                   user-captured photos / short videos: the media bytes live
//                   in blob storage (media_blob_key) and the row keeps the
//                   filter, caption, and — for music-video snaps — a snapshot
//                   of the track that was playing while filming.
//   saved_tracks  — the user's library. A row exists when the track was
//                   saved (saved = 1) and/or played (play_count > 0), so
//                   "recently played" and "saved" share one table.

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const profile = sqliteTable("profile", {
  id: integer("id").primaryKey(),
  displayName: text("display_name").notNull(),
  handle: text("handle").notNull(),
  background: text("background").notNull().default("classic"),
  // Default disappearing-message timer for NEW chats, in seconds.
  // Null = off. 86400 (24 hours) is the secure-by-default value.
  defaultDisappearingSeconds: integer("default_disappearing_seconds").default(86400),
  // SoundChat Plus entitlements. plusActive = 1 while Plus is on;
  // plusStartedAt is when it was (last) turned on. ownedPacks is a
  // comma-separated list of one-time filter-pack ids the user owns
  // ("" = none). Billing is not wired to a payment processor yet —
  // these record the entitlement in the app only.
  plusActive: integer("plus_active").notNull().default(0),
  plusStartedAt: integer("plus_started_at", { mode: "timestamp_ms" }),
  ownedPacks: text("owned_packs").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  handle: text("handle"),
  note: text("note"),
  color: text("color").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Direct chats point at their one contact. Group chats keep contact_id
  // pointing at their first member (the column is NOT NULL with a foreign
  // key) and carry the real roster in conversation_members.
  contactId: integer("contact_id")
    .notNull()
    .references(() => contacts.id),
  kind: text("kind", { enum: ["direct", "group"] }).notNull().default("direct"),
  title: text("title"),
  // Disappearing-message timer for this chat, in seconds. Null = off
  // (messages stay until the chat is deleted). New messages snapshot an
  // expires_at from this value at send time; changing the timer does not
  // move messages that were already sent.
  disappearingSeconds: integer("disappearing_seconds").default(86400),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const conversationMembers = sqliteTable("conversation_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id),
  contactId: integer("contact_id")
    .notNull()
    .references(() => contacts.id),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id),
  sender: text("sender", { enum: ["me", "them"] }).notNull(),
  // In group chats, which member a "them" message is from (null = the user,
  // or a direct chat where the contact is implied).
  senderContactId: integer("sender_contact_id"),
  type: text("type", { enum: ["text", "track", "snap"] }).notNull(),
  text: text("text"),
  trackId: integer("track_id"),
  trackTitle: text("track_title"),
  artistName: text("artist_name"),
  albumName: text("album_name"),
  artworkUrl: text("artwork_url"),
  previewUrl: text("preview_url"),
  trackViewUrl: text("track_view_url"),
  durationMs: integer("duration_ms"),
  // Snap-only fields (null on text/track messages).
  mediaBlobKey: text("media_blob_key"),
  mediaKind: text("media_kind", { enum: ["photo", "video"] }),
  mediaContentType: text("media_content_type"),
  mediaDurationMs: integer("media_duration_ms"),
  filterId: text("filter_id"),
  caption: text("caption"),
  musicTrackId: integer("music_track_id"),
  musicTitle: text("music_title"),
  musicArtist: text("music_artist"),
  musicPreviewUrl: text("music_preview_url"),
  musicArtworkUrl: text("music_artwork_url"),
  musicTrackViewUrl: text("music_track_view_url"),
  // Music-video snaps only: 1 when the song was mixed into the recorded
  // video file itself (Web Audio mix at record time), so playing the video
  // plays the song with no extra tap. 0 = the song is only attached as
  // metadata and plays from the message card (the pre-fix behavior, and
  // the fallback when a browser can't do the mix).
  musicInVideo: integer("music_in_video").notNull().default(0),
  // Disappearing messages: when expires_at passes, the row (and its snap
  // media blob, if any) is deleted from storage on the next read — unless
  // kept = 1, which is the user's "Save this message" choice. Null
  // expires_at = this message never auto-disappears (sent while the
  // chat's timer was off, or before disappearing messages existed).
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  kept: integer("kept").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const playlists = sqliteTable("playlists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Playlist entries snapshot the catalog fields, like saved_tracks, so a
// playlist keeps working even if a catalog entry changes.
export const playlistTracks = sqliteTable("playlist_tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playlistId: integer("playlist_id")
    .notNull()
    .references(() => playlists.id),
  trackId: integer("track_id").notNull(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  album: text("album").notNull(),
  artworkUrl: text("artwork_url").notNull(),
  previewUrl: text("preview_url").notNull(),
  trackViewUrl: text("track_view_url").notNull(),
  durationMs: integer("duration_ms").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const savedTracks = sqliteTable("saved_tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trackId: integer("track_id").notNull().unique(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  album: text("album").notNull(),
  artworkUrl: text("artwork_url").notNull(),
  previewUrl: text("preview_url").notNull(),
  trackViewUrl: text("track_view_url").notNull(),
  durationMs: integer("duration_ms").notNull(),
  saved: integer("saved").notNull().default(1),
  // Set when the user downloads the track's 30s preview for offline play:
  // the audio bytes live in blob storage under this key.
  previewBlobKey: text("preview_blob_key"),
  playCount: integer("play_count").notNull().default(0),
  lastPlayedAt: integer("last_played_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
