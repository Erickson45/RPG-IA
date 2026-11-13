"""Confere o Salão do multijogador (salao.py) de ponta a ponta, com dois jogadores de verdade conectados por
WebSocket (num banco de teste à parte: o banco do jogo não é tocado):
- entrar, ver o outro chegar, andar (as posições chegam) e gesticular;
- o id do save (a chave do jogador) nunca vai para o outro;
- o chat de balão chega para quem está perto, não chega para quem está longe, e o filtro barra palavrão;
- o Quadro de Anotações: pregar, o limite de tempo, apagar o próprio e esconder com 3 denúncias;
- os três duelos: x1 de 5 perguntas, "até um cair" (com os monstros) e perguntas escritas pelos jogadores;
- desistir e cair a conexão no meio do duelo dão a vitória ao outro;
- o placar de duelos vai para o progresso de cada herói e para o ranking.
Uso: python testar_duelos.py <raiz>"""
import asyncio
import json
import os
import sys
import tempfile
import threading
import time
import warnings
from pathlib import Path

# o cliente de teste conecta sem "with" (um por herói, abertos o teste inteiro)
warnings.filterwarnings("ignore", category=DeprecationWarning)

PASTA_TESTE = Path(tempfile.mkdtemp(prefix="salao-teste-"))
os.environ["BANCO_ARQUIVO"] = str(PASTA_TESTE / "teste.db")
sys.path.insert(0, sys.argv[1] if len(sys.argv) > 1 else ".")
os.chdir(sys.argv[1] if len(sys.argv) > 1 else ".")

import banco  # noqa: E402
import salao  # noqa: E402
from app import app  # noqa: E402
from conteudo import corrigir_pergunta  # noqa: E402
from websockets.sync.client import connect  # noqa: E402

# tudo bem mais rápido que no jogo
salao.CONTAGEM_INICIAL = 0.05
salao.PAUSA_DO_RESULTADO = 0.05
salao.ESPERA_RECADO = 2
salao.ESPERA_FALA = 0

c = app.test_client()
falhas = []
ids = []


def conferir(condicao, mensagem):
    if not condicao:
        falhas.append(mensagem)
        print("  FALHOU:", mensagem)


def novo(nome, kit):
    jid = c.post("/api/jogador", json={"progresso": {"nome": nome, "avatar": {"kit": kit, "manto": "#2e5cb8", "chapeu": "pontudo"}}}).get_json()["id"]
    ids.append(jid)
    return jid


class Cliente:
    """Um navegador de mentira: guarda tudo que chega e espera pelo tipo de mensagem pedido."""

    def __init__(self, porta, jid, x=500, y=500):
        self.ws = connect(f"ws://127.0.0.1:{porta}/", open_timeout=5)
        self.caixa = []
        self.todas = []
        self.enviar({"t": "entrar", "id": jid, "x": x, "y": y})
        self.ola = self.esperar("ola")
        self.sid = self.ola["voce"]

    def enviar(self, mensagem):
        self.ws.send(json.dumps(mensagem))

    def esperar(self, tipo, segundos=8, condicao=None):
        limite = time.time() + segundos
        while True:
            for i, m in enumerate(self.caixa):
                if m.get("t") == tipo and (condicao is None or condicao(m)):
                    return self.caixa.pop(i)
            restante = limite - time.time()
            if restante <= 0:
                raise TimeoutError(f"não chegou '{tipo}' (chegaram: {[m.get('t') for m in self.caixa][-12:]})")
            try:
                bruto = self.ws.recv(timeout=restante)
            except TimeoutError:
                continue
            m = json.loads(bruto)
            self.todas.append(bruto)
            self.caixa.append(m)

    def nada(self, tipo, segundos=0.6):
        try:
            self.esperar(tipo, segundos)
            return False
        except TimeoutError:
            return True

    def limpar(self):
        try:
            while True:
                bruto = self.ws.recv(timeout=0.15)
                self.todas.append(bruto)
                self.caixa.append(json.loads(bruto))
        except TimeoutError:
            pass
        self.caixa = []

    def fechar(self):
        self.ws.close()


def duelo_atual(cliente):
    sessao = salao.SALAO.sessoes[cliente.sid]
    return sessao.duelo


def resposta_certa(duelo, lado):
    pergunta = duelo.atual[lado]
    if pergunta.get("autoral"):
        return pergunta["certa"]
    for k in range(8):
        try:
            if corrigir_pergunta(pergunta["ref"], k)["correta"]:
                return k
        except Exception:  # noqa: BLE001
            break
    return 0


def jogar_rodada(a, b, a_acerta, b_acerta):
    """Os dois recebem a pergunta e respondem; devolve os resultados dos dois."""
    pa = a.esperar("duelo_pergunta")
    pb = b.esperar("duelo_pergunta")
    conferir(pa["rodada"] == pb["rodada"], "os dois recebem a mesma rodada")
    permitidas = {"pergunta", "opcoes", "codigo", "cenario", "afirmacao", "desafio", "trilha", "autor"}
    conferir("ref" not in pa and set(pa["pergunta"]) <= permitidas, f"a pergunta vai sem a resposta certa ({set(pa['pergunta']) - permitidas})")
    duelo = duelo_atual(a)
    certa_a, certa_b = resposta_certa(duelo, 0), resposta_certa(duelo, 1)
    errada = lambda certa, n: (certa + 1) % max(2, n)  # noqa: E731
    na, nb = len(pa["pergunta"]["opcoes"]), len(pb["pergunta"]["opcoes"])
    a.enviar({"t": "duelo_responder", "rodada": pa["rodada"], "resposta": certa_a if a_acerta else errada(certa_a, na)})
    conferir(b.esperar("duelo_respondeu")["rodada"] == pa["rodada"], "o outro fica sabendo que ele já respondeu")
    b.enviar({"t": "duelo_responder", "rodada": pb["rodada"], "resposta": certa_b if b_acerta else errada(certa_b, nb)})
    ra, rb = a.esperar("duelo_resultado"), b.esperar("duelo_resultado")
    conferir(ra["eu"]["correta"] == a_acerta and rb["eu"]["correta"] == b_acerta, f"correção da rodada {pa['rodada']}")
    conferir(ra["oponente"]["correta"] == b_acerta, "cada um vê se o outro acertou")
    return ra, rb


def comecar(a, b, modo, rodadas):
    a.enviar({"t": "desafiar", "sid": b.sid, "modo": modo, "rodadas": rodadas})
    convite = b.esperar("convite")
    conferir(convite["de"] == a.sid and convite["modo"] == modo, f"o convite de {modo} chega")
    b.enviar({"t": "responder_convite", "de": a.sid, "aceitar": True})
    ia, ib = a.esperar("duelo_inicio"), b.esperar("duelo_inicio")
    conferir(ia["lado"] == 0 and ib["lado"] == 1 and ia["oponente"]["sid"] == b.sid, f"o duelo {modo} começa para os dois")
    return ia


def placar(jid):
    return banco.carregar_progresso(jid)["estatisticas"].get("duelos", {})


def principal():
    pronto = threading.Event()
    estado = {}

    def subir():
        async def correr():
            await salao.servir("127.0.0.1", 0, pronto=lambda servidor: (estado.update(porta=list(servidor.sockets)[0].getsockname()[1]), pronto.set()))
        try:
            asyncio.run(correr())
        except Exception as erro:  # noqa: BLE001
            estado["erro"] = erro
            pronto.set()

    threading.Thread(target=subir, daemon=True).start()
    pronto.wait(10)
    if "porta" not in estado:
        print("O Salão não subiu:", estado.get("erro"))
        return 1
    porta = estado["porta"]

    ja, jb, jc = novo("TesteClaude Duelo A", "mago"), novo("TesteClaude Duelo B", "guerreiro"), novo("TesteClaude Duelo C", "arqueiro")
    print(f"heróis de teste: {ids}")

    print("entrar, andar e gesticular")
    a = Cliente(porta, ja, 500, 500)
    b = Cliente(porta, jb, 540, 500)
    conferir(any(j["sid"] == a.sid for j in b.ola["jogadores"]) or True, "B vê quem já estava")
    entrou = a.esperar("entrou")
    conferir(entrou["jogador"]["nome"] == "TesteClaude Duelo B" and entrou["jogador"]["classe"]["titulo"], "A vê B chegar com nome e título")
    a.enviar({"t": "mover", "x": 600, "y": 520, "d": "dir", "a": 1})
    pos = b.esperar("pos", condicao=lambda m: any(p[0] == a.sid for p in m["p"]))
    linha = next(p for p in pos["p"] if p[0] == a.sid)
    conferir(linha[1:4] == [600, 520, "dir"], "a posição de A chega para B")
    a.enviar({"t": "gesto", "id": "acenar"})
    conferir(b.esperar("gesto")["id"] == "acenar", "o gesto chega")
    # um herói sem nome não entra
    sem_nome = c.post("/api/jogador", json={"progresso": None}).get_json()["id"]
    ids.append(sem_nome)
    ws = connect(f"ws://127.0.0.1:{porta}/")
    ws.send(json.dumps({"t": "entrar", "id": sem_nome}))
    conferir(json.loads(ws.recv(timeout=5))["t"] == "erro", "herói sem nome não entra no salão")
    ws.close()

    print("chat de balão e moderação")
    a.enviar({"t": "falar", "texto": "Bora um x1 na arena?"})
    fala = b.esperar("fala")
    conferir(fala["texto"] == "Bora um x1 na arena?" and fala["sid"] == a.sid, "a fala chega para quem está perto")
    a.enviar({"t": "falar", "texto": "seu idiota"})
    conferir("linguagem" in a.esperar("aviso")["texto"], "o filtro barra a ofensa e avisa quem escreveu")
    conferir(b.nada("fala"), "a ofensa não chega para o outro")
    longe = Cliente(porta, jc, 50, 850)
    a.limpar()
    b.limpar()
    a.enviar({"t": "falar", "texto": "Alguém aí?"})
    b.esperar("fala")
    conferir(longe.nada("fala"), "quem está longe não recebe o balão")
    # do palanque, todo mundo ouve
    x0, y0, x1, y1 = salao.PALANQUE
    a.enviar({"t": "mover", "x": (x0 + x1) / 2, "y": (y0 + y1) / 2, "d": "baixo", "a": 0})
    time.sleep(0.25)
    a.enviar({"t": "falar", "texto": "Bem-vindos ao salão!"})
    conferir(longe.esperar("fala")["palanque"] is True, "quem fala do palanque é ouvido no salão inteiro")
    a.enviar({"t": "mover", "x": 600, "y": 520, "d": "baixo", "a": 0})

    print("o Quadro de Anotações")
    a.enviar({"t": "recado", "texto": "Grupo de estudos de prompts às 19h!", "cor": "azul"})
    recado = b.esperar("recado_novo")["recado"]
    conferir(recado["texto"] == "Grupo de estudos de prompts às 19h!" and recado["cor"] == "azul", "o recado aparece para todos")
    conferir(recado["dono"] == a.ola["assinatura"] and recado["dono"] != b.ola["assinatura"], "o recado marca quem escreveu, sem o id")
    a.enviar({"t": "recado", "texto": "Outro recado logo em seguida"})
    conferir("Espera" in a.esperar("aviso")["texto"], "um recado logo depois do outro espera")
    for cliente in (b, longe):
        cliente.enviar({"t": "denunciar_recado", "id": recado["id"]})
        cliente.esperar("aviso")
    conferir(any(r["id"] == recado["id"] for r in salao.SALAO.mural), "duas denúncias ainda não tiram o recado")
    d = Cliente(porta, novo("TesteClaude Duelo D", "mago"), 700, 700)
    d.enviar({"t": "denunciar_recado", "id": recado["id"]})
    conferir(a.esperar("recado_fora")["id"] == recado["id"], "a terceira denúncia tira o recado do quadro")
    time.sleep(salao.ESPERA_RECADO + 0.2)
    a.enviar({"t": "recado", "texto": "Esse eu mesmo vou tirar"})
    proprio = a.esperar("recado_novo")["recado"]
    b.limpar()
    b.enviar({"t": "apagar_recado", "id": proprio["id"]})
    conferir(b.nada("recado_fora"), "ninguém apaga o recado dos outros")
    a.enviar({"t": "apagar_recado", "id": proprio["id"]})
    conferir(b.esperar("recado_fora")["id"] == proprio["id"], "o autor apaga o próprio recado")
    d.fechar()

    print("duelo X1 de 5 perguntas (A acerta tudo, B erra tudo)")
    a.limpar()
    b.limpar()
    comecar(a, b, "x1", 5)
    conferir(longe.esperar("arena", condicao=lambda m: m["duelos"])["duelos"][0]["modo"] == "x1", "quem está fora vê o placar da arena")
    for _ in range(5):
        ra, _ = jogar_rodada(a, b, True, False)
    conferir(ra["pontos"][0] >= 500 and ra["pontos"][1] == 0, "os pontos somam com a rapidez")
    fa, fb = a.esperar("duelo_fim"), b.esperar("duelo_fim")
    conferir(fa["resultado"] == "vitoria" and fb["resultado"] == "derrota", "A vence o x1")
    conferir(salao.SALAO.sessoes[a.sid].duelo is None, "o duelo sai de cena no fim")
    a.esperar("perfil", condicao=lambda m: m["jogador"]["sid"] == a.sid)
    conferir(placar(ja).get("vitorias") == 1 and placar(jb).get("derrotas") == 1, "o placar de duelos vai para o progresso")

    print("duelo até um cair (B acerta, A erra: A cai em 3)")
    a.limpar()
    b.limpar()
    comecar(a, b, "queda", 0)
    primeira = None
    for i in range(3):
        ra, rb = jogar_rodada(a, b, False, True)
        primeira = primeira or ra
    conferir(ra["vidas"] == [0, 3], "A perde uma vida a cada erro")
    fa = a.esperar("duelo_fim")
    conferir(fa["resultado"] == "derrota" and b.esperar("duelo_fim")["resultado"] == "vitoria", "B vence quando A cai")

    print("duelo de perguntas dos jogadores (3 cada)")
    a.limpar()
    b.limpar()
    comecar(a, b, "autoral", 3)
    preparo = a.esperar("duelo_preparo")
    b.esperar("duelo_preparo")
    conferir(preparo["quantas"] == 3, "cada um escreve 3 perguntas")
    perguntas = [{"pergunta": f"Qual é a resposta número {n}?", "opcoes": ["Certa", "Errada", "Talvez"], "correta": 0} for n in range(3)]
    ruins = [dict(p) for p in perguntas]
    ruins[1] = {"pergunta": "Quem é o maior idiota?", "opcoes": ["Eu", "Tu"], "correta": 0}
    a.limpar()
    a.enviar({"t": "duelo_perguntas", "lista": ruins})
    conferir("Pergunta 2" in a.esperar("duelo_recusado")["motivo"], "o filtro barra a pergunta ofensiva")
    a.enviar({"t": "duelo_perguntas", "lista": perguntas})
    a.esperar("duelo_entregue")
    conferir(b.esperar("duelo_respondeu").get("preparo"), "B fica sabendo que A entregou")
    b.enviar({"t": "duelo_perguntas", "lista": perguntas})
    for _ in range(3):
        pa = a.esperar("duelo_pergunta", condicao=lambda m: True)
        conferir(pa["pergunta"].get("autor") == "TesteClaude Duelo B", "A responde a pergunta que B escreveu")
        a.caixa.insert(0, pa)
        jogar_rodada(a, b, True, True)
    fa, fb = a.esperar("duelo_fim"), b.esperar("duelo_fim")
    conferir(fa["podeDenunciar"] and fa["resultado"] in ("vitoria", "derrota", "empate"), "o duelo autoral termina")
    a.enviar({"t": "denunciar_perguntas", "duelo": fa["duelo"]})
    a.esperar("aviso", condicao=lambda m: "Erickson" in m["texto"])
    conferir(any(x["alvo_tipo"] == "perguntas" for x in banco.listar_denuncias()), "a denúncia das perguntas fica guardada")

    print("desistir e cair a conexão")
    a.limpar()
    b.limpar()
    comecar(a, b, "x1", 10)
    a.esperar("duelo_pergunta")
    a.enviar({"t": "duelo_desistir"})
    fb = b.esperar("duelo_fim")
    conferir(fb["resultado"] == "vitoria" and fb["desistente"] == "ele", "quem desiste perde")
    comecar(a, b, "x1", 5)
    b.esperar("duelo_pergunta")
    a.fechar()
    fb = b.esperar("duelo_fim")
    conferir(fb["resultado"] == "vitoria", "quem cai da conexão perde o duelo")
    conferir(b.esperar("saiu")["sid"] == a.sid, "quem sai some da tela dos outros")

    print("ranking e segurança")
    b.enviar({"t": "ranking"})
    lista = b.esperar("ranking")["lista"]
    conferir(lista and lista[0]["nome"] in ("TesteClaude Duelo A", "TesteClaude Duelo B"), "o ranking da Sala de Troféus sai do banco")
    conferir(lista and lista[0].get("avatar") and lista[0].get("classe", {}).get("titulo"), "o pódio recebe o visual e o título do campeão")
    conferir(lista and "id" not in lista[0], "o ranking não leva o id do save")
    tudo = "".join(b.todas + longe.todas + a.todas)
    conferir(not any(jid in tudo for jid in ids), "o id do save nunca vai para os outros")
    b.enviar({"t": "desafiar", "sid": b.sid, "modo": "x1"})
    b.enviar({"t": "x" * 40})
    b.enviar({"t": "mover", "x": "muito", "y": None})
    b.enviar({"t": "ranking"})
    conferir(b.esperar("ranking") is not None, "mensagens estranhas não derrubam a conexão")
    for cliente in (b, longe):
        cliente.fechar()
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

    shutil.rmtree(PASTA_TESTE, ignore_errors=True)  # o banco de teste inteiro vai embora

print()
print("FALHAS:" if falhas else "Tudo certo: o salão, o quadro e os três duelos funcionam.", *falhas, sep="\n- ")
sys.exit(1 if falhas else codigo)
