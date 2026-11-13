#!/usr/bin/env bash
# Atualiza o RPG IA já instalado na VM com um pacote novo (rpg-ia.zip), sem tocar nos saves nem no .env.
#
# Uso, como root, depois de enviar o zip novo para /root:
#   cd /root && rm -rf academia-zetsu && unzip -q rpg-ia.zip && bash academia-zetsu/deploy/atualizar.sh
#
# Faz um backup do banco antes, copia o código novo, atualiza as dependências e reinicia o jogo sem derrubar
# quem está jogando por mais que alguns segundos.
set -euo pipefail

ORIGEM="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP=/opt/rpgia
USUARIO=rpgia

if [[ $EUID -ne 0 ]]; then
  echo "Rode como root (sudo bash $0)." >&2
  exit 1
fi
if [[ ! -d "$APP/.venv" ]]; then
  echo "O jogo ainda não foi instalado nesta máquina: use deploy/instalar.sh." >&2
  exit 1
fi

echo "==> Backup do banco antes de atualizar"
systemctl start rpgia-backup.service || echo "(backup não rodou; seguindo)"

echo "==> Copiando o código novo (dados/ e .env ficam como estão)"
rsync -a --delete --exclude 'dados/' --exclude '.env' --exclude '.venv/' --exclude '__pycache__/' "$ORIGEM/" "$APP/"
chown -R "$USUARIO:$USUARIO" "$APP"
chmod 600 "$APP/.env"
chmod 750 "$APP/dados"

echo "==> Dependências"
sudo -u "$USUARIO" "$APP/.venv/bin/pip" install -q -r "$APP/requirements.txt" gunicorn

echo "==> Serviços"
install -m 644 "$APP/deploy/rpgia.service" /etc/systemd/system/rpgia.service
install -m 644 "$APP/deploy/rpgia-backup.service" /etc/systemd/system/rpgia-backup.service
install -m 644 "$APP/deploy/rpgia-backup.timer" /etc/systemd/system/rpgia-backup.timer
systemctl daemon-reload
systemctl restart rpgia.service
# o Salão do multijogador (serviço próprio e a passagem /salao no nginx); quem está no lobby reconecta sozinho
bash "$APP/deploy/ligar-salao.sh"

echo "==> Cola de comandos (~/COMANDOS.txt, abre com 'ajuda')"
install -m 644 "$APP/COMANDOS.txt" /root/COMANDOS.txt
grep -q "alias ajuda=" /root/.bashrc || echo "alias ajuda='less -R ~/COMANDOS.txt'" >> /root/.bashrc
printf '#!/bin/sh\necho "  RPG IA: comandos úteis com: ajuda"\n' > /etc/update-motd.d/98-rpgia-comandos
chmod 755 /etc/update-motd.d/98-rpgia-comandos

sleep 2
curl -fsS -o /dev/null -w "Jogo respondendo: HTTP %{http_code}\n" http://127.0.0.1:8000/ || echo "O jogo não respondeu: veja 'journalctl -u rpgia -n 50'."
