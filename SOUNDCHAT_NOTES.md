# SoundChat notes — what this export is, and what standalone still needs

## What you downloaded

The exact v2 source that runs as Bill's Muse web artifact: React client,
typed server actions, Drizzle schema + migrations, and the four background
illustrations. User data (profile, contacts, chats, saved songs) is NOT in
this zip — it lives in the artifact's own database and was left out on
purpose, along with build output, node_modules, and credentials (there are
none in this project).

## Muse-specific pieces (the parts that only exist inside Muse)

- server/src/actions.ts uses defineAction / ctx from @hatch/space-sdk.
  ctx.db is the per-artifact SQLite database, ctx.blobs is artifact file
  storage, and ctx.executePrivileged runs the host-side helpers in
  server/src/privileged.ts (used only by the source-export download).
- client/src/api.ts builds its typed client from the Actions type with
  createActionClient from @hatch/space-sdk/client.
- client/build.mjs delegates bundling to @hatch/space-sdk/build.
- The artifact package.json (kept in docs as the original reference inside
  this export's git history) points @hatch/space-sdk at a local file path
  that only exists on Muse's machines. That is why the zip ships a
  standalone package.json at the repo root instead.

## Running standalone — what is already here

- Root package.json: normal npm dependencies (React 19, TanStack Query,
  Drizzle ORM, Zod, Vite, Tailwind 4, TypeScript).
- vite.config.ts + root index.html + tsconfig.json: a Vite starter wired to
  the client source.
- .env.example: the (empty, for now) environment template — v2 needs no API
  keys; the iTunes APIs are public.

## What a standalone deployment still needs (not in v2, not faked here)

1. A small HTTP server that implements the same action contract the client
   calls (profile, contacts, conversations, messages, library, music proxy)
   over the Drizzle schema in server/src/schema.ts — or port the actions to
   your framework of choice (Next.js, Hono, Express).
2. A SQLite file (or hosted DB) created from the drizzle/ migrations.
3. Real accounts + a calling network (WebRTC, e.g. LiveKit/Twilio) before
   calls can ring another person's device or carry music to both ends. The
   v2 call is an on-device preview by design.
4. File storage for snap media and offline previews: inside Muse, both
   live in ctx.blobs; standalone, point the sendSnapMessage and
   makeTrackOffline actions at any blob or object store and serve the
   files back at the URLs the list actions return. Camera capture itself
   is plain browser APIs (getUserMedia + MediaRecorder + canvas), no Muse
   pieces involved.
5. Message/snap encryption is client-side WebCrypto (AES-256-GCM) and
   works standalone as-is — the key is generated in the browser and kept
   in local storage, never sent to any server. A standalone host still
   only ever stores ciphertext for texts, captions, and snap media.
   Disappearing messages are server-side: messages carry expires_at /
   kept columns, list actions delete expired unsaved rows (and their
   snap blobs) before reading, and the setConversationDisappearingTimer /
   setMessageKept / deleteMessageNow / purgeExpiredMessages actions
   carry the feature — port those with the rest of the action contract.
6. Spotify login, if you ever want Spotify playback instead of iTunes
   previews — that needs a Spotify developer app and OAuth, which v2 does
   not include.

Treat this zip as the saved source of truth for v2. The Muse artifact stays
the fastest place to keep building; push new exports here whenever you want
a fresh backup.
