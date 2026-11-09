#!/bin/zsh
cd -- "${0:A:h}" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  print "Python 3 is nodig. Installeer Python 3 en probeer opnieuw."
  read -r "?Druk op Enter om te sluiten."
  exit 1
fi
python3 server.py
result=$?
if (( result != 0 )); then
  read -r "?Druk op Enter om te sluiten."
fi
exit "$result"
