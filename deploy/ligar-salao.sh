#!/usr/bin/env bash
# Liga o Salão do multijogador no servidor: o serviço rpgia-salao (salao.py) e a passagem /salao no nginx.
# Chamado pelo instalar.sh e pelo atualizar.sh; pode rodar de novo sem estragar nada.
#
# O site do nginx (/etc/nginx/sites-available/rpgia) foi mexido pelo certbot (o HTTPS), então ele não é
# reescrito: o bloco de deploy/nginx-rpgia-salao.conf entra antes do primeiro "location /" se ainda não
# estiver lá. Se o nginx -t reclamar, a cópia de antes volta e nada muda.
set -euo pipefail

APP=/opt/rpgia
SITE=/etc/nginx/sites-available/rpgia

echo "==> Salão do multijogador (serviço rpgia-salao)"
install -m 644 "$APP/deploy/rpgia-salao.service" /etc/systemd/system/rpgia-salao.service
systemctl daemon-reload
systemctl enable rpgia-salao.service >/dev/null
systemctl restart rpgia-salao.service

if [[ -f "$SITE" ]] && ! grep -q "location = /salao" "$SITE"; then
  echo "==> nginx: passagem /salao para o Salão"
  cp "$SITE" "$SITE.antes-do-salao"
  python3 - "$SITE" "$APP/deploy/nginx-rpgia-salao.conf" <<'PY'
import sys
site, bloco = sys.argv[1], open(sys.argv[2], encoding="utf-8").read()
linhas = open(site, encoding="utf-8").read().split("\n")
saida, feitos = [], 0
for linha in linhas:
    # em cada server que passa o jogo para o gunicorn (o do HTTPS e, sem domínio, o do HTTP)
    if linha.strip() == "location / {":
        saida.extend(bloco.rstrip("\n").split("\n"))
        saida.append("")
        feitos += 1
    saida.append(linha)
open(site, "w", encoding="utf-8").write("\n".join(saida))
print(f"   bloco /salao posto em {feitos} server(s)")
PY
  if nginx -t; then
    systemctl reload nginx
  else
    echo "!! nginx -t falhou: voltando a configuração de antes (o Salão fica sem passagem pelo nginx)." >&2
    cp "$SITE.antes-do-salao" "$SITE"
    nginx -t && systemctl reload nginx
  fi
fi

sleep 1
if systemctl is-active --quiet rpgia-salao.service; then
  echo "Salão no ar (porta 5051, só na máquina; de fora, pelo /salao do nginx)."
else
  echo "O Salão não subiu: veja 'journalctl -u rpgia-salao -n 50'."
fi
