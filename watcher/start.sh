until npm run dev; do
    echo "Watcher crashed with exit code $?. Respawning..." >&2
    sleep 5
done
