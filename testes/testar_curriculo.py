"""Confere o currículo das classes no servidor: para cada classe principal e algumas subclasses, sorteia
muitas perguntas e mede quantas saem do currículo do herói (e nunca de outra classe), se o degrau atual
pesa mais, o estilo da classe (verdadeiro ou falso, ordem, lacuna), a skill dominada e o Grimório de
Erros (errar, o eco voltar, acertar três vezes e sair). Uso: python testar_curriculo.py <raiz>"""
import collections
import os
import sys
import time

sys.path.insert(0, sys.argv[1])
os.chdir(sys.argv[1])

import banco  # noqa: E402
import curriculo  # noqa: E402
import progressao  # noqa: E402
from conteudo import PERGUNTAS_CLASSE, base_da_ref, pergunta_por_ref, sortear_desafio  # noqa: E402
from app import app  # noqa: E402

c = app.test_client()
falhas = []


def heroi_teste(principal, subclasse=None, nivel=1):
    jid = c.post("/api/jogador", json={"progresso": {"nome": "TesteClaude", "avatar": {"kit": principal}}}).get_json()["id"]
    c.post(f"/api/jogador/{jid}/classe/principal", json={"id": principal})
    p = banco.carregar_progresso(jid)
    p["xp"] = next(x for x in range(0, 10 ** 7, 50) if progressao.nivel_de(x) >= nivel)
    p["provas"] = [1, 2, 3, 4]  # as Provas do Degrau já aprovadas (a prova tem teste próprio)
    banco.salvar_progresso(jid, p)
    if subclasse:
        r = c.post(f"/api/jogador/{jid}/classe/subclasse", json={"id": subclasse})
        if r.status_code != 200:
            falhas.append(f"subclasse {subclasse}: {r.status_code} {r.get_json()}")
    return jid


ids = []
try:
    for principal, sub, nivel in (("mago", None, 1), ("guerreiro", None, 1), ("arqueiro", None, 1), ("arqueiro", "cacador", 7), ("mago", "runas", 15)):
        jid = heroi_teste(principal, sub, nivel)
        ids.append(jid)
        p = banco.carregar_progresso(jid)
        heroi = curriculo.heroi_do(p)
        tipos = collections.Counter()
        degraus = collections.Counter()
        for _ in range(1500):
            q = sortear_desafio(2, {1, 2}, [], None, None, heroi)
            ref = base_da_ref(q["ref"])
            tipos["vf" if q["ref"].startswith("vf|") else ref.split(":")[0]] += 1
            if ref.startswith("classe:"):
                pq = pergunta_por_ref(ref)
                if pq.get("classe") and pq["classe"] != heroi["classe"] or pq.get("principal") and pq["principal"] != heroi["principal"]:
                    falhas.append(f"{principal}/{sub}: pergunta de outra classe {pq['skill']}")
                if pq["degrau"] > heroi["degrau"]:
                    falhas.append(f"{principal}/{sub}: pergunta acima do degrau {pq['skill']}")
                degraus[pq["degrau"]] += 1
        total = sum(tipos.values())
        print(f"{principal:<9} {str(sub):<8} degrau {heroi['degrau']} | currículo {tipos['classe'] / total:.0%} | vf {tipos['vf'] / total:.0%} "
              f"ordem {tipos['ordem'] / total:.0%} lacuna {tipos['lacuna'] / total:.0%} | degraus {dict(sorted(degraus.items()))}")
        resumo = c.get(f"/api/jogador/{jid}").get_json()["estado"]["curriculo"]
        print("   skills:", [(s["degrau"], s["nome"], "liberada" if s["liberada"] else "trancada") for s in resumo["skills"]], "| foco:", resumo["foco"])

    # dominar uma skill e o Grimório de Erros
    jid = ids[-1]
    p = banco.carregar_progresso(jid)
    ref = next(f"classe:{q['degrau']}:{i}" for i, q in enumerate(PERGUNTAS_CLASSE) if q.get("classe") == "runas")
    dominada = [curriculo.contar_acerto(p, ref) for _ in range(curriculo.ACERTOS_PARA_DOMINAR)]
    if not dominada[-1] or any(dominada[:-1]):
        falhas.append("a skill não foi dominada no 5º acerto")
    curriculo.anotar_erro(p, ref + "@0123")
    if curriculo.eco_vencido(p) is not None:
        falhas.append("o eco voltou antes da hora")
    p["grimorioErros"][0]["volta"] = time.time() - 1
    curriculo.CHANCE_DE_ECO = 1
    if curriculo.eco_vencido(p) != ref:
        falhas.append("o eco vencido não voltou")
    passos = [curriculo.anotar_acerto_do_eco(p, ref) for _ in range(3)]
    if passos != ["adiado", "adiado", "dominado"] or p["grimorioErros"]:
        falhas.append(f"o eco não saiu do grimório: {passos}")
    print("skill dominada no 5º acerto; eco:", passos)
finally:
    for jid in ids:
        c.delete(f"/api/jogador/{jid}")
    print("heróis de teste apagados")
    print("FALHAS:" if falhas else "sem falhas", *falhas[:20], sep="\n  ")
