#!/usr/bin/env bash
# Reforço de segurança do servidor do RPG IA (o instalar.sh chama no fim; pode rodar sozinho também).
#
#   bash /opt/rpgia/deploy/endurecer.sh
#
# - nginx: limite de pedidos e de conexões por IP (folgado: uma escola inteira sai pelo mesmo IP), tempos
#   curtos contra conexões "lentas de propósito" (slowloris) e corte seco de robôs que procuram WordPress,
#   .env, .git, phpMyAdmin...
# - fail2ban: bane por um tempo quem insiste no limite do nginx ou erra o SSH, e por uma semana quem volta
# - SSH: só por chave (se já houver uma chave cadastrada), menos tentativas por conexão
# - rede do kernel: proteção contra SYN flood, pacotes falsificados e redirecionamentos
# - atualizações automáticas reiniciam a máquina às 5h30 quando o kernel pede (o jogo volta sozinho)
#
# Não protege contra um DDoS grande de verdade (que lota o link da máquina): para isso é preciso um domínio
# próprio atrás da Cloudflare, ou a proteção paga da Vultr.
set -euo pipefail

APP=/opt/rpgia
if [[ $EUID -ne 0 ]]; then
  echo "Rode como root (sudo bash $0)." >&2
  exit 1
fi

echo "==> Reforço 1/5: limites do nginx"
install -m 644 "$APP/deploy/nginx-rpgia-limites.conf" /etc/nginx/conf.d/rpgia-limites.conf
nginx -t
systemctl reload nginx

echo "==> Reforço 2/5: fail2ban (SSH, abuso do limite do nginx e reincidentes)"
install -m 644 "$APP/deploy/fail2ban-rpgia.local" /etc/fail2ban/jail.d/rpgia.local
systemctl restart fail2ban

echo "==> Reforço 3/5: SSH"
CHAVES=/root/.ssh/authorized_keys
{
  echo "# RPG IA: reforço do SSH (00- para valer antes dos outros arquivos desta pasta)"
  echo "MaxAuthTries 3"
  echo "LoginGraceTime 20"
  echo "X11Forwarding no"
  echo "PermitRootLogin prohibit-password"
  # sem chave cadastrada, desligar a senha trancaria o dono do lado de fora
  if [[ -s "$CHAVES" ]]; then
    echo "PasswordAuthentication no"
    echo "KbdInteractiveAuthentication no"
  fi
} > /etc/ssh/sshd_config.d/00-rpgia.conf
if [[ ! -s "$CHAVES" ]]; then
  echo "   (sem chave SSH em $CHAVES: o login por senha continua ligado)"
fi
sshd -t
systemctl reload ssh || systemctl reload sshd

echo "==> Reforço 4/5: rede do kernel"
cat > /etc/sysctl.d/99-rpgia-rede.conf <<'FIM'
# RPG IA: proteção básica da rede
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
FIM
# (o accept_source_route já vem desligado nas VMs e algumas recusam regravar; avisos de outras chaves que
# não são nossas não param o script)
sysctl --system >/dev/null 2>&1 || true

echo "==> Reforço 5/5: reinício automático depois de atualização do kernel (5h30)"
cat > /etc/apt/apt.conf.d/52rpgia-reinicio <<'FIM'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "05:30";
FIM

echo "==> Certificado: renovação começa 45 dias antes e aviso de validade ao entrar por SSH"
# DNS gratuitos (como o DuckDNS) às vezes falham com o Let's Encrypt: começar antes dá ~90 tentativas
# (o certbot tenta 2 vezes por dia) em vez de ~60
for renovacao in /etc/letsencrypt/renewal/*.conf; do
  [[ -e "$renovacao" ]] || continue
  grep -q '^renew_before_expiry' "$renovacao" || sed -i '1i renew_before_expiry = 45 days' "$renovacao"
done
install -m 755 "$APP/deploy/aviso-certificado.sh" /etc/update-motd.d/99-rpgia-certificado
# ensaio semanal automático da renovação (domingo de manhã); o resultado aparece no aviso acima
install -m 755 "$APP/deploy/ensaio-certificado.sh" /usr/local/sbin/rpgia-ensaio-certificado
install -m 644 "$APP/deploy/rpgia-ensaio-certificado.service" /etc/systemd/system/rpgia-ensaio-certificado.service
install -m 644 "$APP/deploy/rpgia-ensaio-certificado.timer" /etc/systemd/system/rpgia-ensaio-certificado.timer
systemctl daemon-reload
systemctl enable --now rpgia-ensaio-certificado.timer

# o fail2ban leva uns segundos para subir depois do restart: espera antes de perguntar
for _ in $(seq 1 20); do
  fail2ban-client ping >/dev/null 2>&1 && break
  sleep 1
done
echo "Reforço aplicado. fail2ban vigiando:"
fail2ban-client status 2>/dev/null | sed -n 's/.*Jail list://p' || echo "   (fail2ban ainda subindo; confira com 'fail2ban-client status')"
