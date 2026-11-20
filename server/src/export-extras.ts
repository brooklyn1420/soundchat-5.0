// Standalone-repo extra files bundled into the SoundChat source export zip.
// These are NOT part of the running Muse web artifact — they only exist so
// the downloaded zip is a useful, self-describing GitHub repo: a README with
// Termux upload steps, a standalone package.json (npm deps instead of the
// artifact's internal SDK path), Vite/tsconfig starters, and honest notes
// about what still needs wiring to run outside Muse.

export const EXPORT_VERSION_BASE = "v2";

export const README_MD = `# SoundChat

SoundChat is a music messaging platform — Spotify-style music discovery and
playback combined with TextNow-style 1-to-1 messaging. You set up a profile,
add contacts, chat with them, and share songs that actually play: every shared
track carries a real 30-second preview.

This repo is the SoundChat v2 source, exported from the Muse web artifact so
the code is never lost again. It is a backup / starting point: the app as
exported runs inside Muse's web-artifact runtime (typed server actions +
per-app database). See SOUNDCHAT_NOTES.md for exactly what is Muse-specific
and what a standalone deployment still needs.

## What's in v2

- Profile setup (display name + handle), stored per user
- Contacts: add, edit, delete, with colored initial avatars
- 1-to-1 chat threads: text messages, plus track messages that play a
  30-second preview right in the thread
- Music tab: live US Top Songs chart and catalog search (Apple iTunes APIs,
  no API key), genre chips, playable previews
- Library: save songs with the heart, recently played, play counts
- 13 backgrounds, picked in Profile: Midnight Leaf, Emerald Haze,
  Mushroom Trip, Cosmic Shrooms, Skulls & Roses, Bone Stack, Grim Reaper,
  Reaper Fog, Galaxy Nebula, Ocean Sunset, Neon Nights, Forest Mist, and the
  classic default
- Call preview in every 1-to-1 chat: ringing, timer, mute, speaker, and
  "Play a song over the call" — the track plays low under the voices with an
  adjustable music level, is shared into the thread, and the call is logged
  in the chat when you hang up
- Snaps in every chat (camera button): take a photo or a short video
  (up to 15 seconds; 60 with Plus) with your camera, or upload one.
  Twenty-six filters: seventeen face lenses drawn as shaded artwork on
  your face — Black Shades, Star Shades, Round Specs, Masquerade,
  Puppy, Kitty, Bunny, Royal Crown, Flower Crown, Angel Halo, Heart
  Cheeks, Gold Chain, Fancy Monocle, Beauty Glow, Neon Glow,
  Butterflies, Little Devil — plus three face-warp lenses that bend
  your real face (Mega Eyes, Puffy Face, Alien), five color looks
  (Rainbow Pop, Golden Hour, Bubbles, Comic Pop, Pixel Party), and
  Original. The lens art is shaded like the big apps: metallic and
  glass gradients, gloss, soft shadows, glows, and blend modes. The
  old emoji-sticker filters were thrown out. Lenses are positioned
  from face landmarks: on browsers with the built-in FaceDetector API
  the lens follows your face live and tilts with your head; everywhere
  else it sits on an on-screen guide ring (the app says which).
  Warp lenses preview live on a canvas. Lenses and warps bake into
  photos and record right into videos through a canvas stream; if a
  browser can't do the canvas recording, the video records plain and
  the review says so. Lenses add things ON — they can't take off real
  glasses or a hat you're wearing. Nine lenses are SoundChat Plus
  lenses (also sold as two one-time filter packs).
  Music
  video mode mixes the song right into the recorded video: the preview
  is fetched and decoded with Web Audio and mixed with your microphone
  into the recorder's stream, so the video file itself plays the song in
  sync — in the review, in the chat, and in a file saved to the device.
  If a browser can't do the mix, it falls back to the old behavior and
  says so: the song plays out loud while filming and is attached to the
  snap to play from the message. Star mode goes one
  step further: pick a song, take or upload a photo of yourself, and the
  app bakes it into a music-video star frame — stage grade, spotlight,
  and a "STARRING YOU" banner naming the song — so you are the singer in
  the shot, with the song attached to play from the snap. Honest limit:
  Star mode stars your real photo in a music-video frame; it does not
  swap your face into the artist's actual video footage, which would
  need a dedicated video-AI service. Snaps are stored
  with the chat (media in blob storage, details in the messages table)
- Camera Studio (the big Camera button in the bottom bar, and on the
  Chats tab): take a photo or video WITHOUT picking a contact first.
  After the shot, a real editor opens: photos can change filter, crop
  (Full / Square / Portrait / Story), and get text stamped on them
  (top / middle / bottom), all re-baked from the original shot; videos
  can be trimmed with start / end sliders (re-recorded in the browser;
  if a browser can't trim, it says so and offers the full clip). Then
  either send it — the chat is picked at send time — or save the
  finished file straight to the device. Music video and Star modes in
  the Studio start with the song you're already listening to
- Watch view: tap the mini-player and the song gets a full-screen
  animated stage — the album artwork slowly zooms over its own blurred
  backdrop with a turning glow, drifting notes, and a seek bar — plus
  one-tap "Film a music video to this song". Honest limit: the visuals
  are animated from the album artwork; the artist's official video is
  not streamed, and what's playing is the 30-second preview
- Group chats: start a group from the Chats tab with two or more contacts —
  group texting, song sharing, snaps, and a group call preview with the
  same play-a-song-over-the-call mix, all in one thread
- Playlists: make playlists in the Library, add any song with the list
  icon, rename / delete / curate them
- Offline previews: the download arrow on a library song stores its
  30-second preview inside SoundChat so it plays without Apple's servers.
  Full songs are not downloadable — Apple only offers the previews
- On-device encryption: new text messages, snap photos/videos, and snap
  captions are encrypted in the browser (AES-256-GCM, WebCrypto) before
  they are saved, with a key that is generated on the device and never
  uploaded — storage only holds scrambled ciphertext for those. Song
  shares and call log lines are not encrypted (catalog / call metadata)
- Disappearing messages: every chat has a timer (10 seconds, 1 minute,
  5 minutes, 1 hour, 24 hours, or 7 days — 24 hours by default, set per
  chat or as the new-chat default in Profile). When a message's timer
  runs out it is deleted from storage for real, snap media files
  included. Tapping Save under a message keeps that one for good;
  Delete now removes one immediately, and Profile can purge every
  expired message on demand. Messages sent before this feature arrived
  have no timer
- SoundChat Plus (freemium): the core app is free — chat, listen,
  share. Plus ($4.99/month) unlocks the nine premium AR lenses,
  four exclusive backgrounds (Galaxy Nebula, Neon Nights, Reaper Fog,
  Cosmic Shrooms), 60-second snap videos, unlimited playlists and
  offline downloads (free: 3 playlists, 10 offline songs), and a Plus
  badge on the profile. The premium lenses are also sold as two
  one-time filter packs ($1.99 each, yours forever). Entitlements live
  on the profile row (migration 0008) and the caps are enforced in the
  actions. No ads that track users, and user data is never sold.
  Honest limit: checkout is not live — activating Plus or a pack
  records the entitlement in the app and charges nothing yet; a real
  payment processor is future work.

Honest limits on the privacy side: the encryption key lives in the
browser on the device, so anyone with the unlocked device and browser
can read the chats, and messages from before encryption arrived are
stored as they were. SoundChat is not decentralized yet — chats live in
its own database and contacts live on one device, so there is no
peer-to-peer network between phones today. Decentralization and true
phone-to-phone end-to-end encryption need real accounts on separate
devices first; that is the road ahead, not something this version claims.

Honest limit: the call is a preview on one device. Contacts live on that
device, so it does not ring a real phone or send audio to another person yet.
Real two-ended calling needs accounts and a calling network (for example
WebRTC) — that is the next big build, not something v2 claims to do.
Snaps live on the same device too, in the chat where you sent them.
Face lenses bake into photos and record into videos through a canvas
stream (then trimmed in the editor if you want); on a browser without
canvas-stream recording the video records plain and says so. In a music
video the song is mixed into the video file itself while filming (Web
Audio mix of the decoded preview + your mic), so it plays with the video
anywhere. Music videos recorded before that fix — and any recorded on a
browser where the mix fails — carry the track attached to the snap
instead, and the message says which one it is.

## Repo layout

~~~
client/            React UI (Vite-style entry in client/index.html)
  src/App.tsx      The whole app: chats, music, library, profile, call UI
  src/api.ts       Typed client for the server actions
  src/assets/      Background artwork (4 WebP illustrations, 13 looks)
server/
  src/actions.ts   Server actions: profile, contacts, chats, music, library,
                   and the source-export actions
  src/schema.ts    Drizzle SQLite schema
drizzle/           SQL migrations for the schema
docs/
  TERMUX_GITHUB_UPLOAD.md   Step-by-step: phone -> GitHub with Termux
SOUNDCHAT_NOTES.md What is Muse-specific and how to run this standalone
~~~

## Upload this to GitHub from your phone (Termux)

The short version — full steps with explanations are in
docs/TERMUX_GITHUB_UPLOAD.md:

~~~sh
pkg update && pkg install -y git gh unzip
termux-setup-storage
cd ~/storage/downloads
unzip soundchat-v2-source.zip
cd soundchat-v2
git init
git add .
git commit -m "SoundChat v2 source"
gh auth login
gh repo create soundchat-platform --private --source=. --remote=origin --push
~~~

Use --public instead of --private if you want the repo public. If a repo
named soundchat-platform already exists under your account, the guide shows
how to push into that existing repo instead.

## Music data

Search and charts come from Apple's public iTunes APIs at runtime
(itunes.apple.com search + US Top Songs RSS). No key, no account. Saved and
shared tracks snapshot their title, artist, artwork, and preview URL so your
library and chat history keep working even if a catalog entry changes.

## License

Bill's project — all rights reserved unless Bill says otherwise.
`;

export const TERMUX_GUIDE_MD = `# Push SoundChat to GitHub from Termux — step by step

Goal: get the soundchat-v2 folder from the downloaded zip into your GitHub
repo (account: Brooklyn420, repo referred to as "Soundchat platform") so the
code is saved outside this phone and outside Muse.

You only do this once. Later exports just repeat steps 5-7 (copy the new
files over, commit, push).

## 1. Install the tools

Open Termux and run:

~~~sh
pkg update && pkg install -y git gh unzip
~~~

- git is for version control, gh is GitHub's command-line login + repo tool,
  unzip opens the downloaded zip.

## 2. Let Termux see your Downloads folder

~~~sh
termux-setup-storage
~~~

Android will ask for storage permission — allow it. This creates the
~/storage folder that links to the phone's shared storage.

## 3. Unzip the export

The SoundChat page's "Download for GitHub" button saves
soundchat-v2-source.zip. Browsers usually put it in Downloads:

~~~sh
cd ~/storage/downloads
ls
unzip soundchat-v2-source.zip
cd soundchat-v2
ls
~~~

You should see README.md, package.json, client, server, drizzle, and docs.
If the zip landed somewhere else, find it first:

~~~sh
find ~/storage -name "soundchat-v2-source.zip" 2>/dev/null
~~~

## 4. Turn the folder into a git repo

~~~sh
git init
git add .
git commit -m "SoundChat v2 source"
~~~

If git asks who you are the first time, set it once:

~~~sh
git config --global user.name "Brooklyn420"
git config --global user.email "your-github-email@example.com"
~~~

Use the email tied to your GitHub account, then run the commit again.

## 5. Log in to GitHub

~~~sh
gh auth login
~~~

Pick: GitHub.com -> HTTPS -> Login with a web browser. It shows a one-time
code — copy it, the browser opens GitHub, paste the code, approve. That signs
Termux in as Brooklyn420 without typing your password into the terminal.

## 6a. Create the repo and push (first time, no repo yet)

~~~sh
gh repo create soundchat-platform --private --source=. --remote=origin --push
~~~

- Use --public instead of --private if you want anyone to see it.
- This creates Brooklyn420/soundchat-platform, connects it as origin, and
  pushes your commit in one go. Done — your code is on GitHub.

## 6b. Push into an existing repo instead

If "Soundchat platform" already exists on your account, connect to it and
push (a GitHub repo name cannot contain spaces — on github.com it will be
something like soundchat-platform; check the repo page for its exact URL and
use that URL below):

~~~sh
git remote add origin https://github.com/Brooklyn420/soundchat-platform.git
git branch -M main
git push -u origin main
~~~

If the existing repo already has files and git refuses the push, run
git pull origin main --allow-unrelated-histories once, fix anything it flags,
then push again.

## 7. Check it worked

Open https://github.com/Brooklyn420 in your browser — the soundchat-platform
repo should show the SoundChat files and your "SoundChat v2 source" commit.

## Updating later

Download a fresh export, unzip it over the same folder (or into a new one and
copy the files across), then:

~~~sh
cd soundchat-v2
git add .
git commit -m "SoundChat update"
git push
~~~
`;

export const SOUNDCHAT_NOTES_MD = `# SoundChat notes — what this export is, and what standalone still needs

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
`;

export const GITIGNORE = `# deps
node_modules/
.bun-cache/

# build output
dist/
client/dist/
client/dist-cvm/
server/dist/
.space-build/
.space-build-cvm/

# artifact runtime data — never commit your private app data
app.db
app.db-shm
app.db-wal
blobs/
.audit/
audits/
.harness/

# local env
.env
.env.local

# OS / editor
.DS_Store
*.log
`;

export const ENV_EXAMPLE = `# SoundChat v2 needs no API keys today.
# Music search + charts use Apple's public iTunes APIs (no key, no account).
# Copy this file to .env when a future version adds real accounts,
# Spotify OAuth, or a calling provider, and put those keys here —
# never commit the filled-in .env.
`;

export const STANDALONE_PACKAGE_JSON = `${JSON.stringify(
  {
    name: "soundchat",
    version: "2.0.0",
    private: true,
    type: "module",
    description:
      "SoundChat — music messaging: chat with people and share songs that play (30-second previews).",
    scripts: {
      dev: "vite",
      build: "tsc --noEmit && vite build",
      preview: "vite preview",
      typecheck: "tsc --noEmit",
    },
    dependencies: {
      "@tanstack/react-query": "5.100.10",
      "drizzle-orm": "0.45.2",
      react: "19.2.5",
      "react-dom": "19.2.5",
      zod: "4.4.3",
    },
    devDependencies: {
      "@types/react": "19.2.14",
      "@types/react-dom": "19.2.3",
      "@vitejs/plugin-react": "^4.3.4",
      tailwindcss: "4.1.13",
      "tailwindcss-safe-area": "1.3.0",
      typescript: "5.6.3",
      vite: "^6.0.7",
    },
  },
  null,
  2,
)}\n`;

export const STANDALONE_TSCONFIG = `${JSON.stringify(
  {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      strict: true,
      noUncheckedIndexedAccess: true,
      verbatimModuleSyntax: true,
      skipLibCheck: true,
      isolatedModules: true,
      noEmit: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ["client/src", "vite.config.ts"],
  },
  null,
  2,
)}\n`;

export const VITE_CONFIG = `import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Standalone starter config for the exported SoundChat source.
// The Muse artifact bundles differently (see client/build.mjs and
// SOUNDCHAT_NOTES.md); this config is for running the client with Vite.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: ".",
  build: { outDir: "dist" },
  server: { port: 5173 },
});
`;

export const STANDALONE_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="color-scheme" content="light dark" />
    <title>SoundChat</title>
  </head>
  <body>
    <div id="root"></div>
    <!-- Standalone entry: the client source expects the action API described
         in SOUNDCHAT_NOTES.md. Inside Muse, client/index.html is the entry. -->
    <script type="module" src="/client/src/main.tsx"></script>
  </body>
</html>
`;
