"""Teste de concorrência e de carga com DOIS processos do servidor no MESMO banco (como os processos do
PythonAnywhere), num banco de teste separado (o banco de verdade não é tocado).

1. Concorrência: 60 compras simultâneas do mesmo jogador, metade em cada processo. No fim, moedas e
   poções têm que bater exatamente (sem a trava, uma compra apagava a outra).
2. Carga: N jogadores ao mesmo tempo, cada um fazendo ações de batalha (ver save, começar luta, pedir
   pergunta, responder, salvar). Mede tempos de resposta e erros.

Uso: python teste_carga.py <raiz do jogo> [jogadores] [rodadas]
"""
import json
import os
import statistics
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

RAIZ = Path(sys.argv[1])
JOGADORES = int(sys.argv[2]) if len(sys.argv) > 2 else 50
RODADAS = int(sys.argv[3]) if len(sys.argv) > 3 else 15
PORTAS = [5071, 5072]
BANCO = Path(tempfile.gettempdir()) / f"rpgia-carga-{os.getpid()}" / "academia.db"
os.environ["BANCO_ARQUIVO"] = str(BANCO)
sys.path.insert(0, str(RAIZ))
os.chdir(RAIZ)
import banco  # noqa: E402  (com BANCO_ARQUIVO já apontando para o banco de teste)

PRECO_POCAO = 90


def pedir(porta, metodo, rota, corpo=None):
    dados = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(f"http://127.0.0.1:{porta}{rota}", data=dados, method=metodo,
                                 headers={"Content-Type": "application/json"})
    inicio = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            corpo = json.loads(r.read() or b"{}")
            return r.status, corpo, time.perf_counter() - inicio
    except urllib.error.HTTPError as e:
        return e.code, {}, time.perf_counter() - inicio


def subir_servidores():
    codigo = "from wsgi import application; application.run(port=int(__import__('sys').argv[1]), threaded=True, use_reloader=False)"
    ambiente = {**os.environ, "PYTHONIOENCODING": "utf-8", "BANCO_ARQUIVO": str(BANCO)}
    processos = [subprocess.Popen([sys.executable, "-c", codigo, str(p)], cwd=RAIZ, env=ambiente,
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) for p in PORTAS]
    for porta in PORTAS:
        for _ in range(100):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{porta}/api/fases", timeout=2)
                break
            except Exception:
                time.sleep(0.2)
    return processos


def teste_concorrencia():
    status, r, _ = pedir(PORTAS[0], "POST", "/api/jogador", {"progresso": {"nome": "TesteCarga", "avatar": {"kit": "mago"}}})
    jid = r["id"]
    p = banco.carregar_progresso(jid)
    p["moedas"] = 100_000
    banco.salvar_progresso(jid, p)
    inicio_pocoes = p["inventario"].get("pocao", 0)
    with ThreadPoolExecutor(30) as grupo:
        resultados = list(grupo.map(lambda i: pedir(PORTAS[i % 2], "POST", f"/api/jogador/{jid}/comprar", {"item": "pocao"})[0], range(60)))
    ok = resultados.count(200)
    p = banco.carregar_progresso(jid)
    moedas_ok = p["moedas"] == 100_000 - ok * PRECO_POCAO
    pocoes_ok = p["inventario"].get("pocao", 0) - inicio_pocoes == ok
    print(f"[concorrência] 60 compras simultâneas em 2 processos: {ok} ok | moedas certas: {moedas_ok} "
          f"({p['moedas']}) | poções certas: {pocoes_ok} ({p['inventario'].get('pocao', 0) - inicio_pocoes})")
    return moedas_ok and pocoes_ok and ok == 60


def um_jogador(n, tempos, erros, travas):
    porta = PORTAS[n % 2]
    status, r, t = pedir(porta, "POST", "/api/jogador", {"progresso": {"nome": f"Carga{n}", "avatar": {"kit": "guerreiro"}}})
    tempos.append(t)
    if status != 200:
        erros.append(("criar", status))
        return
    jid = r["id"]
    pedir(porta, "POST", f"/api/jogador/{jid}/classe/principal", {"id": "guerreiro"})
    for rodada in range(RODADAS):
        porta = PORTAS[(n + rodada) % 2]  # cada ação pode cair em qualquer processo
        passos = [("GET", f"/api/jogador/{jid}", None)]
        s, b, t = pedir(porta, "POST", f"/api/jogador/{jid}/batalhas", {"tipo": "slimeVerde", "monstroId": f"m-{n}-{rodada}"})
        tempos.append(t)
        if s != 200:
            (travas if s == 400 else erros).append(("batalha", s))
            p = banco.carregar_progresso(jid)  # desmaiou: cura (o jogador de verdade descansaria)
            p["vida"]["atual"] = 4
            banco.salvar_progresso(jid, p)
            continue
        bid = b["batalha"]
        passos += [("POST", f"/api/jogador/{jid}/batalhas/{bid}/pergunta", {}),
                   ("POST", f"/api/jogador/{jid}/batalhas/{bid}/responder", {"resposta": 0}),
                   ("PUT", f"/api/jogador/{jid}/progresso", {"nome": f"Carga{n}", "local": "reino"})]
        for metodo, rota, corpo in passos:
            s, _, t = pedir(porta, metodo, rota, corpo)
            tempos.append(t)
            if s >= 500:
                erros.append((rota.split("/")[-1], s))
            elif s >= 400:
                travas.append((rota.split("/")[-1], s))


def teste_carga():
    tempos, erros, regras = [], [], []
    inicio = time.perf_counter()
    with ThreadPoolExecutor(JOGADORES) as grupo:
        list(grupo.map(lambda n: um_jogador(n, tempos, erros, regras), range(JOGADORES)))
    total = time.perf_counter() - inicio
    ms = sorted(t * 1000 for t in tempos)
    pct = lambda q: ms[min(len(ms) - 1, int(len(ms) * q))]  # noqa: E731
    print(f"[carga] {JOGADORES} jogadores ao mesmo tempo, {len(ms)} pedidos em {total:.1f}s ({len(ms) / total:.0f} pedidos/s)")
    print(f"        tempo de resposta: mediana {statistics.median(ms):.0f} ms | 95% até {pct(0.95):.0f} ms | 99% até {pct(0.99):.0f} ms | máx {ms[-1]:.0f} ms")
    print(f"        erros de servidor (5xx): {len(erros)} | recusas das regras do jogo (4xx, ex.: batalha já encerrada): {len(regras)}")
    return not erros


if __name__ == "__main__":
    processos = subir_servidores()
    try:
        ok1 = teste_concorrencia()
        ok2 = teste_carga()
    finally:
        for p in processos:
            p.terminate()
        for p in processos:
            p.wait(timeout=10)
    banco.fechar()
    tamanho = sum(f.stat().st_size for f in BANCO.parent.glob("academia.db*")) // 1024
    print(f"banco de teste: {tamanho} KB em {BANCO.parent} (apagado agora)")
    for f in BANCO.parent.glob("**/*"):
        if f.is_file():
            f.unlink()
    print("SEM FALHAS" if ok1 and ok2 else "FALHAS")
