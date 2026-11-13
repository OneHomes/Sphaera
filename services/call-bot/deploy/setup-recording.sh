#!/usr/bin/env bash
# Run on the video VM as the admin user. Reads the Azure values from
# /tmp/recording.env (RECORDINGS_STORAGE_ACCOUNT, RECORDINGS_STORAGE_KEY,
# AZURE_SPEECH_KEY, AZURE_SPEECH_REGION), takes the LiveKit key from
# ~/livekit/livekit.yaml, writes the two config files (owner-only) and
# starts Egress + the call bot. Prints no secrets.
set -euo pipefail
EGRESS_IMAGE="${1:?usage: setup-recording.sh <egress image, e.g. livekit/egress:v1.x.y>}"
cd ~/livekit
set -a; . /tmp/recording.env; set +a
: "${RECORDINGS_STORAGE_ACCOUNT:?}" "${RECORDINGS_STORAGE_KEY:?}" "${AZURE_SPEECH_KEY:?}"
AZURE_SPEECH_REGION="${AZURE_SPEECH_REGION:-centralindia}"

line=$(grep -E '^[[:space:]]+API[A-Za-z0-9]+:' livekit.yaml | head -1)
LK_KEY=$(echo "$line" | sed -E 's/^[[:space:]]*([^:]+):.*/\1/')
LK_SECRET=$(echo "$line" | sed -E 's/^[^:]+:[[:space:]]*//; s/[[:space:]]*$//')
[ -n "$LK_KEY" ] && [ -n "$LK_SECRET" ] || { echo "LiveKit key not found in livekit.yaml"; exit 1; }

umask 077
cat > egress.yaml <<YAML
log_level: info
api_key: $LK_KEY
api_secret: $LK_SECRET
ws_url: ws://localhost:7880
insecure: true
redis:
  address: localhost:6379
storage:
  azure:
    account_name: $RECORDINGS_STORAGE_ACCOUNT
    account_key: $RECORDINGS_STORAGE_KEY
    container_name: ${RECORDINGS_CONTAINER:-recordings}
cpu_cost:
  room_composite_cpu_cost: 2.0
YAML

cat > call-bot.env <<ENV
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=$LK_KEY
LIVEKIT_API_SECRET=$LK_SECRET
AZURE_SPEECH_KEY=$AZURE_SPEECH_KEY
AZURE_SPEECH_REGION=$AZURE_SPEECH_REGION
SPHAERA_BOT_URL=https://apex.sphaera.tech/api/video/bot
SPEECH_LANGUAGES=en-GB,ur-IN
RECORDING_ENABLED=true
ENV
shred -u /tmp/recording.env 2>/dev/null || rm -f /tmp/recording.env

# Egress reads its config as its own (non-root) user.
EGRESS_UID=$(sudo docker run --rm --entrypoint id "$EGRESS_IMAGE" -u 2>/dev/null || echo 0)
if [ "$EGRESS_UID" != "0" ] && [ "$EGRESS_UID" != "$(id -u)" ]; then sudo chown "$EGRESS_UID" egress.yaml; fi

sudo EGRESS_IMAGE="$EGRESS_IMAGE" docker compose -f docker-compose.recording.yaml up -d --build
sudo EGRESS_IMAGE="$EGRESS_IMAGE" docker compose -f docker-compose.recording.yaml ps
