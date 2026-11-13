#!/usr/bin/env bash
# Run on the video VM (~/livekit). Chooses the call bot's speech-to-text:
#
#   ./switch-transcriber.sh azure      Azure Speech, live (the original setup)
#   ./switch-transcriber.sh openai     gpt-4o-mini-transcribe on Azure
#   ./switch-transcriber.sh set-keys   store the transcribe model's endpoint
#                                      and key from /tmp/transcribe.env
#                                      (TRANSCRIBE_ENDPOINT, TRANSCRIBE_KEY,
#                                      optional TRANSCRIBE_DEPLOYMENT), then
#                                      shred that file
#   ./switch-transcriber.sh status     show which one is on (no secrets)
#
# Switching restarts only the call bot (~10 s). A call in progress keeps
# going and keeps recording, but a few seconds of its transcript are lost,
# so switch when no calls are running.
set -euo pipefail
cd ~/livekit
ENV_FILE=call-bot.env
EGRESS_IMAGE="${EGRESS_IMAGE:-livekit/egress:v1.15.0}"

set_var() { # name value
  if grep -q "^$1=" "$ENV_FILE"; then
    sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"
  else
    echo "$1=$2" >> "$ENV_FILE"
  fi
}

restart() {
  sudo EGRESS_IMAGE="$EGRESS_IMAGE" docker compose -f docker-compose.recording.yaml up -d --no-deps --force-recreate call-bot >/dev/null 2>&1
  sleep 6
  sudo docker logs --tail 1 sphaera-recording-call-bot-1
}

case "${1:-}" in
  azure)
    set_var TRANSCRIBER azure
    restart
    ;;
  openai)
    grep -q '^TRANSCRIBE_KEY=.' "$ENV_FILE" && grep -q '^TRANSCRIBE_ENDPOINT=.' "$ENV_FILE" || {
      echo "No transcribe endpoint/key yet: run set-keys first."
      exit 1
    }
    set_var TRANSCRIBER openai
    restart
    ;;
  set-keys)
    [ -f /tmp/transcribe.env ] || { echo "/tmp/transcribe.env not found"; exit 1; }
    set -a; . /tmp/transcribe.env; set +a
    : "${TRANSCRIBE_ENDPOINT:?}" "${TRANSCRIBE_KEY:?}"
    umask 077
    set_var TRANSCRIBE_ENDPOINT "$TRANSCRIBE_ENDPOINT"
    set_var TRANSCRIBE_KEY "$TRANSCRIBE_KEY"
    set_var TRANSCRIBE_DEPLOYMENT "${TRANSCRIBE_DEPLOYMENT:-gpt-4o-mini-transcribe}"
    shred -u /tmp/transcribe.env 2>/dev/null || rm -f /tmp/transcribe.env
    echo "Saved. Now run: ./switch-transcriber.sh openai"
    ;;
  status)
    echo "TRANSCRIBER=$(grep '^TRANSCRIBER=' "$ENV_FILE" | cut -d= -f2 || true) (empty means azure)"
    grep -q '^TRANSCRIBE_KEY=.' "$ENV_FILE" && echo "transcribe keys: set" || echo "transcribe keys: not set"
    sudo docker logs sphaera-recording-call-bot-1 2>&1 | grep "call bot up" | tail -1
    ;;
  *)
    echo "usage: $0 azure | openai | set-keys | status"
    exit 1
    ;;
esac
