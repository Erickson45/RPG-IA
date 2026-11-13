# Publicar o RPG IA no PythonAnywhere

Guia para deixar o jogo online. Dá para começar no plano grátis (**Beginner**) e passar para o
**Developer** (US$ 10/mês, ou US$ 100/ano) quando for abrir para mais gente; o código não muda.

## 1. Montar o pacote

No seu computador, na pasta do jogo:

```bash
python empacotar.py
```

Isso gera `publicar/rpg-ia.zip` (uns 2 MB). Ficam de fora o ambiente virtual, os bancos e saves locais
(`dados/`), o `.env` (chave da IA), caches e as artes de divulgação.

## 2. Criar a conta e subir os arquivos

1. Crie a conta em https://www.pythonanywhere.com (o seu usuário vira o endereço:
   `https://<usuario>.pythonanywhere.com`).
2. Na aba **Files**, envie o `rpg-ia.zip` para `/home/<usuario>/`.
3. Abra um **Bash console** (aba **Consoles**) e rode:

```bash
cd ~
unzip -o rpg-ia.zip
cd academia-zetsu
python3.11 -m venv ~/.venvs/rpgia
~/.venvs/rpgia/bin/pip install -r requirements.txt
```

## 3. Criar o site

Na aba **Web**:

1. **Add a new web app** → **Manual configuration** → **Python 3.11**.
2. **Virtualenv**: `/home/<usuario>/.venvs/rpgia`
3. **WSGI configuration file** (link na mesma página): apague tudo e deixe só isto:

```python
import sys
sys.path.insert(0, "/home/<usuario>/academia-zetsu")
from wsgi import application
```

4. **Static files** (para o próprio PythonAnywhere entregar JS/CSS/imagens, bem mais rápido que o Flask):
   - URL: `/static/`
   - Directory: `/home/<usuario>/academia-zetsu/static`
5. Ligue **Force HTTPS**.
6. Clique em **Reload** e abra `https://<usuario>.pythonanywhere.com`.

O modo debug fica sempre desligado no site publicado (`wsgi.py`).

## 4. (Opcional) IA de verdade

O jogo funciona inteiro sem IA. Para ligar a "segunda opinião" do Zetsu:

```bash
cd ~/academia-zetsu
cp .env.example .env
nano .env   # coloque ANTHROPIC_API_KEY=... e, se quiser, LIMITE_IA_POR_HORA=20
```

Depois, **Reload** na aba Web.

- **Custo:** cada pedido gasta da sua conta da Anthropic. Por isso há um limite por jogador (IP) por hora.
  Ponha também um teto de gasto no painel da Anthropic.
- **Plano grátis:** o acesso à internet a partir do código é restrito, e a IA pode não funcionar. No
  Developer funciona.

## 5. Backup diário

Na aba **Tasks**, crie uma tarefa diária:

```bash
/home/<usuario>/.venvs/rpgia/bin/python /home/<usuario>/academia-zetsu/backup_banco.py
```

Ela copia o banco para `dados/backups/academia-AAAA-MM-DD.db` (com o jogo rodando) e guarda as 14 mais
novas. De vez em quando, baixe uma cópia para o seu computador pela aba Files.

## 6. Atualizar o jogo depois

1. `python empacotar.py` no seu computador.
2. Envie o zip novo para `/home/<usuario>/`.
3. No Bash: `cd ~ && unzip -o rpg-ia.zip` (os saves em `dados/` não são tocados).
4. **Reload** na aba Web.

Os endereços dos JS/CSS mudam sozinhos quando o arquivo muda (`?v=`), então ninguém fica com versão velha.

## Proteções que já estão no jogo

- **Banco SQLite em modo WAL:** leituras não esperam gravações, e quem chega enquanto outro grava espera a vez.
- **Trava por jogador entre processos** (`banco.trava_do_jogador`): duas ações do mesmo jogador ao mesmo
  tempo não se atropelam (importante no Developer, que tem 3 processos).
- **Limites:** 150 heróis novos por IP por hora (`LIMITE_CRIAR_POR_HORA`; folgado porque escolas e empresas
  saem pelo mesmo IP), opinião da IA limitada por hora e pedidos de no máximo 512 KB.
- **Faxina automática:** o histórico guarda os 300 registros mais novos de cada jogador, e as batalhas
  encerradas somem depois de 3 dias.
- **Privacidade:** a página `/privacidade` (LGPD) tem link na tela inicial. A lixeira do save apaga tudo do servidor.

## Plano grátis: lembretes

- **Renovação:** a cada 3 meses o PythonAnywhere pede para clicar em "Run until 3 months from today" na aba
  Web, senão o site é desligado.
- **Capacidade:** 1 processo atende todo mundo em fila. Dá para testes e grupos pequenos; para turmas
  grandes, passe para o Developer.

## Antes de abrir para muita gente

- Peça para alguém da área revisar uma amostra das perguntas do currículo (elas foram escritas com IA).
- Coloque 3 a 5 pessoas para jogar 30 minutos e observe onde travam.
