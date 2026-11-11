// Video calls are hidden until they run on One Homes' own LiveKit server on
// Azure (they were tested on LiveKit Cloud's free plan). While false: no
// "Video call" button on leads, no "Live calls" in the rail, and every
// /api/video route and video page answers as if it doesn't exist.
// Flip to true (and point LIVEKIT_URL/KEY/SECRET at the new server) to
// turn the feature back on.
export const VIDEO_CALLS_ENABLED = false;
