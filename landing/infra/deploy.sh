#!/usr/bin/env bash
# THRESHOLD's landing page on AWS (S3 + CloudFront with its own CSP, and the waitlist: Lambda + DynamoDB), DNS in
# Cloudflare. As gazum-ai/infra/deploy.sh. The order, and what each step makes: infra/README.md. Run from landing/:
#   infra/deploy.sh check     read-only: who you are in AWS, the template, the tests, the CSP audit of dist/, the
#                             Cloudflare token and the Resend key (never shown), and what is already deployed
#   infra/deploy.sh cert      request the certificate (threshold.gazum.ai, us-east-1), put its DNS validation record in
#                             Cloudflare, wait until it is ISSUED (its ARN is kept in infra/.cert-arn)
#   infra/deploy.sh stack     build the page, then create/update the CloudFormation stack threshold-site
#                             (infra/site.yaml) with the CSP hashes of its inline scripts (the live pages' are kept;
#                             PRUNE=1 drops them); the first run makes the CloudFront-only header value
#                             (infra/.origin-verify, never committed or printed)
#   infra/deploy.sh secrets   put the Resend send-only key (~/.resend-sending-key) into the waitlist's secret, keeping its
#                             generated signing secret
#   infra/deploy.sh api       upload the waitlist's code (api/waitlist.mjs, tested first)
#   infra/deploy.sh publish   build with the waitlist on (/api/waitlist), check the live CSP allows its inline scripts,
#                             upload dist/ (hashed files cached for a year, the rest revalidated), invalidate CloudFront
#   infra/deploy.sh dns       point threshold.gazum.ai (a DNS-only CNAME) at the distribution
#   infra/deploy.sh smoke     the pages, the headers, the 404, and the waitlist (a bad email, Resend's test inbox, a
#                             faded link, the function URL without CloudFront); then deletes the test address
#   infra/deploy.sh status    the stack, the certificate, the DNS and the live site
# AWS: profile gazum, us-east-1 (override with AWS_PROFILE / AWS_REGION). Cloudflare: the DNS token in
# ~/.cloudflare-token. Nothing here prints a secret.
set -euo pipefail
cd "$(dirname "$0")/.."
export AWS_PROFILE="${AWS_PROFILE:-gazum}" AWS_REGION="${AWS_REGION:-us-east-1}"
STACK=threshold-site HOST=threshold.gazum.ai ZONE_NAME=gazum.ai
CERT_FILE=infra/.cert-arn VERIFY_FILE=infra/.origin-verify
# hashed files whose type the CLI may guess wrong (or not at all): set by hand
TYPES='avif=image/avif webp=image/webp woff2=font/woff2 woff=font/woff mjs=text/javascript webmanifest=application/manifest+json mp3=audio/mpeg m4a=audio/mp4 aac=audio/aac ogg=audio/ogg oga=audio/ogg opus=audio/ogg wav=audio/wav flac=audio/flac webm=video/webm mp4=video/mp4'

cf() {   # cf METHOD PATH [JSON]: the Cloudflare API with the token from ~/.cloudflare-token
  local m="$1" p="$2" d="${3:-}"
  local tok; tok="$(cat ~/.cloudflare-token)"
  if [ -n "$d" ]; then curl -fsS -X "$m" "https://api.cloudflare.com/client/v4$p" -H "Authorization: Bearer $tok" -H 'Content-Type: application/json' --data "$d"
  else curl -fsS -X "$m" "https://api.cloudflare.com/client/v4$p" -H "Authorization: Bearer $tok"; fi
}
zone() { cf GET "/zones?name=$ZONE_NAME" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const z=JSON.parse(s).result[0];if(!z)process.exit(1);console.log(z.id)})"; }
# upsert ZONE NAME TYPE CONTENT: one DNS-only record of that name and type, made or changed to CONTENT
upsert() {
  local z="$1" name="$2" type="$3" content="$4"
  local id; id="$(cf GET "/zones/$z/dns_records?type=$type&name=$name" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s).result[0];console.log(r?r.id:'')})")"
  local body; body="$(node -e "console.log(JSON.stringify({type:process.argv[1],name:process.argv[2],content:process.argv[3],proxied:false,ttl:1}))" "$type" "$name" "$content")"
  if [ -n "$id" ]; then cf PUT "/zones/$z/dns_records/$id" "$body" >/dev/null; echo "  updated $type $name -> $content"
  else cf POST "/zones/$z/dns_records" "$body" >/dev/null; echo "  added $type $name -> $content"; fi
}
output() { aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
param() { aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Parameters[?ParameterKey=='$1'].ParameterValue" --output text 2>/dev/null || true; }
build() {   # the production build (the form posts to /api/waitlist), and nothing in it the CSP would block
  SIGNUP_ENDPOINT=/api/waitlist node scripts/build.mjs
  node infra/csp.mjs audit dist || { echo "Fix what the audit names (scripts/ or src/), then try again." >&2; exit 1; }
}

case "${1:-}" in
  check)
    echo "AWS: $(aws sts get-caller-identity --query Arn --output text) ($AWS_REGION)"
    aws cloudformation validate-template --template-body file://infra/site.yaml >/dev/null && echo "  ok   infra/site.yaml validates" \
      || echo "  FAIL infra/site.yaml doesn't validate (above), or AWS can't be reached: aws login --profile $AWS_PROFILE"
    bash -n infra/deploy.sh && echo "  ok   infra/deploy.sh parses"
    node --test api/test/*.test.mjs infra/test/*.test.mjs >/dev/null 2>&1 && echo "  ok   the tests pass" \
      || { echo "  FAIL the tests: node --test api/test/*.test.mjs infra/test/*.test.mjs" >&2; exit 1; }
    if [ -f dist/index.html ]; then
      node infra/csp.mjs audit dist && echo "  ok   dist/ keeps to its own site; inline scripts to allow: $(node infra/csp.mjs hashes dist | wc -w | tr -d ' ')"
    else echo "  --   no dist/ yet (node scripts/build.mjs)"; fi
    [ -s ~/.cloudflare-token ] && { zone >/dev/null && echo "  ok   Cloudflare: the token reaches $ZONE_NAME" || echo "  FAIL Cloudflare: the token can't read $ZONE_NAME"; } \
      || echo "  FAIL ~/.cloudflare-token is missing (cert and dns need it)"
    [ -s ~/.resend-sending-key ] && echo "  ok   ~/.resend-sending-key is there (not shown)" || echo "  FAIL ~/.resend-sending-key is missing (secrets needs it)"
    if [ -s "$CERT_FILE" ]; then echo "  --   certificate: $(aws acm describe-certificate --certificate-arn "$(cat "$CERT_FILE")" --query Certificate.Status --output text)"
    else echo "  --   certificate: not requested yet (infra/deploy.sh cert)"; fi
    echo "  --   stack $STACK: $(aws cloudformation describe-stacks --stack-name "$STACK" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo 'not created yet')"
    ;;
  cert)
    if [ -s "$CERT_FILE" ]; then arn="$(cat "$CERT_FILE")"; echo "Certificate $arn (already requested)"
    else
      arn="$(aws acm request-certificate --domain-name "$HOST" --validation-method DNS --query CertificateArn --output text)"
      echo "$arn" > "$CERT_FILE"; echo "Requested $arn"; sleep 8
    fi
    z="$(zone)"
    aws acm describe-certificate --certificate-arn "$arn" --query 'Certificate.DomainValidationOptions[].ResourceRecord.[Name,Value]' --output text |
      while read -r name value; do [ -n "$name" ] && upsert "$z" "${name%.}" CNAME "${value%.}"; done
    echo "Waiting for ACM to validate (a few minutes)…"
    aws acm wait certificate-validated --certificate-arn "$arn" && echo "ISSUED"
    ;;
  stack)
    [ -s "$CERT_FILE" ] || { echo "No certificate yet: infra/deploy.sh cert first." >&2; exit 1; }
    arn="$(cat "$CERT_FILE")"
    if [ ! -s "$VERIFY_FILE" ]; then (umask 077; node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))" > "$VERIFY_FILE"); fi
    build
    # the CSP allows this build's inline scripts and keeps those of the pages already live, so neither breaks while
    # the next publish goes out (PRUNE=1 keeps only this build's)
    keep=""; [ "${PRUNE:-}" = 1 ] || keep="$(param InlineScriptHashes)"
    hashes="$(node infra/csp.mjs hashes dist "$keep")"
    aws cloudformation deploy --stack-name "$STACK" --template-file infra/site.yaml --no-fail-on-empty-changeset \
      --capabilities CAPABILITY_IAM --parameter-overrides "CertificateArn=$arn" "OriginVerify=$(cat "$VERIFY_FILE")" "InlineScriptHashes=$hashes"
    echo "Distribution: $(output SiteDomain) · bucket: $(output BucketName) · waitlist: $(output WaitlistFunction)"
    ;;
  secrets)
    [ -s "$HOME/.resend-sending-key" ] || { echo "Put the Resend send-only key in ~/.resend-sending-key first." >&2; exit 1; }
    grep -q '^re_' "$HOME/.resend-sending-key" || echo "(~/.resend-sending-key doesn't start with re_: is it a Resend key?)" >&2
    arn="$(output WaitlistSecretArn)"; tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
    (umask 077; aws secretsmanager get-secret-value --secret-id "$arn" --query SecretString --output text > "$tmp/cur.json")
    (umask 077; node -e "const fs=require('fs');const cur=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(!cur.signing)throw new Error('the secret has no signing value');fs.writeFileSync(process.argv[2],JSON.stringify({resend:fs.readFileSync(process.argv[3],'utf8').trim(),signing:cur.signing}))" "$tmp/cur.json" "$tmp/new.json" "$HOME/.resend-sending-key")
    aws secretsmanager put-secret-value --secret-id "$arn" --secret-string "file://$tmp/new.json" >/dev/null
    echo "The waitlist's secret has the Resend key (and keeps its signing secret)."
    ;;
  api)
    node --test api/test/*.test.mjs >/dev/null || { echo "The waitlist's tests fail: not uploading." >&2; exit 1; }
    fn="$(output WaitlistFunction)"; tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
    cp api/waitlist.mjs "$tmp/index.mjs"; (cd "$tmp" && zip -q waitlist.zip index.mjs)
    aws lambda update-function-code --function-name "$fn" --zip-file "fileb://$tmp/waitlist.zip" --query 'LastUpdateStatus' --output text
    aws lambda wait function-updated-v2 --function-name "$fn" && echo "The waitlist's code is live ($fn)."
    ;;
  publish)
    build
    node infra/csp.mjs check dist "$(param InlineScriptHashes)" \
      || { echo "Run infra/deploy.sh stack first (it puts this build's inline-script hashes in the CSP), then publish." >&2; exit 1; }
    b="$(output BucketName)"; id="$(output DistributionId)"
    hashed=(--size-only --cache-control 'public,max-age=31536000,immutable' --only-show-errors)
    # 1 · the hashed files (assets/): only the new ones, a year, immutable; the types set by hand where it matters
    typed=(); for t in $TYPES; do typed+=(--exclude "*.${t%%=*}"); done
    aws s3 sync dist/assets/ "s3://$b/assets/" "${typed[@]}" "${hashed[@]}"
    for t in $TYPES; do
      compgen -G "dist/assets/*.${t%%=*}" >/dev/null || continue
      aws s3 sync dist/assets/ "s3://$b/assets/" --exclude '*' --include "*.${t%%=*}" --content-type "${t#*=}" "${hashed[@]}"
    done
    # 2 · everything else (the pages, robots.txt, the sitemap, the favicons, the social images, brand/): revalidated
    aws s3 sync dist/ "s3://$b/" --exclude 'assets/*' --delete --cache-control 'public,max-age=0,must-revalidate' --only-show-errors
    aws cloudfront create-invalidation --distribution-id "$id" --paths '/*' --query 'Invalidation.Id' --output text
    # 3 · then the hashed files no page asks for any more
    aws s3 sync dist/assets/ "s3://$b/assets/" --delete --size-only --only-show-errors
    echo "Published to https://$HOST"
    ;;
  dns)
    d="$(output SiteDomain)"; z="$(zone)"
    upsert "$z" "$HOST" CNAME "$d"
    ;;
  smoke)
    base="${BASE:-https://$HOST}"; fails=0
    code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
    want() { if [ "$1" = "$3" ]; then printf '  ok   %s %s\n' "$3" "$2"; else printf '  FAIL %s %s (want %s)\n' "$3" "$2" "$1"; fails=$((fails + 1)); fi; }
    for p in / /es/ /privacy/ /es/privacy/ /play/ /favicon.svg /favicon-32.png /apple-touch-icon.png /og-en.jpg /og-es.jpg /robots.txt /sitemap.xml /brand/wordmark.svg /brand/wordmark-email.png; do
      want 200 "$p" "$(code "$base$p")"
    done
    want 301 "/es" "$(code "$base/es")"
    want 404 "/nothing-here/" "$(code "$base/nothing-here/")"
    h="$(curl -sI "$base/")"
    for x in content-security-policy strict-transport-security x-content-type-options x-frame-options permissions-policy; do
      if grep -qi "^$x:" <<<"$h"; then printf '  ok   header %s\n' "$x"; else printf '  FAIL header %s is missing\n' "$x"; fails=$((fails + 1)); fi
    done
    want 400 "waitlist: not an email" "$(code -X POST "$base/api/waitlist" -H 'Content-Type: application/json' --data '{"email":"nope"}')"
    c="$(code -X POST "$base/api/waitlist" -H 'Content-Type: application/json' --data '{"email":"delivered@resend.dev","lang":"en","source":"smoke"}')"
    if [ "$c" = 200 ]; then want 200 "waitlist: Resend's test inbox (listed already)" "$c"; else want 201 "waitlist: Resend's test inbox" "$c"; fi
    want 410 "waitlist: a faded link" "$(code "$base/api/waitlist/confirm?t=x.y")"
    want 403 "the function URL without CloudFront" "$(code -X POST "$(output WaitlistFunctionUrl)api/waitlist" -H 'Content-Type: application/json' --data '{"email":"nope"}')"
    aws dynamodb delete-item --table-name "$(output WaitlistTable)" --key '{"pk":{"S":"e#delivered@resend.dev"}}' && echo "  --   the test address is off the list again"
    echo "  --   the log should say \"confirmation sent to d***@resend.dev\": aws logs tail /aws/lambda/$STACK-waitlist --since 10m"
    if [ "$fails" = 0 ]; then echo "Smoke: all good."; else echo "Smoke: $fails failed." >&2; exit 1; fi
    ;;
  status)
    aws cloudformation describe-stacks --stack-name "$STACK" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "no stack yet"
    [ -s "$CERT_FILE" ] && aws acm describe-certificate --certificate-arn "$(cat "$CERT_FILE")" --query 'Certificate.Status' --output text
    printf '%-20s %s\n' "DNS" "$(dig +short CNAME "$HOST" | head -1)"
    printf '%-20s %s\n' "$HOST" "$(curl -s -o /dev/null -w '%{http_code}' "https://$HOST/")"
    ;;
  *) sed -n '2,22p' "$0"; exit 1 ;;
esac
