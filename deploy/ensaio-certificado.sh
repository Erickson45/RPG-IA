#!/usr/bin/env bash
# Ensaio automático da renovação do certificado HTTPS (vai para /usr/local/sbin/rpgia-ensaio-certificado e roda
# toda semana pelo timer rpgia-ensaio-certificado). Simula a renovação no ambiente de testes do Let's Encrypt
# (não troca o certificado) e guarda o resultado; o aviso do SSH (99-rpgia-certificado) mostra ao entrar.
# A renovação de verdade continua por conta do certbot.timer, duas vezes por dia.
set -uo pipefail

PASTA=/var/lib/rpgia
mkdir -p "$PASTA"
SAIDA="$(certbot renew --dry-run 2>&1)"
QUANDO="$(date '+%d/%m/%Y %H:%M')"

if grep -qi "simulated renewals succeeded" <<<"$SAIDA"; then
  printf 'ok\n%s\n' "$QUANDO" > "$PASTA/ensaio-certificado"
  logger -t rpgia-certificado "ensaio de renovação: ok"
  exit 0
fi

# o motivo em uma linha (DNS do DuckDNS, limite de testes do Let's Encrypt, nginx...)
MOTIVO="$(grep -iE 'Detail:|error:|rateLimited|SERVFAIL' <<<"$SAIDA" | head -n 1 | sed 's/^ *//' | cut -c1-140)"
if grep -qi 'rateLimited' <<<"$SAIDA"; then
  STATUS=adiado  # limite de testes do Let's Encrypt: não é problema da configuração, tenta na próxima semana
else
  STATUS=falhou
fi
printf '%s\n%s\n%s\n' "$STATUS" "$QUANDO" "${MOTIVO:-sem detalhe (veja /var/log/letsencrypt/letsencrypt.log)}" > "$PASTA/ensaio-certificado"
logger -t rpgia-certificado "ensaio de renovação: $STATUS: ${MOTIVO:-}"
exit 0
