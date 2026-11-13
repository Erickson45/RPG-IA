# Publicar o RPG IA numa VM (Vultr, Ubuntu)

Uma máquina virtual sua, com o jogo atrás do nginx, HTTPS, firewall, atualizações automáticas e backup
diário. Os scripts estão em `deploy/` e o resto é seguir os passos. A mesma VM serve depois para o modo
online: o nginx já deixa passar WebSocket.

> Não deu para rodar os scripts num Linux de verdade enquanto eram preparados. Na primeira instalação,
> acompanhe a saída: se algum passo falhar, o script para e mostra onde.

## 1. Criar a VM

Na Vultr: **Deploy New Server** →

- **Tipo:** Cloud Compute (Shared CPU).
- **Local:** São Paulo (mais rápido para jogadores no Brasil).
- **Sistema:** Ubuntu 24.04 LTS.
- **Plano:** 1 vCPU e 1 GB de RAM já dá conta (uns US$ 5 a 6/mês; confira o preço do dia). Com 2 GB
  sobra folga.
- **SSH Key:** recomendado. No Windows, se ainda não tem uma chave:

  ```powershell
  ssh-keygen -t ed25519
  Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
  ```

  Cole o conteúdo do `.pub` em "Add New" na Vultr.
- **Auto Backups:** opcional (uns 20% a mais), mas é o jeito mais simples de ter cópia **fora** da máquina.

Anote o **IP** da VM.

## 2. (Opcional) Domínio

Para ter HTTPS e um endereço bonito (ex.: `rpgia.com.br`):

1. Registre o domínio (no Registro.br, um `.com.br` sai uns R$ 40/ano).
2. Crie um registro **A** apontando para o IP da VM.
3. Espere alguns minutos até o domínio responder.

Sem domínio, o jogo funciona em `http://IP`, mas sem HTTPS.

**Grátis, sem comprar domínio:** o **DuckDNS** (https://www.duckdns.org) dá um nome como
`magiaia.duckdns.org`. Entre com Google ou GitHub, crie o nome e ponha o IP da VM em "current ip". Ele
funciona com o HTTPS do Let's Encrypt. É o que o jogo usa hoje: https://magiaia.duckdns.org

Com domínio, quem entra pelo IP é levado para o endereço com HTTPS.

**Atenção com o DuckDNS:** o DNS dele falha de vez em quando com o Let's Encrypt. A emissão funcionou, mas
ensaios de renovação (`certbot renew --dry-run`) deram "DNS problem: SERVFAIL". O certbot tenta renovar duas
vezes por dia nos 30 dias antes de vencer, então basta uma tentativa dar certo. Mas não é garantido, e o Let's
Encrypt não manda mais e-mail avisando que o certificado vai vencer.

O `endurecer.sh` compensa isso de dois jeitos:

- **Janela maior:** a renovação começa 45 dias antes de vencer (`renew_before_expiry`), em vez de 30, o que dá
  ~90 tentativas.
- **Aviso ao entrar por SSH:** mostra quantos dias faltam (`/etc/update-motd.d/99-rpgia-certificado`), com um
  alerta grande se faltar menos de 20.

- **Ensaio semanal automático:** todo domingo de manhã, o timer `rpgia-ensaio-certificado` roda
  `certbot renew --dry-run` e guarda o resultado em `/var/lib/rpgia/ensaio-certificado`. O aviso do SSH mostra o
  resultado:
  - ok;
  - adiado (limite de testes do Let's Encrypt);
  - falhou, com o motivo.

Para conferir à mão:

- **Ensaio da renovação:** rode `certbot renew --dry-run` de vez em quando.
- **Data de vencimento:** veja com `certbot certificates`.
- **Para não depender disso:** use um domínio próprio. Com ele, também dá para pôr a Cloudflare na frente
  e esconder o IP.

## 3. Montar e enviar o pacote

No Windows, na pasta do jogo:

```powershell
python empacotar.py
scp publicar\rpg-ia.zip root@IP_DA_VM:/root/
```

## 4. Instalar (um comando)

```powershell
ssh root@IP_DA_VM
```

Já dentro da VM:

```bash
apt-get update && apt-get install -y unzip
cd /root && unzip -q rpg-ia.zip
bash academia-zetsu/deploy/instalar.sh rpgia.com.br seu@email.com   # com domínio
# ou
bash academia-zetsu/deploy/instalar.sh                                # só pelo IP
```

Leva uns 3 a 5 minutos. No fim ele confere se o jogo respondeu. Abra `https://seu-dominio` ou
`http://IP_DA_VM`.

O que fica instalado:

| O quê | Onde |
|---|---|
| Jogo | `/opt/rpgia`, rodando como o usuário `rpgia` (nunca root) |
| Saves e banco | `/opt/rpgia/dados/academia.db` |
| Backups | `/opt/rpgia/dados/backups/`, todo dia às 4h, guardando 14 |
| Configurações | `/opt/rpgia/.env` |
| Serviço do jogo | `rpgia` (gunicorn: 3 processos, 4 linhas de execução cada) |
| nginx | entrega `static/` direto, passa o resto ao jogo e o `/salao` (WebSocket) ao Salão do multijogador |
| Segurança | firewall (só SSH, HTTP e HTTPS), fail2ban e atualizações automáticas de segurança |
| Memória de reserva | swap de 1 GB (`/swapfile`), se a VM não tiver |

**A VM de 1 vCPU e 1 GB dá conta?** Sim, para o lançamento.

- **Memória:** cada processo do jogo usa uns 45 MB (medido). Somando os 3 processos, o nginx e o Ubuntu,
  fica em torno de metade da RAM.
- **Capacidade:** o teste de carga fez ~150 pedidos/s numa máquina de 8 núcleos; com 1 vCPU, espere uma
  fração disso. Um jogador real faz um pedido a cada poucos segundos, então são bem mais de 100 pessoas
  jogando ao mesmo tempo (estimativa, não medida nesta VM).
- **Disco:** o save de um jogador tem uns 3 a 5 KB, mais até 300 registros de histórico; dezenas de
  milhares de jogadores cabem em 25 GB.
- **Tráfego:** o jogo baixa ~2 MB na primeira visita e depois fica em cache, então 1 TB/mês sobra.

Se um dia ficar lento, a Vultr deixa trocar para um plano maior ("Change Plan") sem reinstalar.

**Medido na VM de 1 vCPU / 1 GB (São Paulo):** 50 jogadores simulados, todos saindo do mesmo IP (como uma
escola), em ritmo de gente, fizeram 2.147 pedidos.

- **Tempo de resposta:** mediana de 209 ms, e 95% em até 276 ms (contando a viagem pela internet).
- **No servidor:** a carga média ficou em 0,09. Todos os pedidos que chegaram foram respondidos, sem erro.

## Reforço de segurança (`deploy/endurecer.sh`, o instalador já roda)

- **Limites no nginx:**
  - 60 pedidos/s por IP, com folga de 200 de uma vez, e 300 conexões por IP (uma escola inteira cabe);
  - quem passa recebe 429;
  - tempos curtos contra conexões lentas de propósito (slowloris);
  - robôs que procuram WordPress, `.php`, `.env` ou `.git` têm a conexão cortada na hora.
- **fail2ban:**
  - SSH: 4 erros em 10 min, banido por 1 h;
  - quem insiste no limite do nginx: banido por 30 min;
  - reincidentes: 3 banimentos num dia, uma semana de fora.
- **SSH:** só por chave (se já houver uma cadastrada), 3 tentativas por conexão, root só com chave.
- **Rede:** proteção contra SYN flood, pacotes falsificados e redirecionamentos.
- **Atualizações automáticas:** quando o kernel pede, a máquina reinicia às 5h30 e o jogo volta sozinho.
- **Cabeçalhos de segurança:** HSTS, nosniff e anti-iframe, e o nginx não mostra a versão.

**Os limites disso:** nada que roda dentro de uma VM de US$ 5 segura um DDoS grande de verdade, aquele que
lota o link da máquina. Para isso há dois caminhos:

- domínio próprio atrás da Cloudflare (grátis);
- a proteção DDoS paga da Vultr.

Os limites acima seguram robôs, varreduras e floods pequenos, que são o que um jogo pequeno costuma
receber.

## 5. (Opcional) IA de verdade

```bash
nano /opt/rpgia/.env          # ANTHROPIC_API_KEY=..., LIMITE_IA_POR_HORA=20
systemctl restart rpgia
```

Ponha também um teto de gasto no painel da Anthropic.

## 6. Atualizar o jogo

No Windows:

```powershell
python empacotar.py
scp publicar\rpg-ia.zip root@IP_DA_VM:/root/
ssh root@IP_DA_VM
```

Na VM:

```bash
cd /root && rm -rf academia-zetsu && unzip -q rpg-ia.zip && bash academia-zetsu/deploy/atualizar.sh
```

Ele faz backup do banco antes, troca o código, mantém saves e `.env` e reinicia o jogo em segundos.

## 7. Backup fora da máquina

Se a VM quebrar, os backups de dentro dela somem junto. Faça uma destas:

- **Auto Backups da Vultr** (o mais simples).
- **Baixar de vez em quando para o seu PC**, no PowerShell:

  ```powershell
  mkdir backups-rpgia -Force
  scp "root@IP_DA_VM:/opt/rpgia/dados/backups/*" .\backups-rpgia\
  ```

Para **restaurar**:

```bash
systemctl stop rpgia
cp /opt/rpgia/dados/backups/academia-AAAA-MM-DD.db /opt/rpgia/dados/academia.db
rm -f /opt/rpgia/dados/academia.db-wal /opt/rpgia/dados/academia.db-shm
chown rpgia:rpgia /opt/rpgia/dados/academia.db
systemctl start rpgia
```

## 8. Comandos do dia a dia

```bash
systemctl status rpgia                  # está rodando?
journalctl -u rpgia -n 100 --no-pager   # últimas linhas do log (erros aparecem aqui)
systemctl restart rpgia                 # reiniciar o jogo
systemctl list-timers rpgia-backup      # quando roda o próximo backup
ls -lh /opt/rpgia/dados/backups         # backups guardados
```

## 9. Trancar o SSH (depois de testar a chave)

Com a chave SSH funcionando (`ssh root@IP_DA_VM` entra sem pedir senha), desligue o login por senha:

```bash
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
```

Teste numa **segunda** janela que ainda consegue entrar antes de fechar a primeira.

## Custos

| Item | Valor |
|---|---|
| VM | US$ 5 a 6/mês (mais IOF do cartão) |
| Domínio | ~R$ 40/ano (opcional) |
| Auto Backups da Vultr | ~20% da VM (opcional) |

Tudo cabe nos R$ 50/mês.

## O Salão do multijogador

O multijogador (o lobby-castelo e os duelos) roda num serviço próprio, ao lado do gunicorn:
`rpgia-salao` (`salao.py`, um processo assíncrono que fala WebSocket, na porta 5051, só dentro da máquina).
O nginx passa o endereço `/salao` para ele (bloco de `deploy/nginx-rpgia-salao.conf`). Quem liga as duas
coisas é o `deploy/ligar-salao.sh`, chamado pelo `instalar.sh` e pelo `atualizar.sh`: ele instala o
serviço e põe o bloco no site do nginx (sem reescrever o que o certbot mudou), com cópia
`/etc/nginx/sites-available/rpgia.antes-do-salao` e volta automática se o `nginx -t` falhar.

Custo: uns 30 a 60 MB de memória (o serviço tem teto de 200 MB) e nenhum serviço novo de fora (sem Redis).
Comandos e moderação: item 9 do `COMANDOS.txt`.
