// Where the browser keeps a call's client join link between the button that
// starts the call and the agent's call screen (the server stores only the
// link's hash). Its own tiny module so the lead page doesn't load LiveKit.
export function linkStorageKey(callId: string) {
  return `sphaera-video-link-${callId}`;
}
