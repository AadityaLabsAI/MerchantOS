#!/bin/bash
set -e
cd /home/user/repo
TOKEN=$(curl -s -X POST -H 'Content-Type: application/json' -d '{"email":"owner@merchantos.local","password":"OwnerPass123!"}' http://127.0.0.1:3000/auth/login | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{const j=JSON.parse(d); console.log(j.accessToken)})")
STORE_ID="01M4N7PVQMKX0ZE4GYDMJ2QQMN"
SOAP="01M4N7QVSKDEMSV7G1NBGR1P2P"
KEY="idem-test-$(date +%s%N | head -c 16)"
export KEY

echo "=== POST #1 ==="
R1=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H "Idempotency-Key: $KEY" -d '{
  "storeId":"'$STORE_ID'",
  "lines":[{"productId":"'$SOAP'","quantity":1}],
  "taxBps":1800,
  "currency":"INR"
}' http://127.0.0.1:3000/api/bills)
echo "$R1" | head -c 200
echo
echo

echo "=== POST #2 (same key, same body) ==="
R2=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H "Idempotency-Key: $KEY" -d '{
  "storeId":"'$STORE_ID'",
  "lines":[{"productId":"'$SOAP'","quantity":1}],
  "taxBps":1800,
  "currency":"INR"
}' http://127.0.0.1:3000/api/bills)
echo "$R2" | head -c 200
echo
echo

ID1=$(echo "$R1" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{const j=JSON.parse(d); console.log(j.id||'')})")
ID2=$(echo "$R2" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{const j=JSON.parse(d); console.log(j.id||'')})")
echo "Bill 1 id: $ID1"
echo "Bill 2 id: $ID2"
if [ "$ID1" = "$ID2" ] && [ -n "$ID1" ]; then
  echo "PASS: same bill id returned on replay"
else
  echo "FAIL: different ids"
fi

echo
echo "=== Verify in DB ==="
node bin/dev/check-idempotency.cjs
