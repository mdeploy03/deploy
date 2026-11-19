#!/usr/bin/env bash
# Voert een commando uit; bij een fout komen de laatste regels als annotatie op de run-pagina.
set -o pipefail
log=$(mktemp)
"$@" 2>&1 | tee "$log"
code=${PIPESTATUS[0]}
if [ "$code" -ne 0 ]; then
  tail -n 25 "$log" | sed 's/\x1b\[[0-9;]*m//g' | sed 's/%/%25/g' | tr '\n' '\r' | sed 's/\r/%0A/g' > "$log.msg"
  echo "::error title=Wrangler-fout (exitcode $code)::$(cat "$log.msg")"
fi
exit "$code"
