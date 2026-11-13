"""Confere as 6 dungeons no servidor: os dados de cada pergunta, a entrada (com as travas), a correção de
cada resposta (certa e errada), o pergaminho (dica), a poção (tira 2 erradas) e a vitória com o prêmio
(cheio na 1ª vez, 30% depois). Usa um herói de teste e apaga no fim. Uso: python testar_dungeons.py <raiz>"""
import os
import sys

sys.path.insert(0, sys.argv[1])
os.chdir(sys.argv[1])

import banco  # noqa: E402
import progressao  # noqa: E402
from app import app  # noqa: E402
from conteudo import DUNGEONS, FASES  # noqa: E402

c = app.test_client()
falhas = []


def post(rota, corpo=None):
    return c.post(rota, json=corpo or {})


r = post("/api/jogador", {"progresso": {"nome": "TesteClaude", "avatar": {"kit": "mago"}}})
jid = r.get_json()["id"]
J = f"/api/jogador/{jid}"
try:
    post(f"{J}/classe/principal", {"id": "mago"})
    # 1. os dados: toda pergunta com 4 opções, correta válida, explicação e dica
    for d in DUNGEONS.values():
        for s, sala in enumerate(d["salas"]):
            for i, p in enumerate(sala["perguntas"]):
                onde = f"{d['id']} sala {s} pergunta {i}"
                if len(p["opcoes"]) < 2 or not 0 <= p["correta"] < len(p["opcoes"]):
                    falhas.append(f"{onde}: opções/correta inválidas")
                for campo in ("explicacao", "dica"):
                    if not p.get(campo):
                        falhas.append(f"{onde}: sem {campo}")
        if not d["salas"][-1].get("chefe"):
            falhas.append(f"{d['id']}: a última sala não é a do chefe")

    # 2. as travas de entrada: sem a lição pedida, a dungeon não abre; as de Umbraterra pedem o último degrau
    for d in DUNGEONS.values():
        if post(f"{J}/dungeons/{d['id']}/entrar").status_code != 400:
            falhas.append(f"{d['id']}: abriu sem a lição pedida")
    for fase_id, fase in FASES.items():
        if not fase.get("em_breve"):
            post(f"{J}/fases/{fase_id}/concluir", {"estrelas": 3})
    umbra = [d for d in DUNGEONS.values() if d.get("mundo") == "umbra"]
    for d in umbra:
        if post(f"{J}/dungeons/{d['id']}/entrar").status_code != 403:
            falhas.append(f"{d['id']}: abriu sem o último degrau")
    # o último degrau (simulado no save, como o grind)
    p = banco.carregar_progresso(jid)
    p["xp"] = next(x for x in range(0, 10 ** 7, 500) if progressao.nivel_de(x) >= 15)
    p["provas"] = [1, 2, 3, 4]  # as Provas do Degrau (testadas no jogar_historia.py)
    banco.salvar_progresso(jid, p)
    post(f"{J}/classe/subclasse", {"id": "runas"})
    p = banco.carregar_progresso(jid)
    p["dominio"]["prompts"] = 60
    p["dominio"]["fundamentos"] = 60
    p["chefesDerrotados"] = ["chefe-reiSlime", "chefe-fenrir", "chefe-sapoRei"]
    banco.salvar_progresso(jid, p)

    # 3. cada dungeon: entrar, responder tudo (uma errada e depois a certa), dica, poção e vitória 2 vezes
    for d in DUNGEONS.values():
        e = post(f"{J}/dungeons/{d['id']}/entrar")
        if e.status_code != 200:
            falhas.append(f"{d['id']}: não entrou ({e.status_code} {e.get_json()})")
            continue
        # vitória antes de vencer os guardiões: recusada
        if post(f"{J}/dungeons/{d['id']}/vitoria").status_code != 400:
            falhas.append(f"{d['id']}: vitória aceita sem vencer os guardiões")
        # os baús: o 0 traz a chave; abrir de novo não pode
        b0 = post(f"{J}/dungeons/{d['id']}/bau", {"bau": 0}).get_json()
        if not b0.get("chave") or not b0.get("ganhos"):
            falhas.append(f"{d['id']}: o baú 0 não deu a chave ou o prêmio")
        if post(f"{J}/dungeons/{d['id']}/bau", {"bau": 0}).status_code != 400:
            falhas.append(f"{d['id']}: baú aberto duas vezes")
        if post(f"{J}/dungeons/{d['id']}/bau", {"bau": 3}).get_json().get("chave"):
            falhas.append(f"{d['id']}: outro baú deu a chave")
        # a rota do herói: errar tira 1 de vida, acertar anota
        vida_antes = banco.carregar_progresso(jid)["vida"]["atual"]
        p0 = d["salas"][0]["perguntas"][0]
        errou = post(f"{J}/dungeons/{d['id']}/responder", {"sala": 0, "pergunta": 0, "resposta": (p0["correta"] + 1) % len(p0["opcoes"])}).get_json()
        if errou["correta"] or banco.carregar_progresso(jid)["vida"]["atual"] != vida_antes - 1:
            falhas.append(f"{d['id']}: o erro não tirou 1 de vida")
        p = banco.carregar_progresso(jid)
        p["vida"]["atual"] = 10
        banco.salvar_progresso(jid, p)
        perguntas = 0
        for s, sala in enumerate(d["salas"]):
            for i, pergunta in enumerate(sala["perguntas"]):
                ref = {"sala": s, "pergunta": i}
                errada = (pergunta["correta"] + 1) % len(pergunta["opcoes"])
                if post(f"/api/dungeons/{d['id']}/responder", {**ref, "resposta": errada}).get_json()["correta"]:
                    falhas.append(f"{d['id']} {s}/{i}: aceitou resposta errada")
                certa = post(f"/api/dungeons/{d['id']}/responder", {**ref, "resposta": pergunta["correta"]}).get_json()
                if not certa["correta"] or not certa["explicacao"]:
                    falhas.append(f"{d['id']} {s}/{i}: recusou a certa")
                if not post(f"/api/dungeons/{d['id']}/pergaminho", ref).get_json().get("dica"):
                    falhas.append(f"{d['id']} {s}/{i}: pergaminho sem dica")
                tirar = post(f"/api/dungeons/{d['id']}/pocao", ref).get_json()["remover"]
                if pergunta["correta"] in tirar or len(tirar) != min(2, len(pergunta["opcoes"]) - 1):
                    falhas.append(f"{d['id']} {s}/{i}: poção tirou errado {tirar}")
                # a resposta certa pela rota do herói (é ela que conta para a vitória)
                if not post(f"{J}/dungeons/{d['id']}/responder", {**ref, "resposta": pergunta["correta"]}).get_json()["correta"]:
                    falhas.append(f"{d['id']} {s}/{i}: a rota do herói recusou a certa")
                perguntas += 1
        v1 = post(f"{J}/dungeons/{d['id']}/vitoria").get_json()
        post(f"{J}/dungeons/{d['id']}/entrar")
        # a segunda corrida: precisa vencer tudo de novo
        for s, sala in enumerate(d["salas"]):
            for i, pergunta in enumerate(sala["perguntas"]):
                post(f"{J}/dungeons/{d['id']}/responder", {"sala": s, "pergunta": i, "resposta": pergunta["correta"]})
        v2 = post(f"{J}/dungeons/{d['id']}/vitoria").get_json()
        ganhos1 = ", ".join(g["texto"] for g in v1.get("ganhos", []))
        print(f"{d['id']:<17} {len(d['salas'])} salas, {perguntas} perguntas | 1ª vitória: {ganhos1[:110]} | 2ª: primeira={v2.get('primeira')}")
        if not v1.get("primeira") or v2.get("primeira"):
            falhas.append(f"{d['id']}: prêmio da primeira vez errado")
    # vitória sem ter entrado não pode
    if post(f"{J}/dungeons/cripta/vitoria").status_code != 400:
        falhas.append("vitória aceita sem entrar na dungeon")
finally:
    c.delete(J)
    print("herói de teste apagado:", c.get(J).status_code == 404)
    print("FALHAS:" if falhas else "sem falhas", *falhas, sep="\n  ")
