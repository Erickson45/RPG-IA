# RPG IA — Guia passo a passo

O **RPG IA (Academia Arcana de Elyndor)** é um RPG em pixel art que roda no navegador. Cada monstro é uma pergunta sobre Inteligência Artificial.

Este pacote traz o **código-fonte completo** do jogo:

- **conteúdo:** 1.014 perguntas, 42 monstros, 6 dungeons, 26 livros e a história inteira;
- **multijogador:** salão com chat, duelos, guildas e ranking;
- **operação:** os scripts para publicar na internet;
- **testes:** os testes automáticos.

Você pode jogar no seu PC, usar com uma turma ou publicar o seu próprio servidor.

---

## 1. Requisitos

- **Para jogar no PC:** Windows 10 ou 11. Qualquer PC dos últimos anos serve, porque o jogo é leve.
- **Para publicar:** os passos estão nos guias `PUBLICAR.md` e `PUBLICAR_VM.md`. Linux e macOS também funcionam, com Python 3.10 ou mais novo.
- **Opcional:** uma chave da API da Anthropic, para ligar o mestre Zetsu com IA de verdade (seção 4). Sem ela, o Zetsu funciona no **modo roteirizado**, de graça e offline.

## 2. Instalação (um clique)

1. Extraia o .zip numa pasta **sem acentos no caminho**, por exemplo `C:\RPG-IA`.
2. Dê dois cliques em **`instalar.bat`**.
   - Se o Windows mostrar "O Windows protegeu o computador", clique em **Mais informações → Executar assim mesmo**.
   - O instalador coloca o Python 3.12, se faltar, e as bibliotecas do jogo.
3. Espere aparecer **"Tudo pronto!"**.

## 3. Jogar

1. Dê dois cliques em **`iniciar.bat`**. O jogo abre no navegador, no endereço `localhost:5050`.
2. Mantenha a janela preta aberta enquanto joga. Fechar a janela desliga o jogo.
3. Crie o seu herói, escolha a vocação e siga o Zetsu.

**Onde ficam os saves:**

- O progresso fica salvo na pasta `dados`, no arquivo `academia.db`.
- Para começar do zero, feche o jogo e apague essa pasta.
- Para levar o progresso para outro PC, copie essa pasta.

**O multijogador (salão, chat, duelos):**

- Ele sobe junto com o jogo. No seu PC, ele serve para você testar com várias abas abertas.
- Para jogar com outras pessoas, publique o jogo na internet (seção 6).

## 4. Ligar a IA de verdade (opcional)

Sem chave, o Zetsu usa falas roteirizadas e as correções vêm do próprio jogo. Com uma chave da Anthropic, ele passa a:

- conversar de verdade com o jogador;
- dar a "segunda opinião" nas respostas abertas.

1. Crie uma conta em **console.anthropic.com**.
2. Coloque crédito; o uso é pago por uso.
3. Gere uma chave em **API Keys**.
4. Abra o arquivo `.env` da pasta do jogo no Bloco de Notas. Ele foi criado pelo instalador.
5. Apague o `#` do começo da linha `ANTHROPIC_API_KEY=` e cole a sua chave depois do `=`.
6. Feche e abra o jogo de novo.

**Para gastar menos:**

- **Modelo:** tire o `#` da linha `ZETSU_MODELO` e use um modelo mais barato. As opções estão explicadas no próprio `.env`.
- **Limite por jogador:** `LIMITE_IA_POR_HORA` controla quantos pedidos de IA cada jogador pode fazer por hora.

> A chave é sua e é secreta. Nunca compartilhe o arquivo `.env`.

## 5. Personalizar o conteúdo

Todo o conteúdo do jogo é texto, na pasta `conteudo`:

| Arquivo | O que tem |
|---|---|
| `perguntas_classes.json` | As perguntas das batalhas, por classe |
| `fases.json` | As missões e fases |
| `biblioteca.json` | Os livros da biblioteca |

Dá para trocar, corrigir ou acrescentar perguntas. Por exemplo, você pode adaptar o jogo para outro assunto ou para a matéria da sua turma.

1. Copie um item existente.
2. Mude o texto.
3. Mantenha o mesmo formato.

Faça uma cópia do arquivo antes de mexer: uma vírgula fora do lugar impede o jogo de abrir.

O `README.md` documenta o jogo inteiro: classes, combate, dungeons, chefões, economia, multijogador e arquitetura.

**Testes automáticos:** depois de mexer no código, rode os testes da pasta `testes`. Os comandos estão no README.

## 6. Publicar na internet

Para outras pessoas jogarem, há dois caminhos, cada um com um guia completo na pasta:

- **`PUBLICAR.md`, PythonAnywhere:**
  - é o mais simples;
  - dá para começar no plano gratuito;
  - não precisa mexer em servidor.
- **`PUBLICAR_VM.md`, servidor próprio (VM Linux):**
  - Nginx e Gunicorn;
  - HTTPS com Let's Encrypt;
  - multijogador em tempo real;
  - backup diário, fail2ban e firewall.
  - Os scripts prontos estão na pasta `deploy`.

## 7. Solução de problemas

| Problema | O que fazer |
|---|---|
| "winget não foi encontrado" | Instale o **Instalador de Aplicativo** pela Microsoft Store e rode o `instalar.bat` de novo. |
| A página não abre | A janela preta do `iniciar.bat` precisa estar aberta. Se ela fechou com erro, rode o `instalar.bat` de novo. |
| "Address already in use" / porta 5050 ocupada | Outro programa está usando a porta. Feche-o ou, no `iniciar.bat`, troque `5050` por outra porta. Para isso, acrescente a linha `set PORTA=5060` antes da linha do python e abra `localhost:5060` (a 5051 é usada pelo multijogador). |
| "o multijogador ficou desligado" | Falta uma biblioteca. Rode o `instalar.bat` de novo. |
| O Zetsu não usa a IA | Confira se a linha `ANTHROPIC_API_KEY=` está sem `#` no `.env` e se a conta da Anthropic tem crédito. Depois reinicie o jogo. |
| Quero zerar tudo | Feche o jogo e apague a pasta `dados`. |

---

Boa aventura em Elyndor!
