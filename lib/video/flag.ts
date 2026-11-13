// Video calls run on One Homes' own LiveKit server on Azure
// (video.sphaera.tech). Setting this to false hides the feature: no
// "Video call" button on leads, no "Live calls" in the rail, and every
// /api/video route and video page answers as if it doesn't exist.
export const VIDEO_CALLS_ENABLED = true;

// People the feature stays hidden from for now, even while it's on for
// everyone else. Same effect as the switch above, but only for them.
const HIDDEN_FROM = ["aqib@onehomes.com"];

export function videoCallsFor(email: string | null | undefined): boolean {
  if (!VIDEO_CALLS_ENABLED) return false;
  return !HIDDEN_FROM.includes((email ?? "").trim().toLowerCase());
}
