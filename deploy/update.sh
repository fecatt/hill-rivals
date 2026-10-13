#!/bin/bash
set -euo pipefail
cd /opt/hill-rivals/repo
exec 9>/run/hill-rivals-deploy.lock
flock -n 9 || exit 0
git fetch --quiet origin main
target=$(git rev-parse origin/main)
current=$(cat /opt/hill-rivals/deployed-sha 2>/dev/null || true)
[[ "$target" != "$current" ]] || exit 0
git checkout --quiet --detach "$target"
image="hill-rivals:$target"
docker build --quiet -t "$image" .
docker run --rm --entrypoint node "$image" --test test/room.test.js
# Validate the candidate in isolation before replacing the serving process.
docker run --rm --entrypoint node "$image" --input-type=module -e 'import {createSimulation} from "./server/simulation.js"; const s=createSimulation([{character:0,ability:"turbo",color:"red"}],0,0); s.step(); if(!Number.isFinite(s.state().cars[0].x)) process.exit(1);'
old_image=$(docker inspect --format '{{.Config.Image}}' hill-rivals 2>/dev/null || true)
docker rm -f hill-rivals >/dev/null 2>&1 || true
docker run -d --name hill-rivals --restart unless-stopped --memory 256m --cpus 1 --log-opt max-size=10m --log-opt max-file=3 -p 127.0.0.1:3107:3107 -e APP_VERSION="$target" "$image" >/dev/null
healthy=false
for i in {1..20}; do
  if curl -fsS http://127.0.0.1:3107/health >/dev/null; then healthy=true; break; fi
  sleep 1
done
if [[ "$healthy" != true ]]; then
  docker logs --tail 30 hill-rivals
  docker rm -f hill-rivals >/dev/null
  if [[ -n "$old_image" ]]; then docker run -d --name hill-rivals --restart unless-stopped --memory 256m --cpus 1 -p 127.0.0.1:3107:3107 "$old_image" >/dev/null; fi
  exit 1
fi
printf '%s\n' "$target" > /opt/hill-rivals/deployed-sha
echo "Deployed $target"
