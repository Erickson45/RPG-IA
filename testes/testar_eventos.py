"""Confere as novidades do Salão do multijogador, com jogadores de verdade conectados por WebSocket (num
banco de teste à parte: o banco do jogo não é tocado):
- as Casas: escolher (o manto vem junto), a trava de 7 dias para trocar, o chat da Casa (chega a quem é da
  casa, longe ou perto, e não chega aos outros) e os pontos da Taça (duelo vencido e jogado);
- a Pergunta do Dragão: todos recebem a pergunta, quem acerta primeiro leva (XP, moedas, o manto), quem
  acerta depois não; e o teto diário de XP e moedas do Salão;
- a Fenda do Oráculo: abrir, entrar, a batalha em grupo até fechar a Fenda, o prêmio e os pontos da Casa;
- a plateia: quem está fora do duelo recebe a pergunta e o resultado (sem a resposta antes da hora);
- o Desafio do Dia: as mesmas perguntas para todos, uma tentativa por dia, a sequência e o baú do 7º dia;
- a Liga da Semana: o campeão da semana passada é anunciado e ganha o manto (uma vez só).
Uso: python testar_eventos.py <raiz>"""
import asyncio
import json
import os
import sys
import tempfile
import threading
import time
import warnings
from datetime import datetime, timedelta, timezone
from pathlib import Path

warnings.filterwarnings("ignore", category=DeprecationWarning)
PASTA_TESTE = Path(tempfile.mkdtemp(prefix="salao-eventos-"))
os.environ["BANCO_ARQUIVO"] = str(PASTA_TESTE / "teste.db")
os.environ["SALAO_TESTES"] = "1"
os.environ["SALAO_DRAGAO_MIN"] = "999"  # o dragão só vem quando o teste chama
sys.path.insert(0, sys.argv[1] if len(sys.argv) > 1 else ".")
os.chdir(sys.argv[1] if len(sys.argv) > 1 else ".")

import banco  # noqa: E402
import jogador as regras  # noqa: E402
import salao  # noqa: E402
from app import app  # noqa: E402
from conteudo import corrigir_pergunta  # noqa: E402
from websockets.sync.client import connect  # noqa: E402

salao.CONTAGEM_INICIAL = 0.05
salao.PAUSA_DO_RESULTADO = 0.05
salao.SEGUNDOS_PARA_REUNIR_A_FENDA = 1.0
salao.ESPERA_FALA = 0

c = app.test_client()
falhas = []
ids = []


def conferir(condicao, mensagem):
    if not condicao:
        falhas.append(mensagem)
        print("  FALHOU:", mensagem)


def novo(nome, kit="mago"):
    jid = c.post("/api/jogador", json={"progresso": {"nome": nome, "avatar": {"kit": kit, "manto": "#2e5cb8"}}}).get_json()["id"]
    ids.append(jid)
    return jid


def progresso(jid):
    return regras.normalizar(banco.carregar_progresso(jid))


class Cliente:
    def __init__(self, porta, jid, x=500, y=500):
        self.ws = connect(f"ws://127.0.0.1:{porta}/", open_timeout=5)
        self.caixa = []
        self.enviar({"t": "entrar", "id": jid, "x": x, "y": y})
        self.ola = self.esperar("ola")
        self.sid = self.ola["voce"]

    def enviar(self, mensagem):
        self.ws.send(json.dumps(mensagem))

    def esperar(self, tipo, segundos=10, condicao=None):
        limite = time.time() + segundos
        while True:
            for i, m in enumerate(self.caixa):
                if m.get("t") == tipo and (condicao is None or condicao(m)):
                    return self.caixa.pop(i)
            restante = limite - time.time()
            if restante <= 0:
                raise TimeoutError(f"não chegou '{tipo}' (chegaram: {[m.get('t') for m in self.caixa][-12:]})")
            try:
                self.caixa.append(json.loads(self.ws.recv(timeout=restante)))
            except TimeoutError:
                continue

    def nada(self, tipo, segundos=0.6, condicao=None):
        try:
            self.esperar(tipo, segundos, condicao)
            return False
        except TimeoutError:
            return True

    def limpar(self):
        try:
            while True:
                self.caixa.append(json.loads(self.ws.recv(timeout=0.15)))
        except TimeoutError:
            pass
        self.caixa = []


def certa(ref):
    for k in range(8):
        if corrigir_pergunta(ref, k)["correta"]:
            return k
    return 0


def principal():
    pronto = threading.Event()
    estado = {}

    def subir():
        async def correr():
            await salao.servir("127.0.0.1", 0, pronto=lambda s: (estado.update(porta=list(s.sockets)[0].getsockname()[1]), pronto.set()))
        asyncio.run(correr())

    threading.Thread(target=subir, daemon=True).start()
    pronto.wait(10)
    porta = estado["porta"]
    ja, jb, jc = novo("TesteClaude Evento A"), novo("TesteClaude Evento B", "guerreiro"), novo("TesteClaude Evento C", "arqueiro")
    print(f"heróis de teste: {ids}")
    a = Cliente(porta, ja, 500, 500)
    b = Cliente(porta, jb, 540, 500)
    longe = Cliente(porta, jc, 60, 1400)
    conferir(a.ola.get("casas") and set(a.ola["casas"]) == {"runa", "aco", "flecha"}, "o olá traz as três Casas")

    print("as Casas")
    a.enviar({"t": "escolher_casa", "casa": "runa"})
    conferir(a.esperar("casa_escolhida")["casa"] == "runa", "A entra na Casa da Runa")
    conferir("manto-casa-runa" in progresso(ja)["cosmeticos"], "o manto da Casa vem junto")
    conferir(b.esperar("perfil", condicao=lambda m: m["jogador"]["sid"] == a.sid)["jogador"]["casa"] == "runa", "os outros veem a Casa de A")
    a.enviar({"t": "escolher_casa", "casa": "aco"})
    conferir("7 dias" in a.esperar("aviso")["texto"], "trocar de Casa antes de 7 dias não deixa")
    longe.enviar({"t": "escolher_casa", "casa": "runa"})
    longe.esperar("casa_escolhida")
    b.enviar({"t": "escolher_casa", "casa": "aco"})
    b.esperar("casa_escolhida")
    a.limpar(), b.limpar(), longe.limpar()
    a.enviar({"t": "falar", "texto": "Bora pegar a Taça, Runa!", "canal": "casa"})
    fala = longe.esperar("fala")
    conferir(fala.get("canal") == "casa" and fala["texto"] == "Bora pegar a Taça, Runa!", "o chat da Casa chega a quem é da casa, mesmo longe")
    conferir(b.nada("fala"), "o chat da Casa não chega a quem é de outra casa")

    print("os pontos da Taça (um duelo)")
    a.limpar(), b.limpar(), longe.limpar()
    a.enviar({"t": "desafiar", "sid": b.sid, "modo": "x1", "rodadas": 5})
    b.esperar("convite")
    b.enviar({"t": "responder_convite", "de": a.sid, "aceitar": True})
    a.esperar("duelo_inicio"), b.esperar("duelo_inicio")
    plateia = longe.esperar("arena_pergunta")
    conferir("ref" not in json.dumps(plateia) and plateia["pergunta"]["opcoes"], "a plateia recebe a pergunta, sem a resposta")
    for _ in range(5):
        pa = a.esperar("duelo_pergunta")
        b.esperar("duelo_pergunta")
        duelo = salao.SALAO.sessoes[a.sid].duelo
        a.enviar({"t": "duelo_responder", "rodada": pa["rodada"], "resposta": certa(duelo.atual[0]["ref"])})
        b.enviar({"t": "duelo_responder", "rodada": pa["rodada"], "resposta": (certa(duelo.atual[1]["ref"]) + 1) % len(pa["pergunta"]["opcoes"])})
        a.esperar("duelo_resultado"), b.esperar("duelo_resultado")
    conferir(longe.esperar("arena_resultado")["acertos"] == [True, False], "a plateia recebe o resultado da rodada")
    a.esperar("duelo_fim")
    placar = a.esperar("casas", condicao=lambda m: m["placar"].get("runa") and m["placar"].get("aco"))["placar"]
    conferir(placar.get("runa") == 10 and placar.get("aco") == 3, f"o duelo dá 10 à casa de quem venceu e 3 à de quem jogou ({placar})")

    print("a Pergunta do Dragão")
    a.limpar(), b.limpar(), longe.limpar()
    xp_antes = progresso(jb)["xp"]
    a.enviar({"t": "teste_evento", "evento": "dragao", "limite": 4})
    for cliente in (a, b, longe):
        cliente.esperar("dragao_chega")
    pergunta = b.esperar("dragao_pergunta")
    a.esperar("dragao_pergunta")
    ref = salao.SALAO.dragao["ref"]
    a.enviar({"t": "dragao_responder", "id": pergunta["id"], "resposta": (certa(ref) + 1) % len(pergunta["pergunta"]["opcoes"])})
    conferir(a.esperar("dragao_resposta")["correta"] is False, "a resposta errada não vale")
    b.enviar({"t": "dragao_responder", "id": pergunta["id"], "resposta": certa(ref)})
    conferir(b.esperar("dragao_resposta").get("primeiro") is True, "quem acerta primeiro vence")
    longe.enviar({"t": "dragao_responder", "id": pergunta["id"], "resposta": certa(ref)})
    r = longe.esperar("dragao_resposta")
    conferir(r["correta"] and not r["primeiro"], "quem acerta depois não leva o prêmio")
    fim = a.esperar("dragao_fim")
    conferir(fim["vencedor"]["sid"] == b.sid, "todos ficam sabendo quem venceu")
    premio = b.esperar("premio")
    conferir(any("Dragão Dourado" in g["texto"] for g in premio["ganhos"]), "o vencedor ganha o Manto do Dragão Dourado")
    conferir(progresso(jb)["xp"] == xp_antes + 60, "o vencedor ganha 60 de XP")
    # o teto diário: depois de 400 de XP no dia, o Salão não dá mais XP (os visuais continuam vindo)
    for _ in range(8):
        salao.premiar(jb, 60, 40, None, None, "teste-teto")
    dia = progresso(jb)["salaoDia"]
    conferir(dia["xp"] == salao.LIMITE_DIARIO["xp"] and dia["moedas"] == salao.LIMITE_DIARIO["moedas"], f"o teto diário de XP e moedas segura ({dia})")

    print("a Fenda do Oráculo")
    a.limpar(), b.limpar(), longe.limpar()
    a.enviar({"t": "fenda_abrir"})
    conferir(longe.esperar("fenda", condicao=lambda m: m["fenda"])["fenda"]["estado"] == "reunindo", "todos veem a Fenda aberta")
    longe.enviar({"t": "fenda_entrar"})
    a.esperar("fenda_inicio"), longe.esperar("fenda_inicio")
    fenda = salao.SALAO.fenda
    conferir(fenda and len(fenda.membros) == 2 and fenda.vida_maxima == 14, "a Fenda começa com o grupo e a vida certa")
    b.enviar({"t": "desafiar", "sid": a.sid, "modo": "x1", "rodadas": 5})
    conferir("ocupado" in b.esperar("aviso")["texto"], "quem está na Fenda não recebe convite de duelo")
    venceu = None
    for _ in range(12):
        pa = a.esperar("fenda_pergunta", 15)
        pl = longe.esperar("fenda_pergunta", 15)
        a.enviar({"t": "fenda_responder", "rodada": pa["rodada"], "resposta": certa(fenda.atual[a.sid]["ref"])})
        longe.enviar({"t": "fenda_responder", "rodada": pl["rodada"], "resposta": certa(fenda.atual[longe.sid]["ref"])})
        ra = a.esperar("fenda_resultado", 15)
        conferir(ra["eu"]["correta"], "a resposta certa tira vida do chefão")
        if ra["fenda"]["vida"] <= 0:
            venceu = a.esperar("fenda_fim", 15)
            break
    conferir(venceu and venceu["venceu"], "o grupo fecha a Fenda")
    conferir(venceu and any("Fenda" in g["texto"] for g in venceu["ganhos"]), "quem fecha a Fenda ganha o manto dela")
    longe.esperar("fenda_fim", 15)
    a.esperar("fenda", 15, condicao=lambda m: m["fenda"] is None)
    conferir("manto-fenda" in progresso(jc)["cosmeticos"], "o manto vai para os dois do grupo")
    placar = a.esperar("casas", condicao=lambda m: m["placar"].get("runa", 0) >= 40)["placar"]
    conferir(placar.get("runa") == 10 + 15 + 15, f"a Fenda dá 15 pontos a cada herói do grupo ({placar})")
    conferir(salao.SALAO.fenda is None, "a Fenda se fecha no fim")

    print("o Desafio do Dia")
    d = c.get(f"/api/jogador/{ja}/desafio-dia").get_json()
    conferir(d["pergunta"]["numero"] == 1 and not d["feito"], "o desafio de hoje começa na pergunta 1")
    d_outro = c.get(f"/api/jogador/{jb}/desafio-dia").get_json()
    conferir(d_outro["pergunta"]["pergunta"] == d["pergunta"]["pergunta"], "as perguntas do dia são as mesmas para todos")

    def responder_tudo(jid, acertar=True):
        c.get(f"/api/jogador/{jid}/desafio-dia")  # abrir o desafio (no jogo, a janela abre antes)
        r = None
        for _ in range(5):
            p = progresso(jid)["desafioDia"]
            ref = p["refs"][p["atual"]]
            k = certa(ref) if acertar else (certa(ref) + 1) % 2
            r = c.post(f"/api/jogador/{jid}/desafio-dia/responder", json={"resposta": k}).get_json()
        return r

    r = responder_tudo(ja)
    conferir(r["fim"]["contou"] and r["fim"]["sequencia"] == 1 and r["fim"]["ganhos"], "acertar o desafio conta o 1º dia da sequência e dá prêmio")
    conferir(c.post(f"/api/jogador/{ja}/desafio-dia/responder", json={"resposta": 0}).status_code == 400, "uma tentativa por dia")
    # seis dias seguidos já feitos (ontem foi o 6º): hoje é o 7º e abre o baú
    p = progresso(jb)
    ontem = (datetime.fromisoformat(banco.hoje()) - timedelta(days=1)).date().isoformat()
    p["desafioDia"] = {"data": ontem, "sequencia": 6, "ultimoDia": ontem, "baus": 0}
    banco.salvar_progresso(jb, p)
    r = responder_tudo(jb)
    conferir(r["fim"]["sequencia"] == 7 and r["fim"]["bau"], "no 7º dia seguido o baú abre")
    conferir("manto-sequencia" in progresso(jb)["cosmeticos"], "o baú traz o Manto da Chama Constante")

    print("a Liga da Semana")
    semana_passada = (datetime.fromisoformat(banco.inicio_da_semana(-1)) + timedelta(days=2)).isoformat(timespec="seconds")
    with banco.conectar() as conexao:
        for n in range(3):
            conexao.execute("INSERT INTO duelos (id, modo, rodadas, a_id, b_id, pontos_a, pontos_b, vencedor_id, motivo, quando) VALUES (?, 'x1', 5, ?, ?, 500, 0, ?, '', ?)",
                            (f"liga-{n}", jc, ja, jc, semana_passada))
    a.limpar()
    a.enviar({"t": "teste_evento", "evento": "liga"})
    campeao = a.esperar("campeao")["campeao"]
    conferir(campeao and campeao["nome"] == "TesteClaude Evento C" and campeao["vitorias"] == 3, "o campeão da semana passada é anunciado")
    conferir("id" not in campeao, "o campeão vai sem o id do save")
    conferir("manto-campeao" in progresso(jc)["cosmeticos"] and banco.semana(-1) in progresso(jc)["campeaoSemanas"], "o campeão ganha o Manto do Campeão")
    perfil_c = a.esperar("perfil", condicao=lambda m: m["jogador"]["sid"] == longe.sid)["jogador"]
    conferir(perfil_c.get("campeao") is True, "os outros veem quem é o campeão (a aura dourada)")
    for cliente in (a, b, longe):
        cliente.ws.close()
    return 0


try:
    codigo = principal()
finally:
    for jid in ids:
        banco.apagar_jogador(jid)
    banco.fechar()
    sobrou = [jid for jid in ids if banco.carregar_progresso(jid)]
    banco.fechar()
    print(f"heróis de teste apagados ({len(ids)}); sobrou algum: {bool(sobrou)}")
    import shutil

    shutil.rmtree(PASTA_TESTE, ignore_errors=True)

print()
print("FALHAS:" if falhas else "Tudo certo: Casas, Pergunta do Dragão, Fenda, plateia, Desafio do Dia e Liga funcionam.", *falhas, sep="\n- ")
sys.exit(1 if falhas else codigo)
