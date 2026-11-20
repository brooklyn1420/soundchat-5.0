import {
createContext,
useContext,
useEffect,
useMemo,
useRef,
useState,
type FormEvent,
type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim, bytesToBase64, fileToBase64 } from "@hatch/space-sdk/client";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import { api, type ApiResponse } from "./api";
import type { Actions } from "../../server/src/actions";
import bgPotLeaf from "./assets/bg-pot-leaf.webp";
import bgMushroom from "./assets/bg-mushroom.webp";
import bgSkull from "./assets/bg-skull.webp";
import bgReaper from "./assets/bg-reaper.webp";

const FIELDS = actionFields<typeof Actions>();

export type BackgroundId =
  | "classic" | "pot-neon" | "pot-haze" | "mushroom-trip" | "mushroom-glow"
  | "skull-gothic" | "skull-bone" | "reaper-moon" | "reaper-fog"
  | "galaxy" | "sunset" | "neon-nights" | "forest";

export interface BackgroundDef {
  id: BackgroundId;
  name: string;
  category: string;
  image?: string;
  filter?: string;
  position?: string;
  gradientClass?: string;
  swatch: string;
}

export const BACKGROUNDS: BackgroundDef[] = [
  { id: "classic", name: "Classic", category: "Popular styles", swatch: "linear-gradient(135deg,#f6f1ea,#efe7db)" },
  { id: "pot-neon", name: "Midnight Leaf", category: "Pot leaf", image: bgPotLeaf, swatch: "linear-gradient(135deg,#052e16,#16a34a)" },
  { id: "pot-haze", name: "Emerald Haze", category: "Pot leaf", image: bgPotLeaf, filter: "hue-rotate(28deg) saturate(1.35) brightness(1.12)", position: "bottom center", swatch: "linear-gradient(135deg,#166534,#a3e635)" },
  { id: "mushroom-trip", name: "Mushroom Trip", category: "Magic mushroom", image: bgMushroom, swatch: "linear-gradient(135deg,#7c3aed,#ec4899,#f59e0b)" },
  { id: "mushroom-glow", name: "Cosmic Shrooms", category: "Magic mushroom", image: bgMushroom, filter: "hue-rotate(42deg) saturate(1.3)", position: "bottom center", swatch: "linear-gradient(135deg,#0ea5e9,#7c3aed,#ec4899)" },
  { id: "skull-gothic", name: "Skulls & Roses", category: "Skulls", image: bgSkull, swatch: "linear-gradient(135deg,#111111,#991b1b)" },
  { id: "skull-bone", name: "Bone Stack", category: "Skulls", image: bgSkull, filter: "saturate(0.55) brightness(1.05) contrast(1.05)", position: "bottom center", swatch: "linear-gradient(135deg,#44403c,#d6d3d1)" },
  { id: "reaper-moon", name: "Grim Reaper", category: "Reaper", image: bgReaper, swatch: "linear-gradient(135deg,#1e1b4b,#6d28d9)" },
  { id: "reaper-fog", name: "Reaper Fog", category: "Reaper", image: bgReaper, filter: "brightness(0.82) saturate(0.75)", position: "top center", swatch: "linear-gradient(135deg,#312e81,#94a3b8)" },
  { id: "galaxy", name: "Galaxy Nebula", category: "Popular styles", gradientClass: "bg-galaxy", swatch: "linear-gradient(135deg,#4c1d95,#0ea5e9)" },
  { id: "sunset", name: "Ocean Sunset", category: "Popular styles", gradientClass: "bg-sunset", swatch: "linear-gradient(135deg,#e94f37,#f59e0b)" },
  { id: "neon-nights", name: "Neon Nights", category: "Popular styles", gradientClass: "bg-neon-nights", swatch: "linear-gradient(135deg,#ec4899,#22d3ee)" },
  { id: "forest", name: "Forest Mist", category: "Popular styles", gradientClass: "bg-forest", swatch: "linear-gradient(135deg,#14532d,#6ee7b7)" },
];

export function backgroundById(id: string | null | undefined): BackgroundDef {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0]!;
}

const BackgroundContext = createContext<BackgroundDef>(BACKGROUNDS[0]!);
export function useBackground(): BackgroundDef { return useContext(BackgroundContext); }

export function BackgroundLayer() {
  const bg = useBackground();
  if (bg.id === "classic") return null;
  return (
    <>
      {bg.image ? (
        <div className="app-bg-image" style={{ backgroundImage: `url(${bg.image})`, backgroundPosition: bg.position ?? "center", filter: bg.filter }} aria-hidden="true" />
      ) : (
        <div className={`app-bg-gradient ${bg.gradientClass ?? ""}`} aria-hidden="true" />
      )}
      <div className="app-bg-scrim" aria-hidden="true" />
    </>
  );
}

type Track = ApiResponse<typeof api, "searchTracks">["tracks"][number];
type Contact = ApiResponse<typeof api, "listContacts">["contacts"][number];
type Message = ApiResponse<typeof api, "listMessages">["messages"][number];
type LibTrack = ApiResponse<typeof api, "listLibrary">["saved"][number];
type Playlist = ApiResponse<typeof api, "listPlaylists">["playlists"][number];
type ThreadContact = { id: number; name: string; handle: string | null; color: string };

function toTrackIn(t: Track) {
  return {
    trackId: t.trackId,
    title: t.title,
    artist: t.artist,
    album: t.album,
    artworkUrl: t.artworkUrl,
    previewUrl: t.previewUrl,
    trackViewUrl: t.trackViewUrl,
    durationMs: t.durationMs,
    genre: t.genre,
  };
}

function fmtDuration(ms: number): string {
  if (!ms || ms <= 0) return "";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

// ---------------------------------------------------------------------------
// Icons (inline SVG, lucide-style paths)
// ---------------------------------------------------------------------------

function Icon({ d, size = 20 }: { d: string | string[]; size?: number }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

const PlayIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5.14v13.72a1 1 0 0 0 1.52.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z" />
  </svg>
);
const PauseIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);
const ChatIcon = () => (
  <Icon d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
);
const MusicIcon = () => (
  <Icon d={["M9 18V5l12-2v13", "M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"]} />
);
const HeartIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);
const UserIcon = () => (
  <Icon d={["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"]} />
);
const SearchIcon = () => <Icon d={["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "m21 21-4.3-4.3"]} />;
const PlusIcon = () => <Icon d={["M5 12h14", "M12 5v14"]} />;
const SendIcon = () => (
  <Icon d={["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"]} />
);
const XIcon = () => <Icon d={["M18 6 6 18", "m6 6 12 12"]} />;
const BackIcon = () => <Icon d="m15 18-6-6 6-6" />;
const ShareIcon = () => (
  <Icon d={["M12 3v13", "m7 8 5-5 5 5", "M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"]} />
);
const TrashIcon = () => (
  <Icon d={["M3 6h18", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"]} />
);
const PencilIcon = () => (
  <Icon d={["M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z", "m15 5 4 4"]} />
);
const ExternalIcon = () => (
  <Icon d={["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"]} size={16} />
);
const PhoneIcon = () => (
  <Icon d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
);
const PhoneOffIcon = () => (
  <Icon d={["M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.24m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91", "m2 2 20 20"]} />
);
const MicIcon = () => (
  <Icon d={["M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z", "M19 10v2a7 7 0 0 1-14 0v-2", "M12 19v3"]} />
);
const MicOffIcon = () => (
  <Icon d={["M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6", "M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23", "M12 19v3", "m2 2 20 20"]} />
);
const SpeakerIcon = () => (
  <Icon d={["M11 5 6 9H2v6h4l5 4V5Z", "M15.54 8.46a5 5 0 0 1 0 7.07", "M19.07 4.93a10 10 0 0 1 0 14.14"]} />
);
const DownloadIcon = () => (
  <Icon d={["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m7 10 5 5 5-5", "M12 15V3"]} />
);
const CopyIcon = () => (
  <Icon d={["M8 8h12a2 2 0 0 1 2 2v12H10a2 2 0 0 1-2-2V8Z", "M4 4h12v2H6a2 2 0 0 0-2 2v10H2V6a2 2 0 0 1 2-2Z"]} size={16} />
);
const PackageIcon = () => (
  <Icon d={["M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4Z", "M3.3 7 12 12l8.7-5", "M12 22V12"]} />
);
const CameraIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);
const VideoIcon = () => (
  <Icon d={["m16 10 6-3.5v11L16 14", "M3 6.5A1.5 1.5 0 0 1 4.5 5h8A1.5 1.5 0 0 1 14 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 3 17.5v-11Z"]} />
);
const FlipCameraIcon = () => (
  <Icon d={["m17 2 4 4-4 4", "M3 11v-1a4 4 0 0 1 4-4h14", "m7 22-4-4 4-4", "M21 13v1a4 4 0 0 1-4 4H3"]} />
);
const UploadIcon = () => (
  <Icon d={["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m17 8-5-5-5 5", "M12 3v12"]} />
);
const UsersIcon = () => (
  <Icon d={["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"]} />
);
const PlaylistIcon = () => (
  <Icon d={["M10 6h11", "M10 10h11", "M10 14h11", "M3 15v6", "M0.5 18h5"]} />
);
const StarIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.5l2.85 6.15 6.65.72-4.9 4.55 1.3 6.58L12 17.3l-5.9 3.2 1.3-6.58-4.9-4.55 6.65-.72L12 2.5Z" />
  </svg>
);
const LockIcon = () => (
  <Icon d={["M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z", "M7 11V7a5 5 0 0 1 10 0v4"]} />
);
const TimerIcon = () => (
  <Icon d={["M10 2h4", "M12 14v-4", "M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"]} />
);
const ExpandIcon = () => <Icon d={["m18 15-6-6-6 6", "m6 9 6 6 6-6"]} />;
const ScissorsIcon = () => (
  <Icon d={["M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M20 4 8.12 15.88", "M14.47 14.48 20 20", "M8.12 8.12 12 12"]} size={16} />
);
const BookmarkIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Disappearing messages
//
// Each chat has a timer. New messages are stamped with an expiry time and
// are deleted from storage for real when it passes — unless the user taps
// Save on that message, which keeps it for good. The options are shared by
// the per-chat picker and the Profile default.
// ---------------------------------------------------------------------------

export const DISAPPEARING_OPTIONS: { seconds: number | null; label: string; short: string }[] = [
  { seconds: null, label: "Off — messages stay", short: "Off" },
  { seconds: 10, label: "10 seconds — good for a quick test", short: "10 sec" },
  { seconds: 60, label: "1 minute", short: "1 min" },
  { seconds: 300, label: "5 minutes", short: "5 min" },
  { seconds: 3600, label: "1 hour", short: "1 hour" },
  { seconds: 86400, label: "24 hours", short: "24 hours" },
  { seconds: 604800, label: "7 days", short: "7 days" },
];

export function disappearingLabel(seconds: number | null | undefined): string {
  return DISAPPEARING_OPTIONS.find((o) => o.seconds === (seconds ?? null))?.short ?? "24 hours";
}

export function fmtRemaining(expiresAtIso: string, nowMs: number): string {
  const diff = Math.max(0, Math.round((new Date(expiresAtIso).getTime() - nowMs) / 1000));
  if (diff <= 0) return "disappearing…";
  if (diff < 60) return `in ${diff}s`;
  if (diff < 3600) return `in ${Math.ceil(diff / 60)} min`;
  if (diff < 86400) return `in ${Math.ceil(diff / 3600)} hr`;
  return `in ${Math.ceil(diff / 86400)} days`;
}

// ---------------------------------------------------------------------------
// Snaps — face lenses & filters
//
// The old filters pasted emoji stickers at one guessed spot, and Bill
// rejected them outright: he wants lenses like Snapchat and Messenger.
// Those apps' lenses are drawn artwork locked onto your face by face
// tracking, so that's what this is. The first lens set still read as
// flat clip-art next to Snapchat, so this is the Pro rebuild:
//
//   - Every face lens is vector artwork (sunglasses, puppy ears, a crown,
//     a gold chain…) drawn from the face's landmarks — eyes, nose, mouth,
//     chin, face outline, and head tilt — never emoji pasted at a guess.
//     The Pro artwork is shaded like the real apps: metallic and glass
//     gradients, gloss highlights, soft drop shadows, glows, and blend
//     modes, so a crown looks like metal and shades look like glass
//     instead of flat stickers.
//   - NEW — face-warp lenses (Mega Eyes, Puffy Face, Alien): Snapchat's
//     signature face-changers. They don't paste anything on; they bend
//     the photo itself around your eyes / cheeks / chin with a radial
//     warp (see applyWarp). Warps run live on a canvas preview, bake
//     into photos, and record into videos.
//   - NEW — Beauty Glow (a soft-light skin veil with blush, the
//     beauty-filter look), Neon Glow (a glowing face outline), Butterflies,
//     and Little Devil horns join the lineup: 20 lenses & looks total.
//   - On browsers with the built-in FaceDetector API (Chrome on Android
//     and desktop Chrome with the shape-detection feature), the camera
//     finds the face many times a second and the lens follows it live,
//     tilting with the head. That API is the browser's own — no ML model
//     is downloaded or bundled, which the platform forbids.
//   - On browsers without it (Safari, most others), the lens sits on the
//     guide ring the camera shows — line your face up in the ring and
//     the lens lands in the same place. The UI says plainly which of the
//     two is happening; it never pretends tracking is on when it isn't.
//   - Photos bake the lens in on canvas from the landmarks captured with
//     the shot, and videos record through a canvas stream so the lens is
//     in the video file too (the same trick the trim feature uses). If a
//     browser can't do the canvas recording, the video records plain and
//     the review screen says so.
//   - Color looks (Rainbow Pop, Golden Hour…) are CSS/canvas grades, as
//     before.
//
// Landmark coordinates are "aspect space": x is a fraction of the frame
// width, y is measured in frame-width units from the top (y = fraction
// of height × height/width). Aspect space is isotropic — a unit is the
// same length on both axes — so circles stay round and head-tilt angles
// are true at any frame shape. Convert with px = value × frame width.
// ---------------------------------------------------------------------------

export type SnapFilterId =
  | "none" | "rainbow-pop" | "golden-hour" | "bubbles" | "comic-pop" | "pixel-party"
  | "shades" | "star-shades" | "specs" | "masquerade" | "puppy" | "kitty"
  | "bunny" | "crown" | "flower-crown" | "halo" | "heart-cheeks" | "gold-chain"
  | "monocle"
  // Pro rebuild additions: shaded/animated-feel artwork lenses, the
  // Beauty Glow skin look, and the face-warp lenses.
  | "beauty" | "neon" | "butterfly" | "devil"
  | "mega-eyes" | "puffy" | "alien"
  // Legacy emoji-sticker filters. No longer offered in the picker (Bill
  // rejected them); the definitions stay so snaps already sent with one
  // still render the look they were sent with.
  | "big-eyes" | "dog-days" | "star-crown" | "cool-shades" | "smart-specs"
  | "undercover" | "cat-days" | "top-hat" | "snapback" | "bling" | "clown-nose";

export type LensKind =
  | "shades" | "star-shades" | "specs" | "masquerade" | "puppy" | "kitty"
  | "bunny" | "crown" | "flower-crown" | "halo" | "heart-cheeks" | "gold-chain"
  | "monocle" | "beauty" | "neon" | "butterfly" | "devil";

// Face-warp lenses: no artwork is drawn — the image itself is bent
// around the face (see warpBulges / applyWarp).
export type WarpKind = "mega-eyes" | "puffy" | "alien";

export interface SnapSticker {
  emoji: string;
  // Position/size as fractions of the frame (0..1), emoji centered there.
  x: number;
  y: number;
  size: number; // fraction of frame width
  anim?: "float" | "twinkle";
  delay?: number;
}

export interface SnapFilterDef {
  id: SnapFilterId;
  name: string;
  css: string; // CSS filter string; "" = none
  frame?: string; // full-frame overlay background (gradient / tint)
  lens?: LensKind; // drawn face lens, positioned from face landmarks
  warp?: WarpKind; // face-warp lens: bends the image around the face
  tier?: "plus"; // SoundChat Plus lens (also unlockable via its pack)
  packId?: string; // one-time filter pack that unlocks this lens
  face?: SnapSticker[]; // legacy emoji stickers (old filters only)
  deco?: SnapSticker[]; // legacy emoji stickers (old filters only)
  swatch: string; // picker chip background
}

export const SNAP_FILTERS: SnapFilterDef[] = [
  { id: "none", name: "Original", css: "", swatch: "linear-gradient(135deg,#e7e5e4,#a8a29e)" },
  // --- Face lenses: drawn artwork that sits on your real face ---
  {
    id: "shades", name: "Black Shades", css: "saturate(1.25) contrast(1.06)", lens: "shades",
    swatch: "linear-gradient(135deg,#27272a,#09090b)",
  },
  {
    id: "star-shades", name: "Star Shades", css: "saturate(1.3)", lens: "star-shades", tier: "plus", packId: "party-pack",
    swatch: "linear-gradient(135deg,#fbbf24,#f97316)",
  },
  {
    id: "specs", name: "Round Specs", css: "brightness(1.05) saturate(1.1)", lens: "specs",
    swatch: "linear-gradient(135deg,#bae6fd,#64748b)",
  },
  {
    id: "masquerade", name: "Masquerade", css: "saturate(1.25) contrast(1.05)", lens: "masquerade", tier: "plus", packId: "party-pack",
    swatch: "linear-gradient(135deg,#a855f7,#6d28d9)",
  },
  {
    id: "puppy", name: "Puppy", css: "sepia(0.18) saturate(1.25)", lens: "puppy",
    swatch: "linear-gradient(135deg,#d9a066,#8a5a33)",
  },
  {
    id: "kitty", name: "Kitty", css: "saturate(1.2)", lens: "kitty",
    swatch: "linear-gradient(135deg,#f9a8d4,#44403c)",
  },
  {
    id: "bunny", name: "Bunny", css: "brightness(1.06) saturate(1.15)", lens: "bunny",
    swatch: "linear-gradient(135deg,#f5f5f4,#f9a8d4)",
  },
  {
    id: "crown", name: "Royal Crown", css: "brightness(1.07) saturate(1.2)", lens: "crown", tier: "plus", packId: "royal-pack",
    swatch: "linear-gradient(135deg,#fde047,#d97706)",
  },
  {
    id: "flower-crown", name: "Flower Crown", css: "brightness(1.08) saturate(1.25)", lens: "flower-crown",
    swatch: "linear-gradient(135deg,#f9a8d4,#86efac)",
  },
  {
    id: "halo", name: "Angel Halo", css: "brightness(1.12) saturate(1.1)", lens: "halo", tier: "plus", packId: "party-pack",
    swatch: "linear-gradient(135deg,#fef9c3,#facc15)",
  },
  {
    id: "heart-cheeks", name: "Heart Cheeks", css: "saturate(1.3) brightness(1.04)", lens: "heart-cheeks",
    swatch: "linear-gradient(135deg,#fda4af,#e11d48)",
  },
  {
    id: "gold-chain", name: "Gold Chain", css: "brightness(1.08) saturate(1.25)", lens: "gold-chain", tier: "plus", packId: "royal-pack",
    swatch: "linear-gradient(135deg,#fde047,#b45309)",
  },
  {
    id: "monocle", name: "Fancy Monocle", css: "sepia(0.22) contrast(1.05)", lens: "monocle", tier: "plus", packId: "royal-pack",
    swatch: "linear-gradient(135deg,#fde68a,#78716c)",
  },
  // --- Pro rebuild: shaded artwork lenses + the beauty look ---
  {
    id: "beauty", name: "Beauty Glow", css: "brightness(1.07) saturate(1.14) contrast(0.97)", lens: "beauty",
    swatch: "linear-gradient(135deg,#ffe4e6,#fda4af)",
  },
  {
    id: "butterfly", name: "Butterflies", css: "brightness(1.05) saturate(1.22)", lens: "butterfly",
    swatch: "linear-gradient(135deg,#c4b5fd,#f0abfc)",
  },
  {
    id: "neon", name: "Neon Glow", css: "saturate(1.3) contrast(1.06)", lens: "neon", tier: "plus", packId: "party-pack",
    frame: "radial-gradient(ellipse 90% 70% at 50% 42%, transparent 55%, rgba(2,6,23,0.28) 100%)",
    swatch: "linear-gradient(135deg,#22d3ee,#e879f9)",
  },
  {
    id: "devil", name: "Little Devil", css: "saturate(1.3) contrast(1.05)", lens: "devil", tier: "plus", packId: "party-pack",
    swatch: "linear-gradient(135deg,#f87171,#7f1d1d)",
  },
  // --- Face-warp lenses: they bend your actual face, Snapchat-style ---
  {
    id: "mega-eyes", name: "Mega Eyes", css: "saturate(1.22)", warp: "mega-eyes",
    swatch: "linear-gradient(135deg,#fde68a,#fb923c)",
  },
  {
    id: "puffy", name: "Puffy Face", css: "saturate(1.18) brightness(1.03)", warp: "puffy",
    swatch: "linear-gradient(135deg,#fecdd3,#f9a8d4)",
  },
  {
    id: "alien", name: "Alien", css: "hue-rotate(-12deg) saturate(1.25)", warp: "alien", tier: "plus", packId: "party-pack",
    swatch: "linear-gradient(135deg,#86efac,#22d3ee)",
  },
  // --- Color looks: full-frame grades, no face art ---
  {
    id: "rainbow-pop", name: "Rainbow Pop", css: "saturate(1.9) hue-rotate(18deg) contrast(1.08)",
    frame: "linear-gradient(180deg, rgba(255,0,110,0.20), rgba(255,190,0,0.16) 38%, rgba(0,220,130,0.16) 68%, rgba(0,140,255,0.22))",
    swatch: "linear-gradient(135deg,#ff006e,#ffbe0b,#00dc82,#008cff)",
  },
  {
    id: "golden-hour", name: "Golden Hour", css: "sepia(0.45) saturate(1.4) brightness(1.06) contrast(1.02)",
    frame: "linear-gradient(180deg, rgba(255,170,40,0.20), rgba(255,90,0,0.10) 55%, rgba(120,40,0,0.16))",
    swatch: "linear-gradient(135deg,#f59e0b,#ea580c)",
  },
  {
    id: "bubbles", name: "Bubbles", css: "brightness(1.1) contrast(0.95) saturate(1.15)",
    frame: "radial-gradient(circle at 18% 24%, rgba(255,255,255,0.20), transparent 26%), radial-gradient(circle at 82% 62%, rgba(255,255,255,0.16), transparent 30%), radial-gradient(circle at 62% 14%, rgba(255,255,255,0.14), transparent 20%)",
    swatch: "linear-gradient(135deg,#bae6fd,#38bdf8)",
  },
  {
    id: "comic-pop", name: "Comic Pop", css: "contrast(1.35) saturate(1.5)",
    frame: "radial-gradient(circle at 50% 42%, transparent 55%, rgba(0,0,0,0.18))",
    swatch: "linear-gradient(135deg,#facc15,#ef4444)",
  },
  {
    id: "pixel-party", name: "Pixel Party", css: "contrast(1.25) saturate(1.6)",
    frame: "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 3px, transparent 3px 6px)",
    swatch: "linear-gradient(135deg,#22d3ee,#a855f7)",
  },
];

// The rejected emoji-sticker set, kept only so older snaps render as sent.
const LEGACY_SNAP_FILTERS: SnapFilterDef[] = [
  {
    id: "big-eyes", name: "Big Eyes", css: "saturate(1.25) contrast(1.05)",
    face: [{ emoji: "👀", x: 0.5, y: 0.335, size: 0.34 }],
    swatch: "linear-gradient(135deg,#fde68a,#f59e0b)",
  },
  {
    id: "dog-days", name: "Dog Days", css: "sepia(0.25) saturate(1.3)",
    face: [{ emoji: "🐶", x: 0.5, y: 0.33, size: 0.42, anim: "float" }],
    swatch: "linear-gradient(135deg,#fbbf24,#b45309)",
  },
  {
    id: "star-crown", name: "Star Crown", css: "brightness(1.08) saturate(1.2)",
    face: [{ emoji: "👑", x: 0.5, y: 0.155, size: 0.3, anim: "float" }],
    deco: [
      { emoji: "✨", x: 0.12, y: 0.14, size: 0.13, anim: "twinkle" },
      { emoji: "✨", x: 0.88, y: 0.3, size: 0.11, anim: "twinkle", delay: 0.6 },
      { emoji: "⭐", x: 0.84, y: 0.82, size: 0.12, anim: "twinkle", delay: 1.1 },
    ],
    swatch: "linear-gradient(135deg,#fde047,#eab308)",
  },
  {
    id: "cool-shades", name: "Cool Shades", css: "saturate(1.3) contrast(1.06)",
    face: [{ emoji: "🕶️", x: 0.5, y: 0.335, size: 0.38 }],
    deco: [{ emoji: "✨", x: 0.86, y: 0.16, size: 0.11, anim: "twinkle" }],
    swatch: "linear-gradient(135deg,#1f2937,#111827)",
  },
  {
    id: "smart-specs", name: "Smart Specs", css: "brightness(1.05) saturate(1.1)",
    face: [{ emoji: "👓", x: 0.5, y: 0.335, size: 0.36 }],
    deco: [{ emoji: "📚", x: 0.87, y: 0.85, size: 0.14, anim: "float" }],
    swatch: "linear-gradient(135deg,#93c5fd,#2563eb)",
  },
  {
    id: "undercover", name: "Undercover", css: "contrast(1.1) saturate(1.15)",
    face: [{ emoji: "🥸", x: 0.5, y: 0.36, size: 0.46 }],
    swatch: "linear-gradient(135deg,#d6d3d1,#78716c)",
  },
  {
    id: "cat-days", name: "Cat Days", css: "sepia(0.2) saturate(1.3)",
    face: [{ emoji: "🐱", x: 0.5, y: 0.33, size: 0.42, anim: "float" }],
    swatch: "linear-gradient(135deg,#fdba74,#ea580c)",
  },
  {
    id: "top-hat", name: "Top Hat", css: "brightness(1.05) contrast(1.05)",
    face: [{ emoji: "🎩", x: 0.5, y: 0.15, size: 0.34, anim: "float" }],
    deco: [{ emoji: "✨", x: 0.13, y: 0.2, size: 0.11, anim: "twinkle" }],
    swatch: "linear-gradient(135deg,#374151,#f59e0b)",
  },
  {
    id: "snapback", name: "Snapback", css: "saturate(1.35)",
    face: [{ emoji: "🧢", x: 0.5, y: 0.165, size: 0.37 }],
    swatch: "linear-gradient(135deg,#ef4444,#3b82f6)",
  },
  {
    id: "bling", name: "Bling Bling", css: "brightness(1.1) saturate(1.3)",
    frame: "linear-gradient(180deg, rgba(255,215,0,0.14), transparent 45%, rgba(255,170,0,0.12))",
    face: [
      { emoji: "💎", x: 0.245, y: 0.365, size: 0.1, anim: "twinkle" },
      { emoji: "💎", x: 0.755, y: 0.365, size: 0.1, anim: "twinkle", delay: 0.7 },
      { emoji: "📿", x: 0.5, y: 0.545, size: 0.3 },
    ],
    deco: [
      { emoji: "✨", x: 0.12, y: 0.12, size: 0.12, anim: "twinkle", delay: 0.3 },
      { emoji: "✨", x: 0.88, y: 0.62, size: 0.11, anim: "twinkle", delay: 1 },
    ],
    swatch: "linear-gradient(135deg,#fde047,#d97706)",
  },
  {
    id: "clown-nose", name: "Clown Nose", css: "saturate(1.5) contrast(1.05)",
    face: [{ emoji: "🔴", x: 0.5, y: 0.405, size: 0.13 }],
    deco: [{ emoji: "🎪", x: 0.87, y: 0.12, size: 0.15, anim: "float" }],
    swatch: "linear-gradient(135deg,#f87171,#facc15)",
  },
];

export function snapFilterById(id: string | null | undefined): SnapFilterDef {
  return (
    SNAP_FILTERS.find((f) => f.id === id) ??
    LEGACY_SNAP_FILTERS.find((f) => f.id === id) ??
    SNAP_FILTERS[0]!
  );
}

// ---------------------------------------------------------------------------
// SoundChat Plus — freemium entitlements
//
// The core app is free: chat, listen, share, and most lenses. Plus
// ($4.99/month) unlocks the premium lenses, the Plus-exclusive
// backgrounds, 60-second videos (free is 15), and unlimited playlists /
// offline downloads (free is 3 playlists / 10 offline songs). Every
// premium lens also belongs to a one-time filter pack ($1.99, yours
// forever, no subscription). Entitlements live on the profile row and
// the server enforces the caps; these helpers are the client's view.
// ---------------------------------------------------------------------------

export interface Entitlements {
  plus: boolean;
  packs: string[];
}

export const FREE_ENTITLEMENTS: Entitlements = { plus: false, packs: [] };

export interface FilterPack {
  id: "party-pack" | "royal-pack";
  name: string;
  price: string;
  blurb: string;
  lensIds: SnapFilterId[];
}

export const FILTER_PACKS: FilterPack[] = [
  {
    id: "party-pack",
    name: "Party Pack",
    price: "$1.99",
    blurb: "Star Shades, Masquerade, Angel Halo, Neon Glow, Little Devil, and Alien — yours forever.",
    lensIds: ["star-shades", "masquerade", "halo", "neon", "devil", "alien"],
  },
  {
    id: "royal-pack",
    name: "Royal Pack",
    price: "$1.99",
    blurb: "Royal Crown, Gold Chain, and Fancy Monocle — yours forever.",
    lensIds: ["crown", "gold-chain", "monocle"],
  },
];

export function filterPackById(id: string | null | undefined): FilterPack | null {
  return FILTER_PACKS.find((p) => p.id === id) ?? null;
}

// A lens is locked when it's a Plus lens and the user neither has Plus
// nor owns the pack the lens belongs to.
export function lensLocked(def: SnapFilterDef, ent: Entitlements): boolean {
  if (def.tier !== "plus") return false;
  if (ent.plus) return false;
  if (def.packId && ent.packs.includes(def.packId)) return false;
  return true;
}

// Plus-exclusive app backgrounds (ids match the saveBackground action).
export const PLUS_BACKGROUND_IDS = ["galaxy", "neon-nights", "reaper-fog", "mushroom-glow"];

export const PLUS_VIDEO_MS = 60000; // Plus snap-video cap
export const FREE_VIDEO_MS = 15000; // free snap-video cap
export const FREE_PLAYLIST_LIMIT = 3;
export const FREE_OFFLINE_LIMIT = 10;

// ---------------------------------------------------------------------------
// Face landmarks
// ---------------------------------------------------------------------------

export interface FacePt {
  x: number;
  y: number;
}

export interface FaceLandmarks {
  leftEye: FacePt;
  rightEye: FacePt;
  nose: FacePt;
  mouth: FacePt;
  chin: FacePt;
  cx: number; // face box center x (fraction of width)
  cy: number; // face box center y (aspect space)
  w: number; // face box width (fraction of width)
  h: number; // face box height (aspect space)
  roll: number; // head tilt, radians (from the eye line)
}

// The guide-ring face: where the lens lands when the browser has no live
// face detection. Authored from the same anchors the camera's guide ring
// shows (eyes about a third down a portrait frame), converted to aspect
// space for the actual frame shape.
export function guideFace(frameW: number, frameH: number): FaceLandmarks {
  const a = frameW > 0 ? frameH / frameW : 4 / 3;
  const Y = (frac: number) => frac * a;
  return {
    leftEye: { x: 0.395, y: Y(0.335) },
    rightEye: { x: 0.605, y: Y(0.335) },
    nose: { x: 0.5, y: Y(0.42) },
    mouth: { x: 0.5, y: Y(0.5) },
    chin: { x: 0.5, y: Y(0.6) },
    cx: 0.5,
    cy: Y(0.36),
    w: 0.54,
    h: Y(0.5),
    roll: 0,
  };
}

// Landmarks from a detected face box (box given as fractions of the frame
// width/height). Eye/nose/mouth positions use standard face proportions
// inside the box; when the detector also reports eye landmarks, the
// caller refines the eyes and the roll from those.
export function faceFromBox(
  bx: number,
  by: number,
  bw: number,
  bh: number,
  aspectHW: number,
): FaceLandmarks {
  const Y = (frac: number) => frac * aspectHW;
  return {
    leftEye: { x: bx + bw * 0.3, y: Y(by + bh * 0.42) },
    rightEye: { x: bx + bw * 0.7, y: Y(by + bh * 0.42) },
    nose: { x: bx + bw / 2, y: Y(by + bh * 0.63) },
    mouth: { x: bx + bw / 2, y: Y(by + bh * 0.79) },
    chin: { x: bx + bw / 2, y: Y(by + bh * 0.97) },
    cx: bx + bw / 2,
    cy: Y(by + bh / 2),
    w: bw,
    h: Y(bh),
    roll: 0,
  };
}

// The front camera preview is mirrored; detector results are in raw
// sensor space. Flip a face into display space (x mirrored, eyes swap).
export function mirrorFace(f: FaceLandmarks): FaceLandmarks {
  const mx = (p: FacePt): FacePt => ({ x: 1 - p.x, y: p.y });
  return {
    leftEye: mx(f.rightEye),
    rightEye: mx(f.leftEye),
    nose: mx(f.nose),
    mouth: mx(f.mouth),
    chin: mx(f.chin),
    cx: 1 - f.cx,
    cy: f.cy,
    w: f.w,
    h: f.h,
    roll: -f.roll,
  };
}

export function lerpFace(a: FaceLandmarks, b: FaceLandmarks, t: number): FaceLandmarks {
  const L = (u: number, v: number) => u + (v - u) * t;
  const LP = (p: FacePt, q: FacePt): FacePt => ({ x: L(p.x, q.x), y: L(p.y, q.y) });
  return {
    leftEye: LP(a.leftEye, b.leftEye),
    rightEye: LP(a.rightEye, b.rightEye),
    nose: LP(a.nose, b.nose),
    mouth: LP(a.mouth, b.mouth),
    chin: LP(a.chin, b.chin),
    cx: L(a.cx, b.cx),
    cy: L(a.cy, b.cy),
    w: L(a.w, b.w),
    h: L(a.h, b.h),
    roll: L(a.roll, b.roll),
  };
}

// The shape of one result from the browser's built-in FaceDetector API
// (Shape Detection). Only the fields SoundChat reads are typed.
export interface DetectedFace {
  boundingBox: { x: number; y: number; width: number; height: number };
  landmarks?: { type?: string; locations?: { x: number; y: number }[] }[];
}

export interface FaceDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<DetectedFace[]>;
}

// Converts one FaceDetector result (pixel coordinates, raw sensor space)
// into aspect-space landmarks, refining the eyes / nose / mouth and the
// head roll from the detector's own landmarks when it reports them.
export function faceFromDetection(det: DetectedFace, vw: number, vh: number): FaceLandmarks {
  const bb = det.boundingBox;
  const aspect = vh / vw;
  let face = faceFromBox(bb.x / vw, bb.y / vh, bb.width / vw, bb.height / vh, aspect);
  const eyePts: FacePt[] = [];
  let nosePt: FacePt | null = null;
  let mouthPt: FacePt | null = null;
  for (const lm of det.landmarks ?? []) {
    const locs = lm.locations ?? [];
    if (lm.type === "eye") {
      for (const l of locs) eyePts.push({ x: l.x / vw, y: (l.y / vh) * aspect });
    } else if (lm.type === "nose" && locs[0]) {
      nosePt = { x: locs[0].x / vw, y: (locs[0].y / vh) * aspect };
    } else if (lm.type === "mouth" && locs[0]) {
      mouthPt = { x: locs[0].x / vw, y: (locs[0].y / vh) * aspect };
    }
  }
  if (eyePts.length >= 2) {
    const sorted = [...eyePts].sort((p, q) => p.x - q.x);
    const lo = sorted[0];
    const hi = sorted[sorted.length - 1];
    if (lo && hi) {
      face = {
        ...face,
        leftEye: lo,
        rightEye: hi,
        roll: Math.atan2(hi.y - lo.y, hi.x - lo.x),
      };
    }
  }
  if (nosePt) face = { ...face, nose: nosePt };
  if (mouthPt) face = { ...face, mouth: mouthPt };
  return face;
}

// ---------------------------------------------------------------------------
// Lens artwork — one geometry source, two renderers (SVG for the live
// preview overlay, Path2D for the canvas bake / video pipeline), so what
// you see in the preview is exactly what lands in the photo or video.
// Shapes are SVG path strings in pixel space for a frame of width W;
// because landmarks are aspect-space, y pixels are also derived from W.
// ---------------------------------------------------------------------------

// A two-point linear gradient in frame pixel space. Both renderers
// honor it: SVG emits a <linearGradient> with userSpaceOnUse, canvas
// builds a CanvasGradient from the same points, so preview and bake
// shade identically.
export interface LensGrad {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: [number, string][];
}

export interface LensShape {
  d: string;
  fill?: string;
  stroke?: string;
  sw?: number; // stroke width, px
  opacity?: number;
  evenOdd?: boolean;
  cap?: boolean; // round line caps (open strokes like whiskers / arms)
  grad?: LensGrad; // shaded fill (or stroke, per gradTarget)
  gradTarget?: "fill" | "stroke";
  blend?: "soft-light" | "overlay" | "multiply" | "screen"; // composite with the photo
  blur?: number; // soft edge / glow, px
}

type P2 = { x: number; y: number };
const P2pt = (x: number, y: number): P2 => ({ x, y });

function rotPt(p: P2, c: P2, a: number): P2 {
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

const fmtN = (n: number) => Math.round(n * 10) / 10;

function ptsToPath(pts: P2[], close = true): string {
  if (pts.length === 0) return "";
  return `M ${pts.map((p) => `${fmtN(p.x)} ${fmtN(p.y)}`).join(" L ")}${close ? " Z" : ""}`;
}

function ellipsePts(c: P2, rx: number, ry: number, a: number, n = 26): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    out.push(rotPt(P2pt(c.x + rx * Math.cos(t), c.y + ry * Math.sin(t)), c, a));
  }
  return out;
}

function circlePath(c: P2, r: number): string {
  return ptsToPath(ellipsePts(c, r, r, 0, 22));
}

function rrectPts(c: P2, w: number, h: number, r: number, a: number): P2[] {
  const hw = w / 2;
  const hh = h / 2;
  const corners = [
    { cx: hw - r, cy: -hh + r, start: -Math.PI / 2 },
    { cx: hw - r, cy: hh - r, start: 0 },
    { cx: -hw + r, cy: hh - r, start: Math.PI / 2 },
    { cx: -hw + r, cy: -hh + r, start: Math.PI },
  ];
  const out: P2[] = [];
  for (const corner of corners) {
    for (let i = 0; i <= 4; i++) {
      const t = corner.start + (i / 4) * (Math.PI / 2);
      out.push(
        rotPt(P2pt(c.x + corner.cx + r * Math.cos(t), c.y + corner.cy + r * Math.sin(t)), c, a),
      );
    }
  }
  return out;
}

function starPts(c: P2, rO: number, rI: number, a: number, points = 5): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rO : rI;
    const t = a - Math.PI / 2 + (i * Math.PI) / points;
    out.push(P2pt(c.x + r * Math.cos(t), c.y + r * Math.sin(t)));
  }
  return out;
}

function heartPath(c: P2, s: number, a: number): string {
  const lp = (x: number, y: number) => rotPt(P2pt(c.x + x * s, c.y + y * s), c, a);
  const b = lp(0, 0.6);
  const n = lp(0, -0.18);
  const c1 = lp(-0.72, 0.02);
  const c2 = lp(-0.5, -0.42);
  const c3 = lp(0.5, -0.42);
  const c4 = lp(0.72, 0.02);
  const sp = (p: P2) => `${fmtN(p.x)} ${fmtN(p.y)}`;
  return `M ${sp(b)} C ${sp(c1)} ${sp(c2)} ${sp(n)} C ${sp(c3)} ${sp(c4)} ${sp(b)} Z`;
}

// Vertical gradient helper: most lens art shades top→bottom (light
// from above), so this is the common case. Coordinates are frame px.
function vGrad(x: number, yTop: number, yBottom: number, stops: [number, string][]): LensGrad {
  return { x1: x, y1: yTop, x2: x, y2: yBottom, stops };
}

function quadPts(a: P2, ctrl: P2, b: P2, n = 14): P2[] {
  const out: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push(
      P2pt(
        u * u * a.x + 2 * u * t * ctrl.x + t * t * b.x,
        u * u * a.y + 2 * u * t * ctrl.y + t * t * b.y,
      ),
    );
  }
  return out;
}

export function lensShapes(kind: LensKind, f: FaceLandmarks, W: number): LensShape[] {
  const le = P2pt(f.leftEye.x * W, f.leftEye.y * W);
  const re = P2pt(f.rightEye.x * W, f.rightEye.y * W);
  const nose = P2pt(f.nose.x * W, f.nose.y * W);
  const mouth = P2pt(f.mouth.x * W, f.mouth.y * W);
  const chin = P2pt(f.chin.x * W, f.chin.y * W);
  const mid = P2pt((le.x + re.x) / 2, (le.y + re.y) / 2);
  const ed = Math.max(24, Math.hypot(re.x - le.x, re.y - le.y)); // eye distance, px
  const roll = f.roll;
  const cxPx = f.cx * W;
  const cyPx = f.cy * W;
  const fw = f.w * W;
  const fh = f.h * W;
  const top = cyPx - fh / 2;
  const shapes: LensShape[] = [];
  const local = (lx: number, ly: number): P2 =>
    rotPt(P2pt(mid.x + lx * ed, mid.y + ly * ed), mid, roll);

  switch (kind) {
    case "shades": {
      // Soft shadow first, so the frames sit ON the face instead of
      // floating over it — the detail that separates art from stickers.
      for (const eye of [le, re]) {
        shapes.push({
          d: ptsToPath(rrectPts(P2pt(eye.x, eye.y + ed * 0.05), ed * 0.7, ed * 0.56, ed * 0.16, roll)),
          fill: "#000000",
          opacity: 0.28,
          blur: Math.max(2, ed * 0.05),
        });
      }
      for (const eye of [le, re]) {
        shapes.push({
          d: ptsToPath(rrectPts(eye, ed * 0.68, ed * 0.54, ed * 0.15, roll)),
          grad: vGrad(eye.x, eye.y - ed * 0.27, eye.y + ed * 0.27, [
            [0, "#4b4b57"],
            [0.45, "#17171d"],
            [1, "#26262f"],
          ]),
          opacity: 0.96,
        });
        // Glass sheen band + bright catchlight + cool rim light.
        const sheen = rotPt(P2pt(eye.x - ed * 0.04, eye.y - ed * 0.03), eye, roll);
        shapes.push({
          d: ptsToPath(ellipsePts(sheen, ed * 0.21, ed * 0.06, roll - 0.55)),
          fill: "#ffffff",
          opacity: 0.28,
          blur: Math.max(1, ed * 0.02),
        });
        const hl = rotPt(P2pt(eye.x - ed * 0.16, eye.y - ed * 0.14), eye, roll);
        shapes.push({
          d: ptsToPath(ellipsePts(hl, ed * 0.09, ed * 0.035, roll - 0.5)),
          fill: "#ffffff",
          opacity: 0.5,
        });
        const rim = rotPt(P2pt(eye.x, eye.y + ed * 0.22), eye, roll);
        shapes.push({
          d: ptsToPath(ellipsePts(rim, ed * 0.24, ed * 0.028, roll)),
          fill: "#9fd8ff",
          opacity: 0.32,
          blur: Math.max(1, ed * 0.015),
        });
      }
      shapes.push({
        d: ptsToPath(rrectPts(local(0, -0.03), ed * 0.3, ed * 0.09, ed * 0.04, roll)),
        fill: "#17171d",
        opacity: 0.96,
      });
      const armL = rotPt(P2pt(le.x - ed * 0.33, le.y - ed * 0.06), le, roll);
      const armR = rotPt(P2pt(re.x + ed * 0.33, re.y - ed * 0.06), re, roll);
      shapes.push({
        d: ptsToPath([armL, P2pt(-W * 0.02, armL.y - ed * 0.12)], false),
        stroke: "#101014",
        sw: ed * 0.07,
        cap: true,
      });
      shapes.push({
        d: ptsToPath([armR, P2pt(W * 1.02, armR.y - ed * 0.12)], false),
        stroke: "#101014",
        sw: ed * 0.07,
        cap: true,
      });
      break;
    }
    case "specs": {
      for (const eye of [le, re]) {
        shapes.push({
          d: ptsToPath(rrectPts(eye, ed * 0.64, ed * 0.56, ed * 0.2, roll)),
          fill: "rgba(180,220,255,0.10)",
          stroke: "#26262b",
          sw: Math.max(2, ed * 0.045),
        });
        // Diagonal glass sheen so the lenses read as glass, not holes.
        const sheen = rotPt(P2pt(eye.x - ed * 0.06, eye.y - ed * 0.05), eye, roll);
        shapes.push({
          d: ptsToPath(ellipsePts(sheen, ed * 0.2, ed * 0.05, roll - 0.6)),
          fill: "#ffffff",
          opacity: 0.2,
          blur: Math.max(1, ed * 0.015),
        });
      }
      shapes.push({
        d: ptsToPath([local(-0.32, -0.08), local(0, -0.16), local(0.32, -0.08)], false),
        stroke: "#26262b",
        sw: Math.max(2, ed * 0.04),
        cap: true,
      });
      const armL = rotPt(P2pt(le.x - ed * 0.31, le.y - ed * 0.05), le, roll);
      const armR = rotPt(P2pt(re.x + ed * 0.31, re.y - ed * 0.05), re, roll);
      shapes.push({
        d: ptsToPath([armL, P2pt(-W * 0.02, armL.y - ed * 0.1)], false),
        stroke: "#26262b",
        sw: Math.max(1.5, ed * 0.03),
        cap: true,
      });
      shapes.push({
        d: ptsToPath([armR, P2pt(W * 1.02, armR.y - ed * 0.1)], false),
        stroke: "#26262b",
        sw: Math.max(1.5, ed * 0.03),
        cap: true,
      });
      break;
    }
    case "star-shades": {
      for (const eye of [le, re]) {
        shapes.push({
          d: ptsToPath(starPts(P2pt(eye.x, eye.y + ed * 0.04), ed * 0.48, ed * 0.23, roll)),
          fill: "#000000",
          opacity: 0.25,
          blur: Math.max(2, ed * 0.04),
        });
        shapes.push({
          d: ptsToPath(starPts(eye, ed * 0.47, ed * 0.22, roll)),
          grad: vGrad(eye.x, eye.y - ed * 0.47, eye.y + ed * 0.47, [
            [0, "#fde68a"],
            [0.5, "#f59e0b"],
            [1, "#d97706"],
          ]),
          stroke: "#92400e",
          sw: Math.max(1.5, ed * 0.03),
        });
        // Dark amber lens inside the star + a sparkle on the top point.
        shapes.push({ d: circlePath(eye, ed * 0.17), fill: "#451a03", opacity: 0.88 });
        shapes.push({ d: circlePath(eye, ed * 0.06), fill: "#78350f" });
        const spark = rotPt(P2pt(eye.x, eye.y - ed * 0.47), eye, roll);
        shapes.push({
          d: ptsToPath(starPts(spark, ed * 0.075, ed * 0.028, roll, 4)),
          fill: "#ffffff",
          opacity: 0.9,
        });
      }
      shapes.push({
        d: ptsToPath(rrectPts(local(0, -0.02), ed * 0.26, ed * 0.08, ed * 0.04, roll)),
        fill: "#d97706",
      });
      break;
    }
    case "masquerade": {
      const outline: [number, number][] = [
        [-1.08, -0.3], [-0.72, -0.52], [-0.25, -0.44], [0, -0.52], [0.25, -0.44],
        [0.72, -0.52], [1.08, -0.3], [1.0, 0.1], [0.55, 0.3], [0, 0.46],
        [-0.55, 0.3], [-1.0, 0.1],
      ];
      const maskD =
        ptsToPath(outline.map(([lx, ly]) => local(lx, ly))) +
        " " +
        ptsToPath(ellipsePts(le, ed * 0.3, ed * 0.185, roll)) +
        " " +
        ptsToPath(ellipsePts(re, ed * 0.3, ed * 0.185, roll));
      shapes.push({
        d: maskD,
        grad: vGrad(mid.x, mid.y - ed * 0.55, mid.y + ed * 0.5, [
          [0, "#a855f7"],
          [0.55, "#7c3aed"],
          [1, "#4c1d95"],
        ]),
        stroke: "#fbbf24",
        sw: Math.max(1.2, ed * 0.022),
        evenOdd: true,
        opacity: 0.97,
      });
      for (const [lx, ly] of [[-0.8, -0.38], [-0.4, -0.47], [0, -0.5], [0.4, -0.47], [0.8, -0.38]] as [number, number][]) {
        const gem = local(lx, ly);
        shapes.push({
          d: circlePath(gem, ed * 0.045),
          grad: vGrad(gem.x, gem.y - ed * 0.045, gem.y + ed * 0.045, [
            [0, "#fde68a"],
            [1, "#d97706"],
          ]),
        });
        shapes.push({
          d: circlePath(P2pt(gem.x - ed * 0.014, gem.y - ed * 0.014), ed * 0.013),
          fill: "#ffffff",
          opacity: 0.85,
        });
      }
      // A small feather plume fanning off the mask's right corner:
      // three slim ellipses leaning further right as they stack.
      const plumeBase = local(1.02, -0.42);
      for (const [tilt, len, col] of [[0.15, 0.5, "#7c3aed"], [0.42, 0.6, "#a855f7"], [0.7, 0.52, "#c084fc"]] as [number, number, string][]) {
        const c = P2pt(plumeBase.x + ed * 0.13 + tilt * ed * 0.14, plumeBase.y - ed * len * 0.42);
        shapes.push({
          d: ptsToPath(ellipsePts(c, ed * 0.08, ed * len * 0.5, tilt)),
          fill: col,
          opacity: 0.9,
        });
      }
      break;
    }
    case "puppy": {
      for (const s of [-1, 1]) {
        const c = P2pt(cxPx + s * fw * 0.4, top + fh * 0.06);
        shapes.push({
          d: ptsToPath(ellipsePts(P2pt(c.x, c.y + fh * 0.015), fw * 0.16, fh * 0.305, s * 0.55)),
          fill: "#000000",
          opacity: 0.2,
          blur: Math.max(2, ed * 0.04),
        });
        shapes.push({
          d: ptsToPath(ellipsePts(c, fw * 0.155, fh * 0.3, s * 0.55)),
          grad: vGrad(c.x, c.y - fh * 0.3, c.y + fh * 0.3, [
            [0, "#a8703c"],
            [1, "#6f4525"],
          ]),
        });
        shapes.push({
          d: ptsToPath(ellipsePts(c, fw * 0.085, fh * 0.18, s * 0.55)),
          grad: vGrad(c.x, c.y - fh * 0.18, c.y + fh * 0.18, [
            [0, "#eec088"],
            [1, "#cf9455"],
          ]),
        });
      }
      // The classic puppy spot over one eye, blended into the fur.
      shapes.push({
        d: ptsToPath(ellipsePts(le, ed * 0.52, ed * 0.44, roll)),
        fill: "#7c4a21",
        opacity: 0.38,
        blend: "multiply",
        blur: Math.max(2, ed * 0.07),
      });
      shapes.push({
        d: ptsToPath(ellipsePts(nose, ed * 0.3, ed * 0.235, roll)),
        grad: vGrad(nose.x, nose.y - ed * 0.235, nose.y + ed * 0.235, [
          [0, "#55483f"],
          [1, "#16130f"],
        ]),
      });
      const hl = P2pt(nose.x - ed * 0.09, nose.y - ed * 0.08);
      shapes.push({
        d: ptsToPath(ellipsePts(hl, ed * 0.09, ed * 0.05, roll - 0.4)),
        fill: "#ffffff",
        opacity: 0.4,
      });
      shapes.push({
        d: ptsToPath(rrectPts(P2pt(mouth.x, mouth.y + ed * 0.18), ed * 0.3, ed * 0.4, ed * 0.14, roll)),
        grad: vGrad(mouth.x, mouth.y - ed * 0.02, mouth.y + ed * 0.38, [
          [0, "#f79ec0"],
          [1, "#e5567f"],
        ]),
      });
      const t1 = rotPt(P2pt(mouth.x, mouth.y + ed * 0.04), mouth, roll);
      const t2 = rotPt(P2pt(mouth.x, mouth.y + ed * 0.34), mouth, roll);
      shapes.push({
        d: ptsToPath([t1, t2], false),
        stroke: "#d14d78",
        sw: Math.max(1.5, ed * 0.025),
        cap: true,
      });
      break;
    }
    case "kitty": {
      for (const s of [-1, 1]) {
        const bx = cxPx + s * fw * 0.3;
        shapes.push({
          d: ptsToPath([
            P2pt(bx - fw * 0.17, top + fh * 0.14),
            P2pt(bx + s * fw * 0.05, top - fh * 0.3),
            P2pt(bx + fw * 0.17, top + fh * 0.14),
          ]),
          grad: vGrad(bx, top - fh * 0.3, top + fh * 0.14, [
            [0, "#57534e"],
            [1, "#292524"],
          ]),
        });
        shapes.push({
          d: ptsToPath([
            P2pt(bx - fw * 0.09, top + fh * 0.12),
            P2pt(bx + s * fw * 0.03, top - fh * 0.13),
            P2pt(bx + fw * 0.09, top + fh * 0.12),
          ]),
          grad: vGrad(bx, top - fh * 0.13, top + fh * 0.12, [
            [0, "#fbcfe8"],
            [1, "#f472b6"],
          ]),
        });
      }
      // Soft blush on both cheeks, blended into the skin.
      for (const [i, eye] of [le, re].entries()) {
        const s = i === 0 ? -1 : 1;
        shapes.push({
          d: ptsToPath(ellipsePts(P2pt(eye.x + s * ed * 0.24, eye.y + ed * 0.62), ed * 0.3, ed * 0.16, roll)),
          fill: "#fb9eb0",
          opacity: 0.5,
          blend: "soft-light",
          blur: Math.max(2, ed * 0.05),
        });
      }
      shapes.push({
        d: ptsToPath([
          P2pt(nose.x - ed * 0.1, nose.y - ed * 0.05),
          P2pt(nose.x + ed * 0.1, nose.y - ed * 0.05),
          P2pt(nose.x, nose.y + ed * 0.09),
        ]),
        grad: vGrad(nose.x, nose.y - ed * 0.05, nose.y + ed * 0.09, [
          [0, "#f9a8c0"],
          [1, "#ec5f8f"],
        ]),
      });
      for (const s of [-1, 1]) {
        for (const k of [-1, 0, 1]) {
          shapes.push({
            d: ptsToPath(
              [
                P2pt(nose.x + s * ed * 0.22, nose.y + ed * 0.06 + k * ed * 0.05),
                P2pt(nose.x + s * ed * 0.78, nose.y + ed * 0.02 + k * ed * 0.13),
              ],
              false,
            ),
            stroke: "rgba(255,255,255,0.9)",
            sw: Math.max(1.5, ed * 0.018),
            cap: true,
          });
        }
      }
      break;
    }
    case "bunny": {
      for (const s of [-1, 1]) {
        const c = P2pt(cxPx + s * fw * 0.19, top - fh * 0.24);
        shapes.push({
          d: ptsToPath(ellipsePts(P2pt(c.x, c.y + fh * 0.02), fw * 0.098, fh * 0.335, -s * 0.16)),
          fill: "#000000",
          opacity: 0.16,
          blur: Math.max(2, ed * 0.04),
        });
        shapes.push({
          d: ptsToPath(ellipsePts(c, fw * 0.095, fh * 0.33, -s * 0.16)),
          grad: vGrad(c.x, c.y - fh * 0.33, c.y + fh * 0.33, [
            [0, "#ffffff"],
            [1, "#e7e5e4"],
          ]),
          stroke: "#d6d3d1",
          sw: Math.max(1.5, ed * 0.02),
        });
        shapes.push({
          d: ptsToPath(ellipsePts(c, fw * 0.048, fh * 0.2, -s * 0.16)),
          grad: vGrad(c.x, c.y - fh * 0.2, c.y + fh * 0.2, [
            [0, "#fbcfe8"],
            [1, "#f472b6"],
          ]),
        });
      }
      shapes.push({
        d: ptsToPath(ellipsePts(nose, ed * 0.11, ed * 0.075, roll)),
        grad: vGrad(nose.x, nose.y - ed * 0.075, nose.y + ed * 0.075, [
          [0, "#f9a8c0"],
          [1, "#ec5f8f"],
        ]),
      });
      shapes.push({
        d: ptsToPath(rrectPts(P2pt(mouth.x, mouth.y + ed * 0.14), ed * 0.2, ed * 0.17, ed * 0.03, roll)),
        fill: "#ffffff",
        stroke: "#d6d3d1",
        sw: 1.5,
      });
      const t1 = rotPt(P2pt(mouth.x, mouth.y + ed * 0.06), mouth, roll);
      const t2 = rotPt(P2pt(mouth.x, mouth.y + ed * 0.22), mouth, roll);
      shapes.push({
        d: ptsToPath([t1, t2], false),
        stroke: "#d6d3d1",
        sw: 1.5,
        cap: true,
      });
      break;
    }
    case "crown": {
      const yb = top + fh * 0.16;
      const yt = top - fh * 0.14;
      const x0 = cxPx - fw * 0.44;
      const x1 = cxPx + fw * 0.44;
      const step = (x1 - x0) / 5;
      const pts: P2[] = [P2pt(x0, yb), P2pt(x0, yb - fh * 0.12)];
      const tips: P2[] = [];
      for (let i = 0; i < 5; i++) {
        const tip = P2pt(x0 + step * (i + 0.5), yt);
        tips.push(tip);
        pts.push(tip);
        pts.push(P2pt(x0 + step * (i + 1), yb - fh * 0.12));
      }
      pts.push(P2pt(x1, yb));
      // Shadow so the crown rests on the head, then the metal body:
      // bright gold at the tips shading to deep gold at the band.
      shapes.push({
        d: ptsToPath(pts.map((p) => P2pt(p.x, p.y + fh * 0.018))),
        fill: "#000000",
        opacity: 0.22,
        blur: Math.max(2, ed * 0.04),
      });
      shapes.push({
        d: ptsToPath(pts),
        grad: vGrad(cxPx, yt, yb, [
          [0, "#fef08a"],
          [0.45, "#fbbf24"],
          [1, "#d97706"],
        ]),
        stroke: "#92400e",
        sw: Math.max(1.5, ed * 0.02),
      });
      // Darker band along the bottom edge.
      shapes.push({
        d: ptsToPath([
          P2pt(x0, yb),
          P2pt(x1, yb),
          P2pt(x1, yb - fh * 0.045),
          P2pt(x0, yb - fh * 0.045),
        ]),
        fill: "#b45309",
        opacity: 0.5,
      });
      const gemColors = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#ec4899"];
      tips.forEach((tip, i) => {
        shapes.push({ d: circlePath(tip, ed * 0.05), fill: gemColors[i % gemColors.length] ?? "#fde68a" });
        shapes.push({
          d: circlePath(P2pt(tip.x - ed * 0.016, tip.y - ed * 0.016), ed * 0.016),
          fill: "#ffffff",
          opacity: 0.85,
        });
      });
      for (let i = 0; i < 4; i++) {
        shapes.push({
          d: circlePath(P2pt(x0 + step * (i + 0.5), yb - fh * 0.05), ed * 0.035),
          fill: "#fde68a",
        });
      }
      break;
    }
    case "halo": {
      const c = P2pt(cxPx, top - fh * 0.16);
      // Layered glow: a wide blurred halo of light, the gold ring, and
      // a near-white core line — reads as light, not a yellow oval.
      shapes.push({
        d: ptsToPath(ellipsePts(c, fw * 0.3, fh * 0.075, 0)),
        stroke: "#ffd94d",
        sw: fh * 0.11,
        opacity: 0.4,
        blur: Math.max(3, fh * 0.05),
      });
      shapes.push({
        d: ptsToPath(ellipsePts(c, fw * 0.3, fh * 0.075, 0)),
        grad: vGrad(c.x, c.y - fh * 0.075, c.y + fh * 0.075, [
          [0, "#fef9c3"],
          [0.5, "#facc15"],
          [1, "#eab308"],
        ]),
        gradTarget: "stroke",
        sw: Math.max(2.5, fh * 0.04),
      });
      shapes.push({
        d: ptsToPath(ellipsePts(c, fw * 0.3, fh * 0.075, 0)),
        stroke: "#fffbe6",
        sw: Math.max(1.2, fh * 0.014),
        opacity: 0.9,
      });
      break;
    }
    case "heart-cheeks": {
      const c1 = P2pt(le.x - ed * 0.18, le.y + ed * 0.6);
      const c2 = P2pt(re.x + ed * 0.18, re.y + ed * 0.6);
      // Blush glow under each heart so it melts into the cheek.
      for (const c of [c1, c2]) {
        shapes.push({
          d: ptsToPath(ellipsePts(c, ed * 0.3, ed * 0.22, roll)),
          fill: "#fda4af",
          opacity: 0.5,
          blend: "soft-light",
          blur: Math.max(2, ed * 0.05),
        });
      }
      for (const c of [c1, c2]) {
        shapes.push({
          d: heartPath(c, ed * 0.34, roll),
          grad: vGrad(c.x, c.y - ed * 0.15, c.y + ed * 0.2, [
            [0, "#fb7185"],
            [1, "#e11d48"],
          ]),
          opacity: 0.92,
        });
        const hl = rotPt(P2pt(c.x - ed * 0.07, c.y - ed * 0.07), c, roll);
        shapes.push({ d: circlePath(hl, ed * 0.032), fill: "#ffffff", opacity: 0.65 });
      }
      shapes.push({
        d: heartPath(P2pt(re.x + ed * 0.55, re.y - ed * 0.55), ed * 0.18, roll),
        grad: vGrad(re.x + ed * 0.55, re.y - ed * 0.63, re.y - ed * 0.44, [
          [0, "#fda4af"],
          [1, "#f43f5e"],
        ]),
        opacity: 0.75,
      });
      break;
    }
    case "gold-chain": {
      const a = P2pt(cxPx - fw * 0.58, chin.y + fh * 0.02);
      const b = P2pt(cxPx + fw * 0.58, chin.y + fh * 0.02);
      const ctrl = P2pt(cxPx, chin.y + fh * 0.55);
      const curve = quadPts(a, ctrl, b, 14);
      curve.forEach((p) => {
        const r = fw * 0.032;
        shapes.push({
          d: circlePath(p, r),
          grad: vGrad(p.x, p.y - r, p.y + r, [
            [0, "#fde68a"],
            [0.55, "#f59e0b"],
            [1, "#b45309"],
          ]),
          stroke: "#92400e",
          sw: 1,
        });
      });
      const bottom = curve[7] ?? P2pt(cxPx, chin.y + fh * 0.28);
      shapes.push({
        d: ptsToPath([
          P2pt(bottom.x, bottom.y - fh * 0.01),
          P2pt(bottom.x + fw * 0.075, bottom.y + fh * 0.06),
          P2pt(bottom.x, bottom.y + fh * 0.16),
          P2pt(bottom.x - fw * 0.075, bottom.y + fh * 0.06),
        ]),
        grad: vGrad(bottom.x, bottom.y - fh * 0.01, bottom.y + fh * 0.16, [
          [0, "#ecfeff"],
          [0.5, "#67e8f9"],
          [1, "#0284c7"],
        ]),
        stroke: "#075985",
        sw: 1.5,
      });
      shapes.push({
        d: ptsToPath(starPts(P2pt(bottom.x - fw * 0.02, bottom.y + fh * 0.045), fw * 0.02, fw * 0.008, 0, 4)),
        fill: "#ffffff",
        opacity: 0.9,
      });
      for (const s of [-1, 1]) {
        shapes.push({
          d: circlePath(P2pt(cxPx + s * fw * 0.53, cyPx + fh * 0.1), fw * 0.028),
          fill: "#fbbf24",
          stroke: "#92400e",
          sw: 1,
        });
      }
      break;
    }
    case "monocle": {
      shapes.push({
        d: ptsToPath(ellipsePts(re, ed * 0.36, ed * 0.36, 0)),
        fill: "rgba(255,255,255,0.07)",
        grad: vGrad(re.x, re.y - ed * 0.36, re.y + ed * 0.36, [
          [0, "#fde68a"],
          [0.5, "#d4af37"],
          [1, "#92600a"],
        ]),
        gradTarget: "stroke",
        sw: Math.max(2, ed * 0.045),
      });
      const sheen = rotPt(P2pt(re.x - ed * 0.08, re.y - ed * 0.08), re, -0.6);
      shapes.push({
        d: ptsToPath(ellipsePts(sheen, ed * 0.17, ed * 0.045, -0.6)),
        fill: "#ffffff",
        opacity: 0.22,
        blur: Math.max(1, ed * 0.015),
      });
      const chainPts = quadPts(
        P2pt(re.x + ed * 0.1, re.y + ed * 0.34),
        P2pt(re.x + ed * 0.55, chin.y),
        P2pt(re.x + ed * 0.3, chin.y + fh * 0.25),
        10,
      );
      shapes.push({
        d: ptsToPath(chainPts, false),
        stroke: "#d4af37",
        sw: Math.max(1.5, ed * 0.02),
        cap: true,
      });
      break;
    }
    case "flower-crown": {
      const petalColors = ["#f9a8d4", "#ffffff", "#fde68a"];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const fx = cxPx + (t - 0.5) * fw * 0.86;
        const fy = top + fh * 0.1 - Math.sin(t * Math.PI) * fh * 0.09;
        if (i < 6) {
          const lx = cxPx + (t - 0.5 + 1 / 12) * fw * 0.86;
          shapes.push({
            d: ptsToPath(ellipsePts(P2pt(lx, fy + fh * 0.045), fw * 0.045, fw * 0.02, 0.6)),
            fill: "#4ade80",
          });
        }
        const r = fw * 0.052;
        shapes.push({
          d: circlePath(P2pt(fx, fy + fh * 0.014), r * 1.35),
          fill: "#000000",
          opacity: 0.13,
          blur: Math.max(1.5, fw * 0.012),
        });
        for (let k = 0; k < 5; k++) {
          const ang = (k / 5) * Math.PI * 2 - Math.PI / 2;
          const pc = P2pt(fx + r * 0.95 * Math.cos(ang), fy + r * 0.95 * Math.sin(ang));
          const col = petalColors[i % petalColors.length] ?? "#f9a8d4";
          shapes.push({
            d: circlePath(pc, r * 0.62),
            grad: vGrad(pc.x, pc.y - r * 0.62, pc.y + r * 0.62, [
              [0, "#ffffff"],
              [0.35, col],
              [1, col],
            ]),
          });
        }
        shapes.push({
          d: circlePath(P2pt(fx, fy), r * 0.42),
          grad: vGrad(fx, fy - r * 0.42, fy + r * 0.42, [
            [0, "#fcd34d"],
            [1, "#d97706"],
          ]),
        });
      }
      break;
    }
    case "beauty": {
      // The beauty-filter look: a soft-light veil over the whole face
      // (reads as smoothed, glowing skin), blush on the cheeks, a lip
      // tint, and a catchlight sparkle in each eye.
      shapes.push({
        d: ptsToPath(ellipsePts(P2pt(cxPx, cyPx + fh * 0.03), fw * 0.52, fh * 0.52, roll)),
        fill: "#ffe9d6",
        opacity: 0.5,
        blend: "soft-light",
        blur: Math.max(2, fw * 0.05),
      });
      for (const [i, eye] of [le, re].entries()) {
        const s = i === 0 ? -1 : 1;
        shapes.push({
          d: ptsToPath(ellipsePts(P2pt(eye.x + s * ed * 0.24, eye.y + ed * 0.62), ed * 0.3, ed * 0.16, roll)),
          fill: "#fb9eb0",
          opacity: 0.55,
          blend: "soft-light",
          blur: Math.max(2, ed * 0.05),
        });
        const sp = rotPt(P2pt(eye.x - ed * 0.1, eye.y - ed * 0.07), eye, roll);
        shapes.push({ d: circlePath(sp, ed * 0.035), fill: "#ffffff", opacity: 0.85 });
      }
      shapes.push({
        d: ptsToPath(ellipsePts(mouth, ed * 0.24, ed * 0.09, roll)),
        fill: "#f27d92",
        opacity: 0.4,
        blend: "soft-light",
        blur: Math.max(1.5, ed * 0.03),
      });
      break;
    }
    case "neon": {
      const c = P2pt(cxPx, cyPx);
      // A glowing outline hugging the face: magenta echo, blurred cyan
      // glow, then a hot near-white core — light, not a line.
      shapes.push({
        d: ptsToPath(ellipsePts(P2pt(c.x + fw * 0.02, c.y + fh * 0.015), fw * 0.56, fh * 0.54, roll)),
        stroke: "#e879f9",
        sw: Math.max(2, ed * 0.045),
        opacity: 0.7,
        blur: Math.max(2, ed * 0.07),
      });
      shapes.push({
        d: ptsToPath(ellipsePts(c, fw * 0.53, fh * 0.51, roll)),
        stroke: "#22d3ee",
        sw: Math.max(2.5, ed * 0.055),
        opacity: 0.95,
        blur: Math.max(1.5, ed * 0.035),
      });
      shapes.push({
        d: ptsToPath(ellipsePts(c, fw * 0.53, fh * 0.51, roll)),
        stroke: "#ecfeff",
        sw: Math.max(1.2, ed * 0.018),
        opacity: 0.9,
      });
      for (const eye of [le, re]) {
        shapes.push({
          d: ptsToPath(ellipsePts(eye, ed * 0.3, ed * 0.22, roll)),
          stroke: "#22d3ee",
          sw: Math.max(1.5, ed * 0.03),
          opacity: 0.8,
          blur: Math.max(1, ed * 0.02),
        });
      }
      break;
    }
    case "butterfly": {
      const bf = (c: P2, s: number, a: number, topCol: string, bottomCol: string) => {
        const g = vGrad(c.x, c.y - s, c.y + s, [
          [0, topCol],
          [1, bottomCol],
        ]);
        for (const sd of [-1, 1]) {
          shapes.push({
            d: ptsToPath(ellipsePts(rotPt(P2pt(c.x + sd * s * 0.52, c.y - s * 0.28), c, a), s * 0.55, s * 0.34, a + sd * 0.6)),
            grad: g,
            opacity: 0.92,
          });
          shapes.push({
            d: ptsToPath(ellipsePts(rotPt(P2pt(c.x + sd * s * 0.42, c.y + s * 0.3), c, a), s * 0.42, s * 0.26, a + sd * 0.35)),
            grad: g,
            opacity: 0.85,
          });
          // Wing spots, like a real butterfly's markings.
          shapes.push({
            d: circlePath(rotPt(P2pt(c.x + sd * s * 0.55, c.y - s * 0.3), c, a), s * 0.13),
            fill: "#ffffff",
            opacity: 0.75,
          });
        }
        shapes.push({ d: ptsToPath(ellipsePts(c, s * 0.13, s * 0.5, a)), fill: "#312e81" });
        shapes.push({ d: circlePath(P2pt(c.x, c.y - s * 0.55), s * 0.16), fill: "#312e81" });
      };
      bf(P2pt(cxPx + fw * 0.52, top + fh * 0.04), fw * 0.16, -0.35, "#c4b5fd", "#a855f7");
      bf(P2pt(cxPx - fw * 0.56, cyPx + fh * 0.3), fw * 0.12, 0.3, "#f0abfc", "#d946ef");
      bf(P2pt(cxPx + fw * 0.36, chin.y + fh * 0.18), fw * 0.09, -0.15, "#93c5fd", "#6366f1");
      break;
    }
    case "devil": {
      for (const s of [-1, 1]) {
        const bx = cxPx + s * fw * 0.3;
        const horn = [
          P2pt(bx - fw * 0.13, top + fh * 0.13),
          P2pt(bx - fw * 0.03, top - fh * 0.28),
          P2pt(bx + s * fw * 0.04, top - fh * 0.33),
          P2pt(bx + fw * 0.12, top + fh * 0.11),
          P2pt(bx + s * fw * 0.02, top + fh * 0.03),
        ];
        shapes.push({
          d: ptsToPath(horn.map((p) => P2pt(p.x, p.y + fh * 0.018))),
          fill: "#000000",
          opacity: 0.25,
          blur: Math.max(1.5, ed * 0.03),
        });
        shapes.push({
          d: ptsToPath(horn),
          grad: vGrad(bx, top - fh * 0.33, top + fh * 0.13, [
            [0, "#fca5a5"],
            [0.5, "#dc2626"],
            [1, "#7f1d1d"],
          ]),
          stroke: "#450a0a",
          sw: Math.max(1, ed * 0.015),
        });
        shapes.push({
          d: ptsToPath(ellipsePts(P2pt(bx - s * fw * 0.01, top - fh * 0.1), fw * 0.02, fh * 0.1, s * 0.25)),
          fill: "#ffffff",
          opacity: 0.32,
          blur: Math.max(1, ed * 0.02),
        });
      }
      break;
    }
  }
  return shapes;
}

// ---------------------------------------------------------------------------
// Face warps — the face-changer lenses. A warp is a set of radial bulges
// pinned to landmarks: inside a bulge's radius the image is resampled
// from a smaller window (magnify, k > 0 — Mega Eyes) or a larger one
// (pinch, k < 0 — Alien's narrow chin), with a soft feathered edge so
// the bend melts into the untouched photo. No artwork is drawn; the
// person's real face is what changes, which is the whole point.
// ---------------------------------------------------------------------------

export interface WarpBulge {
  cx: number; // center, px in the output frame
  cy: number;
  r: number; // radius, px
  k: number; // strength: + magnifies, − pinches
}

export function warpBulges(kind: WarpKind, f: FaceLandmarks, W: number): WarpBulge[] {
  const le = { x: f.leftEye.x * W, y: f.leftEye.y * W };
  const re = { x: f.rightEye.x * W, y: f.rightEye.y * W };
  const chin = { x: f.chin.x * W, y: f.chin.y * W };
  const cx = f.cx * W;
  const cy = f.cy * W;
  const fw = f.w * W;
  const fh = f.h * W;
  const ed = Math.max(24, Math.hypot(re.x - le.x, re.y - le.y));
  switch (kind) {
    case "mega-eyes":
      return [
        { cx: le.x, cy: le.y, r: ed * 0.52, k: 0.55 },
        { cx: re.x, cy: re.y, r: ed * 0.52, k: 0.55 },
      ];
    case "puffy":
      return [{ cx, cy: cy + fh * 0.06, r: fw * 0.72, k: 0.34 }];
    case "alien":
      return [
        { cx: le.x, cy: le.y, r: ed * 0.5, k: 0.3 },
        { cx: re.x, cy: re.y, r: ed * 0.5, k: 0.3 },
        { cx: (le.x + re.x) / 2, cy: (le.y + re.y) / 2 - ed * 0.55, r: ed * 1.15, k: 0.22 },
        { cx: chin.x, cy: chin.y - ed * 0.1, r: ed * 1.05, k: -0.5 },
      ];
  }
}

// Natural pixel size of a warp source (video / image / canvas).
export function srcDims(source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): { w: number; h: number } {
  if (source instanceof HTMLVideoElement) return { w: source.videoWidth, h: source.videoHeight };
  if (source instanceof HTMLImageElement) return { w: source.naturalWidth || source.width, h: source.naturalHeight || source.height };
  return { w: source.width, h: source.height };
}

// Applies warp bulges to a frame already drawn on `ctx` (in output /
// device pixel space, identity transform). Each bulge is resampled from
// `source` — the same image that was drawn, unwarped — through a
// feathered circular mask on a scratch canvas. `flipX` says the drawn
// frame was mirrored relative to the source (front-camera bakes).
export function applyWarp(
  ctx: CanvasRenderingContext2D,
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  dw: number,
  dh: number,
  bulges: WarpBulge[],
  flipX: boolean,
) {
  const { w: sw, h: sh } = srcDims(source);
  if (!sw || !sh || !dw || !dh) return;
  for (const b of bulges) {
    const m = 1 + b.k;
    if (m <= 0.05) continue;
    const sampleR = b.r / m;
    const size = Math.max(2, Math.ceil(b.r * 2));
    const tmp = document.createElement("canvas");
    tmp.width = size;
    tmp.height = size;
    const tctx = tmp.getContext("2d");
    if (!tctx) continue;
    const sxUser = flipX ? dw - (b.cx + sampleR) : b.cx - sampleR;
    const syUser = b.cy - sampleR;
    tctx.drawImage(
      source,
      (sxUser / dw) * sw,
      (syUser / dh) * sh,
      (sampleR * 2 * sw) / dw,
      (sampleR * 2 * sh) / dh,
      0,
      0,
      size,
      size,
    );
    // Feather the rim so the warp blends into the untouched frame.
    const mask = tctx.createRadialGradient(b.r, b.r, b.r * 0.55, b.r, b.r, b.r);
    mask.addColorStop(0, "rgba(0,0,0,1)");
    mask.addColorStop(1, "rgba(0,0,0,0)");
    tctx.globalCompositeOperation = "destination-in";
    tctx.fillStyle = mask;
    tctx.fillRect(0, 0, size, size);
    tctx.globalCompositeOperation = "source-over";
    ctx.drawImage(tmp, b.cx - b.r, b.cy - b.r, size, size);
  }
}

// Resolves a shape's paint (flat color or gradient) for one target.
// A gradient paints the fill unless gradTarget says "stroke".
function shapePaint(
  ctx: CanvasRenderingContext2D,
  s: LensShape,
  target: "fill" | "stroke",
): string | CanvasGradient | null {
  if (s.grad && (s.gradTarget ?? "fill") === target) {
    const g = ctx.createLinearGradient(s.grad.x1, s.grad.y1, s.grad.x2, s.grad.y2);
    for (const [off, col] of s.grad.stops) g.addColorStop(off, col);
    return g;
  }
  const flat = target === "fill" ? s.fill : s.stroke;
  return flat ?? null;
}

// Draws a lens onto a canvas (photo bake + the video recording pipeline).
export function drawLensCanvas(
  ctx: CanvasRenderingContext2D,
  kind: LensKind,
  face: FaceLandmarks,
  width: number,
) {
  for (const s of lensShapes(kind, face, width)) {
    const path = new Path2D(s.d);
    ctx.save();
    if (s.opacity != null) ctx.globalAlpha = s.opacity;
    if (s.blend) ctx.globalCompositeOperation = s.blend;
    if (s.blur) {
      try {
        ctx.filter = `blur(${s.blur}px)`;
      } catch {
        // Canvas filter unsupported — draw the shape sharp.
      }
    }
    const fillPaint = shapePaint(ctx, s, "fill");
    if (fillPaint) {
      ctx.fillStyle = fillPaint;
      ctx.fill(path, s.evenOdd ? "evenodd" : "nonzero");
    }
    const strokePaint = shapePaint(ctx, s, "stroke");
    if (strokePaint) {
      ctx.strokeStyle = strokePaint;
      ctx.lineWidth = s.sw ?? 2;
      ctx.lineCap = s.cap ? "round" : "butt";
      ctx.stroke(path);
    }
    ctx.restore();
  }
}

function SnapStickerSpan({ s, frameWidth }: { s: SnapSticker; frameWidth: number }) {
  const px = Math.max(18, s.size * frameWidth);
  return (
    <span
      aria-hidden="true"
      className={s.anim === "float" ? "snap-float" : s.anim === "twinkle" ? "snap-twinkle" : undefined}
      style={{
        position: "absolute",
        left: `${s.x * 100}%`,
        top: `${s.y * 100}%`,
        transform: "translate(-50%, -50%)",
        fontSize: px,
        lineHeight: 1,
        animationDelay: s.delay ? `${s.delay}s` : undefined,
        pointerEvents: "none",
      }}
    >
      {s.emoji}
    </span>
  );
}

// The SVG half of the lens renderer: same geometry as the canvas bake,
// with gradients, soft-edge blurs, and blend modes resolved to SVG
// paint servers / filters / mix-blend-mode so the live preview shades
// exactly like the baked photo.
export function LensSvgShapes({
  kind,
  face,
  width,
  idPrefix,
}: {
  kind: LensKind;
  face: FaceLandmarks;
  width: number;
  idPrefix: string;
}) {
  const shapes = lensShapes(kind, face, width);
  const paint = (s: LensShape, i: number, target: "fill" | "stroke"): string => {
    if (s.grad && (s.gradTarget ?? "fill") === target) {
      return `url(#${idPrefix}-g${i})`;
    }
    return (target === "fill" ? s.fill : s.stroke) ?? "none";
  };
  return (
    <>
      <defs>
        {shapes.map((s, i) =>
          s.grad ? (
            <linearGradient
              key={`g${i}`}
              id={`${idPrefix}-g${i}`}
              gradientUnits="userSpaceOnUse"
              x1={s.grad.x1}
              y1={s.grad.y1}
              x2={s.grad.x2}
              y2={s.grad.y2}
            >
              {s.grad.stops.map(([off, col], j) => (
                <stop key={j} offset={off} stopColor={col} />
              ))}
            </linearGradient>
          ) : null,
        )}
        {shapes.map((s, i) =>
          s.blur ? (
            <filter key={`b${i}`} id={`${idPrefix}-b${i}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation={Math.max(0.4, s.blur / 2)} />
            </filter>
          ) : null,
        )}
      </defs>
      {shapes.map((s, i) => (
        <path
          key={i}
          d={s.d}
          fill={paint(s, i, "fill")}
          stroke={paint(s, i, "stroke")}
          strokeWidth={s.sw}
          opacity={s.opacity}
          fillRule={s.evenOdd ? "evenodd" : undefined}
          strokeLinecap={s.cap ? "round" : undefined}
          filter={s.blur ? `url(#${idPrefix}-b${i})` : undefined}
          style={s.blend ? { mixBlendMode: s.blend } : undefined}
        />
      ))}
    </>
  );
}

// Picker icon showing the actual lens art on a face — the way
// Snapchat's lens carousel looks — instead of a plain color swatch.
// Warp lenses show their bend zones as dashed rings on the face.
export function LensIcon({ def, size }: { def: SnapFilterDef; size: number }) {
  const face = faceFromBox(0.2, 0.2, 0.6, 0.68, 1);
  return (
    <span
      className="relative block shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size, background: def.swatch }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <ellipse cx={50} cy={54} rx={30} ry={34} fill="#eec39a" />
        <ellipse cx={38} cy={48.6} rx={4.2} ry={3} fill="#3f3128" />
        <ellipse cx={62} cy={48.6} rx={4.2} ry={3} fill="#3f3128" />
        <path d="M 42 71 Q 50 76.5 58 71" stroke="#b06a4a" strokeWidth={2.4} fill="none" strokeLinecap="round" />
        {def.lens && <LensSvgShapes kind={def.lens} face={face} width={100} idPrefix={`icon-${def.id}`} />}
        {def.warp &&
          warpBulges(def.warp, face, 100).map((b, i) => (
            <g key={i}>
              <circle cx={b.cx} cy={b.cy} r={b.r} fill="#ffffff" opacity={0.22} />
              <circle
                cx={b.cx}
                cy={b.cy}
                r={b.r}
                fill="none"
                stroke="#ffffff"
                strokeWidth={2}
                strokeDasharray="4 3"
                opacity={0.85}
              />
            </g>
          ))}
      </svg>
    </span>
  );
}

// The overlay for a filter, rendered over a relatively-positioned frame
// (camera preview or a sent snap). Color looks show their frame tint and
// legacy filters show their emoji stickers. Face lenses render as SVG
// from the same geometry the canvas bake uses — but only when `live` is
// set (the camera preview): in a sent snap the lens is already baked
// into the pixels, so drawing it again would double it.
export function SnapFilterOverlay({
  filterId,
  frameWidth,
  face,
  live,
}: {
  filterId: string;
  frameWidth: number;
  face?: FaceLandmarks | null;
  live?: boolean;
}) {
  const def = snapFilterById(filterId);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth > 0) setBox({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [filterId]);
  if (def.id === "none") return null;
  const lensFace = face ?? (box ? guideFace(box.w, box.h) : null);
  return (
    <div ref={boxRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {def.frame && <div className="absolute inset-0" style={{ background: def.frame }} />}
      {def.lens && live && box && lensFace && (
        <svg
          key={face ? "locked" : "ring"}
          className="lens-pop absolute inset-0 h-full w-full"
          style={{ transformOrigin: "50% 35%" }}
          viewBox={`0 0 ${box.w} ${box.h}`}
          aria-hidden="true"
        >
          <LensSvgShapes kind={def.lens} face={lensFace} width={box.w} idPrefix="live" />
        </svg>
      )}
      {(def.face ?? []).map((s, i) => (
        <SnapStickerSpan key={`f${i}`} s={s} frameWidth={frameWidth} />
      ))}
      {(def.deco ?? []).map((s, i) => (
        <SnapStickerSpan key={`d${i}`} s={s} frameWidth={frameWidth} />
      ))}
    </div>
  );
}

// Approximates a filter's CSS gradient frame on canvas: a soft
// full-frame tint (warm gold for Golden Hour, a rainbow mix otherwise).
export function applyFrameTint(
  ctx: CanvasRenderingContext2D,
  def: SnapFilterDef,
  width: number,
  height: number,
) {
  if (!def.frame) return;
  ctx.save();
  ctx.globalAlpha = 0.14;
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, "#ff5ea8");
  grad.addColorStop(0.5, "#ffb03a");
  grad.addColorStop(1, "#4d96ff");
  ctx.fillStyle = def.id === "golden-hour" ? "#ff9a1f" : grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// Bakes a filter into a captured photo canvas: the CSS color treatment
// (via the canvas 2D filter, where the browser supports it), the frame
// tint, and the face lens drawn from the landmarks captured with the
// shot (the guide-ring face when none were captured). Legacy filters
// draw their emoji stickers instead. The color treatment is best-effort
// — a browser without canvas-filter support still gets the rest.
export function bakeSnapFilter(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  width: number,
  height: number,
  filterId: SnapFilterId,
  mirrored: boolean,
  face?: FaceLandmarks | null,
) {
  const def = snapFilterById(filterId);
  ctx.save();
  if (mirrored) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  try {
    ctx.filter = def.css || "none";
  } catch {
    // Canvas filter unsupported — draw the frame as-is.
  }
  ctx.drawImage(video, 0, 0, width, height);
  ctx.restore();
  try {
    ctx.filter = "none";
  } catch {
    // ignore
  }
  if (def.id === "none") return;
  if (def.warp) {
    // Bend the photo itself around the face before any tint/artwork.
    applyWarp(ctx, video, width, height, warpBulges(def.warp, face ?? guideFace(width, height), width), mirrored);
  }
  applyFrameTint(ctx, def, width, height);
  if (def.lens) {
    drawLensCanvas(ctx, def.lens, face ?? guideFace(width, height), width);
  }
  const drawSticker = (s: SnapSticker) => {
    const px = Math.max(18, s.size * width);
    ctx.save();
    ctx.font = `${px}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.emoji, s.x * width, s.y * height);
    ctx.restore();
  };
  for (const s of def.face ?? []) drawSticker(s);
  for (const s of def.deco ?? []) drawSticker(s);
}

export function fmtSnapDuration(ms: number): string {
  if (!ms || ms <= 0) return "";
  const total = Math.round(ms / 1000);
  return `0:${String(total).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Snap editor — after a photo is taken, it can be edited before sending:
// swap the funny filter, crop it, and stamp text on it. Edits re-bake from
// the original (unfiltered) capture, so they can be changed or undone as
// often as the user likes. Text is drawn Snapchat-style: white bold words
// on a soft dark band, at the top, middle, or bottom of the photo.
// ---------------------------------------------------------------------------

export type SnapTextPos = "top" | "middle" | "bottom";
export type SnapCropId = "full" | "square" | "portrait" | "story";

export const SNAP_CROPS: { id: SnapCropId; name: string; ratio: number | null }[] = [
  { id: "full", name: "Full", ratio: null },
  { id: "square", name: "Square", ratio: 1 },
  { id: "portrait", name: "Portrait", ratio: 4 / 5 },
  { id: "story", name: "Story", ratio: 9 / 16 },
];

export function drawSnapText(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
  pos: SnapTextPos,
) {
  const clean = text.trim();
  if (!clean) return;
  const fontPx = Math.max(22, Math.round(width * 0.064));
  ctx.save();
  ctx.font = `700 ${fontPx}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Greedy word wrap to at most 3 lines.
  const maxW = width * 0.86;
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = w;
      if (lines.length === 3) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < 3) lines.push(line);
  if (lines.length === 0) lines.push(clean.slice(0, 40));
  const lineH = fontPx * 1.28;
  const blockH = lines.length * lineH + fontPx * 0.75;
  const cy = pos === "top" ? height * 0.16 : pos === "middle" ? height * 0.5 : height * 0.85;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, cy - blockH / 2, width, blockH);
  ctx.fillStyle = "#ffffff";
  lines.forEach((l, i) => {
    ctx.fillText(l, width / 2, cy + (i - (lines.length - 1) / 2) * lineH, maxW);
  });
  ctx.restore();
}

// Re-bakes an edited photo from its original capture: center-crop to the
// chosen shape, apply the filter, then stamp the text. Returns a
// JPEG blob, or null when the browser couldn't do it (the caller keeps
// the unedited photo in that case). `face` carries the landmarks captured
// with the shot so a face lens lands on the real face; it is re-mapped
// into the crop's coordinate space below. Null = guide-ring face.
export async function bakeEditedPhoto(
  rawBlob: Blob,
  filterId: SnapFilterId,
  cropId: SnapCropId,
  text: string,
  pos: SnapTextPos,
  face?: FaceLandmarks | null,
): Promise<Blob | null> {
  const url = URL.createObjectURL(rawBlob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("photo load failed"));
      img.src = url;
    });
    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    if (!sw || !sh) return null;
    const ratio = SNAP_CROPS.find((c) => c.id === cropId)?.ratio ?? null;
    let sx = 0;
    let sy = 0;
    let cw = sw;
    let ch = sh;
    if (ratio) {
      const srcRatio = sw / sh;
      if (srcRatio > ratio) {
        cw = Math.round(sh * ratio);
        sx = Math.round((sw - cw) / 2);
      } else {
        ch = Math.round(sw / ratio);
        sy = Math.round((sh - ch) / 2);
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Draw just the crop region into a scratch canvas, then run the
    // standard filter bake over that frame.
    const scratch = document.createElement("canvas");
    scratch.width = cw;
    scratch.height = ch;
    const sctx = scratch.getContext("2d");
    if (!sctx) return null;
    sctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch);
    // Re-map the face into the cropped frame: aspect-space points are
    // pixel positions in units of the source width, so shift by the crop
    // origin and rescale by the crop width.
    const srcFace = face ?? guideFace(sw, sh);
    const cropPt = (p: FacePt): FacePt => ({
      x: (p.x * sw - sx) / cw,
      y: (p.y * sw - sy) / cw,
    });
    const cropFace: FaceLandmarks = {
      leftEye: cropPt(srcFace.leftEye),
      rightEye: cropPt(srcFace.rightEye),
      nose: cropPt(srcFace.nose),
      mouth: cropPt(srcFace.mouth),
      chin: cropPt(srcFace.chin),
      cx: (srcFace.cx * sw - sx) / cw,
      cy: (srcFace.cy * sw - sy) / cw,
      w: (srcFace.w * sw) / cw,
      h: (srcFace.h * sw) / cw,
      roll: srcFace.roll,
    };
    bakeSnapFilter(ctx, scratch, cw, ch, filterId, false, cropFace);
    drawSnapText(ctx, cw, ch, text, pos);
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.87);
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------------------
// Star in the video — bake the user's own photo into a music-video star
// frame: a stage color grade, a spotlight, and a "STARRING YOU" banner
// naming the song, drawn on canvas so the finished snap really is the
// user's face/body as the performer. The song is attached to the snap and
// plays from the message, like the music-video mode. Honest limit (also
// stated in the camera UI): this puts the user's real photo center-stage
// as the singer — it does not swap their face into the artist's actual
// video footage, which would need a video face-swap service SoundChat
// doesn't have.
// ---------------------------------------------------------------------------

export const STAR_W = 1080;
export const STAR_H = 1350;

function fitStarFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  weight: number,
): number {
  let px = startPx;
  ctx.font = `${weight} ${px}px system-ui, sans-serif`;
  while (px > 16 && ctx.measureText(text).width > maxWidth) {
    px -= 4;
    ctx.font = `${weight} ${px}px system-ui, sans-serif`;
  }
  return px;
}

export function bakeStarFrame(
  ctx: CanvasRenderingContext2D,
  source: HTMLVideoElement | HTMLImageElement,
  sourceWidth: number,
  sourceHeight: number,
  mirrored: boolean,
  track: { title: string; artist: string },
) {
  const w = STAR_W;
  const h = STAR_H;
  const scale = Math.max(w / sourceWidth, h / sourceHeight);
  const dw = sourceWidth * scale;
  const dh = sourceHeight * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;
  ctx.save();
  if (mirrored) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  try {
    ctx.filter = "saturate(1.28) contrast(1.1) brightness(1.04)";
  } catch {
    // Canvas filter unsupported — the frame and banner still bake.
  }
  ctx.drawImage(source, dx, dy, dw, dh);
  ctx.restore();
  try {
    ctx.filter = "none";
  } catch {
    // ignore
  }
  // Spotlight wash from top center.
  const spot = ctx.createRadialGradient(w / 2, h * 0.12, 40, w / 2, h * 0.12, h * 0.72);
  spot.addColorStop(0, "rgba(255,216,150,0.34)");
  spot.addColorStop(1, "rgba(255,216,150,0)");
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, w, h);
  // Vignette so the performer pops.
  const vig = ctx.createRadialGradient(w / 2, h * 0.46, h * 0.28, w / 2, h * 0.5, h * 0.78);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  // Bottom banner gradient + credits.
  const banner = ctx.createLinearGradient(0, h * 0.68, 0, h);
  banner.addColorStop(0, "rgba(0,0,0,0)");
  banner.addColorStop(0.45, "rgba(0,0,0,0.72)");
  banner.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.fillStyle = banner;
  ctx.fillRect(0, h * 0.68, w, h * 0.32);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffb03a";
  fitStarFont(ctx, "★ STARRING YOU ★", w * 0.86, 56, 800);
  ctx.fillText("★ STARRING YOU ★", w / 2, h * 0.845);
  ctx.fillStyle = "#ffffff";
  fitStarFont(ctx, track.title, w * 0.88, 62, 800);
  ctx.fillText(track.title, w / 2, h * 0.905);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  fitStarFont(ctx, `as the singer · ${track.artist}`, w * 0.88, 42, 500);
  ctx.fillText(`as the singer · ${track.artist}`, w / 2, h * 0.955);
}

// ---------------------------------------------------------------------------
// On-device encryption for messages and snaps
//
// Text messages, snap captions, and snap media are encrypted in the browser
// with AES-256-GCM (WebCrypto) BEFORE they are sent to storage, and
// decrypted here on the way out. The key is generated on this device and
// kept in this browser's local storage — it is never sent to the server,
// so SoundChat's storage only ever holds scrambled ciphertext for those.
// Honest limits: the key lives in this browser, so chats read on a browser
// without the key show as locked; song shares and call log lines are not
// encrypted (they're catalog/call metadata, not your words); and this is
// encryption on one device's storage — SoundChat is not a decentralized
// network yet (see the Privacy card in Profile).
// ---------------------------------------------------------------------------

const ENC_TEXT_PREFIX = "enc:v1:";
const SNAP_ENC_MAGIC: readonly number[] = [0x53, 0x43, 0x45, 0x4e, 0x43, 0x31]; // "SCENC1"

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

let deviceKeyPromise: Promise<CryptoKey | null> | null = null;

function getDeviceKey(): Promise<CryptoKey | null> {
  if (!deviceKeyPromise) {
    deviceKeyPromise = (async () => {
      try {
        if (typeof crypto === "undefined" || !crypto.subtle) return null;
        const stored = window.localStorage.getItem("soundchat-device-key");
        if (stored) {
          return await crypto.subtle.importKey(
            "raw",
            b64ToBytes(stored) as BufferSource,
            { name: "AES-GCM" },
            true,
            ["encrypt", "decrypt"],
          );
        }
        const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
          "encrypt",
          "decrypt",
        ]);
        const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
        try {
          window.localStorage.setItem("soundchat-device-key", bytesToBase64(raw));
        } catch {
          // Storage full/blocked: the key still works for this session.
        }
        return key;
      } catch {
        return null;
      }
    })();
  }
  return deviceKeyPromise;
}

export function isEncryptedText(value: string): boolean {
  return value.startsWith(ENC_TEXT_PREFIX);
}

export async function encryptTextValue(plain: string): Promise<string | null> {
  const key = await getDeviceKey();
  if (!key) return null;
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, new TextEncoder().encode(plain)),
    );
    const packed = new Uint8Array(iv.length + ct.length);
    packed.set(iv);
    packed.set(ct, iv.length);
    return ENC_TEXT_PREFIX + bytesToBase64(packed);
  } catch {
    return null;
  }
}

export async function decryptTextValue(value: string): Promise<string | null> {
  if (!isEncryptedText(value)) return value;
  const key = await getDeviceKey();
  if (!key) return null;
  try {
    const packed = b64ToBytes(value.slice(ENC_TEXT_PREFIX.length));
    const iv = packed.subarray(0, 12);
    const ct = packed.subarray(12);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ct as BufferSource,
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

export async function encryptMediaBlob(blob: Blob): Promise<Blob | null> {
  const key = await getDeviceKey();
  if (!key) return null;
  try {
    const raw = new Uint8Array(await blob.arrayBuffer());
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, raw as BufferSource),
    );
    const out = new Uint8Array(SNAP_ENC_MAGIC.length + iv.length + ct.length);
    out.set(SNAP_ENC_MAGIC, 0);
    out.set(iv, SNAP_ENC_MAGIC.length);
    out.set(ct, SNAP_ENC_MAGIC.length + iv.length);
    return new Blob([out as BlobPart], { type: blob.type });
  } catch {
    return null;
  }
}

export function isEncryptedMedia(bytes: Uint8Array): boolean {
  return bytes.length > 18 && SNAP_ENC_MAGIC.every((b, i) => bytes[i] === b);
}

export async function decryptMediaBytes(bytes: Uint8Array): Promise<Uint8Array | null> {
  const key = await getDeviceKey();
  if (!key) return null;
  try {
    const iv = bytes.subarray(SNAP_ENC_MAGIC.length, SNAP_ENC_MAGIC.length + 12);
    const ct = bytes.subarray(SNAP_ENC_MAGIC.length + 12);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ct as BufferSource,
    );
    return new Uint8Array(pt);
  } catch {
    return null;
  }
}

// Renders message text, decrypting on-device ciphertext when needed.
// Plain (older) values render as-is.
function DecryptedText({ value }: { value: string }) {
  const [text, setText] = useState<string | null>(() => (isEncryptedText(value) ? null : value));
  useEffect(() => {
    if (!isEncryptedText(value)) {
      setText(value);
      return;
    }
    let alive = true;
    setText(null);
    void decryptTextValue(value).then((d) => {
      if (alive) {
        setText(d ?? "Encrypted — this device doesn't have the key to read this.");
      }
    });
    return () => {
      alive = false;
    };
  }, [value]);
  return <>{text ?? "Decrypting…"}</>;
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

interface PlayerApi {
  current: Track | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  ducked: boolean;
  musicVolume: number;
  play: (t: Track) => void;
  playOverCall: (t: Track) => void;
  seek: (seconds: number) => void;
  setDucked: (v: boolean) => void;
  setMusicVolume: (v: number) => void;
  toggle: () => void;
  stop: () => void;
}

const PlayerContext = createContext<PlayerApi | null>(null);

function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer outside provider");
  return ctx;
}

function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ducked, setDuckedState] = useState(false);
  const [musicVolume, setMusicVolumeState] = useState(0.35);

  const setDucked = (v: boolean) => {
    setDuckedState(v);
    const audio = audioRef.current;
    if (audio) audio.volume = v ? musicVolume : 1;
  };

  const setMusicVolume = (v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setMusicVolumeState(clamped);
    const audio = audioRef.current;
    if (audio && ducked) audio.volume = clamped;
  };

  const logPlay = useMutation({
    mutationFn: async (t: Track) => await api.logPlay({ track: toTrackIn(t) }),
    onError: () => undefined,
  });

  const play = (t: Track) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (current && current.trackId === t.trackId) {
      if (audio.paused) void audio.play();
      else audio.pause();
      return;
    }
    setCurrent(t);
    setProgress(0);
    audio.src = t.previewUrl;
    void audio.play();
    // Offline plays use a SoundChat-storage URL for the preview; don't send
    // that URL back as the track's catalog URL when logging the play.
    if (!t.previewUrl.includes("/blobs/")) logPlay.mutate(t);
  };

  const playOverCall = (t: Track) => {
    const audio = audioRef.current;
    if (!audio) return;
    // Music sits under the voices: duck it down so talking can continue over it.
    setDuckedState(true);
    audio.volume = musicVolume;
    if (current && current.trackId === t.trackId) {
      if (audio.paused) void audio.play();
      return;
    }
    setCurrent(t);
    setProgress(0);
    audio.src = t.previewUrl;
    void audio.play();
    if (!t.previewUrl.includes("/blobs/")) logPlay.mutate(t);
  };

  const seek = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = Math.max(0, seconds);
    try {
      audio.currentTime = target;
    } catch {
      // Seeking before metadata loads can throw in some browsers; the
      // progress display simply stays where it was.
    }
    setProgress(target);
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  const stop = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setCurrent(null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setDuckedState(false);
    if (audio) audio.volume = 1;
  };

  return (
    <PlayerContext.Provider value={{ current, isPlaying, progress, duration, ducked, musicVolume, play, playOverCall, seek, setDucked, setMusicVolume, toggle, stop }}>
      {children}
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
      />
    </PlayerContext.Provider>
  );
}

function EqBars({ playing }: { playing: boolean }) {
  return (
    <div className={`flex h-5 items-end gap-[3px] ${playing ? "" : "eq-paused"}`} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="eq-bar w-[3px] rounded-full bg-[var(--amber)]"
          style={{ height: "100%", animationDelay: `${i * 0.18}s`, animationDuration: `${0.7 + i * 0.13}s` }}
        />
      ))}
    </div>
  );
}

function MiniPlayer({ onExpand }: { onExpand?: () => void }) {
  const player = usePlayer();
  const { current } = player;
  if (!current) return null;
  const pct = player.duration > 0 ? Math.min(100, (player.progress / player.duration) * 100) : 0;
  return (
    <div className="shrink-0 bg-[var(--player-bg)] text-[var(--player-text)]">
      <div className="h-[3px] w-full bg-white/15">
        <div className="h-full bg-[var(--accent)] transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-3 px-3 py-2">
        <button
          type="button"
          onClick={onExpand}
          aria-label={`Watch ${current.title} with animated visuals`}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {current.artworkUrl ? (
            <img src={current.artworkUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <MusicIcon />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{current.title}</p>
            <p className="truncate text-xs opacity-70">{current.artist} · tap to watch</p>
          </div>
        </button>
        <EqBars playing={player.isPlaying} />
        <button
          type="button"
          onClick={player.toggle}
          aria-label={player.isPlaying ? `Pause ${current.title}` : `Play ${current.title}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white"
        >
          {player.isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          onClick={onExpand}
          aria-label="Open the full-screen Watch view"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full opacity-70"
        >
          <ExpandIcon />
        </button>
        <button
          type="button"
          onClick={player.stop}
          aria-label="Close player"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full opacity-70"
        >
          <XIcon />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Now Playing "Watch" view — every song gets moving visuals while it plays
// instead of a static screen: the album artwork slowly zooms over its own
// blurred backdrop, a colored glow turns behind it, notes drift up, and
// the equalizer dances. From here the user can jump straight into filming
// a music video (or a Star snap) with the song that's playing. Honest
// limit, stated on screen: these are animated visuals from the album art —
// SoundChat plays the song's 30-second preview and does not stream the
// artist's official video.
// ---------------------------------------------------------------------------

function NowPlayingView({
  onClose,
  onFilm,
}: {
  onClose: () => void;
  onFilm: (track: Track, mode: "music" | "star") => void;
}) {
  const player = usePlayer();
  const { current } = player;
  const [artFailed, setArtFailed] = useState(false);
  if (!current) return null;
  const dur = player.duration > 0 ? player.duration : current.durationMs / 1000;
  const pct = dur > 0 ? Math.min(100, (player.progress / dur) * 100) : 0;
  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[#0b090e] text-white" role="dialog" aria-modal="true" aria-label={`Now playing: ${current.title}`}>
      {current.artworkUrl && !artFailed && (
        <img
          src={current.artworkUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full scale-150 object-cover opacity-45 blur-2xl"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" aria-hidden="true" />

      <div className="relative flex items-center justify-between px-3 pt-safe">
        <p className="flex items-center gap-2 font-display text-sm font-bold">
          <VideoIcon /> Watch · Now playing
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Watch view"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"
        >
          <XIcon />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-6">
        <div className="relative">
          <div
            className="mv-glow pointer-events-none absolute -inset-7 rounded-full opacity-70"
            style={{
              background:
                "conic-gradient(from 0deg, rgba(230,62,29,0.0), rgba(230,62,29,0.55), rgba(217,138,6,0.5), rgba(14,165,233,0.45), rgba(230,62,29,0.0))",
              filter: "blur(18px)",
            }}
            aria-hidden="true"
          />
          {current.artworkUrl && !artFailed ? (
            <div className="relative h-60 w-60 overflow-hidden rounded-3xl shadow-2xl sm:h-72 sm:w-72">
              <img
                src={current.artworkUrl}
                alt={`Album artwork for ${current.title}`}
                className={`h-full w-full object-cover ${player.isPlaying ? "mv-art" : ""}`}
                onError={() => setArtFailed(true)}
              />
            </div>
          ) : (
            <div className="relative flex h-60 w-60 items-center justify-center rounded-3xl bg-white/10 sm:h-72 sm:w-72">
              <MusicIcon />
            </div>
          )}
          {player.isPlaying && (
            <>
              <span className="mv-note pointer-events-none absolute -left-3 top-6 text-[var(--amber)]" style={{ animationDelay: "0s" }} aria-hidden="true">
                <MusicIcon />
              </span>
              <span className="mv-note pointer-events-none absolute -right-2 top-16 text-white/85" style={{ animationDelay: "1.3s" }} aria-hidden="true">
                <MusicIcon />
              </span>
              <span className="mv-note pointer-events-none absolute -left-1 bottom-10 text-white/70" style={{ animationDelay: "2.4s" }} aria-hidden="true">
                <MusicIcon />
              </span>
            </>
          )}
        </div>

        <h2 className="mt-7 max-w-full truncate text-center font-display text-2xl font-extrabold">{current.title}</h2>
        <p className="mt-1 max-w-full truncate text-center text-sm text-white/75">
          {current.artist} · {current.album}
        </p>
        <p className="mt-2 max-w-sm text-center text-xs font-medium leading-snug text-white/75">
          Animated visuals from the album artwork — this is not the artist's official music video.
        </p>
        <div className="mt-3">
          <EqBars playing={player.isPlaying} />
        </div>

        <div className="mt-6 w-full max-w-md">
          <input
            type="range"
            min={0}
            max={Math.max(0.1, dur)}
            step={0.1}
            value={Math.min(player.progress, dur)}
            onChange={(e) => player.seek(Number(e.target.value))}
            aria-label={`Seek in ${current.title}`}
            className="w-full accent-[var(--accent)]"
          />
          <div className="mt-1 flex justify-between text-[11px] font-medium text-white/65">
            <span>{fmtDuration(player.progress * 1000)}</span>
            <span>{fmtDuration(dur * 1000)}</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/15" aria-hidden="true">
            <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <button
          type="button"
          onClick={player.toggle}
          aria-label={player.isPlaying ? `Pause ${current.title}` : `Play ${current.title}`}
          className="mt-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-xl"
        >
          {player.isPlaying ? <PauseIcon size={26} /> : <PlayIcon size={26} />}
        </button>
      </div>

      <div className="relative px-4 pb-safe" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-md flex-col gap-2">
          <button
            type="button"
            onClick={() => onFilm(current, "music")}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 font-display text-sm font-bold text-white"
          >
            <VideoIcon /> Film a music video to this song
          </button>
          <button
            type="button"
            onClick={() => onFilm(current, "star")}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white/12 px-5 py-3 font-display text-sm font-bold"
          >
            <StarIcon size={18} /> Star in this song instead
          </button>
          <p className="pt-1 text-center text-[11px] leading-snug text-white/55">
            What's playing is the song's 30-second preview.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function Avatar({ name, color, size = 48 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white"
      style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

function Artwork({ track, size = 52 }: { track: Track; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!track.artworkUrl || failed) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-xl bg-[var(--raised)] text-[var(--dim)]"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <MusicIcon />
      </div>
    );
  }
  return (
    <img
      src={track.artworkUrl}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-xl object-cover"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

function useLibrary() {
  const queryClient = useQueryClient();
  const library = useQuery({ queryKey: ["library"], queryFn: () => api.listLibrary({}) });
  const savedIds = useMemo(
    () => new Set(library.data?.savedTrackIds ?? []),
    [library.data?.savedTrackIds],
  );
  const toggleSave = useMutation({
    mutationFn: async (t: Track) => await api.toggleSaveTrack({ track: toTrackIn(t) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
    onError: () => undefined,
  });
  return { library, savedIds, toggleSave };
}

function TrackRow({
  track,
  savedIds,
  onToggleSave,
  onShare,
  rank,
  onPlaylist,
  offlineUrl,
  isOffline,
  onToggleOffline,
  offlinePending,
}: {
  track: Track;
  savedIds: Set<number>;
  onToggleSave: (t: Track) => void;
  onShare: (t: Track) => void;
  rank?: number;
  onPlaylist?: (t: Track) => void;
  offlineUrl?: string | null;
  isOffline?: boolean;
  onToggleOffline?: (t: Track) => void;
  offlinePending?: boolean;
}) {
  const player = usePlayer();
  const isCurrent = player.current?.trackId === track.trackId;
  const playingThis = isCurrent && player.isPlaying;
  const saved = savedIds.has(track.trackId);
  const dur = fmtDuration(track.durationMs);
  const playTrack = () =>
    player.play(offlineUrl ? { ...track, previewUrl: offlineUrl } : track);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] px-3 py-2.5">
      {rank != null && (
        <span className="w-6 shrink-0 text-center font-display text-lg font-bold text-[var(--dim)]">
          {rank}
        </span>
      )}
      <div className="relative shrink-0">
        <Artwork track={track} />
        <button
          type="button"
          onClick={playTrack}
          aria-label={playingThis ? `Pause ${track.title}` : `Play preview of ${track.title} by ${track.artist}`}
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/45 text-white"
        >
          {playingThis ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-semibold ${isCurrent ? "text-[var(--accent)]" : ""}`}>
          {track.title}
        </p>
        <p className="truncate text-xs text-[var(--dim)]">
          {track.artist}
          {track.album ? ` · ${track.album}` : ""}
        </p>
        {(dur || track.genre || isOffline) && (
          <p className="truncate text-xs text-[var(--dim)]">
            {dur}
            {dur && track.genre ? " · " : ""}
            {track.genre ?? ""}
            {isOffline && (
              <span className="font-semibold text-[var(--amber)]">{dur || track.genre ? " · " : ""}Offline</span>
            )}
          </p>
        )}
      </div>
      {onToggleOffline && (
        <button
          type="button"
          onClick={() => onToggleOffline(track)}
          disabled={offlinePending}
          aria-label={isOffline ? `Remove offline download of ${track.title}` : `Download ${track.title} preview for offline play`}
          aria-pressed={!!isOffline}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${isOffline ? "text-[var(--amber)]" : "text-[var(--dim)]"}`}
        >
          {isOffline ? <XIcon /> : <DownloadIcon />}
        </button>
      )}
      <button
        type="button"
        onClick={() => onToggleSave(track)}
        aria-label={saved ? `Remove ${track.title} from library` : `Save ${track.title} to library`}
        aria-pressed={saved}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${saved ? "text-[var(--amber)]" : "text-[var(--dim)]"}`}
      >
        <HeartIcon filled={saved} />
      </button>
      {onPlaylist && (
        <button
          type="button"
          onClick={() => onPlaylist(track)}
          aria-label={`Add ${track.title} to a playlist`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--dim)]"
        >
          <PlaylistIcon />
        </button>
      )}
      <button
        type="button"
        onClick={() => onShare(track)}
        aria-label={`Share ${track.title} in a chat`}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--dim)]"
      >
        <ShareIcon />
      </button>
    </div>
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 h-full w-full cursor-default" onClick={onClose} />
      <div className="sheet-up relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl bg-[var(--surface)] pb-safe sm:rounded-3xl">
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--raised)]"
          >
            <XIcon />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5 pt-2">{children}</div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-base text-[var(--text)] outline-none focus:border-[var(--accent)]";
const labelCls = "mb-1 block text-sm font-medium text-[var(--dim)]";

// ---------------------------------------------------------------------------
// Contact form sheet (add / edit)
// ---------------------------------------------------------------------------

function ContactSheet({
  contact,
  onClose,
}: {
  contact: Contact | null; // null = add mode
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(contact?.name ?? "");
  const [handle, setHandle] = useState(contact?.handle ?? "");
  const [note, setNote] = useState(contact?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const save = useMutation({
    mutationFn: async () =>
      contact
        ? await api.updateContact({ id: contact.id, name: name.trim(), handle, note })
        : await api.addContact({ name: name.trim(), handle, note }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save. Try again."),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!contact) return { ok: true };
      return await api.deleteContact({ id: contact.id });
    },
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not delete. Try again."),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the contact a name first.");
      return;
    }
    setError(null);
    save.mutate();
  };

  return (
    <Sheet title={contact ? "Edit contact" : "Add contact"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="contact-name" className={labelCls}>Name</label>
          {contact ? (
            <input
              {...FIELDS.updateContact.name}
              id="contact-name"
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maya"
              autoFocus
            />
          ) : (
            <input
              {...FIELDS.addContact.name}
              id="contact-name"
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maya"
              autoFocus
            />
          )}
        </div>
        <div>
          <label htmlFor="contact-handle" className={labelCls}>Handle (optional)</label>
          {contact ? (
            <input
              {...FIELDS.updateContact.handle}
              id="contact-handle"
              className={inputCls}
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@maya"
            />
          ) : (
            <input
              {...FIELDS.addContact.handle}
              id="contact-handle"
              className={inputCls}
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@maya"
            />
          )}
        </div>
        <div>
          <label htmlFor="contact-note" className={labelCls}>Note (optional)</label>
          {contact ? (
            <input
              {...FIELDS.updateContact.note}
              id="contact-note"
              className={inputCls}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="How you know them, favorite genre…"
            />
          ) : (
            <input
              {...FIELDS.addContact.note}
              id="contact-note"
              className={inputCls}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="How you know them, favorite genre…"
            />
          )}
        </div>
        {error && <p className="text-sm text-[var(--accent)]" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-full bg-[var(--accent)] px-5 py-3 font-display font-bold text-white disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : contact ? "Save changes" : "Add contact"}
        </button>
        {contact && (
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => {
              if (confirmDelete) remove.mutate();
              else setConfirmDelete(true);
            }}
            className="flex items-center justify-center gap-2 rounded-full border border-[var(--border)] px-5 py-3 font-medium text-[var(--accent)] disabled:opacity-50"
          >
            <TrashIcon />
            {confirmDelete ? "Tap again to delete contact & chats" : "Delete contact"}
          </button>
        )}
      </form>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Share sheet: send a track into a conversation
// ---------------------------------------------------------------------------

function ShareSheet({
  track,
  onClose,
  onOpenThread,
  onOpenGroupThread,
}: {
  track: Track;
  onClose: () => void;
  onOpenThread: (tc: ThreadContact, conversationId: number) => void;
  onOpenGroupThread: (group: { title: string; members: ThreadContact[] }, conversationId: number) => void;
}) {
  const queryClient = useQueryClient();
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.listConversations({}),
  });
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: () => api.listContacts({}) });
  const [sentTo, setSentTo] = useState<{ name: string; open: (() => void) | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: async (
      target:
        | { kind: "contact"; contact: ThreadContact }
        | { kind: "group"; conversationId: number; title: string; members: ThreadContact[] },
    ) => {
      if (target.kind === "group") {
        await api.sendTrackMessage({ conversationId: target.conversationId, track: toTrackIn(track), sender: "me" });
        return {
          name: target.title,
          open: () => onOpenGroupThread({ title: target.title, members: target.members }, target.conversationId),
        };
      }
      const { conversationId } = await api.getOrCreateConversation({ contactId: target.contact.id });
      await api.sendTrackMessage({ conversationId, track: toTrackIn(track), sender: "me" });
      return {
        name: target.contact.name,
        open: () => onOpenThread(target.contact, conversationId),
      };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      setSentTo(res);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not send. Try again."),
  });

  const convContactIds = new Set(
    (conversations.data?.conversations ?? [])
      .filter((c) => c.kind === "direct" && c.contact)
      .map((c) => c.contact!.id),
  );
  const otherContacts = (contacts.data?.contacts ?? []).filter((c) => !convContactIds.has(c.id));

  return (
    <Sheet title="Share in a chat" onClose={onClose}>
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-[var(--bg)] p-3">
        <Artwork track={track} size={44} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{track.title}</p>
          <p className="truncate text-xs text-[var(--dim)]">{track.artist}</p>
        </div>
      </div>
      {sentTo ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="font-display text-base font-bold">Sent to {sentTo.name} 🎧</p>
          <div className="flex gap-2">
            {sentTo.open && (
              <button
                type="button"
                className="rounded-full bg-[var(--accent)] px-5 py-2.5 font-display font-bold text-white"
                onClick={() => {
                  sentTo.open?.();
                  onClose();
                }}
              >
                Open chat
              </button>
            )}
            <button
              type="button"
              className="rounded-full border border-[var(--border)] px-5 py-2.5 font-medium"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <>
          {error && <p className="mb-3 text-sm text-[var(--accent)]" role="alert">{error}</p>}
          {(conversations.data?.conversations ?? []).length === 0 && otherContacts.length === 0 ? (
            <p className="py-3 text-sm text-[var(--dim)]">
              No contacts yet. Add a contact from the Chats tab first, then come back to share this song.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {(conversations.data?.conversations ?? []).map((c) => {
                if (c.kind === "group") {
                  const title = c.title ?? c.members.map((m) => m.name.split(/\s+/)[0]).join(", ");
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        disabled={send.isPending}
                        onClick={() =>
                          send.mutate({ kind: "group", conversationId: c.id, title, members: c.members })
                        }
                        className="flex w-full items-center gap-3 py-3 text-left disabled:opacity-50"
                        aria-label={`Send ${track.title} to group ${title}`}
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                          style={{ backgroundColor: c.members[0]?.color ?? "#FF4D2E" }}
                          aria-hidden="true"
                        >
                          <UsersIcon />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{title}</span>
                          <span className="block truncate text-xs text-[var(--dim)]">
                            Group · {c.members.length + 1} people
                          </span>
                        </span>
                        <SendIcon />
                      </button>
                    </li>
                  );
                }
                if (!c.contact) return null;
                const contact = c.contact;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={send.isPending}
                      onClick={() => send.mutate({ kind: "contact", contact })}
                      className="flex w-full items-center gap-3 py-3 text-left disabled:opacity-50"
                      aria-label={`Send ${track.title} to ${contact.name}`}
                    >
                      <Avatar name={contact.name} color={contact.color} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{contact.name}</span>
                        {contact.handle && (
                          <span className="block truncate text-xs text-[var(--dim)]">{contact.handle}</span>
                        )}
                      </span>
                      <SendIcon />
                    </button>
                  </li>
                );
              })}
              {otherContacts.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={send.isPending}
                    onClick={() =>
                      send.mutate({ kind: "contact", contact: { id: c.id, name: c.name, handle: c.handle, color: c.color } })
                    }
                    className="flex w-full items-center gap-3 py-3 text-left disabled:opacity-50"
                    aria-label={`Start a chat with ${c.name} and send ${track.title}`}
                  >
                    <Avatar name={c.name} color={c.color} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-[var(--dim)]">New chat</span>
                    </span>
                    <SendIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {send.isPending && <p className="pt-2 text-sm text-[var(--dim)]">Sending…</p>}
        </>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Song picker inside a thread
// ---------------------------------------------------------------------------

function SongPicker({
  onPick,
  onClose,
  title = "Share a song",
}: {
  onPick: (t: Track) => void;
  onClose: () => void;
  title?: string;
}) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const top = useQuery({ queryKey: ["top"], queryFn: () => api.getTopTracks({}) });
  const search = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => api.searchTracks({ query: submitted, limit: 20 }),
    enabled: submitted.length > 0,
  });
  const { library } = useLibrary();
  const player = usePlayer();

  const tracks = submitted ? (search.data?.tracks ?? []) : (top.data?.tracks.slice(0, 12) ?? []);

  return (
    <Sheet title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
        className="mb-3 flex gap-2"
      >
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dim)]">
            <SearchIcon />
          </span>
          <input
            {...FIELDS.searchTracks.query}
            aria-label="Search songs to share"
            className={`${inputCls} pl-10`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value.trim()) setSubmitted("");
            }}
            placeholder="Search songs or artists…"
          />
        </div>
        <button type="submit" className="rounded-xl bg-[var(--accent)] px-4 font-display font-bold text-white">
          Search
        </button>
      </form>
      {!submitted && (library.data?.saved.length ?? 0) > 0 && (
        <>
          <h3 className="mb-2 font-display text-sm font-bold text-[var(--dim)]">From your library</h3>
          <ul className="mb-4 flex flex-col gap-2">
            {library.data?.saved.slice(0, 4).map((t) => (
              <PickerRow key={t.trackId} track={t} onPick={onPick} player={player} />
            ))}
          </ul>
          <h3 className="mb-2 font-display text-sm font-bold text-[var(--dim)]">Top songs right now</h3>
        </>
      )}
      {submitted && search.isPending && <p className="py-4 text-sm text-[var(--dim)]">Searching…</p>}
      {submitted && search.isError && (
        <p className="py-4 text-sm text-[var(--accent)]">Search hit a snag. Check your connection and try again.</p>
      )}
      {submitted && !search.isPending && tracks.length === 0 && (
        <p className="py-4 text-sm text-[var(--dim)]">No songs found for “{submitted}”. Try another artist or title.</p>
      )}
      {!submitted && top.isPending && <p className="py-4 text-sm text-[var(--dim)]">Loading top songs…</p>}
      <ul className="flex flex-col gap-2">
        {tracks.map((t) => (
          <PickerRow key={t.trackId} track={t} onPick={onPick} player={player} />
        ))}
      </ul>
    </Sheet>
  );
}

function PickerRow({
  track,
  onPick,
  player,
}: {
  track: Track;
  onPick: (t: Track) => void;
  player: PlayerApi;
}) {
  const playingThis = player.current?.trackId === track.trackId && player.isPlaying;
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-[var(--bg)] px-3 py-2.5">
      <div className="relative shrink-0">
        <Artwork track={track} size={44} />
        <button
          type="button"
          onClick={() => player.play(track)}
          aria-label={playingThis ? `Pause preview of ${track.title}` : `Play preview of ${track.title}`}
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/45 text-white"
        >
          {playingThis ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{track.title}</p>
        <p className="truncate text-xs text-[var(--dim)]">{track.artist}</p>
      </div>
      <button
        type="button"
        onClick={() => onPick(track)}
        aria-label={`Send ${track.title} by ${track.artist} to this chat`}
        className="flex h-10 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 font-display text-sm font-bold text-white"
      >
        <SendIcon /> Send
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Thread view
// ---------------------------------------------------------------------------

function TrackMessageCard({ msg, mine }: { msg: Message; mine: boolean }) {
  const track = msg.track;
  const player = usePlayer();
  const { savedIds, toggleSave } = useLibrary();
  if (!track) return null;
  const playingThis = player.current?.trackId === track.trackId && player.isPlaying;
  const saved = savedIds.has(track.trackId);
  const dur = fmtDuration(track.durationMs);
  return (
    <div
      className={`w-[270px] max-w-full overflow-hidden rounded-2xl ${
        mine ? "bg-[var(--player-bg)] text-[var(--player-text)]" : "bg-[var(--surface)] border border-[var(--border)]"
      }`}
    >
      <div className="flex items-center gap-3 p-3">
        <div className="relative shrink-0">
          <Artwork track={track} size={56} />
          <button
            type="button"
            onClick={() => player.play(track)}
            aria-label={playingThis ? `Pause ${track.title}` : `Play preview of ${track.title}`}
            className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/45 text-white"
          >
            {playingThis ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold">{track.title}</p>
          <p className={`truncate text-xs ${mine ? "opacity-70" : "text-[var(--dim)]"}`}>{track.artist}</p>
          {track.album && (
            <p className={`truncate text-xs ${mine ? "opacity-70" : "text-[var(--dim)]"}`}>{track.album}</p>
          )}
          {dur && <p className={`text-xs ${mine ? "opacity-70" : "text-[var(--dim)]"}`}>{dur} · 30s preview plays here</p>}
        </div>
      </div>
      <div
        className={`flex items-center gap-1 border-t px-2 py-1 ${mine ? "border-white/15" : "border-[var(--border)]"}`}
      >
        <button
          type="button"
          onClick={() => toggleSave.mutate(track)}
          aria-label={saved ? `Remove ${track.title} from library` : `Save ${track.title} to library`}
          aria-pressed={saved}
          className={`flex h-9 items-center gap-1 rounded-full px-2 text-xs font-medium ${saved ? "text-[var(--amber)]" : mine ? "opacity-80" : "text-[var(--dim)]"}`}
        >
          <HeartIcon filled={saved} /> {saved ? "Saved" : "Save"}
        </button>
        {track.trackViewUrl && (
          <a
            href={track.trackViewUrl}
            target="_blank"
            rel="noreferrer"
            className={`flex h-9 items-center gap-1 rounded-full px-2 text-xs font-medium ${mine ? "opacity-80" : "text-[var(--dim)]"}`}
            aria-label={`Open ${track.title} in Apple Music`}
          >
            <ExternalIcon /> Apple Music
          </a>
        )}
      </div>
    </div>
  );
}

function SnapMessageCard({ msg, mine }: { msg: Message; mine: boolean }) {
  const snap = msg.snap;
  const player = usePlayer();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [frameWidth, setFrameWidth] = useState(270);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setFrameWidth(el.clientWidth || 270);
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (ro) ro.observe(el);
    return () => ro?.disconnect();
  }, []);
  // Snap media is encrypted on-device before storage: fetch the stored
  // bytes, decrypt them here if they carry the encryption header, and show
  // the result. Older unencrypted snaps just use their URL directly.
  const mediaUrl = snap?.mediaUrl;
  const mediaType = snap?.contentType;
  const [media, setMedia] = useState<{ status: "loading" | "ready" | "locked"; url: string | null }>({
    status: "loading",
    url: null,
  });
  useEffect(() => {
    if (!mediaUrl) return;
    let alive = true;
    let objUrl: string | null = null;
    setMedia({ status: "loading", url: null });
    (async () => {
      try {
        const res = await fetch(mediaUrl);
        if (!res.ok) throw new Error("fetch failed");
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (isEncryptedMedia(bytes)) {
          const plain = await decryptMediaBytes(bytes);
          if (!alive) return;
          if (!plain) {
            setMedia({ status: "locked", url: null });
            return;
          }
          objUrl = URL.createObjectURL(new Blob([plain as BlobPart], { type: mediaType || "application/octet-stream" }));
          setMedia({ status: "ready", url: objUrl });
          return;
        }
        if (alive) setMedia({ status: "ready", url: mediaUrl });
      } catch {
        if (alive) setMedia({ status: "ready", url: mediaUrl });
      }
    })();
    return () => {
      alive = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [mediaUrl, mediaType]);
  if (!snap) return null;
  const isMusicVideo = snap.musicTrack != null;
  const musicAsTrack: Track | null = snap.musicTrack
    ? {
        trackId: snap.musicTrack.trackId,
        title: snap.musicTrack.title,
        artist: snap.musicTrack.artist,
        album: "",
        artworkUrl: snap.musicTrack.artworkUrl,
        previewUrl: snap.musicTrack.previewUrl,
        trackViewUrl: snap.musicTrack.trackViewUrl,
        durationMs: 30000,
        genre: null,
      }
    : null;
  const musicPlaying = musicAsTrack != null && player.current?.trackId === musicAsTrack.trackId && player.isPlaying;
  const dur = fmtSnapDuration(snap.durationMs);
  return (
    <div
      className={`w-[270px] max-w-full overflow-hidden rounded-2xl ${
        mine ? "bg-[var(--player-bg)] text-[var(--player-text)]" : "bg-[var(--surface)] border border-[var(--border)]"
      }`}
    >
      <div ref={wrapRef} className="relative bg-black">
        {media.status === "loading" ? (
          <div className="flex h-40 items-center justify-center text-sm text-white/70">
            Loading snap…
          </div>
        ) : media.status === "locked" || !media.url ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 px-4 text-center text-white/80">
            <LockIcon />
            <p className="text-xs leading-snug">
              Encrypted snap — this device doesn't have the key to open it.
            </p>
          </div>
        ) : snap.mediaKind === "photo" ? (
          <>
            <img
              src={media.url}
              alt={snap.caption ? "Snap photo with a caption" : "Snap photo"}
              className="block max-h-[360px] w-full object-cover"
              loading="lazy"
            />
            <SnapFilterOverlay filterId={snap.filterId} frameWidth={frameWidth} />
          </>
        ) : (
          <video
            src={media.url}
            controls
            playsInline
            preload="metadata"
            aria-label={snap.caption ? "Snap video with a caption" : "Snap video"}
            className="block max-h-[360px] w-full object-cover"
          />
        )}
        <div className="pointer-events-none absolute left-2 top-2 flex gap-1.5">
          {isMusicVideo && snap.mediaKind === "photo" ? (
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white">★ Star snap</span>
          ) : isMusicVideo ? (
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white">Music video</span>
          ) : snap.filterId !== "none" ? (
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white">{snap.filterName}</span>
          ) : null}
          {snap.mediaKind === "video" && dur && (
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white">{dur}</span>
          )}
        </div>
      </div>
      {snap.caption && (
        <p className="whitespace-pre-wrap break-words px-3 pt-2.5 text-sm">
          <DecryptedText value={snap.caption} />
        </p>
      )}
      {musicAsTrack && (
        <div className={`flex items-center gap-2.5 px-3 py-2.5 ${snap.caption ? "" : "pt-2.5"}`}>
          {musicAsTrack.artworkUrl ? (
            <img src={musicAsTrack.artworkUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" loading="lazy" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <MusicIcon />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{musicAsTrack.title}</p>
            <p className={`truncate text-xs ${mine ? "opacity-70" : "text-[var(--dim)]"}`}>{musicAsTrack.artist}</p>
          </div>
          <button
            type="button"
            onClick={() => player.play(musicAsTrack)}
            aria-label={musicPlaying ? `Pause ${musicAsTrack.title}` : `Play the song from this music video: ${musicAsTrack.title}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white"
          >
            {musicPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
          </button>
        </div>
      )}
      {isMusicVideo && snap.mediaKind === "photo" && (
        <p className={`px-3 pb-2.5 text-[11px] leading-snug ${mine ? "opacity-60" : "text-[var(--dim)]"}`}>
          Star snap — that's them as the singer in this one. The song plays from here.
        </p>
      )}
      {isMusicVideo && snap.mediaKind === "video" && (
        <p className={`px-3 pb-2.5 text-[11px] leading-snug ${mine ? "opacity-60" : "text-[var(--dim)]"}`}>
          {snap.musicInVideo
            ? "The song is recorded into this video — press play on the video and you'll hear it."
            : "Filmed with this song playing out loud — the song itself isn't recorded into the video, so it plays from here instead."}
        </p>
      )}
    </div>
  );
}

function fmtBytes(n: number): string {
  if (!n || n <= 0) return "0 KB";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtCallTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type CallPhase = "idle" | "ringing" | "connected" | "ended";

function CallOverlay({
  contact,
  phase,
  seconds,
  muted,
  speaker,
  callTrack,
  onToggleMute,
  onToggleSpeaker,
  onEnd,
  onMinimize,
  onPlayMusic,
  members,
}: {
  contact: ThreadContact;
  phase: CallPhase;
  seconds: number;
  muted: boolean;
  speaker: boolean;
  callTrack: Track | null;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onEnd: () => void;
  onMinimize: () => void;
  onPlayMusic: () => void;
  members?: ThreadContact[];
}) {
  const player = usePlayer();
  const connected = phase === "connected";
  const musicPlaying = connected && player.ducked && player.current != null;
  const isGroup = (members?.length ?? 0) > 0;
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[var(--player-bg)] text-[var(--player-text)]" role="dialog" aria-modal="true" aria-label={isGroup ? `Group call preview: ${contact.name}` : `Call preview with ${contact.name}`}>
      <div className="flex items-center justify-between px-4 pt-safe">
        <button type="button" onClick={onMinimize} aria-label="Back to chat while call continues" className="flex h-10 items-center rounded-full px-3 text-sm font-medium opacity-80">
          ← Chat
        </button>
        <span className="text-xs font-semibold uppercase tracking-widest opacity-60">{isGroup ? "Group call preview" : "Call preview"}</span>
        <span className="w-16" aria-hidden="true" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        {isGroup ? (
          <>
            <div className="flex -space-x-4">
              {members!.slice(0, 4).map((m) => (
                <span key={m.id} className="rounded-full ring-4 ring-[var(--player-bg)]">
                  <Avatar name={m.name} color={m.color} size={72} />
                </span>
              ))}
            </div>
            <p className="mt-4 font-display text-2xl font-extrabold">{contact.name}</p>
            <p className="max-w-xs opacity-70">
              You + {members!.map((m) => m.name.split(/\s+/)[0]).join(", ")} · {members!.length + 1} people
            </p>
          </>
        ) : (
          <>
            <Avatar name={contact.name} color={contact.color} size={104} />
            <p className="mt-4 font-display text-2xl font-extrabold">{contact.name}</p>
            {contact.handle && <p className="opacity-70">{contact.handle}</p>}
          </>
        )}
        <p className="mt-2 text-sm opacity-80" role="status">
          {phase === "ringing" && "Preview — calling… ringing"}
          {connected && <>Preview call · {fmtCallTime(seconds)}{muted ? " · You're muted" : ""}{speaker ? " · Speaker on" : ""}</>}
          {phase === "ended" && "Preview call ended"}
        </p>
        {connected && <div className="mt-3"><EqBars playing={!muted} /></div>}

        {connected && (
          <div className="mt-6 w-full max-w-sm rounded-3xl bg-white/10 p-4 text-left">
            {musicPlaying && player.current ? (
              <>
                <div className="flex items-center gap-3">
                  <Artwork track={player.current} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-bold">{player.current.title}</p>
                    <p className="truncate text-xs opacity-70">{player.current.artist}</p>
                    <p className="mt-0.5 text-xs font-medium text-[var(--amber)]">
                      Playing over the call — the music sits low, under the voices, so you can keep talking over it.
                    </p>
                  </div>
                  <button type="button" onClick={player.toggle} aria-label={player.isPlaying ? `Pause ${player.current.title}` : `Resume ${player.current.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                    {player.isPlaying ? <PauseIcon /> : <PlayIcon />}
                  </button>
                </div>
                <label className="mt-3 block text-xs font-medium opacity-80" htmlFor="call-music-volume">
                  Music level under your voices — {Math.round(player.musicVolume * 100)}%
                </label>
                <input
                  id="call-music-volume"
                  type="range"
                  min={0}
                  max={80}
                  step={5}
                  value={Math.round(player.musicVolume * 100)}
                  onChange={(e) => player.setMusicVolume(Number(e.target.value) / 100)}
                  aria-label="Music volume over the call"
                  className="w-full accent-[var(--accent)]"
                />
                <button type="button" onClick={() => { player.stop(); }} aria-label="Stop the music over this call" className="mt-1 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
                  Stop music
                </button>
              </>
            ) : (
              <>
                <p className="font-display text-sm font-bold">Music over the call</p>
                <p className="mt-1 text-sm opacity-75">
                  Play a song over the call at a low level, under the voices, so the talking never has to stop. The song is also shared into this chat.
                </p>
                <button type="button" onClick={onPlayMusic} aria-label="Play a song over this call" className="mt-3 flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 font-display text-sm font-bold text-white">
                  <MusicIcon /> Play a song over the call
                </button>
                {callTrack && <p className="mt-2 text-xs opacity-70">Last played over the call: {callTrack.title} — {callTrack.artist}</p>}
              </>
            )}
          </div>
        )}
        <p className="mt-5 max-w-xs text-xs opacity-60">
          {isGroup
            ? "Test group call on this device — everyone in the group lives here, so this is where you try the call and the music mix end to end."
            : "Test call on this device — your contacts live here, so this is where you try the call and the music mix end to end."}
        </p>
      </div>

      <div className="flex items-end justify-center gap-4 px-6 pb-safe" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
        <div className="flex flex-col items-center gap-1">
          <button type="button" onClick={onToggleMute} disabled={!connected} aria-label={muted ? "Unmute microphone" : "Mute microphone"} aria-pressed={muted} className={`flex h-14 w-14 items-center justify-center rounded-full disabled:opacity-40 ${muted ? "bg-[var(--accent)] text-white" : "bg-white/12 text-white"}`}>
            {muted ? <MicOffIcon /> : <MicIcon />}
          </button>
          <span className="text-[11px] opacity-70">{muted ? "Unmute" : "Mute"}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <button type="button" onClick={onEnd} aria-label="End call" className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e63e1d] text-white">
            <PhoneOffIcon />
          </button>
          <span className="text-[11px] opacity-70">End</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <button type="button" onClick={onToggleSpeaker} disabled={!connected} aria-label={speaker ? "Turn speaker off" : "Turn speaker on"} aria-pressed={speaker} className={`flex h-14 w-14 items-center justify-center rounded-full disabled:opacity-40 ${speaker ? "bg-[var(--accent)] text-white" : "bg-white/12 text-white"}`}>
            <SpeakerIcon />
          </button>
          <span className="text-[11px] opacity-70">Speaker</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Camera sheet — take a photo / short video snap, or film a music video
// ---------------------------------------------------------------------------

type SnapMode = "photo" | "video" | "music" | "star";
type CapturedSnap = {
  blob: Blob;
  url: string;
  kind: "photo" | "video";
  mimeType: string;
  durationMs: number;
  // Music-video recordings only: true when the song was mixed into the
  // recorded file itself, so the video plays the song with no extra tap.
  musicInVideo?: boolean;
  // Video recordings only: the filter/lens that was baked into the
  // recording by the canvas pipeline ("none" when it recorded plain).
  filterId?: SnapFilterId;
};
const MAX_SNAP_BYTES_CLIENT = 10 * 1024 * 1024;

function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      // try the next candidate
    }
  }
  return "";
}

// Trims a captured video to [startMs, endMs] by re-recording just that
// stretch from a detached <video> element through captureStream +
// MediaRecorder. Resolves null when this browser can't do it (no
// captureStream / MediaRecorder) or the re-record fails — the caller
// then tells the user and lets them send the full clip instead; it never
// silently sends a different clip than the one on screen.
async function trimVideoBlob(
  blob: Blob,
  startMs: number,
  endMs: number,
): Promise<{ blob: Blob; durationMs: number } | null> {
  if (typeof MediaRecorder === "undefined") return null;
  const url = URL.createObjectURL(blob);
  try {
    const video = document.createElement("video");
    video.src = url;
    video.playsInline = true;
    video.preload = "auto";
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("video load failed"));
    });
    const captureHost = video as unknown as {
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    };
    const captureFn = captureHost.captureStream ?? captureHost.mozCaptureStream;
    if (!captureFn) return null;
    const stream = captureFn.call(video);
    const mimeType = pickRecorderMimeType();
    let rec: MediaRecorder;
    try {
      rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      try {
        rec = new MediaRecorder(stream);
      } catch {
        return null;
      }
    }
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    const stopped = new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
    });
    video.currentTime = startMs / 1000;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      window.setTimeout(resolve, 1200);
    });
    rec.start(250);
    await video.play();
    const targetSec = endMs / 1000;
    await new Promise<void>((resolve) => {
      const iv = window.setInterval(() => {
        if (video.currentTime >= targetSec || video.ended) {
          window.clearInterval(iv);
          resolve();
        }
      }, 100);
      window.setTimeout(() => {
        window.clearInterval(iv);
        resolve();
      }, Math.max(2000, endMs - startMs + 5000));
    });
    video.pause();
    if (rec.state === "recording") rec.stop();
    await stopped;
    if (chunks.length === 0) return null;
    const type = (rec.mimeType || mimeType || "video/webm").split(";")[0] ?? "video/webm";
    return { blob: new Blob(chunks, { type }), durationMs: Math.max(0, endMs - startMs) };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface SnapSendTarget {
  conversationId: number;
  contact?: ThreadContact;
  group?: { title: string; members: ThreadContact[] };
}

// "Send this snap to…" picker for the standalone camera: the snap was
// taken and edited with no chat chosen, so the destination is picked
// here, at send time. Lists existing chats (direct + group) and contacts
// without a chat yet (a chat is created on pick), like the song share
// sheet. With no contacts at all it says so plainly and points at the
// Save-to-device button instead.
function SnapTargetSheet({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (target: SnapSendTarget) => void;
}) {
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.listConversations({}),
  });
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: () => api.listContacts({}) });
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const pickContact = async (contact: ThreadContact) => {
    setPicking(true);
    setError(null);
    try {
      const { conversationId } = await api.getOrCreateConversation({ contactId: contact.id });
      onPick({ conversationId, contact });
    } catch {
      setError("That chat couldn't be opened. Try again.");
      setPicking(false);
    }
  };

  const convContactIds = new Set(
    (conversations.data?.conversations ?? [])
      .filter((c) => c.kind === "direct" && c.contact)
      .map((c) => c.contact!.id),
  );
  const otherContacts = (contacts.data?.contacts ?? []).filter((c) => !convContactIds.has(c.id));
  const hasTargets =
    (conversations.data?.conversations.length ?? 0) > 0 || otherContacts.length > 0;

  return (
    <Sheet title="Send snap to…" onClose={onClose}>
      {error && <p className="mb-3 text-sm text-[var(--accent)]" role="alert">{error}</p>}
      {!hasTargets && !conversations.isPending && !contacts.isPending ? (
        <p className="py-3 text-sm text-[var(--dim)]">
          You don't have any contacts yet, so there's nobody to send this to. Add a contact from the
          Chats tab — or close this and tap “Save to your device” so you don't lose the snap.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {(conversations.data?.conversations ?? []).map((c) => {
            if (c.kind === "group") {
              const title = c.title ?? c.members.map((m) => m.name.split(/\s+/)[0]).join(", ");
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={picking}
                    onClick={() => onPick({ conversationId: c.id, group: { title, members: c.members } })}
                    className="flex w-full items-center gap-3 py-3 text-left disabled:opacity-50"
                    aria-label={`Send snap to group ${title}`}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: c.members[0]?.color ?? "#FF4D2E" }}
                      aria-hidden="true"
                    >
                      <UsersIcon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{title}</span>
                      <span className="block truncate text-xs text-[var(--dim)]">
                        Group · {c.members.length + 1} people
                      </span>
                    </span>
                    <SendIcon />
                  </button>
                </li>
              );
            }
            if (!c.contact) return null;
            const contact = c.contact;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={picking}
                  onClick={() => onPick({ conversationId: c.id, contact })}
                  className="flex w-full items-center gap-3 py-3 text-left disabled:opacity-50"
                  aria-label={`Send snap to ${contact.name}`}
                >
                  <Avatar name={contact.name} color={contact.color} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{contact.name}</span>
                    {contact.handle && (
                      <span className="block truncate text-xs text-[var(--dim)]">{contact.handle}</span>
                    )}
                  </span>
                  <SendIcon />
                </button>
              </li>
            );
          })}
          {otherContacts.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={picking}
                onClick={() =>
                  void pickContact({ id: c.id, name: c.name, handle: c.handle, color: c.color })
                }
                className="flex w-full items-center gap-3 py-3 text-left disabled:opacity-50"
                aria-label={`Start a chat with ${c.name} and send the snap`}
              >
                <Avatar name={c.name} color={c.color} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-[var(--dim)]">New chat</span>
                </span>
                <SendIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      {picking && <p className="pt-2 text-sm text-[var(--dim)]">Opening the chat…</p>}
    </Sheet>
  );
}

// SoundChat Plus sheet: status, what's included, the subscribe /
// turn-off controls, and the one-time filter packs. Honest billing note
// (also in the UI): checkout is not live in this version — activating
// Plus or a pack records the entitlement in the app and charges nothing.
function PlusSheet({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => api.getProfile({}) });
  const plus = profileQ.data?.plus ?? { active: false, since: null, packs: [] as string[] };
  const [error, setError] = useState<string | null>(null);

  const setPlus = useMutation({
    mutationFn: async (active: boolean) => await api.setPlus({ active }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      setError(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "That didn't go through. Try again."),
  });
  const unlockPack = useMutation({
    mutationFn: async (packId: "party-pack" | "royal-pack") =>
      await api.unlockFilterPack({ packId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      setError(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "That didn't go through. Try again."),
  });
  const busy = setPlus.isPending || unlockPack.isPending;

  return (
    <Sheet title="SoundChat Plus" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl bg-[var(--player-bg)] p-4 text-[var(--player-text)]">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[var(--amber)] px-2.5 py-0.5 font-display text-[11px] font-extrabold text-black">
              PLUS
            </span>
            {plus.active ? (
              <p className="text-sm font-bold">You're Plus — everything below is on.</p>
            ) : (
              <p className="text-sm font-bold">
                <span className="font-display text-xl font-extrabold">$4.99</span>
                <span className="opacity-70"> /month</span>
              </p>
            )}
          </div>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm leading-snug">
            <li>✦ Every premium AR lens — Star Shades, Masquerade, Royal Crown, Gold Chain, Fancy Monocle, Angel Halo, Neon Glow, Little Devil, Alien</li>
            <li>✦ Plus-only backgrounds: Galaxy Nebula, Neon Nights, Reaper Fog, Cosmic Shrooms</li>
            <li>✦ 60-second snap videos (free snaps are 15 seconds)</li>
            <li>✦ Unlimited playlists and offline downloads (free: 3 playlists, 10 offline songs)</li>
            <li>✦ The Plus badge on your profile</li>
          </ul>
          <p className="mt-3 text-xs leading-snug opacity-70">
            The core app stays free forever — chatting, listening, and sharing never cost anything.
            And the deal never changes: no ads that track you, and your data is never sold. Not on
            free, not on Plus.
          </p>
        </div>

        {plus.active ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setPlus.mutate(false)}
            className="w-full rounded-full bg-[var(--bg)] px-5 py-3 font-display text-sm font-bold disabled:opacity-50"
          >
            {setPlus.isPending ? "Working…" : "Turn off Plus (back to free)"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setPlus.mutate(true)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 font-display text-sm font-bold text-white disabled:opacity-50"
          >
            <StarIcon size={16} /> {setPlus.isPending ? "Working…" : "Go Plus — $4.99/month"}
          </button>
        )}

        <div>
          <p className="font-display text-sm font-bold">Or grab a lens pack — one time, yours forever</p>
          <div className="mt-2 flex flex-col gap-2">
            {FILTER_PACKS.map((pack) => {
              const owned = plus.packs.includes(pack.id);
              const covered = owned || plus.active;
              return (
                <div key={pack.id} className="flex items-center gap-3 rounded-2xl bg-[var(--bg)] p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">
                      {pack.name} <span className="font-semibold text-[var(--dim)]">· {pack.price} one-time</span>
                    </p>
                    <p className="text-xs leading-snug text-[var(--dim)]">{pack.blurb}</p>
                  </div>
                  {covered ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {plus.active && !owned ? "In Plus" : "Unlocked"}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => unlockPack.mutate(pack.id)}
                      className="shrink-0 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {unlockPack.isPending ? "…" : `Unlock ${pack.price}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {error && <p className="text-center text-sm text-red-500" role="alert">{error}</p>}
        <p className="text-center text-[11px] leading-snug text-[var(--dim)]">
          Straight talk on billing: checkout isn't live in this version of SoundChat, so tapping Go
          Plus or Unlock turns it on in your app right away and no card is charged. When payments
          launch, Plus is $4.99/month (cancel anytime) and packs stay one-time — you'll confirm
          before anything is ever charged.
        </p>
      </div>
    </Sheet>
  );
}

function CameraSheet({
  conversationId,
  contactName,
  sender,
  senderContactId,
  initialMode,
  initialTrack,
  onClose,
  onSent,
  onSentToChat,
}: {
  // Null = the standalone Camera Studio: no chat was picked up front.
  // The snap is taken and edited first; the destination is chosen at
  // send time (or the snap is saved to the device instead).
  conversationId: number | null;
  contactName?: string;
  sender: "me" | "them";
  senderContactId?: number | null;
  initialMode?: SnapMode;
  initialTrack?: Track | null;
  onClose: () => void;
  onSent?: () => void;
  onSentToChat?: (target: SnapSendTarget) => void;
}) {
  const standalone = conversationId == null;
  const player = usePlayer();
  const [phase, setPhase] = useState<"camera" | "review">("camera");
  const [mode, setMode] = useState<SnapMode>(initialMode ?? "photo");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [filterId, setFilterId] = useState<SnapFilterId>("none");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraRetry, setCameraRetry] = useState(0);
  const [captured, setCaptured] = useState<CapturedSnap | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [startingRec, setStartingRec] = useState(false);
  const [mixFailed, setMixFailed] = useState(false);
  const [recMs, setRecMs] = useState(0);
  const [musicTrack, setMusicTrack] = useState<Track | null>(initialTrack ?? null);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(360);
  // --- Face-lens state ---
  // trackedFace: the face the browser's built-in detector is following
  // right now (display space), or null when no face is locked — the lens
  // then sits on the guide ring. faceApi says whether this browser has
  // the detector at all; the UI states which mode is live, honestly.
  const [trackedFace, setTrackedFace] = useState<FaceLandmarks | null>(null);
  const [faceApi, setFaceApi] = useState<"unknown" | "on" | "off">("unknown");
  const [lensFailed, setLensFailed] = useState(false);
  const [plusSheetOpen, setPlusSheetOpen] = useState(false);
  // --- Editor state (review phase) ---
  // The original unfiltered photo, kept so filters / crop / text can be
  // re-baked and undone. Null for videos and star snaps.
  const [rawPhoto, setRawPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [editFilterId, setEditFilterId] = useState<SnapFilterId>("none");
  const [editCropId, setEditCropId] = useState<SnapCropId>("full");
  const [editText, setEditText] = useState("");
  const [editTextPos, setEditTextPos] = useState<SnapTextPos>("bottom");
  const [editBusy, setEditBusy] = useState(false);
  // Video trim, in seconds. trimEndSec = 0 means "not measured yet".
  const [trimStartSec, setTrimStartSec] = useState(0);
  const [trimEndSec, setTrimEndSec] = useState(0);
  const [trimming, setTrimming] = useState(false);
  const [trimFailed, setTrimFailed] = useState(false);
  // Standalone-only review actions.
  const [sendPickerOpen, setSendPickerOpen] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef(0);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(true);
  const musicStartedRef = useRef(false);
  // --- Music-video mix: the song's preview is decoded with Web Audio and
  // mixed with the microphone into the recorder's stream, so the finished
  // video file itself carries the song (in sync, no extra tap). ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicBufferRef = useRef<{ trackId: number; buffer: AudioBuffer } | null>(null);
  const musicLoadRef = useRef<{ trackId: number; promise: Promise<AudioBuffer | null> } | null>(null);
  const mixRef = useRef<{
    source: AudioBufferSourceNode;
    micSource: MediaStreamAudioSourceNode | null;
    dest: MediaStreamAudioDestinationNode;
  } | null>(null);
  const navTargetRef = useRef<SnapSendTarget | null>(null);
  const modeRef = useRef<SnapMode>(initialMode ?? "photo");
  modeRef.current = mode;
  // Face-lens refs: faceRef is the smoothed face the draw loops read
  // every frame (state would re-render 60×/s); captureFaceRef freezes
  // the face at the moment a photo is taken so the editor's re-bakes
  // keep the lens on the same face.
  const faceRef = useRef<FaceLandmarks | null>(null);
  const captureFaceRef = useRef<FaceLandmarks | null>(null);
  const detectorRef = useRef<FaceDetectorLike | null>(null);
  const filterRef = useRef<SnapFilterDef>(snapFilterById("none"));
  const lensPipeRef = useRef<{ raf: number } | null>(null);
  // Live warp preview: while a face-warp lens is picked, the camera
  // feed is painted through a canvas (same warp as the bake) so you see
  // your face bend in real time, not just in the finished snap.
  const warpCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const warpRafRef = useRef<number | null>(null);

  const filterDef = snapFilterById(filterId);
  filterRef.current = filterDef;

  // SoundChat Plus entitlements (shares the ["profile"] cache with the
  // Profile tab). They set the video-length cap and which lenses unlock.
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => api.getProfile({}) });
  const ent: Entitlements = profileQ.data
    ? { plus: profileQ.data.plus.active, packs: profileQ.data.plus.packs }
    : FREE_ENTITLEMENTS;
  const maxRecordMs = ent.plus ? PLUS_VIDEO_MS : FREE_VIDEO_MS;
  const maxSnapBytes = ent.plus ? 32 * 1024 * 1024 : MAX_SNAP_BYTES_CLIENT;

  // Picking a filter: a locked Plus lens opens the Plus sheet instead.
  const pickFilter = (def: SnapFilterDef) => {
    if (lensLocked(def, ent)) {
      setPlusSheetOpen(true);
      return;
    }
    setFilterId(def.id);
  };

  const stopStream = () => {
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const stopMusic = () => {
    if (musicStartedRef.current) {
      musicStartedRef.current = false;
      player.stop();
    }
  };

  const getAudioCtx = (): AudioContext | null => {
    if (audioCtxRef.current) return audioCtxRef.current;
    if (typeof window === "undefined") return null;
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      audioCtxRef.current = new AC();
    } catch {
      return null;
    }
    return audioCtxRef.current;
  };

  // Fetches and decodes the song's 30-second preview so it can be mixed
  // into a music-video recording. Apple's preview host sends CORS headers
  // (Access-Control-Allow-Origin: * — verified), so the browser is allowed
  // to read the bytes. Cached per track; resolves null when anything
  // fails, and the caller falls back to attaching the song like before.
  const loadMusicBuffer = (track: Track): Promise<AudioBuffer | null> => {
    if (musicBufferRef.current?.trackId === track.trackId) {
      return Promise.resolve(musicBufferRef.current.buffer);
    }
    if (musicLoadRef.current?.trackId === track.trackId) return musicLoadRef.current.promise;
    const promise = (async (): Promise<AudioBuffer | null> => {
      try {
        const actx = getAudioCtx();
        if (!actx) return null;
        const res = await fetch(track.previewUrl);
        if (!res.ok) return null;
        const bytes = await res.arrayBuffer();
        const buffer = await actx.decodeAudioData(bytes);
        musicBufferRef.current = { trackId: track.trackId, buffer };
        return buffer;
      } catch {
        return null;
      }
    })();
    musicLoadRef.current = { trackId: track.trackId, promise };
    return promise;
  };

  // Builds the recording stream for a music video: the camera's video
  // track plus ONE mixed audio track — your voice from the mic and the
  // song together. The song is also routed to the speakers so you hear it
  // while you film. startMixSong() fires the song at the same moment the
  // recorder starts, so picture and music begin together.
  const buildMixStream = (cameraStream: MediaStream, buffer: AudioBuffer): MediaStream | null => {
    const actx = getAudioCtx();
    if (!actx) return null;
    try {
      const dest = actx.createMediaStreamDestination();
      let micSource: MediaStreamAudioSourceNode | null = null;
      if (cameraStream.getAudioTracks().length > 0) {
        micSource = actx.createMediaStreamSource(cameraStream);
        micSource.connect(dest);
      }
      const source = actx.createBufferSource();
      source.buffer = buffer;
      const musicGain = actx.createGain();
      musicGain.gain.value = 0.9;
      source.connect(musicGain);
      musicGain.connect(dest);
      musicGain.connect(actx.destination);
      mixRef.current = { source, micSource, dest };
      return new MediaStream([...cameraStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    } catch {
      mixRef.current = null;
      return null;
    }
  };

  const startMixSong = () => {
    const actx = audioCtxRef.current;
    if (actx) void actx.resume().catch(() => undefined);
    try {
      mixRef.current?.source.start(0);
    } catch {
      // already started
    }
  };

  const stopMix = () => {
    const mix = mixRef.current;
    mixRef.current = null;
    if (!mix) return;
    try {
      mix.source.stop();
    } catch {
      // never started
    }
    try {
      mix.source.disconnect();
      mix.micSource?.disconnect();
      mix.dest.disconnect();
    } catch {
      // already disconnected
    }
  };

  // Start (or restart) the camera while in the camera phase.
  useEffect(() => {
    if (phase !== "camera") return;
    let cancelled = false;
    const start = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setCameraError("This browser couldn't open a camera here. You can still upload a photo or short video instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1440 } },
          audio: true,
        });
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        streamRef.current = stream;
        setCameraError(null);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      } catch {
        if (!cancelled) {
          setCameraError("Camera or microphone access was blocked. Allow it in your browser settings, or upload a photo or short video instead.");
        }
      }
    };
    void start();
    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, facing, cameraRetry]);

  // --- Face tracking: while a lens is picked, run the browser's built-in
  // FaceDetector (Shape Detection API — the browser's own face finder, no
  // downloaded model) on the camera feed ~11×/second and keep the lens
  // glued to the face. Where the API doesn't exist, faceApi flips to
  // "off" and the lens sits on the guide ring instead — the UI says so.
  useEffect(() => {
    const activeDef = snapFilterById(filterId);
    if (phase !== "camera" || mode === "star" || (!activeDef.lens && !activeDef.warp)) return;
    const FD = (
      window as unknown as {
        FaceDetector?: new (options?: {
          fastMode?: boolean;
          maxDetectedFaces?: number;
        }) => FaceDetectorLike;
      }
    ).FaceDetector;
    if (typeof FD !== "function") {
      setFaceApi("off");
      return;
    }
    setFaceApi("on");
    if (!detectorRef.current) {
      try {
        detectorRef.current = new FD({ fastMode: true, maxDetectedFaces: 1 });
      } catch {
        setFaceApi("off");
        return;
      }
    }
    const detector = detectorRef.current;
    let stopped = false;
    let raf = 0;
    let lastRun = 0;
    let misses = 0;
    const loop = (t: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(loop);
      if (t - lastRun < 90) return;
      lastRun = t;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;
      void detector
        .detect(video)
        .then((faces) => {
          if (stopped) return;
          const found = faces[0];
          if (found) {
            misses = 0;
            const raw = faceFromDetection(found, video.videoWidth, video.videoHeight);
            const disp = facing === "user" ? mirrorFace(raw) : raw;
            const prev = faceRef.current;
            const next = prev ? lerpFace(prev, disp, 0.45) : disp;
            faceRef.current = next;
            setTrackedFace(next);
          } else {
            misses += 1;
            if (misses >= 12) {
              faceRef.current = null;
              setTrackedFace(null);
            }
          }
        })
        .catch(() => undefined);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [phase, mode, filterId, facing, cameraRetry]);

  // --- Live warp preview: while a face-warp lens is picked, paint the
  // camera feed through the warp canvas so the bend is visible live,
  // exactly as it will bake. The plain <video> stays mounted underneath
  // (recording and photo capture read from it); the canvas covers it.
  useEffect(() => {
    const def = snapFilterById(filterId);
    if (phase !== "camera" || mode === "star" || cameraError || !def.warp) return;
    const warp = def.warp;
    let raf = 0;
    let stopped = false;
    const loop = () => {
      if (stopped) return;
      raf = requestAnimationFrame(loop);
      warpRafRef.current = raf;
      const video = videoRef.current;
      const canvas = warpCanvasRef.current;
      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) return;
      const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
      const cw = Math.round(video.videoWidth * scale);
      const ch = Math.round(video.videoHeight * scale);
      if (canvas.width !== cw) canvas.width = cw;
      if (canvas.height !== ch) canvas.height = ch;
      const cctx = canvas.getContext("2d");
      if (!cctx) return;
      const mirrored = facing === "user";
      const face = faceRef.current ?? guideFace(cw, ch);
      cctx.save();
      if (mirrored) {
        cctx.translate(cw, 0);
        cctx.scale(-1, 1);
      }
      try {
        cctx.filter = def.css || "none";
      } catch {
        // Canvas filter unsupported — paint the frame as-is.
      }
      cctx.drawImage(video, 0, 0, cw, ch);
      cctx.restore();
      try {
        cctx.filter = "none";
      } catch {
        // ignore
      }
      applyWarp(cctx, video, cw, ch, warpBulges(warp, face, cw), mirrored);
      applyFrameTint(cctx, def, cw, ch);
    };
    raf = requestAnimationFrame(loop);
    warpRafRef.current = raf;
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      if (warpRafRef.current === raf) warpRafRef.current = null;
    };
  }, [phase, mode, filterId, facing, cameraError, cameraRetry]);

  const stopLensPipeline = () => {
    if (lensPipeRef.current) {
      cancelAnimationFrame(lensPipeRef.current.raf);
      lensPipeRef.current = null;
    }
  };

  // Records the camera through a canvas with the current lens drawn (or
  // the current warp applied) on every frame, so the look is IN the
  // video file (the same captureStream trick the trimmer uses). Returns
  // the canvas stream, or null when this browser can't do it — the
  // caller then records plain and says so.
  const startLensPipeline = (def: SnapFilterDef): MediaStream | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || (!def.lens && !def.warp)) return null;
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    const cw = Math.round(video.videoWidth * scale);
    const ch = Math.round(video.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const cctx = canvas.getContext("2d");
    if (!cctx) return null;
    const capHost = canvas as unknown as { captureStream?: (fps: number) => MediaStream };
    if (typeof capHost.captureStream !== "function") return null;
    let stream: MediaStream;
    try {
      stream = capHost.captureStream.call(canvas, 30);
    } catch {
      return null;
    }
    const mirrored = facing === "user";
    const lens = def.lens;
    const warp = def.warp;
    const draw = () => {
      const face = faceRef.current ?? guideFace(cw, ch);
      cctx.save();
      if (mirrored) {
        cctx.translate(cw, 0);
        cctx.scale(-1, 1);
      }
      try {
        cctx.filter = def.css || "none";
      } catch {
        // Canvas filter unsupported — draw the frame as-is.
      }
      cctx.drawImage(video, 0, 0, cw, ch);
      cctx.restore();
      try {
        cctx.filter = "none";
      } catch {
        // ignore
      }
      if (warp) applyWarp(cctx, video, cw, ch, warpBulges(warp, face, cw), mirrored);
      applyFrameTint(cctx, def, cw, ch);
      if (lens) drawLensCanvas(cctx, lens, face, cw);
      lensPipeRef.current = { raf: requestAnimationFrame(draw) };
    };
    lensPipeRef.current = { raf: requestAnimationFrame(draw) };
    return stream;
  };

  // Unmount cleanup.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      stopLensPipeline();
      stopStream();
      stopMusic();
      stopMix();
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => undefined);
        audioCtxRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Music video / Star default to the song you're already listening to,
  // so filming starts with that song instead of an empty picker.
  const nowPlaying = player.current;
  useEffect(() => {
    if ((mode === "music" || mode === "star") && !musicTrack && nowPlaying) {
      setMusicTrack(nowPlaying);
    }
  }, [mode, musicTrack, nowPlaying]);

  // Warm up the song mix as soon as a music-video song is picked, so
  // tapping record starts filming (and the song) right away instead of
  // waiting on a download first.
  useEffect(() => {
    if (phase === "camera" && mode === "music" && musicTrack) {
      void loadMusicBuffer(musicTrack);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode, musicTrack]);

  const finishRecording = (
    blob: Blob,
    mimeType: string,
    durationMs: number,
    musicInVideo = false,
    bakedFilterId: SnapFilterId = "none",
  ) => {
    if (!mountedRef.current) return;
    stopLensPipeline();
    stopStream();
    setTrimStartSec(0);
    setTrimEndSec(durationMs / 1000);
    setTrimFailed(false);
    setCaptured({
      blob,
      url: URL.createObjectURL(blob),
      kind: "video",
      mimeType,
      durationMs,
      musicInVideo,
      filterId: bakedFilterId,
    });
    setPhase("review");
  };

  const stopRecording = () => {
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    setRecording(false);
    stopLensPipeline();
    stopMusic();
    const rec = recorderRef.current;
    if (rec && rec.state === "recording") {
      try {
        rec.stop();
      } catch {
        // already stopped
      }
    }
    stopMix();
  };

  const startRecording = async () => {
    const stream = streamRef.current;
    if (!stream || recording || startingRec) return;
    if (typeof MediaRecorder === "undefined") {
      setError("This browser can't record video here. Try a photo snap, or upload a short video instead.");
      return;
    }
    setError(null);
    setMixFailed(false);
    setLensFailed(false);
    // Music video: mix the song into the recording itself, so the video
    // file carries the music. The preview is normally already decoded
    // (warm-up effect); if it still needs a moment, the record button
    // shows "Loading song…" while we wait.
    let recordStream = stream;
    let mixed = false;
    if (modeRef.current === "music" && musicTrack) {
      setStartingRec(true);
      const buffer = await loadMusicBuffer(musicTrack);
      if (!mountedRef.current) return;
      setStartingRec(false);
      if (buffer) {
        const mixStream = buildMixStream(stream, buffer);
        if (mixStream) {
          recordStream = mixStream;
          mixed = true;
        }
      }
      if (!mixed) setMixFailed(true);
    }
    // Face lens / warp: record through the canvas pipeline so the look
    // is drawn into the video itself. The audio (plain mic, or the
    // music mix) carries over from whichever stream was going to be
    // recorded.
    const activeFilter = filterRef.current;
    let lensInVideo = false;
    if (activeFilter.lens || activeFilter.warp) {
      const lensStream = startLensPipeline(activeFilter);
      if (lensStream) {
        recordStream = new MediaStream([
          ...lensStream.getVideoTracks(),
          ...recordStream.getAudioTracks(),
        ]);
        lensInVideo = true;
      } else {
        setLensFailed(true);
      }
    }
    chunksRef.current = [];
    const mimeType = pickRecorderMimeType();
    let rec: MediaRecorder;
    try {
      rec = mimeType ? new MediaRecorder(recordStream, { mimeType }) : new MediaRecorder(recordStream);
    } catch {
      stopMix();
      stopLensPipeline();
      setError("Recording wouldn't start on this browser. Try a photo snap instead.");
      return;
    }
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const type = (rec.mimeType || mimeType || "video/webm").split(";")[0] ?? "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      const durationMs = Math.min(maxRecordMs, Date.now() - recStartRef.current);
      finishRecording(blob, type, durationMs, mixed, lensInVideo ? activeFilter.id : "none");
    };
    recStartRef.current = Date.now();
    setRecMs(0);
    try {
      rec.start(250);
    } catch {
      stopMix();
      stopLensPipeline();
      setError("Recording wouldn't start on this browser. Try a photo snap instead.");
      return;
    }
    setRecording(true);
    if (modeRef.current === "music" && musicTrack) {
      if (mixed) {
        // The song now plays through the mix — into the video and out the
        // speakers — from the top, so it lines up with the first frame.
        // Stop the regular player so the song doesn't play twice.
        if (player.isPlaying) player.stop();
        startMixSong();
      } else {
        // Fallback, only when this browser couldn't do the mix: the old
        // behavior — the song plays out loud alongside the filming and is
        // attached to the snap to play from the message.
        const alreadyPlaying = player.current?.trackId === musicTrack.trackId && player.isPlaying;
        if (!alreadyPlaying) {
          musicStartedRef.current = true;
          player.play(musicTrack);
        }
      }
    }
    recTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - recStartRef.current;
      setRecMs(elapsed);
      if (elapsed >= maxRecordMs) stopRecording();
    }, 200);
  };

  // Applies the editor state to the original photo and swaps the review
  // preview to the re-baked result. With no edits at all, the original
  // capture is used untouched.
  const applyPhotoEdit = async (
    fid: SnapFilterId,
    cropId: SnapCropId,
    text: string,
    pos: SnapTextPos,
    raw: { blob: Blob; url: string } | null,
  ) => {
    if (!raw) return;
    setEditFilterId(fid);
    setEditCropId(cropId);
    setEditText(text);
    setEditTextPos(pos);
    if (fid === "none" && cropId === "full" && !text.trim()) {
      setCaptured((prev) => {
        if (prev && prev.url !== raw.url) URL.revokeObjectURL(prev.url);
        return { blob: raw.blob, url: raw.url, kind: "photo", mimeType: raw.blob.type || "image/jpeg", durationMs: 0 };
      });
      return;
    }
    setEditBusy(true);
    const baked = await bakeEditedPhoto(raw.blob, fid, cropId, text, pos, captureFaceRef.current);
    if (!mountedRef.current) return;
    setEditBusy(false);
    if (!baked) {
      setError("That edit couldn't be applied in this browser — the original photo is still ready to send.");
      return;
    }
    setError(null);
    setCaptured((prev) => {
      if (prev && prev.url !== raw.url) URL.revokeObjectURL(prev.url);
      return { blob: baked, url: URL.createObjectURL(baked), kind: "photo", mimeType: "image/jpeg", durationMs: 0 };
    });
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    setError(null);
    const scale = Math.min(1, 1440 / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Your photo couldn't be captured. Try again.");
      return;
    }
    // Capture the frame UNfiltered first: this original is what the
    // review editor re-bakes from, so the filter can still be changed
    // (or removed) after the photo is taken.
    bakeSnapFilter(ctx, video, w, h, "none", facing === "user");
    // Freeze the face with the shot: the tracked face if one is locked,
    // otherwise the guide-ring face for this frame shape. The editor's
    // re-bakes keep using it, so the lens stays on the same face.
    captureFaceRef.current = faceRef.current ?? guideFace(w, h);
    canvas.toBlob(
      (rawBlob) => {
        if (!rawBlob || !mountedRef.current) return;
        stopStream();
        const raw = { blob: rawBlob, url: URL.createObjectURL(rawBlob) };
        setRawPhoto(raw);
        setEditCropId("full");
        setEditText("");
        setEditTextPos("bottom");
        setEditFilterId(filterId);
        if (filterId === "none") {
          setCaptured({ blob: rawBlob, url: raw.url, kind: "photo", mimeType: "image/jpeg", durationMs: 0 });
          setPhase("review");
          return;
        }
        void bakeEditedPhoto(rawBlob, filterId, "full", "", "bottom", captureFaceRef.current).then((baked) => {
          if (!mountedRef.current) return;
          if (baked) {
            setCaptured({ blob: baked, url: URL.createObjectURL(baked), kind: "photo", mimeType: "image/jpeg", durationMs: 0 });
          } else {
            setCaptured({ blob: rawBlob, url: raw.url, kind: "photo", mimeType: "image/jpeg", durationMs: 0 });
          }
          setPhase("review");
        });
      },
      "image/jpeg",
      0.92,
    );
  };

  const captureStarPhoto = () => {
    const video = videoRef.current;
    if (!musicTrack) {
      setError("Pick your song first — the star frame names the song you're starring in.");
      setMusicPickerOpen(true);
      return;
    }
    if (!video || video.videoWidth === 0) return;
    setError(null);
    const canvas = document.createElement("canvas");
    canvas.width = STAR_W;
    canvas.height = STAR_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Your star photo couldn't be made. Try again.");
      return;
    }
    bakeStarFrame(ctx, video, video.videoWidth, video.videoHeight, facing === "user", musicTrack);
    canvas.toBlob(
      (blob) => {
        if (!blob || !mountedRef.current) return;
        stopStream();
        setRawPhoto(null);
        setCaptured({ blob, url: URL.createObjectURL(blob), kind: "photo", mimeType: "image/jpeg", durationMs: 0 });
        setPhase("review");
      },
      "image/jpeg",
      0.88,
    );
  };

  const bakeStarFromFile = (file: File) => {
    if (!musicTrack) {
      setError("Pick your song first — then choose your photo and it becomes the star frame.");
      setMusicPickerOpen(true);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = STAR_W;
      canvas.height = STAR_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        setError("That photo couldn't be turned into a star snap. Try another one.");
        return;
      }
      bakeStarFrame(ctx, img, img.naturalWidth || img.width, img.naturalHeight || img.height, false, musicTrack);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob || !mountedRef.current) return;
          stopStream();
          setRawPhoto(null);
          setCaptured({ blob, url: URL.createObjectURL(blob), kind: "photo", mimeType: "image/jpeg", durationMs: 0 });
          setPhase("review");
        },
        "image/jpeg",
        0.88,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("That photo couldn't be opened. Try a JPEG or PNG photo of you.");
    };
    img.src = url;
  };

  const onUploadFile = (file: File) => {
    setError(null);
    const isVideo = file.type.startsWith("video/");
    const isPhoto = file.type.startsWith("image/");
    if (!isVideo && !isPhoto) {
      setError("Pick a photo or a video file.");
      return;
    }
    if (modeRef.current === "star") {
      if (isVideo) {
        setError("Star mode stars a photo of you — pick a photo, or switch to Music video to film yourself.");
        return;
      }
      bakeStarFromFile(file);
      return;
    }
    const kind: "photo" | "video" = isVideo ? "video" : "photo";
    if (kind === "photo" && modeRef.current === "music") setMode("photo");
    const url = URL.createObjectURL(file);
    if (isVideo) {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.onloadedmetadata = () => {
        const durationMs = Math.round((probe.duration || 0) * 1000);
        if (durationMs > maxRecordMs + 5000) {
          URL.revokeObjectURL(url);
          setError(
            ent.plus
              ? "That video is longer than a snap — pick a clip of about 60 seconds or less."
              : "That video is longer than a snap — pick a clip of about 15 seconds or less. SoundChat Plus stretches snaps to 60 seconds.",
          );
          return;
        }
        stopStream();
        setRawPhoto(null);
        setTrimStartSec(0);
        setTrimEndSec(durationMs / 1000);
        setTrimFailed(false);
        setCaptured({ blob: file, url, kind, mimeType: file.type.split(";")[0] ?? file.type, durationMs });
        setPhase("review");
      };
      probe.onerror = () => {
        stopStream();
        setRawPhoto(null);
        setTrimStartSec(0);
        setTrimEndSec(0);
        setTrimFailed(false);
        setCaptured({ blob: file, url, kind, mimeType: file.type.split(";")[0] ?? file.type, durationMs: 0 });
        setPhase("review");
      };
      probe.src = url;
      return;
    }
    stopStream();
    // Uploaded photos join the editor too: the file is the original the
    // review screen re-bakes filters / crops / text from. No face was
    // tracked for an upload, so a lens uses the guide-ring face.
    captureFaceRef.current = null;
    setRawPhoto({ blob: file, url });
    setEditFilterId("none");
    setEditCropId("full");
    setEditText("");
    setEditTextPos("bottom");
    setCaptured({ blob: file, url, kind, mimeType: file.type.split(";")[0] ?? file.type, durationMs: 0 });
    setPhase("review");
  };

  const retake = () => {
    if (captured && (!rawPhoto || captured.url !== rawPhoto.url)) URL.revokeObjectURL(captured.url);
    if (rawPhoto) URL.revokeObjectURL(rawPhoto.url);
    setRawPhoto(null);
    setCaptured(null);
    captureFaceRef.current = null;
    faceRef.current = null;
    setTrackedFace(null);
    setCaption("");
    setError(null);
    setEditText("");
    setTrimFailed(false);
    setTrimming(false);
    setSavedNote(false);
    setMixFailed(false);
    setLensFailed(false);
    setPhase("camera");
  };

  const sendSnap = useMutation({
    mutationFn: async (args: { cap: CapturedSnap; targetConversationId: number }) => {
      const cap = args.cap;
      // Encrypt the media and caption on this device first — storage only
      // ever sees scrambled bytes. If this browser has no crypto support,
      // the snap is sent as-is (the Profile privacy card says which is which).
      const mediaToSend = (await encryptMediaBlob(cap.blob)) ?? cap.blob;
      const { dataBase64, mimeType } = await fileToBase64(mediaToSend);
      const captionPlain = caption.trim();
      const captionEncrypted = captionPlain ? await encryptTextValue(captionPlain) : null;
      return await api.sendSnapMessage({
        conversationId: args.targetConversationId,
        sender,
        senderContactId: senderContactId ?? null,
        mediaKind: cap.kind,
        dataBase64,
        mimeType: cap.mimeType || mimeType.split(";")[0] || cap.mimeType,
        durationMs: cap.kind === "video" ? cap.durationMs : 0,
        filterId:
          cap.kind === "photo" && mode !== "star"
            ? rawPhoto
              ? editFilterId
              : filterId
            : cap.kind === "video"
              ? (cap.filterId ?? "none")
              : "none",
        caption: captionPlain ? (captionEncrypted ?? captionPlain) : undefined,
        musicTrack: (mode === "music" || mode === "star") && musicTrack ? toTrackIn(musicTrack) : null,
        musicInVideo: cap.kind === "video" && (cap.musicInVideo ?? false),
      });
    },
    onSuccess: () => {
      if (standalone) {
        const target = navTargetRef.current;
        if (target) onSentToChat?.(target);
      } else {
        onSent?.();
      }
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "That snap didn't send. Try again."),
  });

  const videoDurationSec = captured?.kind === "video" ? captured.durationMs / 1000 : 0;
  const isTrimmed =
    captured?.kind === "video" &&
    videoDurationSec > 0 &&
    (trimStartSec > 0.05 || trimEndSec < videoDurationSec - 0.05);

  // Produces the final snap to send or save: for a trimmed video that's a
  // freshly re-recorded clip of just the chosen stretch. Returns null
  // (with an error already shown) when the trim couldn't be made and the
  // user hasn't agreed to the full clip.
  const finalizeCapture = async (): Promise<CapturedSnap | null> => {
    if (!captured) return null;
    if (captured.kind !== "video" || !isTrimmed) return captured;
    if (trimFailed) return captured; // user chose "send the full clip" after a failed trim
    setTrimming(true);
    const trimmed = await trimVideoBlob(
      captured.blob,
      Math.round(trimStartSec * 1000),
      Math.round(trimEndSec * 1000),
    );
    if (!mountedRef.current) return null;
    setTrimming(false);
    if (!trimmed) {
      setTrimFailed(true);
      setError(
        "This browser couldn't trim the clip. Send it full-length instead, or reset the trim and try again.",
      );
      return null;
    }
    return {
      blob: trimmed.blob,
      url: URL.createObjectURL(trimmed.blob),
      kind: "video",
      mimeType: trimmed.blob.type || captured.mimeType,
      durationMs: trimmed.durationMs,
      // Trimming re-records through the video element, audio included —
      // a song mixed into the clip stays in the trimmed clip, and so
      // does a lens that was recorded into it.
      musicInVideo: captured.musicInVideo ?? false,
      filterId: captured.filterId ?? "none",
    };
  };

  const prepareAndSend = async (targetConversationId: number) => {
    if (!captured || sendSnap.isPending || trimming) return;
    if (caption.trim().length > 140) {
      setError("Captions are capped at 140 characters — trim it a little and send again.");
      return;
    }
    setError(null);
    const finalCap = await finalizeCapture();
    if (!finalCap) return;
    if (finalCap.blob.size > maxSnapBytes) {
      setError(
        ent.plus
          ? "That snap is too big to send (about 32 MB max). Try a shorter clip."
          : "That snap is too big to send (about 10 MB max). Try a shorter clip.",
      );
      if (finalCap !== captured) URL.revokeObjectURL(finalCap.url);
      return;
    }
    sendSnap.mutate({ cap: finalCap, targetConversationId });
  };

  const trySend = () => {
    if (conversationId != null) void prepareAndSend(conversationId);
  };

  // Saves the finished snap (edits and trim applied) as a file on this
  // device — the way to keep a snap without sending it to anyone.
  const saveToDevice = async () => {
    if (!captured || trimming) return;
    setError(null);
    const finalCap = await finalizeCapture();
    if (!finalCap) return;
    const ext =
      finalCap.mimeType === "image/png"
        ? "png"
        : finalCap.mimeType === "image/webp"
          ? "webp"
          : finalCap.mimeType === "video/webm"
            ? "webm"
            : finalCap.mimeType === "video/quicktime"
              ? "mov"
              : finalCap.kind === "photo"
                ? "jpg"
                : "mp4";
    const a = document.createElement("a");
    a.href = finalCap.url;
    a.download = `soundchat-snap-${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (finalCap !== captured) {
      window.setTimeout(() => URL.revokeObjectURL(finalCap.url), 4000);
    }
    setSavedNote(true);
  };

  // Track the preview width so overlay stickers size like the sent card's.
  const measurePreview = (el: HTMLDivElement | null) => {
    if (el) setPreviewWidth(el.clientWidth || 360);
  };

  const headerTitle =
    phase === "review"
      ? standalone
        ? "Edit your snap"
        : `Send snap · ${contactName ?? ""}`
      : `${mode === "music" ? "Music video" : mode === "star" ? "Star in the video" : "Snap"}${standalone ? "" : ` · ${contactName ?? ""}`}`;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={standalone ? "Camera studio — take and edit a photo or video" : `Take a snap for ${contactName ?? ""}`}>
      <div className="flex items-center justify-between px-3 pt-safe">
        <button
          type="button"
          onClick={() => {
            if (recording) stopRecording();
            onClose();
          }}
          aria-label="Close camera"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"
        >
          <XIcon />
        </button>
        <p className="font-display text-sm font-bold">
          {headerTitle}
        </p>
        {phase === "camera" && !cameraError ? (
          <button
            type="button"
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
            disabled={recording}
            aria-label={facing === "user" ? "Switch to back camera" : "Switch to front camera"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 disabled:opacity-40"
          >
            <FlipCameraIcon />
          </button>
        ) : (
          <span className="w-10" aria-hidden="true" />
        )}
      </div>

      {phase === "camera" ? (
        <>
          <div ref={measurePreview} className="relative mx-3 mt-2 min-h-0 flex-1 overflow-hidden rounded-3xl bg-neutral-900">
            {cameraError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="text-neutral-300"><CameraIcon /></span>
                <p className="text-sm text-neutral-200">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 font-display text-sm font-bold text-white"
                >
                  <UploadIcon /> Upload a photo or video
                </button>
                <button
                  type="button"
                  onClick={() => setCameraRetry((n) => n + 1)}
                  className="rounded-full bg-white/12 px-5 py-2.5 text-sm font-semibold"
                >
                  Try the camera again
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  aria-label="Camera preview"
                  className="h-full w-full object-cover"
                  style={{
                    transform: facing === "user" ? "scaleX(-1)" : undefined,
                    filter:
                      mode === "star"
                        ? "saturate(1.28) contrast(1.1) brightness(1.04)"
                        : filterDef.css || undefined,
                  }}
                />
                {mode !== "star" && filterDef.warp && (
                  <canvas
                    ref={warpCanvasRef}
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                {mode === "star" && (
                  <>
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(ellipse 90% 55% at 50% 12%, rgba(255,216,150,0.30), transparent 65%), radial-gradient(ellipse 120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.45) 100%)",
                      }}
                      aria-hidden="true"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-3 pt-10 text-center">
                      <p className="font-display text-sm font-extrabold tracking-wide text-[var(--amber)]">★ STARRING YOU ★</p>
                      <p className="truncate text-sm font-bold text-white">
                        {musicTrack ? musicTrack.title : "Pick your song below"}
                      </p>
                      {musicTrack && (
                        <p className="truncate text-[11px] text-white/75">as the singer · {musicTrack.artist}</p>
                      )}
                    </div>
                  </>
                )}
                {mode !== "star" && (
                  <SnapFilterOverlay filterId={filterId} frameWidth={previewWidth} face={trackedFace} live />
                )}
                {mode !== "star" && (filterDef.lens || filterDef.warp) && !trackedFace && (
                  <div
                    className="pointer-events-none absolute left-1/2 top-[4%] aspect-square w-[62%] -translate-x-1/2 rounded-full border-2 border-dashed border-white/50"
                    aria-hidden="true"
                  />
                )}
                {mode !== "star" && (filterDef.lens || filterDef.warp) && !trackedFace && (
                  <p className="pointer-events-none absolute inset-x-0 top-2 text-center text-[11px] font-medium text-white/85">
                    {faceApi === "on" ? "Looking for your face…" : "Line your face up in the ring"}
                  </p>
                )}
                {recording && (
                  <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold">
                    <span className="snap-rec inline-block h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
                    {fmtSnapDuration(recMs)} / {fmtSnapDuration(maxRecordMs)}
                    <span className="sr-only">Recording</span>
                  </div>
                )}
                {mode === "music" && musicTrack && (
                  <div className="absolute inset-x-3 bottom-3 flex items-center gap-2.5 rounded-2xl bg-black/65 px-3 py-2">
                    {musicTrack.artworkUrl ? (
                      <img src={musicTrack.artworkUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15"><MusicIcon /></span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{musicTrack.title}</p>
                      <p className="truncate text-[11px] text-white/70">
                        {recording ? "Recording — the song is going into your video" : "Records into your video as you film"}
                      </p>
                    </div>
                    {recording && <EqBars playing />}
                  </div>
                )}
              </>
            )}
          </div>

          {!cameraError && mode === "music" && (
            <div className="px-4 pt-3">
              {musicTrack ? (
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-center text-sm">
                    <span className="font-semibold">{musicTrack.title}</span> — {musicTrack.artist}
                  </p>
                  <button
                    type="button"
                    onClick={() => setMusicPickerOpen(true)}
                    disabled={recording}
                    className="shrink-0 rounded-full bg-white/12 px-4 py-2 text-sm font-semibold disabled:opacity-40"
                  >
                    Change song
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMusicPickerOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 font-display text-sm font-bold text-white"
                >
                  <MusicIcon /> Pick the song for your music video
                </button>
              )}
              <p className="mt-2 text-center text-[11px] leading-snug text-white/60">
                The song is mixed right into your video while you film — you hear it, you can sing along
                (your voice is in there too), and whoever watches hears the song with the video, no extra
                tap. It restarts from the top when you hit record so it lines up with your first frame.
              </p>
            </div>
          )}

          {!cameraError && mode === "star" && (
            <div className="px-4 pt-3">
              {musicTrack ? (
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-center text-sm">
                    <span className="font-semibold">{musicTrack.title}</span> — {musicTrack.artist}
                  </p>
                  <button
                    type="button"
                    onClick={() => setMusicPickerOpen(true)}
                    className="shrink-0 rounded-full bg-white/12 px-4 py-2 text-sm font-semibold"
                  >
                    Change song
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMusicPickerOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 font-display text-sm font-bold text-white"
                >
                  <MusicIcon /> Pick the song you're starring in
                </button>
              )}
              <p className="mt-2 text-center text-[11px] leading-snug text-white/60">
                Take a photo with the big button, or tap the upload icon to use a photo of you that's
                already on this phone. You become the singer — center stage, your name in lights — and
                the song is attached so it plays from the snap. Honest note: this stars your real photo
                in a music-video frame; it can't swap your face into {musicTrack ? musicTrack.artist : "the artist"}'s
                actual video footage.
              </p>
            </div>
          )}

          {!cameraError && mode !== "star" && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-1 pt-3" role="group" aria-label="Filters and lenses">
              {SNAP_FILTERS.map((f) => {
                const locked = lensLocked(f, ent);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => pickFilter(f)}
                    aria-pressed={filterId === f.id}
                    aria-label={locked ? `Filter: ${f.name} — SoundChat Plus lens` : `Filter: ${f.name}`}
                    className={`relative flex shrink-0 flex-col items-center gap-1 rounded-2xl px-1 py-1 ${filterId === f.id ? "bg-white/15" : ""}`}
                  >
                    {f.lens || f.warp ? (
                      <span
                        className={`block rounded-full border-2 ${filterId === f.id ? "border-[var(--accent)]" : "border-white/30"}`}
                        aria-hidden="true"
                      >
                        <LensIcon def={f} size={40} />
                      </span>
                    ) : (
                      <span
                        className={`h-11 w-11 rounded-full border-2 ${filterId === f.id ? "border-[var(--accent)]" : "border-white/30"}`}
                        style={{ background: f.swatch }}
                        aria-hidden="true"
                      />
                    )}
                    {locked && (
                      <span className="absolute right-0.5 top-0.5 rounded-full bg-[var(--amber)] px-1.5 py-px text-[8px] font-extrabold text-black">
                        PLUS
                      </span>
                    )}
                    <span className="w-14 text-center text-[10px] font-medium leading-tight">{f.name}</span>
                  </button>
                );
              })}
            </div>
          )}
          {!cameraError && mode !== "star" && (filterDef.lens || filterDef.warp) && (
            <p className="px-6 pt-2 text-center text-[11px] leading-snug text-white/60">
              {faceApi === "on"
                ? trackedFace
                  ? "Face tracking is on — the look follows your face and tilts with your head, and it's drawn right into your photos and videos."
                  : "Looking for your face… hold still a second and the look locks on and follows you."
                : "This browser doesn't have live face tracking built in, so the look sits on the guide ring — line your face up in it and it lands right. (Browsers with face detection built in get the follow-you version automatically.)"}{" "}
              {filterDef.warp
                ? "Warp lenses bend your real face — watch it change live above."
                : "Lenses add things on — they can't take off real glasses or a hat you're wearing."}
            </p>
          )}
          {!cameraError && mode === "video" && !filterDef.lens && !filterDef.warp && (
            <p className="px-6 pt-3 text-center text-[11px] leading-snug text-white/60">
              Pick a lens above and it records right into the video. On the next screen you can trim the
              start and end before sending.{" "}
              {ent.plus ? "Up to 60 seconds with Plus." : "Up to 15 seconds — Plus stretches it to 60."}
            </p>
          )}

          {error && <p className="px-4 pt-2 text-center text-sm text-red-300" role="alert">{error}</p>}

          <div className="px-4 pb-safe" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <div className="mb-3 flex justify-center" role="group" aria-label="Snap mode">
              {(["photo", "video", "music", "star"] as SnapMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  disabled={recording || startingRec}
                  aria-pressed={mode === m}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-bold disabled:opacity-40 ${mode === m ? "text-[var(--amber)]" : "text-white/60"}`}
                >
                  {m === "photo" ? <CameraIcon /> : m === "video" ? <VideoIcon /> : m === "music" ? <MusicIcon /> : <StarIcon size={18} />}
                  {m === "photo" ? "Photo" : m === "video" ? "Video" : m === "music" ? "Music video" : "Star"}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={recording}
                aria-label="Upload a photo or video instead"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/12 disabled:opacity-40"
              >
                <UploadIcon />
              </button>
              {mode === "photo" || mode === "star" ? (
                <button
                  type="button"
                  onClick={mode === "star" ? captureStarPhoto : capturePhoto}
                  disabled={!!cameraError || (mode === "star" && !musicTrack)}
                  aria-label={mode === "star" ? "Take your star photo" : "Take photo"}
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white bg-white/25 disabled:opacity-40"
                >
                  <span className="h-14 w-14 rounded-full bg-white" aria-hidden="true" />
                </button>
              ) : recording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  aria-label="Stop recording"
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white bg-red-500/30"
                >
                  <span className="h-7 w-7 rounded-md bg-red-500" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  disabled={!!cameraError || startingRec || (mode === "music" && !musicTrack)}
                  aria-label={mode === "music" ? "Start filming your music video" : "Start recording a video snap"}
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white bg-red-500/25 disabled:opacity-40"
                >
                  <span className="h-14 w-14 rounded-full bg-red-500" aria-hidden="true" />
                </button>
              )}
              <span className="flex w-12 justify-center text-center text-[11px] font-medium text-white/60">
                {mode === "star" && !musicTrack
                  ? "Pick a song first"
                  : mode === "star"
                    ? "You're the star"
                    : mode === "photo"
                      ? "Tap to snap"
                      : startingRec
                        ? "Loading song…"
                        : recording
                          ? "Tap to stop"
                          : mode === "music" && !musicTrack
                            ? "Pick a song first"
                            : ent.plus
                              ? "Up to 60s"
                              : "Up to 15s"}
              </span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="relative mx-3 mt-2 min-h-0 flex-1 overflow-hidden rounded-3xl bg-neutral-900">
            {captured?.kind === "photo" ? (
              <img src={captured.url} alt="Your snap, ready to edit and send" className="h-full w-full object-contain" />
            ) : captured ? (
              <video
                ref={reviewVideoRef}
                src={captured.url}
                controls
                autoPlay
                loop
                playsInline
                aria-label="Your video snap, ready to edit and send"
                className="h-full w-full object-contain"
                onLoadedMetadata={(e) => {
                  if (trimStartSec > 0) e.currentTarget.currentTime = trimStartSec;
                }}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  if (trimEndSec > 0 && v.currentTime > trimEndSec) v.currentTime = trimStartSec;
                }}
              />
            ) : null}
            {captured?.kind === "video" && (
              <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold">
                {isTrimmed
                  ? `Trimmed to ${fmtSnapDuration((trimEndSec - trimStartSec) * 1000)}`
                  : `${fmtSnapDuration(captured.durationMs)} video`}
              </span>
            )}
            {captured?.kind === "photo" && rawPhoto && editFilterId !== "none" && (
              <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold">
                {snapFilterById(editFilterId).name} — change it below
              </span>
            )}
            {captured?.kind === "photo" && mode === "star" && (
              <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold">
                ★ Starring you
              </span>
            )}
          </div>
          <div className="max-h-[52dvh] overflow-y-auto px-4 pb-safe pt-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            {captured?.kind === "photo" && rawPhoto && (
              <div className="mb-3 rounded-2xl bg-white/10 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-white/85">
                  <PencilIcon /> Edit this photo — changes apply right away
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Change the filter">
                  {SNAP_FILTERS.map((f) => {
                    const locked = lensLocked(f, ent);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        disabled={editBusy}
                        onClick={() => {
                          if (locked) {
                            setPlusSheetOpen(true);
                            return;
                          }
                          void applyPhotoEdit(f.id, editCropId, editText, editTextPos, rawPhoto);
                        }}
                        aria-pressed={editFilterId === f.id}
                        aria-label={locked ? `Filter: ${f.name} — SoundChat Plus lens` : `Filter: ${f.name}`}
                        className={`relative flex shrink-0 flex-col items-center gap-1 rounded-xl px-1 py-1 disabled:opacity-50 ${editFilterId === f.id ? "bg-white/15" : ""}`}
                      >
                        {f.lens || f.warp ? (
                          <span
                            className={`block rounded-full border-2 ${editFilterId === f.id ? "border-[var(--accent)]" : "border-white/30"}`}
                            aria-hidden="true"
                          >
                            <LensIcon def={f} size={32} />
                          </span>
                        ) : (
                          <span
                            className={`h-9 w-9 rounded-full border-2 ${editFilterId === f.id ? "border-[var(--accent)]" : "border-white/30"}`}
                            style={{ background: f.swatch }}
                            aria-hidden="true"
                          />
                        )}
                        {locked && (
                          <span className="absolute right-0 top-0 rounded-full bg-[var(--amber)] px-1 py-px text-[7px] font-extrabold text-black">
                            PLUS
                          </span>
                        )}
                        <span className="w-12 text-center text-[9px] font-medium leading-tight">{f.name}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Crop the photo">
                  <span className="text-[11px] font-semibold text-white/60">Crop:</span>
                  {SNAP_CROPS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={editBusy}
                      onClick={() => void applyPhotoEdit(editFilterId, c.id, editText, editTextPos, rawPhoto)}
                      aria-pressed={editCropId === c.id}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${editCropId === c.id ? "bg-[var(--accent)] text-white" : "bg-white/12"}`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    aria-label="Text stamped on the photo"
                    maxLength={60}
                    className="min-w-0 flex-1 rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-[var(--accent)]"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => void applyPhotoEdit(editFilterId, editCropId, editText, editTextPos, rawPhoto)}
                    placeholder="Add text on the photo…"
                  />
                  <div className="flex shrink-0 overflow-hidden rounded-full bg-white/12" role="group" aria-label="Text position">
                    {(["top", "middle", "bottom"] as SnapTextPos[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        disabled={editBusy}
                        onClick={() => void applyPhotoEdit(editFilterId, editCropId, editText, p, rawPhoto)}
                        aria-pressed={editTextPos === p}
                        aria-label={`Put the text at the ${p}`}
                        className={`px-2.5 py-2 text-[11px] font-bold capitalize disabled:opacity-50 ${editTextPos === p ? "bg-[var(--accent)] text-white" : ""}`}
                      >
                        {p === "top" ? "Top" : p === "middle" ? "Mid" : "Low"}
                      </button>
                    ))}
                  </div>
                </div>
                {editBusy && <p className="mt-1.5 text-[11px] text-white/60">Applying your edit…</p>}
              </div>
            )}

            {captured?.kind === "video" && videoDurationSec >= 1 && (
              <div className="mb-3 rounded-2xl bg-white/10 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-white/85">
                  <ScissorsIcon /> Trim the clip
                </p>
                <p className="mb-2 text-[11px] text-white/60">
                  Keeping {fmtSnapDuration(trimStartSec * 1000)} – {fmtSnapDuration(trimEndSec * 1000)} of{" "}
                  {fmtSnapDuration(captured.durationMs)}. The preview above plays just that stretch.
                </p>
                <label htmlFor="snap-trim-start" className="mb-0.5 block text-[11px] font-semibold text-white/70">
                  Start: {fmtSnapDuration(trimStartSec * 1000)}
                </label>
                <input
                  id="snap-trim-start"
                  type="range"
                  min={0}
                  max={videoDurationSec}
                  step={0.1}
                  value={trimStartSec}
                  onChange={(e) => {
                    const v = Math.min(Number(e.target.value), Math.max(0, trimEndSec - 0.3));
                    setTrimStartSec(v);
                    setTrimFailed(false);
                    if (reviewVideoRef.current) reviewVideoRef.current.currentTime = v;
                  }}
                  aria-label="Trim start"
                  className="w-full accent-[var(--accent)]"
                />
                <label htmlFor="snap-trim-end" className="mb-0.5 block text-[11px] font-semibold text-white/70">
                  End: {fmtSnapDuration(trimEndSec * 1000)}
                </label>
                <input
                  id="snap-trim-end"
                  type="range"
                  min={0}
                  max={videoDurationSec}
                  step={0.1}
                  value={trimEndSec}
                  onChange={(e) => {
                    const v = Math.max(Number(e.target.value), trimStartSec + 0.3);
                    setTrimEndSec(v);
                    setTrimFailed(false);
                    if (reviewVideoRef.current) reviewVideoRef.current.currentTime = trimStartSec;
                  }}
                  aria-label="Trim end"
                  className="w-full accent-[var(--accent)]"
                />
                {isTrimmed && (
                  <button
                    type="button"
                    onClick={() => {
                      setTrimStartSec(0);
                      setTrimEndSec(videoDurationSec);
                      setTrimFailed(false);
                      if (reviewVideoRef.current) reviewVideoRef.current.currentTime = 0;
                    }}
                    className="mt-1 rounded-full bg-white/12 px-3.5 py-1.5 text-xs font-semibold"
                  >
                    Reset trim — keep the whole clip
                  </button>
                )}
              </div>
            )}

            <label htmlFor="snap-caption" className="mb-1 block text-xs font-medium text-white/70">
              Caption (optional)
            </label>
            <input
              {...FIELDS.sendSnapMessage.caption}
              id="snap-caption"
              className="w-full rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-base text-white outline-none placeholder:text-white/40 focus:border-[var(--accent)]"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Say something about it…"
            />
            {captured?.kind === "video" && captured.filterId && captured.filterId !== "none" && (
              <p className="mt-2 text-center text-xs text-white/70">
                The {snapFilterById(captured.filterId).name} look is recorded right into this video —
                press play and it's there in the file itself, not just floating on top.
              </p>
            )}
            {captured?.kind === "video" && lensFailed && (
              <p className="mt-2 text-center text-xs text-white/70">
                This browser couldn't draw the look into the recording, so this video was recorded plain.
              </p>
            )}
            {mode === "music" && musicTrack && captured?.kind === "video" && (
              <p className="mt-2 text-center text-xs text-white/70">
                {captured.musicInVideo
                  ? `“${musicTrack.title}” is recorded right into this video — press play above and you'll hear it. Saving it to your device or sending it keeps the song in the file.`
                  : mixFailed
                    ? `This browser couldn't mix “${musicTrack.title}” into the video itself, so the song is attached to play from the snap instead.`
                    : `With “${musicTrack.title}” by ${musicTrack.artist} attached to play from the snap.`}
              </p>
            )}
            {mode === "star" && musicTrack && captured?.kind === "photo" && (
              <p className="mt-2 text-center text-xs text-white/70">
                That's you starring as the singer in “{musicTrack.title}” by {musicTrack.artist} — the song is
                attached so it plays from the snap.
              </p>
            )}
            {error && <p className="mt-2 text-center text-sm text-red-300" role="alert">{error}</p>}
            {savedNote && (
              <p className="mt-2 text-center text-xs font-medium text-emerald-300">
                Saved to this device — look in your downloads or photo library.
              </p>
            )}
            {standalone ? (
              <>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={retake}
                    disabled={sendSnap.isPending || trimming}
                    className="flex-1 rounded-full bg-white/12 px-4 py-3 font-display text-sm font-bold disabled:opacity-40"
                  >
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveToDevice()}
                    disabled={sendSnap.isPending || trimming || !captured}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/12 px-4 py-3 font-display text-sm font-bold disabled:opacity-40"
                  >
                    <DownloadIcon /> {trimming ? "Trimming…" : "Save to device"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSendPickerOpen(true);
                  }}
                  disabled={sendSnap.isPending || trimming || !captured}
                  className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 font-display text-sm font-bold text-white disabled:opacity-50"
                >
                  <SendIcon /> {sendSnap.isPending ? "Sending…" : trimFailed && isTrimmed ? "Send full clip to a chat…" : "Send to a chat…"}
                </button>
              </>
            ) : (
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={retake}
                  disabled={sendSnap.isPending || trimming}
                  className="flex-1 rounded-full bg-white/12 px-5 py-3 font-display text-sm font-bold disabled:opacity-40"
                >
                  Retake
                </button>
                <button
                  type="button"
                  onClick={trySend}
                  disabled={sendSnap.isPending || trimming || !captured}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 font-display text-sm font-bold text-white disabled:opacity-50"
                >
                  <SendIcon /> {trimming ? "Trimming…" : sendSnap.isPending ? "Sending…" : trimFailed && isTrimmed ? "Send full clip" : "Send snap"}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        aria-label="Upload a photo or video"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onUploadFile(f);
        }}
      />
      {musicPickerOpen && (
        <SongPicker
          title={mode === "star" ? "Song you're starring in" : "Song for your music video"}
          onClose={() => setMusicPickerOpen(false)}
          onPick={(t) => {
            setMusicTrack(t);
            setMusicPickerOpen(false);
          }}
        />
      )}
      {sendPickerOpen && (
        <SnapTargetSheet
          onClose={() => setSendPickerOpen(false)}
          onPick={(target) => {
            navTargetRef.current = target;
            setSendPickerOpen(false);
            void prepareAndSend(target.conversationId);
          }}
        />
      )}
      {plusSheetOpen && <PlusSheet onClose={() => setPlusSheetOpen(false)} />}
    </div>
  );
}

function DisappearingSheet({
  conversationId,
  currentSeconds,
  chatName,
  onClose,
  onSaved,
}: {
  conversationId: number;
  currentSeconds: number | null;
  chatName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(currentSeconds);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () =>
      await api.setConversationDisappearingTimer({ conversationId, seconds: picked }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't change the timer."),
  });
  return (
    <Sheet title="Disappearing messages" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-[var(--dim)]">
          Pick how long new messages in your chat with {chatName} stick around. When the time
          runs out, the message is <span className="font-semibold text-[var(--text)]">deleted from
          storage for real</span> — text, photo, and video files included — not just hidden.
          Messages you tap <span className="font-semibold text-[var(--text)]">Save</span> on never
          disappear. Changing this only affects messages sent from now on.
        </p>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Disappearing timer for this chat">
          {DISAPPEARING_OPTIONS.map((o) => {
            const on = picked === o.seconds;
            return (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPicked(o.seconds)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold ${
                  on ? "bg-[var(--accent)] text-white" : "bg-[var(--bg)]"
                }`}
              >
                <TimerIcon />
                <span className="flex-1">{o.label}</span>
                {on && <span aria-hidden="true">On</span>}
              </button>
            );
          })}
        </div>
        {error && <p className="text-sm text-[var(--accent)]" role="alert">{error}</p>}
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => {
            setError(null);
            save.mutate();
          }}
          className="rounded-full bg-[var(--accent)] px-5 py-3 font-display font-bold text-white disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save timer"}
        </button>
      </div>
    </Sheet>
  );
}

function ThreadView({
  conversationId,
  contact,
  group,
  myName,
  onBack,
  onEditContact,
}: {
  conversationId: number;
  contact: ThreadContact | null;
  group?: { title: string; members: ThreadContact[] } | null;
  myName: string;
  onBack: () => void;
  onEditContact: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sender, setSender] = useState<"me" | "them">("me");
  const [asMemberId, setAsMemberId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [snapOpen, setSnapOpen] = useState(false);
  const isGroup = group != null;
  const members = group?.members ?? [];
  // Who the next outgoing message is "from": in a group, either me or one
  // chosen member; in a direct chat, me or the contact (testing toggle).
  const effSender: "me" | "them" = isGroup ? (asMemberId != null ? "them" : "me") : sender;
  const effSenderContactId: number | null = isGroup ? asMemberId : null;
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [timerSheetOpen, setTimerSheetOpen] = useState(false);
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState<number | null>(null);
  // Ticking clock so "disappears in …" countdowns stay honest.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(iv);
  }, []);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ---- Call state ----
  const player = usePlayer();
  const [callPhase, setCallPhase] = useState<CallPhase>("idle");
  const [callOpen, setCallOpen] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [callMuted, setCallMuted] = useState(false);
  const [callSpeaker, setCallSpeaker] = useState(true);
  const [callPickerOpen, setCallPickerOpen] = useState(false);
  const [callTrack, setCallTrack] = useState<Track | null>(null);
  const callTrackRef = useRef<Track | null>(null);
  const callSecondsRef = useRef(0);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (callPhase !== "connected") return;
    const iv = setInterval(() => {
      setCallSeconds((s) => { callSecondsRef.current = s + 1; return s + 1; });
    }, 1000);
    return () => clearInterval(iv);
  }, [callPhase]);

  useEffect(() => () => { if (ringTimer.current) clearTimeout(ringTimer.current); }, []);

  const messages = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => api.listMessages({ conversationId }),
    // Poll so a message whose timer runs out while the chat is open is
    // actually removed from the screen (the server deletes it on read).
    refetchInterval: 10000,
  });

  const disappearingSeconds = messages.data?.disappearingSeconds ?? null;

  const invalidateThread = () => {
    queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const keepMessage = useMutation({
    mutationFn: async (v: { messageId: number; kept: boolean }) =>
      await api.setMessageKept(v),
    onSuccess: invalidateThread,
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't save that message."),
  });

  const deleteMessageNow = useMutation({
    mutationFn: async (messageId: number) => await api.deleteMessageNow({ messageId }),
    onSuccess: () => {
      setConfirmDeleteMsgId(null);
      invalidateThread();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't delete that message."),
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.data?.messages.length]);

  const sendText = useMutation({
    mutationFn: async () => {
      const plain = draft.trim();
      // Encrypt on this device before it goes anywhere near storage.
      const encrypted = await encryptTextValue(plain);
      return await api.sendTextMessage({
        conversationId,
        text: encrypted ?? plain,
        sender: effSender,
        senderContactId: effSenderContactId,
      });
    },
    onSuccess: () => {
      setDraft("");
      invalidateThread();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Message didn't send. Try again."),
  });

  const sendTrack = useMutation({
    mutationFn: async (t: Track) =>
      await api.sendTrackMessage({
        conversationId,
        track: toTrackIn(t),
        sender: effSender,
        senderContactId: effSenderContactId,
      }),
    onSuccess: () => {
      setPickerOpen(false);
      invalidateThread();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Song didn't send. Try again."),
  });

  const clearChat = useMutation({
    mutationFn: async () => await api.deleteConversation({ id: conversationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onBack();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not delete this chat."),
  });

  const logCall = useMutation({
    mutationFn: async (text: string) => await api.sendTextMessage({ conversationId, text, sender: "me" }),
    onSuccess: invalidateThread,
    onError: () => undefined,
  });

  const startCall = () => {
    setCallSeconds(0);
    callSecondsRef.current = 0;
    setCallMuted(false);
    setCallSpeaker(true);
    setCallTrack(null);
    callTrackRef.current = null;
    setCallPhase("ringing");
    setCallOpen(true);
    if (ringTimer.current) clearTimeout(ringTimer.current);
    ringTimer.current = setTimeout(() => setCallPhase("connected"), 2600);
  };

  const endCall = () => {
    if (ringTimer.current) clearTimeout(ringTimer.current);
    const wasConnected = callPhase === "connected";
    const dur = callSecondsRef.current;
    const listened = callTrackRef.current;
    if (player.ducked) player.stop();
    setCallPhase("ended");
    if (wasConnected && dur >= 3) {
      const label = isGroup ? "Group call" : "Call";
      logCall.mutate(
        listened
          ? `${label} · ${fmtCallTime(dur)} · Played “${listened.title}” by ${listened.artist} over the call`
          : `${label} · ${fmtCallTime(dur)}`,
      );
    }
    setTimeout(() => { setCallPhase("idle"); setCallOpen(false); }, 900);
  };

  const playOverCall = (t: Track) => {
    setCallPickerOpen(false);
    setCallTrack(t);
    callTrackRef.current = t;
    player.playOverCall(t);
    // Also share the track into the thread as a normal track message.
    sendTrack.mutate(t);
  };

  const firstName = contact ? (contact.name.split(/\s+/)[0] ?? contact.name) : "";
  const displayName = isGroup ? group.title : (contact?.name ?? "Chat");
  const callContact: ThreadContact = isGroup
    ? { id: 0, name: group.title, handle: null, color: members[0]?.color ?? "#FF4D2E" }
    : (contact ?? { id: 0, name: "Chat", handle: null, color: "#FF4D2E" });
  const memberName = (id: number | null) =>
    members.find((m) => m.id === id)?.name.split(/\s+/)[0] ?? firstName;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-2 py-2 pt-safe">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to chats"
          className="flex h-10 w-10 items-center justify-center rounded-full"
        >
          <BackIcon />
        </button>
        {isGroup ? (
          <div className="flex shrink-0 -space-x-2.5" aria-hidden="true">
            {members.slice(0, 3).map((m) => (
              <span key={m.id} className="rounded-full ring-2 ring-[var(--surface)]">
                <Avatar name={m.name} color={m.color} size={34} />
              </span>
            ))}
          </div>
        ) : (
          contact && <Avatar name={contact.name} color={contact.color} size={40} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-bold leading-tight">{displayName}</p>
          {isGroup ? (
            <p className="truncate text-xs text-[var(--dim)]">
              Group · {members.map((m) => m.name.split(/\s+/)[0]).join(", ")}
            </p>
          ) : (
            contact?.handle && <p className="truncate text-xs text-[var(--dim)]">{contact.handle}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setTimerSheetOpen(true)}
          aria-label={`Disappearing messages for this chat: ${disappearingSeconds == null ? "off" : disappearingLabel(disappearingSeconds)}. Change the timer`}
          className={`flex h-10 w-10 items-center justify-center rounded-full ${disappearingSeconds == null ? "text-[var(--dim)]" : "text-[var(--accent)]"}`}
        >
          <TimerIcon />
        </button>
        <button
          type="button"
          onClick={() => { if (callPhase === "idle" || callPhase === "ended") startCall(); else setCallOpen(true); }}
          aria-label={callPhase === "connected" || callPhase === "ringing" ? `Return to call with ${displayName}` : isGroup ? `Group call ${displayName}` : `Call ${displayName}`}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-white"
        >
          <PhoneIcon />
        </button>
        {!isGroup && (
          <button
            type="button"
            onClick={onEditContact}
            aria-label={`Edit contact ${displayName}`}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--dim)]"
          >
            <PencilIcon />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirmClear) clearChat.mutate();
            else setConfirmClear(true);
          }}
          aria-label={confirmClear ? "Tap again to delete this chat" : "Delete this chat"}
          className={`flex h-10 w-10 items-center justify-center rounded-full ${confirmClear ? "text-[var(--accent)]" : "text-[var(--dim)]"}`}
        >
          <TrashIcon />
        </button>
      </header>
      {confirmClear && (
        <p className="shrink-0 bg-[var(--surface)] px-4 py-2 text-center text-xs text-[var(--accent)]">
          Tap the trash icon again to delete this whole chat.
        </p>
      )}
      <button
        type="button"
        onClick={() => setTimerSheetOpen(true)}
        aria-label="Change disappearing message timer for this chat"
        className="flex shrink-0 items-center justify-center gap-1.5 border-b border-[var(--border)] bg-[var(--bg)] px-4 py-1.5 text-center text-[11px] font-medium text-[var(--dim)]"
      >
        <TimerIcon />
        {disappearingSeconds == null
          ? "Disappearing messages are off in this chat — tap to turn them on"
          : `Disappearing messages on — new messages vanish after ${disappearingLabel(disappearingSeconds)} unless you save them`}
      </button>
      {(callPhase === "ringing" || callPhase === "connected") && !callOpen && (
        <button
          type="button"
          onClick={() => setCallOpen(true)}
          aria-label={`Return to call with ${displayName}`}
          className="flex shrink-0 items-center justify-center gap-2 bg-[#14532d] px-4 py-2 text-center text-sm font-semibold text-white"
        >
          <PhoneIcon /> {callPhase === "ringing" ? `Calling ${isGroup ? displayName : firstName}…` : `On a call with ${isGroup ? displayName : firstName} · ${fmtCallTime(callSeconds)}`} — tap to return
        </button>
      )}

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {messages.isPending && <p className="text-center text-sm text-[var(--dim)]">Loading messages…</p>}
        {messages.isError && (
          <p className="text-center text-sm text-[var(--accent)]">Messages couldn't load. Pull back and try again.</p>
        )}
        {messages.data && messages.data.messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-xs text-center">
            {isGroup ? (
              <div className="flex justify-center -space-x-3" aria-hidden="true">
                {members.slice(0, 3).map((m) => (
                  <Avatar key={m.id} name={m.name} color={m.color} size={56} />
                ))}
              </div>
            ) : (
              contact && <Avatar name={contact.name} color={contact.color} size={64} />
            )}
            <p className="mt-3 font-display font-bold">{displayName}</p>
            <p className="mt-1 text-sm text-[var(--dim)]">
              Say hi, tap the music note below to send the first song, or the camera to send a snap.
              {disappearingSeconds != null &&
                ` Messages here disappear after ${disappearingLabel(disappearingSeconds)} — tap Save on any message to keep it.`}
            </p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {messages.data?.messages.map((m) => {
            const mine = m.sender === "me";
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                {m.type === "track" && m.track ? (
                  <TrackMessageCard msg={m} mine={mine} />
                ) : m.type === "snap" && m.snap ? (
                  <SnapMessageCard msg={m} mine={mine} />
                ) : (
                  <div
                    className={`max-w-[80%] whitespace-pre-wrap break-words rounded-3xl px-4 py-2.5 text-base ${
                      mine
                        ? "rounded-br-lg bg-[var(--accent)] text-white"
                        : "rounded-bl-lg bg-[var(--surface)] border border-[var(--border)]"
                    }`}
                  >
                    {m.text != null && <DecryptedText value={m.text} />}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 pt-1">
                  <span className="text-[11px] text-[var(--dim)]">
                    {mine ? myName : isGroup ? memberName(m.senderContactId) : firstName} · {fmtTime(m.createdAt)}
                  </span>
                  {m.kept ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--amber)]">
                      <BookmarkIcon filled /> Saved — won't disappear
                    </span>
                  ) : m.expiresAt ? (
                    <span className="flex items-center gap-1 text-[11px] text-[var(--dim)]">
                      <TimerIcon /> Disappears {fmtRemaining(m.expiresAt, nowMs)}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => keepMessage.mutate({ messageId: m.id, kept: !m.kept })}
                    disabled={keepMessage.isPending}
                    aria-pressed={m.kept}
                    aria-label={
                      m.kept
                        ? `Unsave the message sent at ${fmtTime(m.createdAt)} so it can disappear again`
                        : `Save the message sent at ${fmtTime(m.createdAt)} so it doesn't disappear`
                    }
                    className={`flex min-h-8 items-center gap-1 rounded-full px-2 text-[11px] font-semibold disabled:opacity-50 ${
                      m.kept ? "text-[var(--amber)]" : "text-[var(--dim)]"
                    }`}
                  >
                    <BookmarkIcon filled={m.kept} /> {m.kept ? "Saved" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmDeleteMsgId === m.id) deleteMessageNow.mutate(m.id);
                      else setConfirmDeleteMsgId(m.id);
                    }}
                    disabled={deleteMessageNow.isPending}
                    aria-label={
                      confirmDeleteMsgId === m.id
                        ? `Tap again to delete the message sent at ${fmtTime(m.createdAt)} right now`
                        : `Delete the message sent at ${fmtTime(m.createdAt)} right now`
                    }
                    className={`flex min-h-8 items-center rounded-full px-2 text-[11px] font-semibold disabled:opacity-50 ${
                      confirmDeleteMsgId === m.id ? "text-[var(--accent)]" : "text-[var(--dim)]"
                    }`}
                  >
                    {confirmDeleteMsgId === m.id ? "Tap again to delete" : "Delete now"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <MiniPlayer />

      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-3 pb-safe pt-2">
        <div className="mb-2 flex flex-wrap items-center gap-2" role="group" aria-label="Send as">
          <span className="text-xs text-[var(--dim)]">Send as:</span>
          {isGroup ? (
            <>
              <button
                type="button"
                onClick={() => setAsMemberId(null)}
                aria-pressed={asMemberId == null}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${asMemberId == null ? "bg-[var(--accent)] text-white" : "bg-[var(--raised)]"}`}
              >
                Me
              </button>
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setAsMemberId(m.id)}
                  aria-pressed={asMemberId === m.id}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${asMemberId === m.id ? "bg-[var(--accent)] text-white" : "bg-[var(--raised)]"}`}
                >
                  {m.name.split(/\s+/)[0]}
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSender("me")}
                aria-pressed={sender === "me"}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${sender === "me" ? "bg-[var(--accent)] text-white" : "bg-[var(--raised)]"}`}
              >
                Me
              </button>
              <button
                type="button"
                onClick={() => setSender("them")}
                aria-pressed={sender === "them"}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${sender === "them" ? "bg-[var(--accent)] text-white" : "bg-[var(--raised)]"}`}
              >
                {firstName}
              </button>
            </>
          )}
          <span className="text-[11px] text-[var(--dim)]">(handy while testing)</span>
        </div>
        {error && <p className="mb-2 text-sm text-[var(--accent)]" role="alert">{error}</p>}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) {
              setError("Type a message first — or share a song with the music note, or a snap with the camera.");
              return;
            }
            if (draft.trim().length > 2000) {
              setError("Messages are capped at 2,000 characters — trim it a little and send again.");
              return;
            }
            setError(null);
            sendText.mutate();
          }}
        >
          <button
            type="button"
            onClick={() => setSnapOpen(true)}
            aria-label="Take a photo or video snap"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--raised)] text-[var(--accent)]"
          >
            <CameraIcon />
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label="Share a song in this chat"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--raised)] text-[var(--accent)]"
          >
            <MusicIcon />
          </button>
          <input
            {...FIELDS.sendTextMessage.text}
            aria-label="Message text"
            className="min-h-11 flex-1 rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-base outline-none focus:border-[var(--accent)]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={isGroup ? `Message ${displayName}…` : `Message ${firstName}…`}
          />
          <button
            type="submit"
            disabled={sendText.isPending}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white disabled:opacity-50"
          >
            <SendIcon />
          </button>
        </form>
      </div>

      {timerSheetOpen && (
        <DisappearingSheet
          conversationId={conversationId}
          currentSeconds={disappearingSeconds}
          chatName={displayName}
          onClose={() => setTimerSheetOpen(false)}
          onSaved={invalidateThread}
        />
      )}
      {pickerOpen && (
        <SongPicker
          onClose={() => setPickerOpen(false)}
          onPick={(t) => sendTrack.mutate(t)}
        />
      )}
      {snapOpen && (
        <CameraSheet
          conversationId={conversationId}
          contactName={isGroup ? displayName : firstName}
          sender={effSender}
          senderContactId={effSenderContactId}
          onClose={() => setSnapOpen(false)}
          onSent={invalidateThread}
        />
      )}
      {callPickerOpen && (
        <SongPicker
          title="Play over the call"
          onClose={() => setCallPickerOpen(false)}
          onPick={playOverCall}
        />
      )}
      {callOpen && callPhase !== "idle" && (
        <CallOverlay
          contact={callContact}
          members={isGroup ? members : undefined}
          phase={callPhase}
          seconds={callSeconds}
          muted={callMuted}
          speaker={callSpeaker}
          callTrack={callTrack}
          onToggleMute={() => setCallMuted((v) => !v)}
          onToggleSpeaker={() => setCallSpeaker((v) => !v)}
          onEnd={endCall}
          onMinimize={() => setCallOpen(false)}
          onPlayMusic={() => setCallPickerOpen(true)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function GroupSheet({
  contacts,
  onClose,
  onOpenGroup,
}: {
  contacts: Contact[];
  onClose: () => void;
  onOpenGroup: (group: { title: string; members: ThreadContact[] }, conversationId: number) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const members = contacts
        .filter((c) => selected.includes(c.id))
        .map((c) => ({ id: c.id, name: c.name, handle: c.handle, color: c.color }));
      const { conversationId } = await api.createGroupConversation({
        title: name.trim() || undefined,
        contactIds: selected,
      });
      return { members, conversationId };
    },
    onSuccess: ({ members, conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      onOpenGroup(
        {
          title:
            name.trim() ||
            members.map((m) => m.name.split(/\s+/)[0]).slice(0, 3).join(", ") +
              (members.length > 3 ? ` +${members.length - 3}` : ""),
          members,
        },
        conversationId,
      );
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "That group didn't start. Try again."),
  });

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Sheet title="New group chat" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="group-name" className={labelCls}>Group name (optional)</label>
          <input
            {...FIELDS.createGroupConversation.title}
            id="group-name"
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Weekend crew"
          />
        </div>
        <div>
          <p className={labelCls}>Who's in? Pick at least two people.</p>
          <ul className="flex flex-col gap-2">
            {contacts.map((c) => {
              const on = selected.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    aria-pressed={on}
                    aria-label={`${on ? "Remove" : "Add"} ${c.name} ${on ? "from" : "to"} the group`}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${on ? "bg-[var(--accent)] text-white" : "bg-[var(--bg)]"}`}
                  >
                    <Avatar name={c.name} color={c.color} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.name}</span>
                      {c.handle && (
                        <span className={`block truncate text-xs ${on ? "text-white/75" : "text-[var(--dim)]"}`}>{c.handle}</span>
                      )}
                    </span>
                    <span className="text-sm font-bold" aria-hidden="true">{on ? "In" : "Add"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        {error && <p className="text-sm text-[var(--accent)]" role="alert">{error}</p>}
        <button
          type="button"
          disabled={selected.length < 2 || create.isPending}
          onClick={() => {
            if (selected.length < 2) {
              setError("Pick at least two people for a group chat.");
              return;
            }
            setError(null);
            create.mutate();
          }}
          className="rounded-full bg-[var(--accent)] px-5 py-3 font-display font-bold text-white disabled:opacity-50"
        >
          {create.isPending ? "Starting group…" : `Start group chat${selected.length > 0 ? ` (${selected.length} people)` : ""}`}
        </button>
      </div>
    </Sheet>
  );
}

function ChatsTab({
  onOpenThread,
  onOpenGroupThread,
  onAddContact,
  onOpenCamera,
}: {
  onOpenThread: (tc: ThreadContact, conversationId: number) => void;
  onOpenGroupThread: (group: { title: string; members: ThreadContact[] }, conversationId: number) => void;
  onAddContact: () => void;
  onOpenCamera: () => void;
}) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: () => api.listContacts({}) });
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.listConversations({}),
  });

  const openWithContact = useMutation({
    mutationFn: async (c: ThreadContact) => {
      const { conversationId } = await api.getOrCreateConversation({ contactId: c.id });
      return { c, conversationId };
    },
    onSuccess: ({ c, conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onOpenThread(c, conversationId);
    },
    onError: () => undefined,
  });

  const f = filter.trim().toLowerCase();
  const shownContacts = (contacts.data?.contacts ?? []).filter(
    (c) => !f || c.name.toLowerCase().includes(f),
  );
  const shownConvs = (conversations.data?.conversations ?? []).filter((c) => {
    if (!f) return true;
    if (c.kind === "group") {
      return (
        (c.title ?? "").toLowerCase().includes(f) ||
        c.members.some((m) => m.name.toLowerCase().includes(f))
      );
    }
    return (c.contact?.name ?? "").toLowerCase().includes(f);
  });
  const hasContacts = (contacts.data?.contacts.length ?? 0) > 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-6">
      <div className="flex items-center justify-between pb-3 pt-4">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Chats</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setGroupSheetOpen(true)}
            disabled={!hasContacts}
            aria-label="Start a group chat"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)] disabled:opacity-40"
          >
            <UsersIcon />
          </button>
          <button
            type="button"
            onClick={onAddContact}
            aria-label="Add contact"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-white"
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenCamera}
        aria-label="Open the camera — take a photo or video, no contact needed"
        className="mb-4 flex w-full items-center gap-3 rounded-3xl bg-[var(--accent)] px-4 py-3.5 text-left text-white"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20" aria-hidden="true">
          <CameraIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-bold">Take a photo or video</span>
          <span className="block text-xs leading-snug opacity-90">
            Snap it, edit it — filter, crop, text, trim — then send it or keep it. No contact needed.
          </span>
        </span>
        <span className="shrink-0 opacity-90" aria-hidden="true">
          <VideoIcon />
        </span>
      </button>

      <div className="relative mb-4">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dim)]">
          <SearchIcon />
        </span>
        <input
          aria-label="Search chats and contacts"
          className={`${inputCls} pl-10`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search chats & contacts"
        />
      </div>

      {contacts.isPending && <p className="py-6 text-sm text-[var(--dim)]">Loading…</p>}

      {contacts.data && !hasContacts && (
        <div className="rounded-3xl bg-[var(--surface)] p-6 text-center">
          <p className="font-display text-lg font-bold">Nobody here yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-[var(--dim)]">
            Add your first contact and you can chat, swap texts, and send each other songs that actually play.
            Or tap the Camera button above — photos and videos don't need a contact; take one, edit it, and
            keep it on this device.
          </p>
          <button
            type="button"
            onClick={onAddContact}
            className="mt-4 rounded-full bg-[var(--accent)] px-6 py-3 font-display font-bold text-white"
          >
            Add a contact
          </button>
        </div>
      )}

      {hasContacts && (
        <>
          <div className="mb-5 flex gap-4 overflow-x-auto pb-1" aria-label="Contacts">
            {shownContacts.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => openWithContact.mutate({ id: c.id, name: c.name, handle: c.handle, color: c.color })}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5"
                aria-label={`Chat with ${c.name}`}
              >
                <Avatar name={c.name} color={c.color} size={52} />
                <span className="w-full truncate text-center text-xs font-medium">{c.name.split(/\s+/)[0]}</span>
              </button>
            ))}
            {shownContacts.length === 0 && (
              <p className="text-sm text-[var(--dim)]">No contacts match “{filter}”.</p>
            )}
          </div>

          <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-[var(--dim)]">
            Recent chats
          </h2>
          {conversations.isPending && <p className="py-3 text-sm text-[var(--dim)]">Loading chats…</p>}
          {conversations.data && shownConvs.length === 0 && (
            <p className="rounded-2xl bg-[var(--surface)] px-4 py-5 text-sm text-[var(--dim)]">
              {f
                ? `No chats match “${filter}”.`
                : "No chats yet — tap a contact above to start one."}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {shownConvs.map((c) => {
              const isGroup = c.kind === "group";
              const title = isGroup
                ? (c.title ?? c.members.map((m) => m.name.split(/\s+/)[0]).join(", "))
                : (c.contact?.name ?? "Chat");
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (isGroup) {
                        onOpenGroupThread({ title, members: c.members }, c.id);
                      } else if (c.contact) {
                        onOpenThread(c.contact, c.id);
                      }
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl bg-[var(--surface)] px-3 py-3 text-left"
                    aria-label={isGroup ? `Open group chat ${title}` : `Open chat with ${title}`}
                  >
                    {isGroup ? (
                      <span
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: c.members[0]?.color ?? "#FF4D2E" }}
                        aria-hidden="true"
                      >
                        <UsersIcon />
                      </span>
                    ) : (
                      c.contact && <Avatar name={c.contact.name} color={c.contact.color} size={48} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-display font-bold">{title}</span>
                        {c.lastMessage && (
                          <span className="shrink-0 text-[11px] text-[var(--dim)]">
                            {fmtTime(c.lastMessage.createdAt)}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-sm text-[var(--dim)]">
                        {isGroup && <span className="font-medium">Group · {c.members.length + 1} people · </span>}
                        {c.lastMessage ? (
                          <>
                            {c.lastMessage.sender === "me" ? "You: " : ""}
                            <DecryptedText value={c.lastMessage.preview} />
                          </>
                        ) : (
                          "No messages yet — say hi"
                        )}
                      </span>
                      {c.disappearingSeconds != null && (
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-[var(--dim)]">
                          <TimerIcon /> Disappears after {disappearingLabel(c.disappearingSeconds)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {groupSheetOpen && (
        <GroupSheet
          contacts={contacts.data?.contacts ?? []}
          onClose={() => setGroupSheetOpen(false)}
          onOpenGroup={onOpenGroupThread}
        />
      )}
    </div>
  );
}

const GENRES = ["Pop", "Hip-Hop", "R&B", "Country", "Rock", "Latin", "Dance", "Jazz", "Alternative", "K-Pop"];

function PlaylistSheet({ track, onClose }: { track: Track; onClose: () => void }) {
  const queryClient = useQueryClient();
  const playlists = useQuery({ queryKey: ["playlists"], queryFn: () => api.listPlaylists({}) });
  const [newName, setNewName] = useState("");
  const [addedTo, setAddedTo] = useState<number | null>(null);
  const [alreadyIn, setAlreadyIn] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["playlists"] });

  const add = useMutation({
    mutationFn: async (playlistId: number) =>
      await api.addTrackToPlaylist({ playlistId, track: toTrackIn(track) }),
    onSuccess: (res, playlistId) => {
      invalidate();
      if (res.added) {
        setAddedTo(playlistId);
        setAlreadyIn(null);
      } else {
        setAlreadyIn(playlistId);
        setAddedTo(null);
      }
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't add that song. Try again."),
  });

  const create = useMutation({
    mutationFn: async () => await api.createPlaylist({ name: newName.trim() }),
    onSuccess: (res) => {
      setNewName("");
      invalidate();
      add.mutate(res.id);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't create that playlist."),
  });

  return (
    <Sheet title="Add to playlist" onClose={onClose}>
      <div className="mb-4 flex items-center gap-3">
        <Artwork track={track} size={44} />
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold">{track.title}</p>
          <p className="truncate text-xs text-[var(--dim)]">{track.artist}</p>
        </div>
      </div>
      {playlists.isPending && <p className="py-3 text-sm text-[var(--dim)]">Loading playlists…</p>}
      {playlists.data && playlists.data.playlists.length === 0 && (
        <p className="py-2 text-sm text-[var(--dim)]">No playlists yet — make your first one below.</p>
      )}
      <ul className="mb-4 flex flex-col gap-2">
        {playlists.data?.playlists.map((p) => {
          const contains = p.tracks.some((t) => t.trackId === track.trackId);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => add.mutate(p.id)}
                disabled={add.isPending}
                aria-label={`Add ${track.title} to playlist ${p.name}`}
                className="flex w-full items-center gap-3 rounded-2xl bg-[var(--bg)] px-3 py-2.5 text-left disabled:opacity-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--raised)] text-[var(--accent)]">
                  <PlaylistIcon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className="block text-xs text-[var(--dim)]">
                    {p.tracks.length} {p.tracks.length === 1 ? "song" : "songs"}
                  </span>
                </span>
                {addedTo === p.id ? (
                  <span className="shrink-0 text-sm font-bold text-[var(--amber)]">Added</span>
                ) : alreadyIn === p.id || contains ? (
                  <span className="shrink-0 text-xs font-medium text-[var(--dim)]">In playlist</span>
                ) : (
                  <span className="shrink-0 text-[var(--accent)]"><PlusIcon /></span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) {
            setError("Give the new playlist a name first.");
            return;
          }
          setError(null);
          create.mutate();
        }}
      >
        <input
          {...FIELDS.createPlaylist.name}
          aria-label="New playlist name"
          className={`${inputCls} flex-1`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New playlist name…"
        />
        <button
          type="submit"
          disabled={create.isPending}
          className="shrink-0 rounded-xl bg-[var(--accent)] px-4 font-display text-sm font-bold text-white disabled:opacity-50"
        >
          Create + add
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-[var(--accent)]" role="alert">{error}</p>}
    </Sheet>
  );
}

function PlaylistsSection({ onShare, onPlaylist }: { onShare: (t: Track) => void; onPlaylist: (t: Track) => void }) {
  const queryClient = useQueryClient();
  const { savedIds, toggleSave } = useLibrary();
  const playlists = useQuery({ queryKey: ["playlists"], queryFn: () => api.listPlaylists({}) });
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => api.getProfile({}) });
  const plusActive = profileQ.data?.plus.active ?? false;
  const playlistCount = playlists.data?.playlists.length ?? 0;
  const atFreeCap = !plusActive && playlistCount >= FREE_PLAYLIST_LIMIT;
  const [plusSheetOpen, setPlusSheetOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["playlists"] });

  const create = useMutation({
    mutationFn: async () => await api.createPlaylist({ name: newName.trim() }),
    onSuccess: () => {
      setNewName("");
      invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't create that playlist."),
  });
  const rename = useMutation({
    mutationFn: async (p: Playlist) => await api.renamePlaylist({ id: p.id, name: renameDraft.trim() }),
    onSuccess: () => {
      setRenamingId(null);
      invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't rename that playlist."),
  });
  const remove = useMutation({
    mutationFn: async (id: number) => await api.deletePlaylist({ id }),
    onSuccess: () => {
      setConfirmDeleteId(null);
      invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't delete that playlist."),
  });
  const removeTrack = useMutation({
    mutationFn: async (v: { playlistId: number; trackId: number }) =>
      await api.removeTrackFromPlaylist(v),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't remove that song."),
  });

  return (
    <div className="mb-6">
      <h2 className="mb-2 font-display text-lg font-bold">Playlists</h2>
      {!plusActive && (
        <p className="mb-2 text-xs text-[var(--dim)]">
          {playlistCount} of {FREE_PLAYLIST_LIMIT} free playlists.{" "}
          <button type="button" onClick={() => setPlusSheetOpen(true)} className="font-bold text-[var(--accent)]">
            Plus makes them unlimited.
          </button>
        </p>
      )}
      {plusSheetOpen && <PlusSheet onClose={() => setPlusSheetOpen(false)} />}
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (atFreeCap) {
            setPlusSheetOpen(true);
            return;
          }
          if (!newName.trim()) {
            setError("Give the playlist a name first.");
            return;
          }
          setError(null);
          create.mutate();
        }}
      >
        <input
          {...FIELDS.createPlaylist.name}
          aria-label="New playlist name"
          className={`${inputCls} flex-1`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New playlist — e.g. Driving"
        />
        <button
          type="submit"
          disabled={create.isPending}
          className="shrink-0 rounded-xl bg-[var(--accent)] px-4 font-display text-sm font-bold text-white disabled:opacity-50"
        >
          Create
        </button>
      </form>
      {error && <p className="mb-2 text-sm text-[var(--accent)]" role="alert">{error}</p>}
      {playlists.isPending && <p className="py-2 text-sm text-[var(--dim)]">Loading playlists…</p>}
      {playlists.data && playlists.data.playlists.length === 0 && (
        <p className="rounded-2xl bg-[var(--surface)] px-4 py-4 text-sm text-[var(--dim)]">
          No playlists yet. Create one here, or tap the list icon on any song to start one from that song.
        </p>
      )}
      <div className="flex flex-col gap-2">
        {playlists.data?.playlists.map((p) => {
          const expanded = expandedId === p.id;
          return (
            <div key={p.id} className="rounded-2xl bg-[var(--surface)] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : p.id)}
                  aria-expanded={expanded}
                  aria-label={expanded ? `Collapse playlist ${p.name}` : `Expand playlist ${p.name}`}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--raised)] text-[var(--accent)]">
                    <PlaylistIcon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-sm font-bold">{p.name}</span>
                    <span className="block text-xs text-[var(--dim)]">
                      {p.tracks.length} {p.tracks.length === 1 ? "song" : "songs"}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenamingId(renamingId === p.id ? null : p.id);
                    setRenameDraft(p.name);
                  }}
                  aria-label={`Rename playlist ${p.name}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--dim)]"
                >
                  <PencilIcon />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmDeleteId === p.id) remove.mutate(p.id);
                    else setConfirmDeleteId(p.id);
                  }}
                  aria-label={confirmDeleteId === p.id ? `Tap again to delete playlist ${p.name}` : `Delete playlist ${p.name}`}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${confirmDeleteId === p.id ? "text-[var(--accent)]" : "text-[var(--dim)]"}`}
                >
                  <TrashIcon />
                </button>
              </div>
              {confirmDeleteId === p.id && (
                <p className="pt-1 text-center text-xs text-[var(--accent)]">
                  Tap the trash again to delete “{p.name}” — the songs stay in your library.
                </p>
              )}
              {renamingId === p.id && (
                <form
                  className="flex gap-2 pt-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!renameDraft.trim()) {
                      setError("The playlist name can't be empty.");
                      return;
                    }
                    setError(null);
                    rename.mutate(p);
                  }}
                >
                  <input
                    {...FIELDS.renamePlaylist.name}
                    aria-label={`New name for playlist ${p.name}`}
                    className={`${inputCls} flex-1`}
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={rename.isPending}
                    className="shrink-0 rounded-xl bg-[var(--accent)] px-4 font-display text-sm font-bold text-white disabled:opacity-50"
                  >
                    Save name
                  </button>
                </form>
              )}
              {expanded && (
                <div className="flex flex-col gap-2 pt-2">
                  {p.tracks.length === 0 && (
                    <p className="px-1 py-2 text-sm text-[var(--dim)]">
                      Nothing in here yet — tap the list icon on any song to add it.
                    </p>
                  )}
                  {p.tracks.map((t) => (
                    <div key={t.trackId}>
                      <TrackRow track={t} savedIds={savedIds} onToggleSave={(x) => toggleSave.mutate(x)} onShare={onShare} onPlaylist={onPlaylist} />
                      <div className="flex justify-end pr-1 pt-0.5">
                        <button
                          type="button"
                          onClick={() => removeTrack.mutate({ playlistId: p.id, trackId: t.trackId })}
                          aria-label={`Remove ${t.title} from playlist ${p.name}`}
                          className="rounded-full px-2 py-0.5 text-[11px] font-medium text-[var(--dim)] underline underline-offset-2"
                        >
                          Remove from {p.name}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MusicTab({ onShare, onPlaylist }: { onShare: (t: Track) => void; onPlaylist: (t: Track) => void }) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const top = useQuery({ queryKey: ["top"], queryFn: () => api.getTopTracks({}) });
  const search = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => api.searchTracks({ query: submitted, limit: 30 }),
    enabled: submitted.length > 0,
  });
  const { savedIds, toggleSave } = useLibrary();

  const runSearch = (q: string) => {
    setQuery(q);
    setSubmitted(q.trim());
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-6">
      <h1 className="pb-3 pt-4 font-display text-3xl font-extrabold tracking-tight">Music</h1>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dim)]">
            <SearchIcon />
          </span>
          <input
            {...FIELDS.searchTracks.query}
            aria-label="Search songs and artists"
            className={`${inputCls} pl-10`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value.trim()) setSubmitted("");
            }}
            placeholder="Songs, artists, albums…"
          />
        </div>
        <button type="submit" className="rounded-xl bg-[var(--accent)] px-4 font-display font-bold text-white">
          Search
        </button>
      </form>

      <div className="mb-5 flex flex-wrap gap-2" aria-label="Browse by genre">
        {GENRES.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => runSearch(g)}
            aria-pressed={submitted === g}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              submitted === g ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] border border-[var(--border)]"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {!submitted && (
        <>
          <h2 className="mb-2 font-display text-lg font-bold">Top Songs — US</h2>
          {top.isPending && <p className="py-4 text-sm text-[var(--dim)]">Loading the chart…</p>}
          {top.isError && (
            <div className="rounded-2xl bg-[var(--surface)] p-4">
              <p className="text-sm text-[var(--dim)]">The chart couldn't load right now.</p>
              <button
                type="button"
                onClick={() => void top.refetch()}
                className="mt-2 rounded-full bg-[var(--accent)] px-4 py-2 font-display text-sm font-bold text-white"
              >
                Retry
              </button>
            </div>
          )}
          {top.data && top.data.tracks.length === 0 && (
            <p className="py-4 text-sm text-[var(--dim)]">No chart songs came back. Try a search above.</p>
          )}
          <div className="flex flex-col gap-2">
            {top.data?.tracks.map((t, i) => (
              <TrackRow key={t.trackId} track={t} rank={i + 1} savedIds={savedIds} onToggleSave={(x) => toggleSave.mutate(x)} onShare={onShare} onPlaylist={onPlaylist} />
            ))}
          </div>
        </>
      )}

      {submitted && (
        <>
          <h2 className="mb-2 font-display text-lg font-bold">Results for “{submitted}”</h2>
          {search.isPending && <p className="py-4 text-sm text-[var(--dim)]">Searching…</p>}
          {search.isError && (
            <div className="rounded-2xl bg-[var(--surface)] p-4">
              <p className="text-sm text-[var(--dim)]">Search couldn't reach the catalog.</p>
              <button
                type="button"
                onClick={() => void search.refetch()}
                className="mt-2 rounded-full bg-[var(--accent)] px-4 py-2 font-display text-sm font-bold text-white"
              >
                Retry
              </button>
            </div>
          )}
          {search.data && search.data.tracks.length === 0 && (
            <p className="py-4 text-sm text-[var(--dim)]">Nothing found for “{submitted}”. Try a different spelling or artist.</p>
          )}
          <div className="flex flex-col gap-2">
            {search.data?.tracks.map((t) => (
              <TrackRow key={t.trackId} track={t} savedIds={savedIds} onToggleSave={(x) => toggleSave.mutate(x)} onShare={onShare} onPlaylist={onPlaylist} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LibraryTab({
  onShare,
  onPlaylist,
  goMusic,
}: {
  onShare: (t: Track) => void;
  onPlaylist: (t: Track) => void;
  goMusic: () => void;
}) {
  const queryClient = useQueryClient();
  const { library, savedIds, toggleSave } = useLibrary();
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [plusSheetOpen, setPlusSheetOpen] = useState(false);
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => api.getProfile({}) });
  const plusActive = profileQ.data?.plus.active ?? false;
  const offlineCount = library.data
    ? new Set([...library.data.saved, ...library.data.recent].filter((t) => t.offline).map((t) => t.trackId)).size
    : 0;

  const toggleOffline = useMutation({
    mutationFn: async (t: LibTrack) =>
      t.offline
        ? await api.removeTrackOffline({ trackId: t.trackId })
        : await api.makeTrackOffline({ track: toTrackIn(t) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
    onError: (e) => setOfflineError(e instanceof Error ? e.message : "That download didn't work. Try again."),
  });

  const offlineProps = (t: LibTrack) => ({
    offlineUrl: t.offlineUrl,
    isOffline: t.offline,
    onToggleOffline: (x: Track) => {
      setOfflineError(null);
      if (!t.offline && !plusActive && offlineCount >= FREE_OFFLINE_LIMIT) {
        setPlusSheetOpen(true);
        return;
      }
      toggleOffline.mutate(x as LibTrack);
    },
    offlinePending: toggleOffline.isPending && toggleOffline.variables?.trackId === t.trackId,
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-6">
      <h1 className="pb-1 pt-4 font-display text-3xl font-extrabold tracking-tight">Library</h1>
      <p className="pb-3 text-sm text-[var(--dim)]">
        The download arrow saves a song's 30-second preview into SoundChat, so it plays offline — from the app's own
        storage instead of Apple's servers. Full songs aren't downloadable; Apple only offers the previews.
      </p>
      {!plusActive && library.data && (
        <p className="pb-3 text-xs text-[var(--dim)]">
          Offline downloads: {offlineCount} of {FREE_OFFLINE_LIMIT} on the free plan.{" "}
          <button type="button" onClick={() => setPlusSheetOpen(true)} className="font-bold text-[var(--accent)]">
            Plus makes them unlimited.
          </button>
        </p>
      )}
      {plusSheetOpen && <PlusSheet onClose={() => setPlusSheetOpen(false)} />}
      {offlineError && <p className="mb-3 text-sm text-[var(--accent)]" role="alert">{offlineError}</p>}
      {library.isPending && <p className="py-4 text-sm text-[var(--dim)]">Loading your library…</p>}
      {library.isError && (
        <p className="py-4 text-sm text-[var(--accent)]">Your library couldn't load. Try again in a moment.</p>
      )}
      {library.data && (
        <>
          <PlaylistsSection onShare={onShare} onPlaylist={onPlaylist} />
          {library.data.recent.length > 0 && (
            <>
              <h2 className="mb-2 font-display text-lg font-bold">Recently played</h2>
              <div className="mb-6 flex flex-col gap-2">
                {library.data.recent.map((t) => (
                  <div key={t.trackId} className="relative">
                    <TrackRow track={t} savedIds={savedIds} onToggleSave={(x) => toggleSave.mutate(x)} onShare={onShare} onPlaylist={onPlaylist} {...offlineProps(t)} />
                    {t.playCount > 0 && (
                      <span className="pointer-events-none absolute right-3 top-2 text-[11px] font-medium text-[var(--dim)]">
                        {t.playCount} {t.playCount === 1 ? "play" : "plays"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          <h2 className="mb-2 font-display text-lg font-bold">Saved songs</h2>
          {library.data.saved.length === 0 ? (
            <div className="rounded-3xl bg-[var(--surface)] p-6 text-center">
              <p className="font-display text-lg font-bold">No saved songs yet</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-[var(--dim)]">
                Tap the heart on any song and it lands here, ready to play or share.
              </p>
              <button
                type="button"
                onClick={goMusic}
                className="mt-4 rounded-full bg-[var(--accent)] px-6 py-3 font-display font-bold text-white"
              >
                Find songs
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {library.data.saved.map((t) => (
                <TrackRow key={t.trackId} track={t} savedIds={savedIds} onToggleSave={(x) => toggleSave.mutate(x)} onShare={onShare} onPlaylist={onPlaylist} {...offlineProps(t)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BackgroundPicker({
  current,
  onPick,
  pending,
  plusActive,
  onPlusPick,
}: {
  current: string;
  onPick: (id: BackgroundId) => void;
  pending: boolean;
  plusActive: boolean;
  onPlusPick: () => void;
}) {
  const categories = [...new Set(BACKGROUNDS.map((b) => b.category))];
  return (
    <div className="mb-6">
      <h2 className="mb-1 font-display text-lg font-bold">Background</h2>
      <p className="mb-3 text-sm text-[var(--dim)]">Pick a look — it shows behind your chats, music, and library. Tap one to apply it right away. The ones marked PLUS are SoundChat Plus exclusives.</p>
      {categories.map((cat) => (
        <div key={cat} className="mb-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--dim)]">{cat}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BACKGROUNDS.filter((b) => b.category === cat).map((b) => {
              const active = current === b.id;
              const locked = PLUS_BACKGROUND_IDS.includes(b.id) && !plusActive;
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={pending}
                  onClick={() => (locked ? onPlusPick() : onPick(b.id))}
                  aria-label={locked ? `${b.name} background — SoundChat Plus exclusive` : `Use ${b.name} background`}
                  aria-pressed={active}
                  className={`group overflow-hidden rounded-2xl border-2 text-left disabled:opacity-60 ${active ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
                >
                  <span className="relative block h-24 w-full overflow-hidden">
                    {b.image ? (
                      <img src={b.image} alt="" className="h-full w-full object-cover" style={{ objectPosition: b.position ?? "center", filter: b.filter }} loading="lazy" />
                    ) : b.gradientClass ? (
                      <span className={`block h-full w-full ${b.gradientClass}`} style={{ background: b.swatch }} aria-hidden="true" />
                    ) : (
                      <span className="block h-full w-full" style={{ background: b.swatch }} aria-hidden="true" />
                    )}
                    {active && <span className="absolute right-2 top-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-white">On</span>}
                    {locked && (
                      <span className="absolute left-2 top-2 rounded-full bg-[var(--amber)] px-2 py-0.5 text-[11px] font-extrabold text-black">
                        PLUS
                      </span>
                    )}
                  </span>
                  <span className="block bg-[var(--surface)] px-3 py-2 text-sm font-semibold">{b.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const TERMUX_COMMANDS = `pkg update && pkg install -y git gh unzip
termux-setup-storage
cd ~/storage/downloads
unzip soundchat-v2-source.zip
cd soundchat-v2
git init && git add . && git commit -m "SoundChat v2 source"
gh auth login
gh repo create soundchat-platform --private --source=. --remote=origin --push`;

type ExportInfo = ApiResponse<typeof api, "exportSoundchatSource">;

function GitHubExportCard() {
  const [info, setInfo] = useState<ExportInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const build = useMutation({
    mutationFn: async () => await api.exportSoundchatSource({}),
    onSuccess: (data) => {
      setInfo(data);
      setError(null);
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "The export could not be built. Try again in a moment."),
  });

  const saveZip = async () => {
    if (!info) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.getSoundchatExportDownload({ blobKey: info.blobKey });
      if (res.dataBase64) {
        const binary = atob(res.dataBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/zip" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.fileName || info.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      } else if (res.downloadUrl) {
        const a = document.createElement("a");
        a.href = res.downloadUrl;
        a.download = res.fileName || info.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        setError("The download link was empty. Build the zip again and try once more.");
      }
    } catch {
      // Fallback: the direct download URL from the build step.
      const a = document.createElement("a");
      a.href = info.downloadUrl;
      a.download = info.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setSaving(false);
    }
  };

  const copyCommands = async () => {
    try {
      await navigator.clipboard.writeText(TERMUX_COMMANDS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy did not work on this device — the commands are shown below to copy by hand.");
    }
  };

  return (
    <div className="mb-6 rounded-3xl bg-[var(--surface)] p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[var(--accent)]"><PackageIcon /></span>
        <h2 className="font-display text-lg font-bold">Save SoundChat to GitHub</h2>
      </div>
      <p className="mb-3 text-sm text-[var(--dim)]">
        Package the full SoundChat v2 source — app code, backgrounds, database schema — as one zip,
        ready to unzip in Termux and push to your Brooklyn420 repo so the code is never lost again.
        The zip holds source only: no chats, contacts, or private app data.
      </p>

      {!info ? (
        <button
          type="button"
          disabled={build.isPending}
          onClick={() => build.mutate()}
          aria-label="Download SoundChat source zip for GitHub"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 font-display font-bold text-white disabled:opacity-50"
        >
          <DownloadIcon />
          {build.isPending ? "Preparing your zip…" : "Download for GitHub"}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium" role="status">
            Ready: <span className="font-display font-bold">{info.fileName}</span> · {fmtBytes(info.sizeBytes)} · {info.version}
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={info.downloadUrl}
              download={info.fileName}
              aria-label={`Download ${info.fileName}`}
              className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 font-display text-sm font-bold text-white"
            >
              <DownloadIcon /> Download zip
            </a>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveZip()}
              aria-label="Save the SoundChat source zip to this device"
              className="rounded-full border border-[var(--border)] px-5 py-2.5 font-display text-sm font-bold disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save zip"}
            </button>
            <button
              type="button"
              disabled={build.isPending}
              onClick={() => build.mutate()}
              aria-label="Build a fresh SoundChat source zip"
              className="rounded-full border border-[var(--border)] px-5 py-2.5 font-display text-sm font-bold disabled:opacity-50"
            >
              {build.isPending ? "Rebuilding…" : "Rebuild"}
            </button>
          </div>
        </div>
      )}
      {build.isPending && !info && (
        <p className="mt-2 text-sm text-[var(--dim)]">Packing the source, backgrounds, and guides…</p>
      )}
      {error && <p className="mt-2 text-sm text-[var(--accent)]" role="alert">{error}</p>}

      <details className="mt-4">
        <summary className="cursor-pointer font-display text-sm font-bold" aria-label="Show Termux steps to push SoundChat to GitHub">
          Termux steps: phone → GitHub
        </summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-[var(--dim)]">
          <li>Download the zip above — it lands in Downloads as soundchat-v2-source.zip.</li>
          <li>Open Termux and install the tools: git, gh (GitHub login), and unzip.</li>
          <li>Run termux-setup-storage once and allow storage access, so Termux can see Downloads.</li>
          <li>Unzip the export in Downloads and step into the soundchat-v2 folder.</li>
          <li>Start git, add everything, and make the first commit: “SoundChat v2 source”.</li>
          <li>Sign in with gh auth login (GitHub.com → HTTPS → web browser, paste the one-time code).</li>
          <li>Create the repo and push: gh repo create soundchat-platform — use --public instead of --private if you want it public.</li>
          <li>Repo already exists? Connect it instead: git remote add origin https://github.com/Brooklyn420/soundchat-platform.git, then git branch -M main and git push -u origin main.</li>
          <li>Check github.com/Brooklyn420 — the soundchat-platform repo should show the SoundChat files.</li>
        </ol>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">Copy-paste commands</span>
            <button
              type="button"
              onClick={() => void copyCommands()}
              aria-label="Copy the Termux commands"
              className="flex items-center gap-1 rounded-full bg-[var(--raised)] px-3 py-1.5 text-xs font-semibold"
            >
              <CopyIcon /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-2xl bg-[var(--player-bg)] p-3 text-xs leading-relaxed text-[var(--player-text)]">{TERMUX_COMMANDS}</pre>
          <p className="mt-1 text-xs text-[var(--dim)]">
            Full guide with fixes for common snags is in the zip: docs/TERMUX_GITHUB_UPLOAD.md.
          </p>
        </div>
      </details>
    </div>
  );
}

function ProfileTab({
  onEditContact,
  onBackgroundPicked,
}: {
  onEditContact: (c: Contact) => void;
  onBackgroundPicked: (id: BackgroundId) => void;
}) {
  const queryClient = useQueryClient();
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => api.getProfile({}) });
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: () => api.listContacts({}) });
  const [name, setName] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plusSheetOpen, setPlusSheetOpen] = useState(false);

  const profile = profileQ.data?.profile;
  const plusActive = profileQ.data?.plus.active ?? false;
  const shownName = name ?? profile?.displayName ?? "";
  const shownHandle = handle ?? profile?.handle ?? "";

  const save = useMutation({
    mutationFn: async () =>
      await api.saveProfile({ displayName: shownName.trim(), handle: shownHandle.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setSavedMsg(true);
      setName(null);
      setHandle(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save your profile."),
  });

  const [bgNotice, setBgNotice] = useState<string | null>(null);
  const saveBg = useMutation({
    mutationFn: async (bg: BackgroundId) => await api.saveBackground({ background: bg }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save that background."),
  });

  const [purgeMsg, setPurgeMsg] = useState<string | null>(null);
  const setDefaultTimer = useMutation({
    mutationFn: async (seconds: number | null) =>
      await api.setDefaultDisappearingTimer({ seconds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't save that timer."),
  });
  const purgeNow = useMutation({
    mutationFn: async () => await api.purgeExpiredMessages({}),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setPurgeMsg(
        res.deleted > 0
          ? `Deleted ${res.deleted} expired message${res.deleted === 1 ? "" : "s"} from storage.`
          : "Nothing was expired right now — storage is already clean.",
      );
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't run the clean-up."),
  });

  const pickBackground = (id: BackgroundId) => {
    // Apply instantly on this device first, then save — a tap should never
    // look like nothing happened while the save round-trips.
    onBackgroundPicked(id);
    queryClient.setQueryData<ApiResponse<typeof api, "getProfile">>(["profile"], (old) =>
      old?.profile ? { ...old, profile: { ...old.profile, background: id } } : old,
    );
    setBgNotice(`${backgroundById(id).name} is on — saving your pick…`);
    setError(null);
    saveBg.mutate(id, {
      onSuccess: () => setBgNotice(`${backgroundById(id).name} saved as your background.`),
      onError: () => setBgNotice(null),
    });
  };

  const stats = profileQ.data?.stats;
  const statItems: { label: string; value: number }[] = [
    { label: "Contacts", value: stats?.contacts ?? 0 },
    { label: "Chats", value: stats?.conversations ?? 0 },
    { label: "Messages", value: stats?.messages ?? 0 },
    { label: "Saved songs", value: stats?.savedTracks ?? 0 },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-6">
      <h1 className="pb-3 pt-4 font-display text-3xl font-extrabold tracking-tight">Profile</h1>
      {profile && (
        <div className="mb-5 flex items-center gap-4 rounded-3xl bg-[var(--player-bg)] p-5 text-[var(--player-text)]">
          <Avatar name={profile.displayName} color="#FF4D2E" size={64} />
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate font-display text-xl font-bold">
              <span className="truncate">{profile.displayName}</span>
              {plusActive && (
                <span className="shrink-0 rounded-full bg-[var(--amber)] px-2 py-0.5 text-[10px] font-extrabold text-black">
                  PLUS
                </span>
              )}
            </p>
            <p className="truncate opacity-70">{profile.handle}</p>
          </div>
          <EqBars playing={false} />
        </div>
      )}

      <form
        className="mb-6 flex flex-col gap-4 rounded-3xl bg-[var(--surface)] p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!shownName.trim() || !shownHandle.trim()) {
            setError("Name and handle can't be empty.");
            return;
          }
          setError(null);
          setSavedMsg(false);
          save.mutate();
        }}
      >
        <div>
          <label htmlFor="profile-name" className={labelCls}>Display name</label>
          <input
            {...FIELDS.saveProfile.displayName}
            id="profile-name"
            className={inputCls}
            value={shownName}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="profile-handle" className={labelCls}>Handle</label>
          <input
            {...FIELDS.saveProfile.handle}
            id="profile-handle"
            className={inputCls}
            value={shownHandle}
            onChange={(e) => setHandle(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-[var(--accent)]" role="alert">{error}</p>}
        {savedMsg && <p className="text-sm font-medium text-[var(--amber)]">Profile saved.</p>}
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-full bg-[var(--accent)] px-5 py-3 font-display font-bold text-white disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save profile"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setPlusSheetOpen(true)}
        className="mb-6 flex w-full items-center gap-3 rounded-3xl bg-[var(--surface)] p-5 text-left"
        aria-label={plusActive ? "SoundChat Plus — you're a member, manage it" : "SoundChat Plus — see what it unlocks"}
      >
        <span className="rounded-full bg-[var(--amber)] px-2.5 py-1 font-display text-[11px] font-extrabold text-black">
          PLUS
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-bold">
            {plusActive ? "SoundChat Plus is on" : "SoundChat Plus — $4.99/month"}
          </span>
          <span className="block text-sm text-[var(--dim)]">
            {plusActive
              ? "Premium lenses, exclusive backgrounds, 60-second videos, unlimited playlists & offline. Tap to manage."
              : "Premium AR lenses, exclusive backgrounds, 60-second videos, unlimited playlists & offline. The app itself stays free."}
          </span>
        </span>
        <span className="shrink-0 text-[var(--dim)]" aria-hidden="true">›</span>
      </button>
      {plusSheetOpen && <PlusSheet onClose={() => setPlusSheetOpen(false)} />}

      <BackgroundPicker
        current={profile?.background ?? "classic"}
        onPick={pickBackground}
        pending={false}
        plusActive={plusActive}
        onPlusPick={() => setPlusSheetOpen(true)}
      />
      {bgNotice && <p className="-mt-3 mb-5 text-sm font-medium text-[var(--amber)]" role="status">{bgNotice}</p>}

      <div className="mb-6 rounded-3xl bg-[var(--surface)] p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="text-[var(--accent)]"><LockIcon /></span> Privacy &amp; security
        </h2>
        <h3 className="mt-4 flex items-center gap-2 font-display text-base font-bold">
          <span className="text-[var(--accent)]"><TimerIcon /></span> Disappearing messages
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
          New messages delete themselves from storage when their timer runs out — the message
          and, for snaps, the photo or video file are removed for real, not just hidden. Tap{" "}
          <span className="font-semibold text-[var(--text)]">Save</span> under any message in a
          chat to keep that one for good; saved messages show a gold bookmark and never disappear.
          You can change the timer inside each chat, too — the setting below is the timer new
          chats start with.
        </p>
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Default disappearing timer for new chats"
        >
          {DISAPPEARING_OPTIONS.map((o) => {
            const current = profile?.defaultDisappearingSeconds ?? 86400;
            const on = current === o.seconds;
            return (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={setDefaultTimer.isPending}
                onClick={() => setDefaultTimer.mutate(o.seconds)}
                aria-label={`Set default disappearing timer for new chats to ${o.label}`}
                className={`rounded-full px-3.5 py-2 text-xs font-bold disabled:opacity-50 ${
                  on ? "bg-[var(--accent)] text-white" : "bg-[var(--raised)]"
                }`}
              >
                {o.short}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[var(--dim)]">
          Default right now:{" "}
          <span className="font-semibold text-[var(--text)]">
            {profile?.defaultDisappearingSeconds == null
              ? "Off — new chats keep messages"
              : disappearingLabel(profile?.defaultDisappearingSeconds ?? 86400)}
          </span>
          . Messages sent before disappearing messages arrived have no timer and stay until
          you delete them or the chat.
        </p>
        <button
          type="button"
          onClick={() => {
            setPurgeMsg(null);
            purgeNow.mutate();
          }}
          disabled={purgeNow.isPending}
          className="mt-3 rounded-full bg-[var(--raised)] px-4 py-2.5 text-sm font-bold disabled:opacity-50"
        >
          {purgeNow.isPending ? "Cleaning up…" : "Delete expired messages now"}
        </button>
        {purgeMsg && <p className="mt-2 text-sm font-medium text-[var(--amber)]" role="status">{purgeMsg}</p>}

        <h3 className="mt-5 font-display text-base font-bold">Encryption</h3>
        <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-[var(--dim)]">
          <li>
            <span className="font-semibold text-[var(--text)]">Your texts and snaps are encrypted on this device</span>{" "}
            before they're saved — AES-256 encryption (WebCrypto) scrambles every new text message, snap photo and
            video, and snap caption. SoundChat's storage only holds the scrambled version.
          </li>
          <li>
            <span className="font-semibold text-[var(--text)]">The key never leaves this browser.</span> It's made
            here and kept in this browser's storage — it is never uploaded. Only a browser holding the key can read
            the messages; open SoundChat somewhere without it and they show as locked.
          </li>
          <li>
            <span className="font-semibold text-[var(--text)]">Song shares still disappear on the timer,</span>{" "}
            but their catalog info (title, artist, artwork) isn't encrypted — same for call log lines, which do
            get a timer. Older messages from before encryption arrived stay readable as they are.
          </li>
          <li>
            <span className="font-semibold text-[var(--text)]">The honest limits:</span> anyone holding your
            unlocked phone can read what's on it, and no app can promise that a court order aimed at the
            phone's owner could never reach the phone itself. What SoundChat does guarantee is on this page:
            storage holds scrambled copies, unsaved messages delete themselves, and there are no trackers or ads.
          </li>
          <li>
            <span className="font-semibold text-[var(--text)]">Not decentralized — yet.</span> Chats still live in
            SoundChat's own database and your contacts live on this device, so there's no peer-to-peer network
            carrying messages between phones today. True decentralization and phone-to-phone end-to-end encryption
            need real accounts on separate devices first — that's the road ahead, not something this version claims.
          </li>
        </ul>
      </div>

      <GitHubExportCard />

      <div className="mb-6 grid grid-cols-2 gap-2" aria-label="Your SoundChat numbers">
        {statItems.map((s) => (
          <div key={s.label} className="rounded-2xl bg-[var(--surface)] p-4 text-center">
            <p className="font-display text-3xl font-extrabold">{s.value}</p>
            <p className="text-sm text-[var(--dim)]">{s.label}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-2 font-display text-lg font-bold">Your contacts</h2>
      {contacts.data && contacts.data.contacts.length === 0 && (
        <p className="rounded-2xl bg-[var(--surface)] px-4 py-5 text-sm text-[var(--dim)]">
          No contacts yet — add them from the Chats tab.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {contacts.data?.contacts.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] px-3 py-2.5">
            <Avatar name={c.name} color={c.color} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{c.name}</span>
              <span className="block truncate text-xs text-[var(--dim)]">
                {[c.handle, c.note].filter(Boolean).join(" · ") || "—"}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onEditContact(c)}
              aria-label={`Edit contact ${c.name}`}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--dim)]"
            >
              <PencilIcon />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup + shell
// ---------------------------------------------------------------------------

function SetupScreen() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (v: { displayName: string; handle: string }) => await api.saveProfile(v),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
    onError: (e) => setError(e instanceof Error ? e.message : "Could not set up your profile."),
  });

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
      <div className="mb-2 flex items-center gap-2 text-[var(--accent)]">
        <MusicIcon />
        <span className="font-display text-sm font-bold uppercase tracking-widest">SoundChat</span>
      </div>
      <h1 className="font-display text-4xl font-extrabold leading-tight">
        Chat with people.
        <br />
        Send them songs that <span className="text-[var(--accent)]">play</span>.
      </h1>
      <p className="mt-3 text-[var(--dim)]">
        Set up your profile to get started — this is the name and handle your friends will see.
      </p>
      <form
        className="mt-8 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            setError("Add your name so friends know it's you.");
            return;
          }
          setError(null);
          save.mutate({ displayName: name.trim(), handle: handle.trim() || name.trim() });
        }}
      >
        <div>
          <label htmlFor="setup-name" className={labelCls}>Your name</label>
          <input
            {...FIELDS.saveProfile.displayName}
            id="setup-name"
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bill"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="setup-handle" className={labelCls}>Handle</label>
          <input
            {...FIELDS.saveProfile.handle}
            id="setup-handle"
            className={inputCls}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@bill"
          />
        </div>
        {error && <p className="text-sm text-[var(--accent)]" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-full bg-[var(--accent)] px-6 py-3.5 font-display text-lg font-bold text-white disabled:opacity-50"
        >
          {save.isPending ? "Setting up…" : "Start chatting"}
        </button>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate({ displayName: "You", handle: "@you" })}
          className="py-1 text-sm font-medium text-[var(--dim)] underline underline-offset-4"
        >
          Just look around first
        </button>
      </form>
    </div>
  );
}

type Tab = "chats" | "music" | "library" | "profile";

function Shell() {
  const [tab, setTab] = useState<Tab>("chats");
  const [bgOverride, setBgOverride] = useState<BackgroundId | null>(null);
  const [thread, setThread] = useState<{
    contact: ThreadContact | null;
    group: { title: string; members: ThreadContact[] } | null;
    conversationId: number;
  } | null>(null);
  const [contactSheet, setContactSheet] = useState<{ mode: "add" } | { mode: "edit"; contact: Contact } | null>(null);
  const [shareTrack, setShareTrack] = useState<Track | null>(null);
  const [playlistTrack, setPlaylistTrack] = useState<Track | null>(null);
  const [watchOpen, setWatchOpen] = useState(false);
  const [studio, setStudio] = useState<{ mode: SnapMode; track: Track | null } | null>(null);

  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => api.getProfile({}) });
  const contactsQ = useQuery({ queryKey: ["contacts"], queryFn: () => api.listContacts({}) });

  if (profileQ.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-[var(--dim)]">Loading SoundChat…</p>
      </div>
    );
  }
  if (profileQ.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-display font-bold">SoundChat couldn't load.</p>
        <button
          type="button"
          onClick={() => void profileQ.refetch()}
          className="rounded-full bg-[var(--accent)] px-5 py-2.5 font-display font-bold text-white"
        >
          Retry
        </button>
      </div>
    );
  }
  if (!profileQ.data?.profile) {
    return <SetupScreen />;
  }

  const myName = profileQ.data.profile.displayName;
  const activeBackground = backgroundById(bgOverride ?? profileQ.data.profile.background);

  const openThread = (contact: ThreadContact, conversationId: number) => {
    setThread({ contact, group: null, conversationId });
    setTab("chats");
  };

  const openGroupThread = (group: { title: string; members: ThreadContact[] }, conversationId: number) => {
    setThread({ contact: null, group, conversationId });
    setTab("chats");
  };

  const editContactForThread = () => {
    if (!thread?.contact) return;
    const full = contactsQ.data?.contacts.find((c) => c.id === thread.contact!.id);
    if (full) setContactSheet({ mode: "edit", contact: full });
  };

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "chats", label: "Chats", icon: <ChatIcon /> },
    { id: "music", label: "Music", icon: <MusicIcon /> },
    { id: "library", label: "Library", icon: <HeartIcon /> },
    { id: "profile", label: "Profile", icon: <UserIcon /> },
  ];

  return (
    <BackgroundContext.Provider value={activeBackground}>
      <BackgroundLayer />
      <div className={`relative z-10 flex min-h-0 flex-1 flex-col ${activeBackground.id !== "classic" ? "app-bg-has" : ""}`}>
      {thread ? (
        <ThreadView
          conversationId={thread.conversationId}
          contact={thread.contact}
          group={thread.group}
          myName={myName}
          onBack={() => setThread(null)}
          onEditContact={editContactForThread}
        />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "chats" && (
              <ChatsTab
                onOpenThread={openThread}
                onOpenGroupThread={openGroupThread}
                onAddContact={() => setContactSheet({ mode: "add" })}
                onOpenCamera={() => setStudio({ mode: "photo", track: null })}
              />
            )}
            {tab === "music" && <MusicTab onShare={setShareTrack} onPlaylist={setPlaylistTrack} />}
            {tab === "library" && (
              <LibraryTab onShare={setShareTrack} onPlaylist={setPlaylistTrack} goMusic={() => setTab("music")} />
            )}
            {tab === "profile" && (
              <ProfileTab
                onEditContact={(c) => setContactSheet({ mode: "edit", contact: c })}
                onBackgroundPicked={(id) => setBgOverride(id)}
              />
            )}
          </div>
          <MiniPlayer onExpand={() => setWatchOpen(true)} />
          <nav
            className="flex shrink-0 items-stretch justify-around border-t border-[var(--border)] bg-[var(--surface)] pb-safe"
            aria-label="SoundChat sections"
          >
            {tabs.slice(0, 2).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-label={t.label}
                aria-current={tab === t.id ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
                  tab === t.id ? "text-[var(--accent)]" : "text-[var(--dim)]"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setStudio({ mode: "photo", track: null })}
              aria-label="Camera — take a photo or video, no contact needed"
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold text-[var(--accent)]"
            >
              <span className="-mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg ring-4 ring-[var(--surface)]" aria-hidden="true">
                <CameraIcon />
              </span>
              Camera
            </button>
            {tabs.slice(2).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-label={t.label}
                aria-current={tab === t.id ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
                  tab === t.id ? "text-[var(--accent)]" : "text-[var(--dim)]"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
        </>
      )}

      </div>
      {contactSheet && (
        <ContactSheet
          contact={contactSheet.mode === "edit" ? contactSheet.contact : null}
          onClose={() => setContactSheet(null)}
        />
      )}
      {shareTrack && (
        <ShareSheet
          track={shareTrack}
          onClose={() => setShareTrack(null)}
          onOpenThread={openThread}
          onOpenGroupThread={openGroupThread}
        />
      )}
      {playlistTrack && (
        <PlaylistSheet track={playlistTrack} onClose={() => setPlaylistTrack(null)} />
      )}
      {watchOpen && (
        <NowPlayingView
          onClose={() => setWatchOpen(false)}
          onFilm={(track, mode) => {
            setWatchOpen(false);
            setStudio({ mode, track });
          }}
        />
      )}
      {studio && (
        <CameraSheet
          conversationId={null}
          sender="me"
          initialMode={studio.mode}
          initialTrack={studio.track}
          onClose={() => setStudio(null)}
          onSentToChat={(target) => {
            setStudio(null);
            if (target.group) openGroupThread(target.group, target.conversationId);
            else if (target.contact) openThread(target.contact, target.conversationId);
          }}
        />
      )}
    </BackgroundContext.Provider>
  );
}

export function App() {
  return (
    <div className="app-bg flex h-dvh flex-col bg-[var(--bg)] text-[var(--text)]">
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      <PlayerProvider>
        <Shell />
      </PlayerProvider>
    </div>
  );
}
