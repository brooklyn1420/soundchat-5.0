# SoundChat

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
