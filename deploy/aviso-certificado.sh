#!/usr/bin/env bash
# Mensagem ao entrar por SSH (vai para /etc/update-motd.d/99-rpgia-certificado): quantos dias faltam para o
# certificado HTTPS do jogo vencer, o resultado do último ensaio semanal de renovação (rpgia-ensaio-certificado)
# e um alerta grande se algo precisar de atenção. (O Let's Encrypt não manda mais e-mail avisando; e o DNS do
# DuckDNS às vezes falha na renovação.)
for cert in /etc/letsencrypt/live/*/cert.pem; do
  [[ -e "$cert" ]] || exit 0
  dominio="$(basename "$(dirname "$cert")")"
  fim="$(openssl x509 -enddate -noout -in "$cert" 2>/dev/null | cut -d= -f2)"
  [[ -n "$fim" ]] || continue
  dias=$(( ( $(date -d "$fim" +%s) - $(date +%s) ) / 86400 ))
  if (( dias < 20 )); then
    echo
    echo "  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    echo "  !!  RPG IA: o certificado HTTPS de $dominio vence em $dias dia(s)"
    echo "  !!  A renovação automática não conseguiu. Tente agora:"
    echo "  !!      certbot renew"
    echo "  !!  Se der 'DNS problem: SERVFAIL', é instabilidade do DuckDNS:"
    echo "  !!  tente de novo mais tarde (ou use um domínio próprio)."
    echo "  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    echo
  else
    echo "  RPG IA: certificado HTTPS de $dominio ok, vence em $dias dias."
  fi
done

# o último ensaio semanal da renovação
ENSAIO=/var/lib/rpgia/ensaio-certificado
if [[ -r "$ENSAIO" ]]; then
  status="$(sed -n 1p "$ENSAIO")"
  quando="$(sed -n 2p "$ENSAIO")"
  motivo="$(sed -n 3p "$ENSAIO")"
  case "$status" in
    ok) echo "  RPG IA: último ensaio de renovação ok ($quando)." ;;
    adiado) echo "  RPG IA: último ensaio de renovação adiado ($quando): limite de testes do Let's Encrypt, tenta de novo no domingo." ;;
    *)
      echo
      echo "  !!  RPG IA: o último ensaio de renovação FALHOU ($quando)"
      echo "  !!  $motivo"
      echo "  !!  Se for SERVFAIL, é o DuckDNS instável: o próximo ensaio é no domingo."
      echo "  !!  Se repetir por semanas, rode 'certbot renew --dry-run' e veja o motivo."
      echo
      ;;
  esac
else
  echo "  RPG IA: o primeiro ensaio automático de renovação roda no próximo domingo de manhã."
fi
