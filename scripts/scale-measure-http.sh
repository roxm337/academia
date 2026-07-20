#!/bin/bash
# Times the PDF and page routes at real school size, over HTTP — the path a
# director actually uses. Needs `npm start` running and scale-seed.mts applied.
set -u
BASE=${BASE_URL:-http://localhost:3000}

login() {
  local jar=$2; rm -f "$jar"
  local csrf
  csrf=$(curl -s -c "$jar" -b "$jar" "$BASE/api/auth/csrf" | sed 's/.*"csrfToken":"\([^"]*\)".*/\1/')
  curl -s -o /dev/null -c "$jar" -b "$jar" -X POST "$BASE/api/auth/callback/credentials" \
    -d "csrfToken=$csrf" -d "email=$1" -d "password=Passw0rd!" -d "redirect=false" \
    -H "Content-Type: application/x-www-form-urlencoded"
}

t() { # label url jar
  local out
  out=$(curl -s -o /tmp/scale-out -b "$3" -w "%{http_code} %{time_total} %{size_download}" "$BASE$2")
  set -- $out
  printf "  %8.0fms  %-46s http=%s size=%sKB\n" \
    "$(echo "$2 * 1000" | bc)" "$1" "$1" "$(( $3 / 1024 ))" 2>/dev/null || true
  echo "  code=$1 time=${2}s size=$(( $3 / 1024 ))KB"
}

login directeur@academia.ma /tmp/sd.jar

CLASS=$(curl -s -b /tmp/sd.jar "$BASE/fr/director/bulletins" | grep -oE 'class=[a-z0-9]{20,}' | head -1 | cut -d= -f2)
SEM=$(curl -s -b /tmp/sd.jar "$BASE/fr/director/bulletins" | grep -oE 'semester=[a-z0-9]{20,}' | head -1 | cut -d= -f2)

echo
echo "== pages =="
for p in "/fr/director" "/fr/director/students" "/fr/director/bulletins" "/fr/director/council" "/fr/director/fees"; do
  printf "%-34s " "$p"
  curl -s -o /dev/null -b /tmp/sd.jar -w "http=%{http_code}  %{time_total}s\n" "$BASE$p"
done

echo
echo "== bulletin booklet (one class) =="
for L in fr ar; do
  printf "  %s  " "$L"
  curl -s -o /tmp/book-$L.pdf -b /tmp/sd.jar \
    -w "http=%{http_code}  %{time_total}s  %{size_download} bytes\n" \
    "$BASE/api/bulletin/booklet?class=$CLASS&semester=$SEM&locale=$L"
done

echo
echo "== receipt booklet (all receipts) =="
curl -s -o /tmp/rec.pdf -b /tmp/sd.jar \
  -w "  http=%{http_code}  %{time_total}s  %{size_download} bytes\n" \
  "$BASE/api/receipt/booklet?from=2000-01-01&to=2100-01-01&locale=fr"

echo
echo "== CSV export (whole class list) =="
curl -s -o /tmp/rep.csv -b /tmp/sd.jar \
  -w "  http=%{http_code}  %{time_total}s  %{size_download} bytes\n" \
  "$BASE/api/reports?kind=class-list&class=$CLASS&semester=$SEM&locale=fr"
