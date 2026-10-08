curl -sS https://3000-im0swn4n2zndd8gtiy33v.e2b.app/app.css > /tmp/css.txt
for cls in bg-brand-600 text-4xl rounded-2xl flex grid grid-cols-4 lg:pl-64 hover:bg-brand-50 divide-y shadow-soft btn-primary amount empty-hint; do
  if grep -q "\\.$cls" /tmp/css.txt; then echo "  $cls: OK"; else echo "  $cls: MISSING"; fi
done
echo
echo "--- size ---"
wc -c /tmp/css.txt
