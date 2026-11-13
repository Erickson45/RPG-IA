#!/usr/bin/env bash
# Instala o RPG IA numa VM Ubuntu nova (testado para Ubuntu 22.04/24.04 LTS, ex.: Vultr em São Paulo).
#
# Uso, como root, na pasta onde o rpg-ia.zip foi descompactado:
#   bash academia-zetsu/deploy/instalar.sh                         # só pelo IP (http)
#   bash academia-zetsu/deploy/instalar.sh rpgia.com.br voce@email  # com domínio e HTTPS (Let's Encrypt)
#
# O que ele faz: atualiza o sistema; instala Python, nginx, certbot, firewall (ufw), fail2ban e as
# atualizações automáticas de segurança; cria o usuário "rpgia" (o jogo nunca roda como root); copia o
# jogo para /opt/rpgia (sem tocar nos saves nem no .env se já existirem); cria o ambiente Python; sobe o
# jogo com gunicorn como serviço (systemd) e o Salão do multijogador (salao.py, outro serviço); configura o
# nginx na frente (arquivos estáticos direto e o WebSocket do Salão em /salao); liga o backup diário e, com
# domínio, o HTTPS.
# Pode rodar de novo sem estragar nada.
set -euo pipefail

DOMINIO="${1:-}"
EMAIL="${2:-}"
ORIGEM="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP=/opt/rpgia
USUARIO=rpgia

if [[ $EUID -ne 0 ]]; then
  echo "Rode como root (sudo bash $0 ...)." >&2
  exit 1
fi
if [[ -n "$DOMINIO" && -z "$EMAIL" ]]; then
  echo "Com domínio, informe também um e-mail (o Let's Encrypt avisa por ele quando o certificado vai vencer)." >&2
  exit 1
fi

echo "==> 1/8 Atualizando o sistema e instalando os pacotes"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y python3 python3-venv python3-pip nginx certbot python3-certbot-nginx ufw fail2ban \
  unattended-upgrades sqlite3 rsync unzip

echo "==> 2/8 Atualizações automáticas de segurança e memória de reserva (swap)"
dpkg-reconfigure -f noninteractive unattended-upgrades
# VM pequena (1 GB): 1 GB de swap segura um pico de memória (fica mais lento em vez de derrubar o jogo)
if ! swapon --show | grep -q .; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-rpgia-swap.conf
fi

echo "==> 3/8 Usuário do jogo e arquivos em $APP"
id "$USUARIO" >/dev/null 2>&1 || useradd --system --create-home --home-dir "/home/$USUARIO" --shell /usr/sbin/nologin "$USUARIO"
mkdir -p "$APP"
# dados/ (banco, backups, travas) e .env do servidor nunca são sobrescritos
rsync -a --delete --exclude 'dados/' --exclude '.env' --exclude '.venv/' --exclude '__pycache__/' "$ORIGEM/" "$APP/"
mkdir -p "$APP/dados/backups"
if [[ ! -f "$APP/.env" ]]; then
  cp "$APP/.env.example" "$APP/.env"
fi
chown -R "$USUARIO:$USUARIO" "$APP"
chmod 600 "$APP/.env"
# o banco e os backups só o usuário do jogo lê (o nginx só precisa de static/)
chmod 750 "$APP/dados"

echo "==> 4/8 Ambiente Python"
sudo -u "$USUARIO" python3 -m venv "$APP/.venv"
sudo -u "$USUARIO" "$APP/.venv/bin/pip" install --upgrade pip
sudo -u "$USUARIO" "$APP/.venv/bin/pip" install -r "$APP/requirements.txt" gunicorn

echo "==> 5/8 Serviço do jogo (gunicorn)"
install -m 644 "$APP/deploy/rpgia.service" /etc/systemd/system/rpgia.service
install -m 644 "$APP/deploy/rpgia-backup.service" /etc/systemd/system/rpgia-backup.service
install -m 644 "$APP/deploy/rpgia-backup.timer" /etc/systemd/system/rpgia-backup.timer
systemctl daemon-reload
systemctl enable --now rpgia.service
systemctl enable --now rpgia-backup.timer
systemctl restart rpgia.service

echo "==> 6/8 nginx na frente do jogo"
NOME_SERVIDOR="${DOMINIO:-_}"
# as zonas de limite por IP (nível http) vêm antes do site, que as usa
install -m 644 "$APP/deploy/nginx-rpgia-limites.conf" /etc/nginx/conf.d/rpgia-limites.conf
sed "s/__DOMINIO__/$NOME_SERVIDOR/" "$APP/deploy/nginx-rpgia.conf" > /etc/nginx/sites-available/rpgia
ln -sf /etc/nginx/sites-available/rpgia /etc/nginx/sites-enabled/rpgia
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# o Salão do multijogador (salao.py) e a passagem /salao no nginx
bash "$APP/deploy/ligar-salao.sh"

echo "==> 7/8 Firewall (só SSH, HTTP e HTTPS) e fail2ban (bloqueia quem erra a senha do SSH)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
systemctl enable --now fail2ban

echo "==> 8/8 HTTPS"
if [[ -n "$DOMINIO" ]]; then
  # --keep-until-expiring: rodando de novo, reaproveita o certificado que já existe
  certbot --nginx --non-interactive --agree-tos -m "$EMAIL" -d "$DOMINIO" --redirect --keep-until-expiring
  # o certbot responde 404 para quem chega pelo IP (ou outro nome): melhor mandar para o jogo
  sed -i "s|return 404; # managed by Certbot|return 301 https://$DOMINIO\$request_uri; # IP e outros nomes vão para o jogo|" /etc/nginx/sites-available/rpgia
  nginx -t && systemctl reload nginx
else
  echo "Sem domínio: o jogo fica só em http://IP. Para HTTPS, aponte um domínio para este IP e rode de novo:"
  echo "  bash $APP/deploy/instalar.sh seu-dominio.com.br voce@email"
fi

echo "==> Reforço de segurança (limites, fail2ban, SSH, rede, reinício automático)"
bash "$APP/deploy/endurecer.sh"

echo
echo "Pronto! Conferindo:"
sleep 2
systemctl --no-pager --lines=0 status rpgia.service || true
# o jogo direto (gunicorn) e, por fora, pelo nginx no endereço público
curl -fsS -o /dev/null -w "Jogo respondendo: HTTP %{http_code}\n" http://127.0.0.1:8000/ || echo "O jogo ainda não respondeu: veja 'journalctl -u rpgia -n 50'."
if [[ -n "$DOMINIO" ]]; then
  curl -fsS -o /dev/null -w "Pelo endereço público (https://$DOMINIO): HTTP %{http_code}\n" "https://$DOMINIO/" || echo "O endereço público ainda não respondeu (DNS ou certificado): confira 'nginx -t'."
fi
