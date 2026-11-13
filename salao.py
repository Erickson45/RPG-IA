"""O Salão: o servidor de tempo real do multijogador (o lobby-castelo e a arena de duelos).

Por que um processo à parte: o jogo roda no gunicorn com 3 processos de 4 linhas de execução, e cada
WebSocket prenderia uma delas o tempo todo. O Salão é um processo só, assíncrono (pacote websockets): ele
aguenta centenas de conexões com pouca memória e guarda todo o estado do lobby (quem está onde, os duelos)
na própria memória, sem precisar dividir nada entre processos. O que precisa durar (os recados do Quadro de
Anotações, as denúncias, o placar dos duelos) vai para o mesmo SQLite do jogo (banco.py).

Quem decide tudo é o servidor, como no resto do jogo: as perguntas dos duelos são sorteadas e corrigidas
aqui (as respostas certas nunca vão para o navegador antes da hora), e o texto que os jogadores escrevem
passa pelo filtro de moderacao.py.

O id do jogador (o uuid do save) é a chave dele: nunca é mandado para os outros. No salão cada conexão
ganha um número curto (sid), e é por ele que os navegadores se conhecem.

Rodar sozinho:  python salao.py            (porta SALAO_PORTA, 5051 por padrão; SALAO_HOST, 127.0.0.1)
No computador, o python app.py já sobe o Salão junto (numa linha de execução própria).

Protocolo (JSON, campo "t" é o tipo):
  navegador → salão: entrar, mover, gesto, falar, denunciar_jogador, recado, apagar_recado, denunciar_recado,
                     ranking, desafiar, responder_convite, cancelar_convite, duelo_perguntas, duelo_responder,
                     duelo_desistir, denunciar_perguntas
  salão → navegador: ola, entrou, saiu, pos, gesto, fala, perfil, aviso, erro, mural, recado_novo, recado_fora,
                     ranking, convite, convite_fim, arena, anuncio, duelo_inicio, duelo_preparo,
                     duelo_pergunta, duelo_respondeu, duelo_resultado, duelo_fim
"""

import asyncio
import hashlib
import json
import os
import random
import re
import time
import uuid
from collections import deque
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

import banco  # noqa: E402
import habilidades  # noqa: E402
import moderacao  # noqa: E402
import progressao  # noqa: E402
from conteudo import MONSTROS, com_tempo, como_verdadeiro_ou_falso, corrigir_pergunta, sortear_pergunta  # noqa: E402

PORTA = int(os.environ.get("SALAO_PORTA", "5051"))
HOST = os.environ.get("SALAO_HOST", "127.0.0.1")

# o mapa do lobby (igual ao SALAO_MAPA do lobby.js): 84 x 96 tiles de 16 unidades
TILE = 16
LARGURA, ALTURA = 84 * TILE, 96 * TILE

# ---------- as Casas ----------
# Três Casas fixas (como guildas): cada herói escolhe uma ao entrar no Salão pela primeira vez e pode trocar a
# cada 7 dias. Tudo o que ele faz no Salão soma pontos para a casa dele na Taça das Casas da semana.
CASAS = {
    # (os ids "runa", "aco" e "flecha" ficaram dos nomes antigos: mudar quebraria os saves e o placar)
    "runa": {"nome": "Ordem da Lua Partida", "icone": "🌙", "cor": "#6c48c9", "manto": "manto-casa-runa",
             "lema": "Na noite mais escura, a pergunta acende a luz.",
             "texto": "Guardam os cacos do Oráculo desde a Grande Ruptura. Pensam devagar, erram pouco e nunca aceitam uma resposta sem entender o porquê."},
    "aco": {"nome": "Legião da Fênix Rubra", "icone": "🔥", "cor": "#b8322a", "manto": "manto-casa-aco",
            "lema": "Cair, aprender, renascer.",
            "texto": "Nasceram das cinzas da Ruptura. Encaram cada desafio de frente: cada erro vira brasa, e cada brasa vira fogo."},
    "flecha": {"nome": "Clã do Lobo de Jade", "icone": "🐺", "cor": "#2f8a3a", "manto": "manto-casa-flecha",
               "lema": "Quem caça a resposta não caça sozinho.",
               "texto": "Caçadores das florestas de Elyndor. Leem cada rastro antes de soltar a flecha, e o clã inteiro divide a caça."},
}
DIAS_PARA_TROCAR_DE_CASA = 7
PONTOS_DA_CASA = {"duelo_vitoria": 10, "duelo": 3, "fenda": 15, "dragao": 5}
# os prêmios de XP e moedas do Salão têm teto por dia (o resto do prêmio são visuais e glória): assim ninguém
# sobe de nível "farmando" com os amigos, e o Um Jogador continua sendo o caminho principal
LIMITE_DIARIO = {"xp": 400, "moedas": 200}

# ---------- os eventos ----------
MINUTOS_ENTRE_DRAGOES = float(os.environ.get("SALAO_DRAGAO_MIN", "12"))
SEGUNDOS_DA_PERGUNTA_DO_DRAGAO = 25
SEGUNDOS_PARA_REUNIR_A_FENDA = 45
SEGUNDOS_DA_PERGUNTA_DA_FENDA = 25
CHEFES_DA_FENDA = ["reiSlime", "fenrir", "sapoRei", "escorpiaoImperador", "ignis", "colossoMagma", "rainhaCristal", "leviata", "ymir", "nyxar", "vazio"]
# nos testes (SALAO_TESTES=1) dá para disparar os eventos na hora, sem esperar o relógio
MODO_DE_TESTE = os.environ.get("SALAO_TESTES") == "1"
# o palanque: quem fala de cima dele é ouvido no salão inteiro (tiles, igual ao lobby.js)
PALANQUE = (30 * TILE, 8 * TILE, 42 * TILE, 13 * TILE)
RAIO_DA_FALA = 260  # unidades do mundo: quem está mais longe não vê o balão
DIRECOES = {"baixo", "cima", "esq", "dir"}
GESTOS = {"acenar", "dancar", "pular", "reverencia", "comemorar", "rir", "coracao", "descansar"}
CORES_RECADO = {"amarelo", "rosa", "azul", "verde", "lilas"}

MAXIMO_CONEXOES = int(os.environ.get("SALAO_MAXIMO", "300"))
# uma escola inteira sai pelo mesmo IP: folgado de propósito
MAXIMO_POR_IP = int(os.environ.get("SALAO_POR_IP", "80"))
# as posições saem 20 vezes por segundo (só de quem se mexeu): cada navegador manda as dele 10 vezes por
# segundo, e com o pacote a cada 50 ms elas chegam aos outros sem se amontoar (o movimento fica mais liso)
TICK = 0.05
# cada conexão pode mandar até 20 mensagens por segundo (com folga de 40 de uma vez); bem acima disso, cai
FICHAS_POR_SEGUNDO, FICHAS_MAXIMAS, FICHAS_PARA_DERRUBAR = 20, 40, -200

ESPERA_FALA = 1.2  # segundos entre duas falas
ESPERA_RECADO = 60  # segundos entre dois recados
RECADOS_POR_JOGADOR = 3  # recados ao mesmo tempo no quadro
DENUNCIAS_PARA_ESCONDER = 3  # pessoas diferentes denunciando um recado: ele some
DENUNCIAS_PARA_SILENCIAR = 3  # pessoas diferentes denunciando um jogador em 24 h: fica sem falar
MINUTOS_SILENCIADO = 30

# ---------- os duelos ----------
MODOS = {
    "x1": {"nome": "X1 de perguntas", "rodadas": (5, 10, 20)},
    "queda": {"nome": "Até um cair", "rodadas": (0,)},
    "autoral": {"nome": "Perguntas dos jogadores", "rodadas": (3, 5)},
}
VIDAS_NA_QUEDA = 3
RODADAS_MAXIMAS_NA_QUEDA = 40
RODADAS_POR_MONSTRO = 3
# a torre de monstros do "até um cair": cada um faz 3 perguntas, cada vez mais difíceis
TORRE_DE_MONSTROS = ["slimeVerde", "morcego", "slimeRoxo", "lobo", "sapo", "assombracao", "esqueleto", "escorpiao", "loboNeve", "dragao", "ignis"]
LIMITE_AUTORAL = 30  # segundos para responder a pergunta do outro
LIMITE_MAXIMO = 30  # nenhuma pergunta do duelo dá mais que isso
PAUSA_DO_RESULTADO = 4.0
CONTAGEM_INICIAL = 3.5
MINUTOS_PARA_ESCREVER = 6
SEGUNDOS_DO_CONVITE = 30
PONTOS_ACERTO, PONTOS_RAPIDEZ = 100, 50


def agora():
    return time.monotonic()


def assinatura(jogador_id):
    """Um apelido curto e fixo do jogador, que não revela o id (marca "este recado é teu")."""
    return hashlib.sha1(f"salao:{jogador_id}".encode()).hexdigest()[:10]


def avatar_seguro(avatar):
    """Só as escolhas de visual, com nomes e valores simples (o desenho é feito no navegador dos outros)."""
    if not isinstance(avatar, dict):
        return {}
    seguro = {}
    for chave, valor in list(avatar.items())[:40]:
        if isinstance(chave, str) and re.fullmatch(r"[a-zA-Z]{1,24}", chave) and isinstance(valor, str) and re.fullmatch(r"[#\w-]{1,32}", valor):
            seguro[chave] = valor
    return seguro


def identidade(progresso):
    """O título do herói (o mesmo selo que aparece em cima dele no jogo): ícone, título, cor e raridade."""
    principal = habilidades.principal_do(progresso)
    if not principal:
        return {"icone": "🌱", "titulo": "Viajante", "cor": "#a98bff", "degrau": 0}
    classe = habilidades.classe_do(progresso)
    degrau = habilidades.degrau(progresso)
    degraus = [principal["iniciante"]] + (classe["evolucoes"] if classe else [])
    titulo = degraus[min(degrau, len(degraus)) - 1]["titulo"] if degrau else principal["iniciante"]["titulo"]
    dono = classe or principal
    return {"icone": dono.get("icone", "✨"), "titulo": titulo, "cor": dono.get("cor", "#a98bff"), "degrau": degrau}


def placar_de_duelos(progresso):
    duelos = (progresso.get("estatisticas") or {}).get("duelos") or {}
    return {chave: int(duelos.get(chave) or 0) for chave in ("vitorias", "derrotas", "empates")}


def perfil_de(progresso):
    import jogador  # aqui dentro: o jogador.py puxa o Flask, e só o salão rodando de verdade precisa dele

    progresso = jogador.normalizar(progresso)
    casa = (progresso.get("casa") or {}).get("id")
    return {
        "nome": str(progresso.get("nome") or "")[:30],
        "avatar": avatar_seguro(progresso.get("avatar")),
        "classe": identidade(progresso),
        "nivel": progressao.nivel_de(progresso["xp"]),
        "duelos": placar_de_duelos(progresso),
        "acertos": int(progresso["estatisticas"].get("acertos") or 0),
        "casa": casa if casa in CASAS else None,
    }


def premiar(jogador_id, xp=0, moedas=0, cosmetico=None, itens=None, motivo="salao"):
    """O prêmio de um evento do Salão (no banco, com a trava do jogador). XP e moedas respeitam o teto do
    dia (LIMITE_DIARIO); visuais e itens vêm sempre. Devolve (o que ganhou, o perfil novo)."""
    import jogador

    with banco.trava_do_jogador(jogador_id):
        progresso = banco.carregar_progresso(jogador_id)
        if not progresso:
            return [], None
        progresso = jogador.normalizar(progresso)
        dia = progresso.get("salaoDia") if isinstance(progresso.get("salaoDia"), dict) else {}
        if dia.get("data") != banco.hoje():
            dia = {"data": banco.hoje(), "xp": 0, "moedas": 0}
        xp = max(0, min(int(xp), LIMITE_DIARIO["xp"] - dia["xp"]))
        moedas = max(0, min(int(moedas), LIMITE_DIARIO["moedas"] - dia["moedas"]))
        recompensa = {"xp": xp, "moedas": moedas, "itens": itens or {}}
        if cosmetico and cosmetico not in progresso["cosmeticos"]:
            recompensa["cosmetico"] = cosmetico
        ganhos = jogador.conceder(jogador_id, progresso, recompensa, motivo)
        dia["xp"] += xp
        dia["moedas"] += moedas
        progresso["salaoDia"] = dia
        banco.salvar_progresso(jogador_id, progresso)
        return ganhos, perfil_de(progresso)


def escolher_casa(jogador_id, casa):
    """Põe o herói numa Casa (ou troca, se já passaram os 7 dias). Devolve (perfil, motivo de recusa, ganhos)."""
    import jogador

    with banco.trava_do_jogador(jogador_id):
        progresso = jogador.normalizar(banco.carregar_progresso(jogador_id))
        atual = progresso.get("casa") or {}
        if atual.get("id") == casa:
            return None, "Tu já és dessa Casa.", []
        if atual.get("id") and time.time() - float(atual.get("desde") or 0) < DIAS_PARA_TROCAR_DE_CASA * 86400:
            faltam = DIAS_PARA_TROCAR_DE_CASA * 86400 - (time.time() - float(atual["desde"]))
            return None, f"Só dá para trocar de Casa a cada {DIAS_PARA_TROCAR_DE_CASA} dias. Faltam {max(1, round(faltam / 86400))} dia(s).", []
        progresso["casa"] = {"id": casa, "desde": time.time()}
        ganhos = jogador.conceder(jogador_id, progresso, {"cosmetico": CASAS[casa]["manto"]}, f"casa:{casa}")
        banco.salvar_progresso(jogador_id, progresso)
        banco.registrar(jogador_id, "casa", {"casa": casa})
        return perfil_de(progresso), None, ganhos


def campeao_da_semana_passada():
    """O Campeão da Liga da Semana passada (quem mais venceu duelos), com o visual, e o manto dele (uma vez
    por semana). None se ninguém duelou."""
    import jogador

    lista = banco.ranking_da_semana(-1, limite=1)
    if not lista:
        return None
    vencedor = lista[0]
    semana_dele = banco.semana(-1)
    with banco.trava_do_jogador(vencedor["id"]):
        progresso = banco.carregar_progresso(vencedor["id"])
        if not progresso:
            return None
        progresso = jogador.normalizar(progresso)
        if semana_dele not in progresso["campeaoSemanas"]:
            progresso["campeaoSemanas"].append(semana_dele)
            jogador.conceder(vencedor["id"], progresso, {"cosmetico": "manto-campeao"}, f"campeao:{semana_dele}")
            banco.salvar_progresso(vencedor["id"], progresso)
        perfil = perfil_de(progresso)
    return {"id": vencedor["id"], "nome": vencedor["nome"], "vitorias": vencedor["vitorias"], "semana": semana_dele,
            "avatar": perfil["avatar"], "classe": perfil["classe"], "casa": perfil["casa"]}


# ---------- quem está no salão ----------

class Sessao:
    _proximo = 0

    def __init__(self, ws, jogador_id, perfil, ip):
        Sessao._proximo += 1
        self.sid = Sessao._proximo
        self.ws = ws
        self.jogador_id = jogador_id
        self.perfil = perfil
        self.ip = ip
        self.assinatura = assinatura(jogador_id)
        self.x, self.y, self.direcao, self.andando = LARGURA / 2, ALTURA - 6 * TILE, "cima", False
        self.mudou = True
        self.fichas = FICHAS_MAXIMAS
        self.recarga = agora()
        self.ultima_fala = 0.0
        self.falas = deque(maxlen=6)  # as últimas falas, que vão junto numa denúncia
        self.mudo_ate = 0.0
        self.duelo = None
        self.fenda = None
        self.convites = {}  # sid de quem convidou -> {modo, rodadas, quando}

    def publico(self):
        campeao = SALAO.campeao and SALAO.campeao.get("id") == self.jogador_id
        return {"sid": self.sid, **self.perfil, "x": round(self.x), "y": round(self.y), "d": self.direcao, "a": self.andando,
                "duelando": bool(self.duelo), "naFenda": bool(self.fenda), "campeao": bool(campeao)}

    def ocupado(self):
        return bool(self.duelo or self.fenda)

    def gastar_ficha(self):
        """Limite de mensagens: devolve False quando a conexão passou do limite (a mensagem é ignorada)."""
        momento = agora()
        self.fichas = min(FICHAS_MAXIMAS, self.fichas + (momento - self.recarga) * FICHAS_POR_SEGUNDO)
        self.recarga = momento
        self.fichas -= 1
        return self.fichas >= 0

    def no_palanque(self):
        x0, y0, x1, y1 = PALANQUE
        return x0 <= self.x <= x1 and y0 <= self.y <= y1


class Salao:
    def __init__(self):
        self.sessoes = {}  # sid -> Sessao
        self.por_jogador = {}  # jogador_id -> Sessao
        self.duelos = {}  # id -> Duelo (em andamento)
        self.encerrados = {}  # id -> (quando, Duelo): as perguntas escritas ficam um tempo, para denúncia
        self.mural = []
        self.assinatura_do_mural = None
        self.silenciados = {}  # jogador_id -> até quando (time.time)
        self.placar_casas = {}  # os pontos da semana de cada casa
        self.campeao = None  # o Campeão da Liga da Semana passada (com o id: nunca vai inteiro para ninguém)
        self.dragao = None  # a Pergunta do Dragão em andamento
        self.fenda = None  # a Fenda do Oráculo aberta (uma de cada vez)

    def campeao_publico(self):
        return {k: v for k, v in self.campeao.items() if k != "id"} if self.campeao else None

    async def atualizar_placar_das_casas(self, espalhar=True):
        self.placar_casas = await asyncio.to_thread(banco.placar_das_casas)
        if espalhar:
            self.espalhar({"t": "casas", "placar": self.placar_casas})

    async def pontuar(self, sessao_ou_id, motivo, quantos=None):
        """Soma pontos para a Casa do herói (se ele tiver uma) e atualiza a Taça para todo mundo."""
        if isinstance(sessao_ou_id, Sessao):
            jogador_id, casa = sessao_ou_id.jogador_id, sessao_ou_id.perfil.get("casa")
        else:
            jogador_id, casa = sessao_ou_id
        if not casa:
            return
        await asyncio.to_thread(banco.somar_pontos_da_casa, jogador_id, casa, quantos or PONTOS_DA_CASA[motivo])
        await self.atualizar_placar_das_casas()

    async def entregar_premio(self, sessao, ganhos, perfil, titulo):
        """Mostra o prêmio para quem ganhou e atualiza o perfil dele para todos (o visual novo, os números)."""
        if ganhos:
            await self.enviar(sessao, {"t": "premio", "titulo": titulo, "ganhos": ganhos})
        if perfil and self.sessoes.get(sessao.sid) is sessao:
            sessao.perfil = perfil
            self.espalhar({"t": "perfil", "jogador": sessao.publico()})

    # ---------- envio ----------

    @staticmethod
    def json(mensagem):
        return json.dumps(mensagem, ensure_ascii=False, separators=(",", ":"))

    async def enviar(self, sessao, mensagem):
        try:
            await sessao.ws.send(self.json(mensagem))
        except Exception:  # noqa: BLE001 (a conexão caiu: o laço dela cuida da saída)
            pass

    def espalhar(self, mensagem, para=None, exceto=None):
        """Manda para todos (ou para a lista "para"), sem esperar ninguém (websockets.broadcast)."""
        from websockets.asyncio.server import broadcast

        alvos = [s.ws for s in (para if para is not None else self.sessoes.values()) if s is not exceto]
        if alvos:
            broadcast(alvos, self.json(mensagem))

    def aviso(self, sessao, texto, icone="⚠️"):
        return self.enviar(sessao, {"t": "aviso", "texto": texto, "icone": icone})

    # ---------- entrar e sair ----------

    async def entrar(self, ws, mensagem, ip):
        jogador_id = str(mensagem.get("id") or "")
        if not re.fullmatch(r"[0-9a-f]{32}", jogador_id):
            await ws.send(self.json({"t": "erro", "texto": "Herói inválido."}))
            return None
        progresso = await asyncio.to_thread(banco.carregar_progresso, jogador_id)
        if not progresso:
            await ws.send(self.json({"t": "erro", "texto": "Esse herói não existe mais neste servidor."}))
            return None
        if not progresso.get("nome") or not progresso.get("avatar"):
            await ws.send(self.json({"t": "erro", "texto": "Cria teu herói no modo Um Jogador antes de entrar no salão."}))
            return None
        perfil = await asyncio.to_thread(perfil_de, progresso)
        antiga = self.por_jogador.get(jogador_id)
        if antiga:
            # o mesmo herói em outra aba: a aba velha sai (e um duelo dela termina)
            await self.enviar(antiga, {"t": "erro", "texto": "Tu abriste o salão em outra aba ou janela. Esta aqui saiu."})
            await self.sair(antiga)
            try:
                await antiga.ws.close(4000, "outra aba")
            except Exception:  # noqa: BLE001
                pass
        sessao = Sessao(ws, jogador_id, perfil, ip)
        if isinstance(mensagem.get("x"), (int, float)) and isinstance(mensagem.get("y"), (int, float)):
            sessao.x = min(max(float(mensagem["x"]), 0), LARGURA)
            sessao.y = min(max(float(mensagem["y"]), 0), ALTURA)
        # quem foi silenciado continua silenciado mesmo saindo e entrando de novo
        restante = self.silenciados.get(jogador_id, 0) - time.time()
        sessao.mudo_ate = agora() + restante if restante > 0 else 0.0
        self.sessoes[sessao.sid] = sessao
        self.por_jogador[jogador_id] = sessao
        await self.enviar(sessao, {
            "t": "ola", "voce": sessao.sid, "assinatura": sessao.assinatura, "eu": sessao.publico(),
            "jogadores": [s.publico() for s in self.sessoes.values() if s is not sessao],
            "mural": self.mural, "arena": self.placares(), "modos": {k: {"nome": v["nome"], "rodadas": v["rodadas"]} for k, v in MODOS.items()},
            "casas": CASAS, "placarCasas": self.placar_casas, "trocarCasaDias": DIAS_PARA_TROCAR_DE_CASA,
            "campeao": self.campeao_publico(), "fenda": self.fenda.publico() if self.fenda else None,
            "dragao": self.dragao_publico(), "limiteDiario": LIMITE_DIARIO,
        })
        self.espalhar({"t": "entrou", "jogador": sessao.publico()}, exceto=sessao)
        return sessao

    async def sair(self, sessao):
        if self.sessoes.get(sessao.sid) is not sessao:
            return
        if sessao.duelo:
            sessao.duelo.desistir(sessao, "saiu do salão")
        if sessao.fenda:
            sessao.fenda.sair(sessao)
        del self.sessoes[sessao.sid]
        if self.por_jogador.get(sessao.jogador_id) is sessao:
            del self.por_jogador[sessao.jogador_id]
        # convites que ele mandou somem da tela de quem recebeu
        for outra in self.sessoes.values():
            if outra.convites.pop(sessao.sid, None):
                await self.enviar(outra, {"t": "convite_fim", "de": sessao.sid})
        self.espalhar({"t": "saiu", "sid": sessao.sid})

    # ---------- o laço das posições ----------

    async def laco_das_posicoes(self):
        while True:
            await asyncio.sleep(TICK)
            mudados = [s for s in self.sessoes.values() if s.mudou]
            if not mudados:
                continue
            for s in mudados:
                s.mudou = False
            self.espalhar({"t": "pos", "p": [[s.sid, round(s.x), round(s.y), s.direcao, 1 if s.andando else 0] for s in mudados]})

    async def laco_do_mural(self):
        """De tempos em tempos o quadro é relido do banco: recados vencidos ou apagados pelo Erickson
        (python moderar.py apagar <id>) somem das telas sem reiniciar o salão."""
        while True:
            await self.recarregar_mural()
            await asyncio.sleep(20)
            # convites velhos e duelos encerrados há tempo saem da memória
            limite = agora() - SEGUNDOS_DO_CONVITE
            for s in list(self.sessoes.values()):
                for de, convite in list(s.convites.items()):
                    if convite["quando"] < limite:
                        del s.convites[de]
                        await self.enviar(s, {"t": "convite_fim", "de": de})
            for duelo_id, (quando, _) in list(self.encerrados.items()):
                if quando < agora() - 900:
                    del self.encerrados[duelo_id]

    async def recarregar_mural(self):
        recados = await asyncio.to_thread(banco.recados_visiveis)
        publicos = [{**{k: r[k] for k in ("id", "nome", "texto", "cor", "quando")}, "dono": assinatura(r["autor"])} for r in recados]
        marca = tuple(r["id"] for r in publicos)
        if marca != self.assinatura_do_mural:
            mudou = self.assinatura_do_mural is not None
            self.mural, self.assinatura_do_mural = publicos, marca
            if mudou:
                self.espalhar({"t": "mural", "recados": self.mural})

    # ---------- as mensagens ----------

    async def tratar(self, s, m):
        tipo = m.get("t")
        acao = getattr(self, f"ao_{tipo}", None) if isinstance(tipo, str) and re.fullmatch(r"[a-z_]{2,30}", tipo) else None
        if acao:
            await acao(s, m)

    async def ao_mover(self, s, m):
        x, y = m.get("x"), m.get("y")
        if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
            return
        s.x, s.y = min(max(float(x), 0), LARGURA), min(max(float(y), 0), ALTURA)
        s.direcao = m.get("d") if m.get("d") in DIRECOES else s.direcao
        s.andando = bool(m.get("a"))
        s.mudou = True

    async def ao_gesto(self, s, m):
        if m.get("id") in GESTOS:
            self.espalhar({"t": "gesto", "sid": s.sid, "id": m["id"]}, exceto=s)

    async def ao_falar(self, s, m):
        if s.mudo_ate > agora():
            minutos = max(1, round((s.mudo_ate - agora()) / 60))
            return await self.aviso(s, f"Tua voz foi silenciada por denúncias. Volta a falar em {minutos} min.", "🔇")
        if agora() - s.ultima_fala < ESPERA_FALA:
            return
        texto = moderacao.limpar(m.get("texto")).replace("\n", " ")
        motivo = moderacao.motivo_para_recusar(texto, 140)
        if motivo:
            return await self.aviso(s, motivo, "🛡️")
        s.ultima_fala = agora()
        s.falas.append(texto)
        # o canal da Casa chega a todos da mesma casa, em qualquer lugar do castelo (sem balão em cima do herói)
        if m.get("canal") == "casa":
            casa = s.perfil.get("casa")
            if not casa:
                return await self.aviso(s, "Tu ainda não tens Casa. Visita o Distrito das Casas, ao sul do jardim!", "🛡️")
            membros = [o for o in self.sessoes.values() if o.perfil.get("casa") == casa]
            self.espalhar({"t": "fala", "sid": s.sid, "nome": s.perfil["nome"], "texto": texto, "canal": "casa", "casa": casa}, para=membros)
            return
        palanque = s.no_palanque()
        ouvintes = list(self.sessoes.values()) if palanque else [o for o in self.sessoes.values() if abs(o.x - s.x) < RAIO_DA_FALA and abs(o.y - s.y) < RAIO_DA_FALA]
        self.espalhar({"t": "fala", "sid": s.sid, "nome": s.perfil["nome"], "texto": texto, "palanque": palanque}, para=ouvintes)

    # ---------- as Casas ----------

    async def ao_escolher_casa(self, s, m):
        casa = m.get("casa")
        if casa not in CASAS:
            return
        perfil, motivo, ganhos = await asyncio.to_thread(escolher_casa, s.jogador_id, casa)
        if motivo:
            return await self.aviso(s, motivo, "🛡️")
        await self.entregar_premio(s, ganhos, perfil, f"Bem-vindo à {CASAS[casa]['nome']}!")
        await self.enviar(s, {"t": "casa_escolhida", "casa": casa})
        self.espalhar({"t": "anuncio", "icone": CASAS[casa]["icone"], "texto": f"{s.perfil['nome']} agora é da {CASAS[casa]['nome']}!"})

    async def ao_casa_info(self, s, m):
        casa = m.get("casa")
        if casa not in CASAS:
            return
        destaques = await asyncio.to_thread(banco.destaques_da_casa, casa)
        online = [{"sid": o.sid, "nome": o.perfil["nome"]} for o in self.sessoes.values() if o.perfil.get("casa") == casa]
        await self.enviar(s, {"t": "casa_info", "casa": casa, "destaques": destaques, "online": online, "placar": self.placar_casas})

    async def ao_denunciar_jogador(self, s, m):
        alvo = self.sessoes.get(m.get("sid"))
        if not alvo or alvo is s:
            return
        provas = " | ".join(alvo.falas) or "(sem falas recentes)"
        quantas = await asyncio.to_thread(banco.denunciar, "jogador", alvo.jogador_id, s.jogador_id, f"{alvo.perfil['nome']}: {provas}", 24)
        await self.aviso(s, "Denúncia registrada. Obrigado por cuidar do salão. Podes também silenciar esse jogador só para ti.", "🛡️")
        if quantas >= DENUNCIAS_PARA_SILENCIAR and alvo.mudo_ate < agora():
            alvo.mudo_ate = agora() + MINUTOS_SILENCIADO * 60
            self.silenciados[alvo.jogador_id] = time.time() + MINUTOS_SILENCIADO * 60
            await self.aviso(alvo, f"Várias pessoas denunciaram tuas falas. Tua voz fica silenciada por {MINUTOS_SILENCIADO} min.", "🔇")

    # ---------- a Pergunta do Dragão (o evento ao vivo da praça) ----------

    def dragao_publico(self):
        d = self.dragao
        if not d or d["fase"] != "pergunta":
            return None
        return {"id": d["id"], "pergunta": d["publica"], "limite": d["limite"], "resta": max(0, round(d["ate"] - agora()))}

    async def laco_do_dragao(self):
        while True:
            await asyncio.sleep(MINUTOS_ENTRE_DRAGOES * 60)
            if self.sessoes and not self.dragao:
                try:
                    await self.pergunta_do_dragao()
                except Exception as erro:  # noqa: BLE001 (um evento não pode derrubar o salão)
                    print(f"[salao] erro na Pergunta do Dragão: {erro!r}", flush=True)
                    self.dragao = None

    async def pergunta_do_dragao(self, aviso=6.0, limite=SEGUNDOS_DA_PERGUNTA_DO_DRAGAO):
        """Um dragão pousa na praça e solta uma pergunta para todo mundo: quem acertar primeiro leva o prêmio."""
        self.dragao = {"id": uuid.uuid4().hex[:10], "fase": "chegando", "respondidos": set(), "vencedor": None, "evento": asyncio.Event()}
        self.espalhar({"t": "dragao_chega", "segundos": aviso})
        await asyncio.sleep(aviso)
        pergunta = sortear_pergunta(2, {1}, [])
        pergunta = com_tempo(pergunta, "escolha", "cenario" if pergunta["cenario"] else "codigo" if pergunta["codigo"] else "escolha")
        self.dragao.update(fase="pergunta", ref=pergunta["ref"], publica=pergunta_publica(pergunta), limite=limite, ate=agora() + limite)
        self.espalhar({"t": "dragao_pergunta", **self.dragao_publico()})
        # a pergunta fica aberta até o tempo acabar (ou até todo mundo no castelo ter respondido): quem acerta
        # depois do primeiro também fica sabendo que acertou
        fim = agora() + limite + 0.5
        while agora() < fim and len(self.dragao["respondidos"]) < len(self.sessoes):
            self.dragao["evento"].clear()
            try:
                await asyncio.wait_for(self.dragao["evento"].wait(), timeout=max(0.05, fim - agora()))
            except asyncio.TimeoutError:  # no Python 3.10 (o do servidor) não é o mesmo TimeoutError
                break
        certo = corrigir_pergunta(self.dragao["ref"], 0)
        vencedor = self.dragao["vencedor"]
        self.espalhar({"t": "dragao_fim", "id": self.dragao["id"], "resposta_certa": certo["resposta_certa"], "texto_certo": certo.get("texto_certo"),
                       "explicacao": certo["explicacao"], "vencedor": {"sid": vencedor.sid, "nome": vencedor.perfil["nome"]} if vencedor else None})
        if vencedor:
            self.espalhar({"t": "anuncio", "icone": "🐉", "texto": f"{vencedor.perfil['nome']} respondeu primeiro e domou o Dragão da praça!"})
        self.dragao = None

    async def ao_dragao_responder(self, s, m):
        d = self.dragao
        if not d or d["fase"] != "pergunta" or m.get("id") != d["id"] or s.jogador_id in d["respondidos"]:
            return
        resposta = m.get("resposta")
        if not isinstance(resposta, int):
            return
        d["respondidos"].add(s.jogador_id)
        d["evento"].set()
        if not corrigir_pergunta(d["ref"], resposta)["correta"]:
            return await self.enviar(s, {"t": "dragao_resposta", "id": d["id"], "correta": False})
        if d["vencedor"]:
            return await self.enviar(s, {"t": "dragao_resposta", "id": d["id"], "correta": True, "primeiro": False, "vencedor": d["vencedor"].perfil["nome"]})
        d["vencedor"] = s
        self.espalhar({"t": "anuncio", "icone": "⚡", "texto": f"{s.perfil['nome']} acertou primeiro a Pergunta do Dragão!"})
        await self.enviar(s, {"t": "dragao_resposta", "id": d["id"], "correta": True, "primeiro": True})
        ganhos, perfil = await asyncio.to_thread(premiar, s.jogador_id, 60, 40, "manto-dragao-dourado", None, "pergunta-do-dragao")
        await self.entregar_premio(s, ganhos, perfil, "Domador do Dragão!")
        await self.pontuar(s, "dragao")

    async def ao_teste_evento(self, s, m):
        """Só nos testes (SALAO_TESTES=1): dispara um evento na hora."""
        if not MODO_DE_TESTE:
            return
        if m.get("evento") == "dragao" and not self.dragao:
            asyncio.create_task(self.pergunta_do_dragao(aviso=0.05, limite=float(m.get("limite") or 3)))
        if m.get("evento") == "liga":
            await self.atualizar_campeao()

    # ---------- a Liga da Semana ----------

    async def atualizar_campeao(self):
        antes = self.campeao_publico()
        self.campeao = await asyncio.to_thread(campeao_da_semana_passada)
        if self.campeao_publico() != antes:
            self.espalhar({"t": "campeao", "campeao": self.campeao_publico()})
            # a aura do campeão: quem está no salão vê o perfil novo
            for s in self.sessoes.values():
                self.espalhar({"t": "perfil", "jogador": s.publico()})

    async def laco_da_liga(self):
        while True:
            try:
                await self.atualizar_campeao()
                await self.atualizar_placar_das_casas()
            except Exception as erro:  # noqa: BLE001
                print(f"[salao] erro na Liga: {erro!r}", flush=True)
            await asyncio.sleep(300)

    # ---------- as Fendas do Oráculo (os chefões em grupo) ----------

    async def ao_fenda_abrir(self, s, m):
        if self.fenda:
            return await self.aviso(s, "Já há uma Fenda aberta. Entra nela pelo Altar ou pelo aviso!", "🌀")
        if s.ocupado():
            return await self.aviso(s, "Termina teu duelo antes de abrir a Fenda.")
        self.fenda = Fenda(self, s)
        self.espalhar({"t": "anuncio", "icone": "🌀", "texto": f"{s.perfil['nome']} abriu uma Fenda do Oráculo! Vai ao Círculo da Fenda (2 a 4 heróis)."})
        self.espalhar({"t": "fenda", "fenda": self.fenda.publico()})
        self.fenda.tarefa = asyncio.create_task(self.fenda.rodar())

    async def ao_fenda_entrar(self, s, m):
        f = self.fenda
        if not f or f.estado != "reunindo":
            return await self.aviso(s, "Não há Fenda esperando heróis agora.", "🌀")
        if s.ocupado():
            return await self.aviso(s, "Termina teu duelo antes de entrar na Fenda.")
        await f.entrar(s)

    async def ao_fenda_sair(self, s, m):
        if s.fenda:
            s.fenda.sair(s)

    async def ao_fenda_responder(self, s, m):
        if s.fenda:
            await s.fenda.receber_resposta(s, m.get("rodada"), m.get("resposta"))

    def fenda_fechou(self, fenda):
        if self.fenda is fenda:
            self.fenda = None
        for s in fenda.membros:
            if s.fenda is fenda:
                s.fenda = None
        self.espalhar({"t": "fenda", "fenda": None})

    # ---------- o Quadro de Anotações ----------

    async def ao_recado(self, s, m):
        texto = moderacao.limpar(m.get("texto"))
        motivo = moderacao.motivo_para_recusar(texto, 280)
        if motivo:
            return await self.aviso(s, motivo, "🛡️")
        quantos, ultimo = await asyncio.to_thread(banco.recados_do_jogador, s.jogador_id)
        if quantos >= RECADOS_POR_JOGADOR:
            return await self.aviso(s, f"Tu já tens {RECADOS_POR_JOGADOR} recados no quadro. Tira um antes de pôr outro.", "📌")
        if ultimo:
            passou = (datetime.now(timezone.utc) - datetime.fromisoformat(ultimo)).total_seconds()
            if passou < ESPERA_RECADO:
                return await self.aviso(s, f"Espera {int(ESPERA_RECADO - passou) + 1} s para pregar outro recado.", "⏳")
        cor = m.get("cor") if m.get("cor") in CORES_RECADO else "amarelo"
        recado = await asyncio.to_thread(banco.criar_recado, s.jogador_id, s.perfil["nome"], texto, cor)
        publico = {**{k: recado[k] for k in ("id", "nome", "texto", "cor", "quando")}, "dono": s.assinatura}
        self.mural = [publico] + self.mural
        self.assinatura_do_mural = tuple(r["id"] for r in self.mural)
        self.espalhar({"t": "recado_novo", "recado": publico})

    async def ao_apagar_recado(self, s, m):
        recado_id = m.get("id")
        if isinstance(recado_id, int) and await asyncio.to_thread(banco.apagar_recado, recado_id, s.jogador_id):
            self.tirar_do_mural(recado_id)

    async def ao_denunciar_recado(self, s, m):
        recado_id = m.get("id")
        recado = next((r for r in self.mural if r["id"] == recado_id), None)
        if not recado or recado["dono"] == s.assinatura:
            return
        quantas = await asyncio.to_thread(banco.denunciar, "recado", recado_id, s.jogador_id, f"{recado['nome']}: {recado['texto']}")
        await self.aviso(s, "Denúncia registrada. Com mais denúncias, o recado sai do quadro.", "🛡️")
        if quantas >= DENUNCIAS_PARA_ESCONDER:
            await asyncio.to_thread(banco.ocultar_recado, recado_id)
            self.tirar_do_mural(recado_id)

    def tirar_do_mural(self, recado_id):
        self.mural = [r for r in self.mural if r["id"] != recado_id]
        self.assinatura_do_mural = tuple(r["id"] for r in self.mural)
        self.espalhar({"t": "recado_fora", "id": recado_id})

    async def ao_ranking(self, s, m, espalhar=False):
        """O ranking de 30 dias (o pódio), a Liga da Semana e o Campeão da semana passada."""
        lista = await asyncio.to_thread(ranking_com_visual)
        liga = [{"nome": r["nome"], "vitorias": r["vitorias"]} for r in await asyncio.to_thread(banco.ranking_da_semana)]
        mensagem = {"t": "ranking", "lista": lista, "liga": liga, "campeao": self.campeao_publico()}
        if espalhar:
            self.espalhar(mensagem)
        else:
            await self.enviar(s, mensagem)

    # ---------- convites para duelo ----------

    async def ao_desafiar(self, s, m):
        alvo = self.sessoes.get(m.get("sid"))
        modo = m.get("modo")
        if modo not in MODOS or not alvo or alvo is s:
            return
        rodadas = m.get("rodadas") if m.get("rodadas") in MODOS[modo]["rodadas"] else MODOS[modo]["rodadas"][0]
        if s.ocupado():
            return await self.aviso(s, "Termina o que estás fazendo (duelo ou Fenda) antes de chamar outro duelo.")
        if alvo.ocupado():
            return await self.aviso(s, f"{alvo.perfil['nome']} está ocupado num duelo ou numa Fenda. Assiste da arquibancada!", "🏟️")
        convite = alvo.convites.get(s.sid)
        if convite and agora() - convite["quando"] < 8:
            return await self.aviso(s, "Calma: o convite já foi. Espera a resposta.", "⏳")
        # dois convites cruzados (os dois se desafiaram): o duelo começa direto
        cruzado = s.convites.get(alvo.sid)
        if cruzado and cruzado["modo"] == modo and cruzado["rodadas"] == rodadas:
            s.convites.pop(alvo.sid, None)
            return await self.comecar_duelo(alvo, s, modo, rodadas)
        alvo.convites[s.sid] = {"modo": modo, "rodadas": rodadas, "quando": agora()}
        await self.enviar(alvo, {"t": "convite", "de": s.sid, "nome": s.perfil["nome"], "modo": modo, "rodadas": rodadas, "segundos": SEGUNDOS_DO_CONVITE})
        await self.aviso(s, f"Convite enviado para {alvo.perfil['nome']}. Esperando a resposta...", "⚔️")

    async def ao_cancelar_convite(self, s, m):
        alvo = self.sessoes.get(m.get("sid"))
        if alvo and alvo.convites.pop(s.sid, None):
            await self.enviar(alvo, {"t": "convite_fim", "de": s.sid})

    async def ao_responder_convite(self, s, m):
        quem = self.sessoes.get(m.get("de"))
        convite = s.convites.pop(m.get("de"), None)
        if not quem or not convite:
            return await self.aviso(s, "Esse convite já não vale mais.")
        if not m.get("aceitar"):
            return await self.aviso(quem, f"{s.perfil['nome']} recusou o duelo desta vez.", "🙅")
        if agora() - convite["quando"] > SEGUNDOS_DO_CONVITE:
            return await self.aviso(s, "O convite expirou. Desafia de volta!", "⏳")
        if s.ocupado() or quem.ocupado():
            return await self.aviso(s, "Um de vocês já está noutro duelo ou numa Fenda.")
        await self.comecar_duelo(quem, s, convite["modo"], convite["rodadas"])

    async def comecar_duelo(self, a, b, modo, rodadas):
        # quem entra num duelo recusa os outros convites pendentes
        for sessao in (a, b):
            for de in list(sessao.convites):
                sessao.convites.pop(de)
                await self.enviar(sessao, {"t": "convite_fim", "de": de})
        duelo = Duelo(self, modo, rodadas, a, b)
        self.duelos[duelo.id] = duelo
        a.duelo = b.duelo = duelo
        self.espalhar({"t": "anuncio", "icone": "⚔️", "texto": f"{a.perfil['nome']} e {b.perfil['nome']} entram na arena: {MODOS[modo]['nome']}!"})
        duelo.tarefa = asyncio.create_task(duelo.rodar())

    def placares(self):
        return [d.placar() for d in self.duelos.values() if not d.fim]

    def espalhar_arena(self):
        self.espalhar({"t": "arena", "duelos": self.placares()})

    # ---------- dentro do duelo ----------

    async def ao_duelo_perguntas(self, s, m):
        if s.duelo:
            await s.duelo.receber_perguntas(s, m.get("lista"))

    async def ao_duelo_responder(self, s, m):
        if s.duelo:
            await s.duelo.receber_resposta(s, m.get("rodada"), m.get("resposta"))

    async def ao_duelo_desistir(self, s, m):
        if s.duelo:
            s.duelo.desistir(s, "desistiu")

    async def ao_denunciar_perguntas(self, s, m):
        guardado = self.encerrados.get(m.get("duelo"))
        if not guardado:
            return await self.aviso(s, "Esse duelo já saiu da memória do salão.")
        duelo = guardado[1]
        if s.jogador_id not in duelo.ids:
            return
        i = duelo.ids.index(s.jogador_id)
        outro = 1 - i
        texto = json.dumps(duelo.autorais[outro] or [], ensure_ascii=False)
        await asyncio.to_thread(banco.denunciar, "perguntas", f"{duelo.id}:{duelo.ids[outro]}", s.jogador_id, f"{duelo.nomes[outro]}: {texto}")
        await self.aviso(s, "Denúncia registrada: o Erickson vai ler essas perguntas.", "🛡️")

    def encerrado(self, duelo):
        self.duelos.pop(duelo.id, None)
        self.encerrados[duelo.id] = (agora(), duelo)
        for lado in duelo.lados:
            if lado.duelo is duelo:
                lado.duelo = None
        self.espalhar_arena()


def nivel_de_perigo(nivel_heroi):
    """O perigo das perguntas pelo nível do herói (o mesmo de 1 a 4 dos monstros do Reino)."""
    return 1 if nivel_heroi <= 4 else 2 if nivel_heroi <= 9 else 3 if nivel_heroi <= 15 else 4


def pergunta_publica(pergunta):
    return {k: pergunta.get(k) for k in ("pergunta", "opcoes", "codigo", "cenario", "afirmacao", "desafio", "trilha") if pergunta.get(k) is not None}


class Duelo:
    def __init__(self, salao, modo, rodadas, a, b):
        self.salao = salao
        self.id = uuid.uuid4().hex[:12]
        self.modo = modo
        self.total = rodadas if modo != "queda" else None
        self.lados = [a, b]
        self.ids = [a.jogador_id, b.jogador_id]
        self.nomes = [a.perfil["nome"], b.perfil["nome"]]
        self.pontos = [0, 0]
        self.acertos = [0, 0]
        self.vidas = [VIDAS_NA_QUEDA, VIDAS_NA_QUEDA] if modo == "queda" else None
        self.rodada = 0
        self.vistas = []
        self.autorais = [None, None]
        self.atual = None  # [pergunta de a, pergunta de b] com o necessário para corrigir
        self.respostas = {}
        self.evento = asyncio.Event()
        self.parar = asyncio.Event()
        self.desistente = None
        self.motivo_desistencia = ""
        self.fim = False
        self.tarefa = None
        self.base = nivel_de_perigo(min(a.perfil["nivel"], b.perfil["nivel"]))

    def lado_de(self, sessao):
        return self.lados.index(sessao) if sessao in self.lados else None

    def placar(self):
        def lado(i):
            s = self.lados[i]
            return {"sid": s.sid, "nome": self.nomes[i], "pontos": self.pontos[i], "vidas": self.vidas[i] if self.vidas else None}
        return {"id": self.id, "modo": self.modo, "nomeModo": MODOS[self.modo]["nome"], "rodada": self.rodada, "total": self.total, "a": lado(0), "b": lado(1)}

    def visto_por(self, i, mensagem):
        """A mensagem do ponto de vista do lado i ("eu" e "ele")."""
        return {**mensagem, "pontos": [self.pontos[i], self.pontos[1 - i]], "vidas": [self.vidas[i], self.vidas[1 - i]] if self.vidas else None}

    async def enviar_aos_dois(self, mensagem):
        for i, s in enumerate(self.lados):
            await self.salao.enviar(s, self.visto_por(i, mensagem))

    async def esperar(self, segundos):
        """Espera, mas acorda na hora se alguém desistir."""
        try:
            await asyncio.wait_for(self.parar.wait(), timeout=segundos)
        except asyncio.TimeoutError:  # no Python 3.10 (o do servidor) não é o mesmo TimeoutError
            pass

    def desistir(self, sessao, motivo):
        i = self.lado_de(sessao)
        if i is None or self.fim or self.desistente is not None:
            return
        self.desistente = i
        self.motivo_desistencia = motivo
        self.parar.set()
        self.evento.set()

    # ---------- o roteiro do duelo ----------

    async def rodar(self):
        try:
            for i, s in enumerate(self.lados):
                outro = self.lados[1 - i]
                await self.salao.enviar(s, self.visto_por(i, {
                    "t": "duelo_inicio", "duelo": self.id, "modo": self.modo, "nomeModo": MODOS[self.modo]["nome"], "total": self.total,
                    "lado": i, "oponente": outro.publico(), "contagem": CONTAGEM_INICIAL,
                    "vidasMaximas": VIDAS_NA_QUEDA if self.vidas else None,
                }))
            self.salao.espalhar_arena()
            if self.modo == "autoral" and not await self.preparar():
                return
            await self.esperar(CONTAGEM_INICIAL)
            while self.desistente is None and not self.acabou():
                await self.rodada_nova()
            await self.encerrar()
        except asyncio.CancelledError:
            raise
        except Exception as erro:  # noqa: BLE001 (um erro num duelo não pode derrubar o salão)
            print(f"[salao] erro no duelo {self.id}: {erro!r}", flush=True)
            self.fim = True
            for s in self.lados:
                await self.salao.aviso(s, "O duelo teve um problema e foi encerrado sem resultado.")
            self.salao.encerrado(self)

    def acabou(self):
        if self.modo == "queda":
            return min(self.vidas) <= 0 or self.rodada >= RODADAS_MAXIMAS_NA_QUEDA
        return self.rodada >= self.total

    async def preparar(self):
        """Duelo de perguntas dos jogadores: cada um escreve as suas (com tempo). Devolve se dá para seguir."""
        prazo = MINUTOS_PARA_ESCREVER * 60
        await self.enviar_aos_dois({"t": "duelo_preparo", "duelo": self.id, "quantas": self.total, "segundos": prazo})
        await self.esperar_condicao(lambda: all(self.autorais), prazo)
        if self.desistente is not None:
            await self.encerrar()
            return False
        if not all(self.autorais):
            faltou = [i for i in (0, 1) if not self.autorais[i]]
            if len(faltou) == 2:
                self.fim = True
                for s in self.lados:
                    await self.salao.aviso(s, "O tempo acabou e ninguém terminou as perguntas: duelo cancelado.", "⌛")
                    await self.salao.enviar(s, {"t": "duelo_fim", "duelo": self.id, "resultado": "cancelado", "motivo": "tempo"})
                self.salao.encerrado(self)
                return False
            self.desistente = faltou[0]
            self.motivo_desistencia = "não terminou as perguntas a tempo"
            await self.encerrar()
            return False
        return True

    async def esperar_condicao(self, condicao, segundos):
        limite = agora() + segundos
        while not condicao() and self.desistente is None and agora() < limite:
            self.evento.clear()
            try:
                await asyncio.wait_for(self.evento.wait(), timeout=max(0.05, limite - agora()))
            except asyncio.TimeoutError:  # no Python 3.10 (o do servidor) não é o mesmo TimeoutError
                break

    async def receber_perguntas(self, sessao, lista):
        i = self.lado_de(sessao)
        if i is None or self.modo != "autoral" or self.rodada or self.autorais[i]:
            return
        perguntas, motivo = validar_autorais(lista, self.total)
        if motivo:
            return await self.salao.enviar(sessao, {"t": "duelo_recusado", "duelo": self.id, "motivo": motivo})
        self.autorais[i] = perguntas
        await self.salao.enviar(sessao, {"t": "duelo_entregue", "duelo": self.id})
        await self.salao.enviar(self.lados[1 - i], {"t": "duelo_respondeu", "duelo": self.id, "preparo": True})
        self.evento.set()

    def sortear(self):
        """A pergunta da rodada (a mesma para os dois) no x1 e no "até um cair"."""
        if self.modo == "queda":
            perigo = min(4, max(self.base, MONSTROS[self.monstro()]["nivel"]))
        else:
            perigo = min(4, self.base + (1 if self.rodada > self.total * 2 / 3 else 0))
        pergunta = sortear_pergunta(perigo, {1}, self.vistas)
        self.vistas = (self.vistas + [pergunta["ref"].partition("@")[0]])[-60:]
        if not pergunta["cenario"] and random.random() < 0.22:
            pergunta = como_verdadeiro_ou_falso(pergunta)
        else:
            pergunta = com_tempo(pergunta, "escolha", "cenario" if pergunta["cenario"] else "codigo" if pergunta["codigo"] else "escolha")
        limite = min(LIMITE_MAXIMO, pergunta["tempo"]["limite"])
        return {"ref": pergunta["ref"], "publica": pergunta_publica(pergunta), "limite": limite}

    def monstro(self):
        return TORRE_DE_MONSTROS[min(len(TORRE_DE_MONSTROS) - 1, (self.rodada - 1) // RODADAS_POR_MONSTRO)]

    def autoral_para(self, i):
        """No duelo de perguntas dos jogadores, o lado i responde a pergunta que o outro escreveu."""
        original = self.autorais[1 - i][self.rodada - 1]
        ordem = list(range(len(original["opcoes"])))
        random.shuffle(ordem)
        publica = {"pergunta": original["pergunta"], "opcoes": [original["opcoes"][k] for k in ordem], "desafio": "autoral", "autor": self.nomes[1 - i]}
        return {"autoral": True, "certa": ordem.index(original["correta"]), "texto_certo": original["opcoes"][original["correta"]],
                "publica": publica, "limite": LIMITE_AUTORAL}

    async def rodada_nova(self):
        self.rodada += 1
        if self.modo == "autoral":
            self.atual = [self.autoral_para(0), self.autoral_para(1)]
        else:
            sorteada = self.sortear()
            self.atual = [sorteada, sorteada]
        self.respostas = {}
        self.inicio = agora()
        extra = {}
        if self.modo == "queda":
            tipo = self.monstro()
            extra["monstro"] = {"tipo": tipo, "nome": MONSTROS[tipo]["nome"], "rodadaDoMonstro": (self.rodada - 1) % RODADAS_POR_MONSTRO + 1}
        for i, s in enumerate(self.lados):
            await self.salao.enviar(s, self.visto_por(i, {
                "t": "duelo_pergunta", "duelo": self.id, "rodada": self.rodada, "total": self.total,
                "pergunta": self.atual[i]["publica"], "limite": self.atual[i]["limite"], **extra,
            }))
        self.salao.espalhar_arena()
        # a plateia vê a mesma pergunta (sem a resposta) e pode dar o palpite dela (no x1 e no "até um cair")
        if self.modo != "autoral":
            self.salao.espalhar({"t": "arena_pergunta", "duelo": self.id, "rodada": self.rodada, "pergunta": self.atual[0]["publica"],
                                 "limite": self.atual[0]["limite"], "nomes": self.nomes, **extra},
                                para=[o for o in self.salao.sessoes.values() if o not in self.lados])
        limite = max(q["limite"] for q in self.atual) + 1.5
        await self.esperar_condicao(lambda: len(self.respostas) == 2, limite)
        if self.desistente is not None:
            return
        resultados = [self.corrigir(i) for i in (0, 1)]
        for i in (0, 1):
            r = resultados[i]
            if r["correta"]:
                self.acertos[i] += 1
                self.pontos[i] += r["ganhou"]
            elif self.vidas:
                self.vidas[i] = max(0, self.vidas[i] - 1)
        for i, s in enumerate(self.lados):
            outro = resultados[1 - i]
            await self.salao.enviar(s, self.visto_por(i, {
                "t": "duelo_resultado", "duelo": self.id, "rodada": self.rodada,
                "eu": resultados[i], "oponente": {"correta": outro["correta"], "respondeu": outro["respondeu"], "ganhou": outro["ganhou"], "segundos": outro["segundos"]},
                "ultima": self.acabou(),
            }))
        self.salao.espalhar_arena()
        if self.modo != "autoral":
            self.salao.espalhar({"t": "arena_resultado", "duelo": self.id, "rodada": self.rodada, "resposta_certa": resultados[0]["resposta_certa"],
                                 "texto_certo": resultados[0].get("texto_certo"), "acertos": [r["correta"] for r in resultados], "nomes": self.nomes},
                                para=[o for o in self.salao.sessoes.values() if o not in self.lados])
        await self.esperar(PAUSA_DO_RESULTADO)

    def corrigir(self, i):
        pergunta = self.atual[i]
        resposta, quando = self.respostas.get(i, (None, None))
        segundos = round(quando - self.inicio, 1) if quando else None
        if pergunta.get("autoral"):
            correta = resposta == pergunta["certa"]
            r = {"correta": correta, "resposta_certa": pergunta["certa"], "texto_certo": pergunta["texto_certo"], "explicacao": f"Pergunta escrita por {self.nomes[1 - i]}."}
        else:
            r = {k: v for k, v in corrigir_pergunta(pergunta["ref"], resposta).items() if k in ("correta", "resposta_certa", "texto_certo", "explicacao")}
            r["correta"] = bool(r["correta"]) and resposta is not None
        dentro = segundos is not None and segundos <= pergunta["limite"] + 0.5
        r["correta"] = r["correta"] and dentro
        r["ganhou"] = PONTOS_ACERTO + round(PONTOS_RAPIDEZ * max(0.0, 1 - segundos / pergunta["limite"])) if r["correta"] else 0
        r["respondeu"] = resposta is not None and dentro
        r["segundos"] = segundos
        return r

    async def receber_resposta(self, sessao, rodada, resposta):
        i = self.lado_de(sessao)
        if i is None or rodada != self.rodada or i in self.respostas or not self.atual:
            return
        if not (isinstance(resposta, int) and 0 <= resposta < 8):
            return
        self.respostas[i] = (resposta, agora())
        await self.salao.enviar(self.lados[1 - i], {"t": "duelo_respondeu", "duelo": self.id, "rodada": rodada})
        self.evento.set()

    def vencedor(self):
        if self.desistente is not None:
            return 1 - self.desistente
        if self.vidas:
            if self.vidas[0] != self.vidas[1]:
                return 0 if self.vidas[0] > self.vidas[1] else 1
        if self.pontos[0] != self.pontos[1]:
            return 0 if self.pontos[0] > self.pontos[1] else 1
        return None

    async def encerrar(self):
        if self.fim:
            return
        self.fim = True
        vencedor = self.vencedor()
        motivo = self.motivo_desistencia if self.desistente is not None else ""
        # sai de cena antes de avisar: quem recebe o fim já pode desafiar de novo (a revanche)
        self.salao.encerrado(self)
        for i, s in enumerate(self.lados):
            resultado = "empate" if vencedor is None else "vitoria" if vencedor == i else "derrota"
            await self.salao.enviar(s, self.visto_por(i, {
                "t": "duelo_fim", "duelo": self.id, "resultado": resultado, "motivo": motivo,
                "desistente": None if self.desistente is None else ("eu" if self.desistente == i else "ele"),
                "acertos": [self.acertos[i], self.acertos[1 - i]], "rodadas": self.rodada,
                "podeDenunciar": self.modo == "autoral" and bool(self.autorais[1 - i]),
                "modo": self.modo, "total": self.total, "oponente": self.lados[1 - i].sid,
            }))
        if vencedor is None:
            texto = f"Empate entre {self.nomes[0]} e {self.nomes[1]} no {MODOS[self.modo]['nome']}!"
        else:
            texto = f"{self.nomes[vencedor]} venceu {self.nomes[1 - vencedor]} no {MODOS[self.modo]['nome']}" + (f" ({motivo})" if motivo else "!")
        self.salao.espalhar({"t": "anuncio", "icone": "🏆", "texto": texto})
        # o placar de duelos de cada herói (no banco, com a trava do jogador) e o perfil novo para todos
        perfis = await asyncio.to_thread(gravar_resultado, self, vencedor, motivo)
        for s, perfil in zip(self.lados, perfis):
            if perfil and self.salao.sessoes.get(s.sid) is s:
                s.perfil = perfil
                self.salao.espalhar({"t": "perfil", "jogador": s.publico()})
        # os pontos da Casa de cada um (quem vence leva mais) e o pódio da Sala de Troféus, na hora para todo mundo
        for i, s in enumerate(self.lados):
            await self.salao.pontuar((self.ids[i], (perfis[i] or s.perfil).get("casa")), "duelo_vitoria" if vencedor == i else "duelo")
        await self.salao.ao_ranking(None, {}, espalhar=True)


class Fenda:
    """Uma Fenda do Oráculo: um fragmento do Oráculo rasga o céu sobre o Círculo da Fenda e 2 a 4 heróis o
    enfrentam juntos. Cada rodada, cada um responde a SUA pergunta (sorteada no perigo do chefão): acertar
    tira vida dele (rápido vale crítico), errar quebra um dos escudos do grupo. Vence quem zerar a vida dele
    antes de os escudos acabarem."""

    MAXIMO = 4
    MINIMO = 2
    RODADAS_MAXIMAS = 15

    def __init__(self, salao, dono):
        self.salao = salao
        self.id = uuid.uuid4().hex[:10]
        self.estado = "reunindo"
        self.membros = []
        self.ate = agora() + SEGUNDOS_PARA_REUNIR_A_FENDA
        self.evento = asyncio.Event()
        self.tipo = None
        self.vida = self.vida_maxima = 0
        self.escudos = 0
        self.rodada = 0
        self.atual = {}  # sid -> pergunta da rodada
        self.respostas = {}  # sid -> (resposta, quando)
        self.tarefa = None
        self.vistas = []
        self._entrar_direto(dono)

    def _entrar_direto(self, s):
        self.membros.append(s)
        s.fenda = self

    def publico(self):
        return {"id": self.id, "estado": self.estado, "tipo": self.tipo, "nome": MONSTROS[self.tipo]["nome"] if self.tipo else None,
                "vida": self.vida, "vidaMaxima": self.vida_maxima, "escudos": self.escudos, "rodada": self.rodada,
                "membros": [{"sid": m.sid, "nome": m.perfil["nome"]} for m in self.membros], "resta": max(0, round(self.ate - agora())),
                "maximo": self.MAXIMO, "minimo": self.MINIMO, "furia": self.furia()}

    def furia(self):
        return bool(self.vida_maxima) and self.vida <= self.vida_maxima / 2

    def espalhar_estado(self):
        self.salao.espalhar({"t": "fenda", "fenda": self.publico()})

    async def entrar(self, s):
        if s in self.membros:
            return
        if len(self.membros) >= self.MAXIMO:
            return await self.salao.aviso(s, "A Fenda já tem 4 heróis.", "🌀")
        self._entrar_direto(s)
        self.espalhar_estado()
        if len(self.membros) >= self.MAXIMO:
            self.evento.set()

    def sair(self, s):
        if s not in self.membros:
            return
        self.membros.remove(s)
        s.fenda = None
        self.respostas.pop(s.sid, None)
        self.atual.pop(s.sid, None)
        self.evento.set()
        if self.membros:
            self.espalhar_estado()

    async def esperar(self, condicao, segundos):
        limite = agora() + segundos
        while not condicao() and self.membros and agora() < limite:
            self.evento.clear()
            try:
                await asyncio.wait_for(self.evento.wait(), timeout=max(0.05, limite - agora()))
            except asyncio.TimeoutError:  # no Python 3.10 (o do servidor) não é o mesmo TimeoutError
                break

    async def rodar(self):
        try:
            await self.esperar(lambda: len(self.membros) >= self.MAXIMO, SEGUNDOS_PARA_REUNIR_A_FENDA)
            if len(self.membros) < self.MINIMO:
                for s in list(self.membros):
                    await self.salao.aviso(s, "Ninguém mais veio: a Fenda se fechou sozinha. Chama os amigos e tenta de novo!", "🌀")
                return
            await self.batalha()
        except asyncio.CancelledError:
            raise
        except Exception as erro:  # noqa: BLE001 (um erro numa Fenda não pode derrubar o salão)
            print(f"[salao] erro na Fenda {self.id}: {erro!r}", flush=True)
        finally:
            self.salao.fenda_fechou(self)

    async def batalha(self):
        n = len(self.membros)
        nivel_medio = sum(m.perfil["nivel"] for m in self.membros) / n
        self.tipo = CHEFES_DA_FENDA[min(len(CHEFES_DA_FENDA) - 1, int(nivel_medio // 4))]
        self.vida = self.vida_maxima = 6 + 4 * n
        self.escudos = 2 + n
        self.estado = "batalha"
        for s in self.membros:
            await self.salao.enviar(s, {"t": "fenda_inicio", "fenda": self.publico()})
        self.espalhar_estado()
        await asyncio.sleep(2.5)
        while self.membros and self.vida > 0 and self.escudos > 0 and self.rodada < self.RODADAS_MAXIMAS:
            await self.rodada_nova()
        await self.encerrar()

    def perigo(self):
        return min(4, max(1, MONSTROS[self.tipo]["nivel"] + (1 if self.furia() else 0)))

    async def rodada_nova(self):
        self.rodada += 1
        self.respostas = {}
        self.inicio = agora()
        limite = 18 if self.furia() else SEGUNDOS_DA_PERGUNTA_DA_FENDA
        self.atual = {}
        for s in self.membros:
            pergunta = sortear_pergunta(self.perigo(), {1}, self.vistas)
            self.vistas = (self.vistas + [pergunta["ref"].partition("@")[0]])[-80:]
            if not pergunta["cenario"] and random.random() < 0.2:
                pergunta = como_verdadeiro_ou_falso(pergunta)
            self.atual[s.sid] = {"ref": pergunta["ref"], "publica": pergunta_publica(pergunta), "limite": limite}
            await self.salao.enviar(s, {"t": "fenda_pergunta", "rodada": self.rodada, "pergunta": self.atual[s.sid]["publica"], "limite": limite, "fenda": self.publico()})
        await self.esperar(lambda: all(m.sid in self.respostas for m in self.membros), limite + 1.5)
        resultados = []
        for s in list(self.membros):
            pergunta = self.atual.get(s.sid)
            if not pergunta:
                continue
            resposta, quando = self.respostas.get(s.sid, (None, None))
            segundos = round(quando - self.inicio, 1) if quando else None
            certo = corrigir_pergunta(pergunta["ref"], resposta) if resposta is not None else corrigir_pergunta(pergunta["ref"], -1)
            correta = resposta is not None and bool(certo["correta"]) and segundos <= limite + 0.5
            dano = (2 if segundos is not None and segundos <= 6 else 1) if correta else 0
            if correta:
                self.vida = max(0, self.vida - dano)
            else:
                self.escudos = max(0, self.escudos - 1)
            resultados.append({"sid": s.sid, "nome": s.perfil["nome"], "correta": correta, "dano": dano, "segundos": segundos,
                               "resposta_certa": certo["resposta_certa"], "texto_certo": certo.get("texto_certo"), "explicacao": certo["explicacao"]})
        for s in self.membros:
            meu = next((r for r in resultados if r["sid"] == s.sid), None)
            await self.salao.enviar(s, {"t": "fenda_resultado", "rodada": self.rodada, "eu": meu, "todos": [{k: r[k] for k in ("sid", "nome", "correta", "dano")} for r in resultados], "fenda": self.publico()})
        self.espalhar_estado()
        await asyncio.sleep(3.5)

    async def receber_resposta(self, s, rodada, resposta):
        if rodada != self.rodada or s.sid in self.respostas or s.sid not in self.atual or not isinstance(resposta, int):
            return
        self.respostas[s.sid] = (resposta, agora())
        for outro in self.membros:
            if outro is not s:
                await self.salao.enviar(outro, {"t": "fenda_respondeu", "sid": s.sid, "rodada": rodada})
        self.evento.set()

    async def encerrar(self):
        venceu = self.vida <= 0 and bool(self.membros)
        self.estado = "fim"
        nome = MONSTROS[self.tipo]["nome"]
        nomes = ", ".join(m.perfil["nome"] for m in self.membros)
        if venceu:
            self.salao.espalhar({"t": "anuncio", "icone": "🌀", "texto": f"A Fenda foi fechada! {nomes} venceram {nome}."})
        elif self.membros:
            self.salao.espalhar({"t": "anuncio", "icone": "💀", "texto": f"{nome} quebrou os escudos de {nomes}. A Fenda se fechou... por enquanto."})
        for s in list(self.membros):
            if venceu:
                ganhos, perfil = await asyncio.to_thread(premiar, s.jogador_id, 120, 60, "manto-fenda", None, f"fenda:{self.tipo}")
            else:
                ganhos, perfil = await asyncio.to_thread(premiar, s.jogador_id, 20, 0, None, None, f"fenda-derrota:{self.tipo}")
            await self.salao.enviar(s, {"t": "fenda_fim", "venceu": venceu, "tipo": self.tipo, "nome": nome, "ganhos": ganhos, "rodadas": self.rodada})
            await self.salao.entregar_premio(s, [], perfil, "")
            if venceu:
                await self.salao.pontuar(s, "fenda")


def validar_autorais(lista, quantas):
    """As perguntas que um jogador escreveu: o número certo, com 2 a 4 alternativas e o texto aprovado
    pelo filtro. Devolve (perguntas limpas, None) ou (None, motivo)."""
    if not isinstance(lista, list) or len(lista) != quantas:
        return None, f"Escreve as {quantas} perguntas antes de entregar."
    limpas = []
    for n, item in enumerate(lista, 1):
        if not isinstance(item, dict):
            return None, f"A pergunta {n} está incompleta."
        pergunta = moderacao.limpar(item.get("pergunta"))
        opcoes = [moderacao.limpar(o).replace("\n", " ") for o in (item.get("opcoes") or []) if isinstance(o, str) and o.strip()]
        correta = item.get("correta")
        if len(pergunta) < 8:
            return None, f"A pergunta {n} está curta demais."
        if not 2 <= len(opcoes) <= 4:
            return None, f"A pergunta {n} precisa de 2 a 4 alternativas."
        if len({moderacao.achatar(o) for o in opcoes}) != len(opcoes):
            return None, f"A pergunta {n} tem alternativas repetidas."
        if not isinstance(correta, int) or not 0 <= correta < len(opcoes):
            return None, f"Marca qual é a alternativa certa da pergunta {n}."
        for texto, maximo in [(pergunta, 220)] + [(o, 90) for o in opcoes]:
            motivo = moderacao.motivo_para_recusar(texto, maximo)
            if motivo:
                return None, f"Pergunta {n}: {motivo}"
        limpas.append({"pergunta": pergunta, "opcoes": opcoes, "correta": correta})
    return limpas, None


def ranking_com_visual(no_podio=3):
    """O ranking de vitórias (30 dias) para o quadro dos campeões; os do pódio vêm com o visual e o título
    (o pódio da Sala de Troféus mostra o herói de cada um). O id do save não sai daqui."""
    saida = []
    for posicao, linha in enumerate(banco.ranking_de_duelos()):
        item = {"nome": linha["nome"], "vitorias": linha["vitorias"]}
        if posicao < no_podio:
            progresso = banco.carregar_progresso(linha["id"])
            if progresso:
                perfil = perfil_de(progresso)
                item.update(avatar=perfil["avatar"], classe=perfil["classe"])
        saida.append(item)
    return saida


def gravar_resultado(duelo, vencedor, motivo):
    """Guarda o duelo e soma no placar de cada herói (estatisticas.duelos). Devolve os perfis novos."""
    import jogador

    vencedor_id = None if vencedor is None else duelo.ids[vencedor]
    banco.registrar_duelo(duelo.id, duelo.modo, duelo.rodada, duelo.ids[0], duelo.ids[1], duelo.pontos[0], duelo.pontos[1], vencedor_id, motivo)
    perfis = []
    for i, jogador_id in enumerate(duelo.ids):
        with banco.trava_do_jogador(jogador_id):
            progresso = banco.carregar_progresso(jogador_id)
            if not progresso:
                perfis.append(None)
                continue
            progresso = jogador.normalizar(progresso)
            duelos = progresso["estatisticas"].setdefault("duelos", {})
            chave = "empates" if vencedor is None else "vitorias" if vencedor == i else "derrotas"
            duelos[chave] = int(duelos.get(chave) or 0) + 1
            por_modo = duelos.setdefault("porModo", {}).setdefault(duelo.modo, {})
            por_modo[chave] = int(por_modo.get(chave) or 0) + 1
            banco.salvar_progresso(jogador_id, progresso)
            banco.registrar(jogador_id, "duelo", {"modo": duelo.modo, "resultado": chave, "contra": duelo.nomes[1 - i], "pontos": duelo.pontos[i]})
            perfis.append(perfil_de(progresso))
    return perfis


# ---------- a conexão de cada navegador ----------

def endereco(ws):
    """O IP de quem conecta (atrás do nginx, ele vem no X-Forwarded-For, que o nginx sempre reescreve)."""
    remoto = (ws.remote_address or ("?",))[0]
    if remoto in ("127.0.0.1", "::1"):
        encaminhado = ws.request.headers.get("X-Forwarded-For") if ws.request else None
        if encaminhado:
            return encaminhado.split(",")[0].strip()
    return remoto


SALAO = Salao()


async def atender(ws):
    ip = endereco(ws)
    if len(SALAO.sessoes) >= MAXIMO_CONEXOES:
        await ws.close(4001, "salão cheio")
        return
    if sum(1 for s in SALAO.sessoes.values() if s.ip == ip) >= MAXIMO_POR_IP:
        await ws.close(4002, "muitas conexões deste endereço")
        return
    sessao = None
    try:
        # a primeira mensagem tem que ser "entrar", em até 10 segundos
        primeira = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
        if not isinstance(primeira, dict) or primeira.get("t") != "entrar":
            return
        sessao = await SALAO.entrar(ws, primeira, ip)
        if not sessao:
            return
        async for bruto in ws:
            if not sessao.gastar_ficha():
                if sessao.fichas < FICHAS_PARA_DERRUBAR:
                    await ws.close(4003, "mensagens demais")
                    break
                continue
            try:
                mensagem = json.loads(bruto)
            except (ValueError, TypeError):
                continue
            if isinstance(mensagem, dict):
                await SALAO.tratar(sessao, mensagem)
    except (asyncio.TimeoutError, TimeoutError, ValueError):
        pass
    except Exception as erro:  # noqa: BLE001 (a conexão caiu ou mandou lixo)
        nome = type(erro).__name__
        if "ConnectionClosed" not in nome:
            print(f"[salao] conexão encerrada por erro: {erro!r}", flush=True)
    finally:
        if sessao:
            await SALAO.sair(sessao)


def caminho_valido(conexao, pedido):
    """Só o endereço do salão (/ no computador, /salao atrás do nginx) aceita WebSocket."""
    if pedido.path.split("?")[0] not in ("/", "/salao", "/salao/"):
        return conexao.respond(404, "Nada aqui.\n")
    return None


async def servir(host=HOST, porta=PORTA, pronto=None):
    from websockets.asyncio.server import serve

    banco.iniciar()
    async with serve(atender, host, porta, max_size=16 * 1024, ping_interval=20, ping_timeout=20,
                     process_request=caminho_valido, compression=None) as servidor:
        tarefas = [asyncio.create_task(SALAO.laco_das_posicoes()), asyncio.create_task(SALAO.laco_do_mural()),
                   asyncio.create_task(SALAO.laco_do_dragao()), asyncio.create_task(SALAO.laco_da_liga())]
        print(f"[salao] o Salão está aberto em ws://{host}:{porta}", flush=True)
        if pronto:
            pronto(servidor)
        try:
            await asyncio.Future()
        finally:
            for tarefa in tarefas:
                tarefa.cancel()


def rodar_em_linha(host=HOST, porta=PORTA):
    """Sobe o Salão numa linha de execução própria (o python app.py faz isso no computador)."""
    import threading

    def correr():
        try:
            asyncio.run(servir(host, porta))
        except OSError as erro:
            print(f"[salao] não deu para abrir a porta {porta}: {erro}", flush=True)

    linha = threading.Thread(target=correr, name="salao", daemon=True)
    linha.start()
    return linha


if __name__ == "__main__":
    import signal

    async def principal():
        laco = asyncio.get_running_loop()
        tarefa = asyncio.create_task(servir())
        if hasattr(signal, "SIGTERM"):
            try:
                laco.add_signal_handler(signal.SIGTERM, tarefa.cancel)
            except NotImplementedError:  # Windows
                pass
        try:
            await tarefa
        except asyncio.CancelledError:
            print("[salao] fechando o Salão.", flush=True)

    try:
        asyncio.run(principal())
    except KeyboardInterrupt:
        pass
