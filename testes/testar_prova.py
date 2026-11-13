"""Confere a Prova do Degrau no servidor, para cada uma das 15 subclasses e das 3 classes principais:
- a prova só abre com a skill do degrau dominada;
- tem 10 perguntas, todas do currículo da classe do herói, até o degrau dele, sem repetir;
- a dificuldade sobe (média do começo < média do fim) e o fim é da skill do degrau provado;
- reprovar (errando tudo) bloqueia uma nova tentativa por um tempo e manda os erros para o grimório;
- aprovar sobe o degrau quando o nível já permite, e dá prêmio;
- a subclasse não se escolhe sem a Prova do Aprendiz;
- um save antigo (sem "provas") mantém o degrau que já tinha.
Uso: python testar_prova.py <raiz>"""
import os
import sys

sys.path.insert(0, sys.argv[1])
os.chdir(sys.argv[1])

import banco  # noqa: E402
import curriculo  # noqa: E402
import habilidades  # noqa: E402
import progressao  # noqa: E402
from app import app  # noqa: E402
from conteudo import CLASSES, pergunta_por_ref  # noqa: E402

c = app.test_client()
falhas = []
ids = []


def novo(principal):
    jid = c.post("/api/jogador", json={"progresso": {"nome": "TesteClaude", "avatar": {"kit": principal}}}).get_json()["id"]
    ids.append(jid)
    c.post(f"/api/jogador/{jid}/classe/principal", json={"id": principal})
    return jid


def ajustar(jid, **campos):
    p = banco.carregar_progresso(jid)
    p.update(campos)
    banco.salvar_progresso(jid, p)


def dominar(jid):
    p = banco.carregar_progresso(jid)
    s = curriculo.situacao_da_prova(p)
    p.setdefault("skills", {})[s["skill"]["id"]] = curriculo.ACERTOS_PARA_DOMINAR
    p["provaEspera"] = 0
    banco.salvar_progresso(jid, p)


def fazer(jid, acertar=True):
    """Faz a prova inteira; devolve (resultado, dificuldades, perguntas)."""
    r = c.post(f"/api/jogador/{jid}/prova/iniciar")
    if r.status_code != 200:
        return None, [], []
    difs, pergs = [], []
    for _ in range(10):
        prova = banco.carregar_progresso(jid)["prova"]
        ref = prova["refs"][prova["atual"]]
        base, _, ordem = ref.partition("@")
        p = pergunta_por_ref(base)
        difs.append(p.get("dificuldade", 2))
        pergs.append((base, p))
        certa = ordem.index(str(p["correta"]))
        r = c.post(f"/api/jogador/{jid}/prova/responder", json={"resposta": certa if acertar else (certa + 1) % 4}).get_json()
    return r["resultado"], difs, pergs


try:
    nivel_de = lambda n: next(x for x in range(0, 10 ** 7, 50) if progressao.nivel_de(x) >= n)  # noqa: E731
    for principal in ("mago", "guerreiro", "arqueiro"):
        jid = novo(principal)
        # sem dominar a skill, a prova não abre
        if c.post(f"/api/jogador/{jid}/prova/iniciar").status_code != 400:
            falhas.append(f"{principal}: prova abriu sem a skill dominada")
        # a subclasse não se escolhe sem a Prova do Aprendiz
        ajustar(jid, xp=nivel_de(4))
        sub = next(s for s in CLASSES if s["principal"] == principal)
        if c.post(f"/api/jogador/{jid}/classe/subclasse", json={"id": sub["id"]}).status_code != 400:
            falhas.append(f"{principal}: escolheu subclasse sem a Prova do Aprendiz")
        # reprovar: espera e os erros vão para o grimório
        dominar(jid)
        res, _, _ = fazer(jid, acertar=False)
        p = banco.carregar_progresso(jid)
        if not res or res["aprovado"] or c.post(f"/api/jogador/{jid}/prova/iniciar").status_code != 400 or len(p["grimorioErros"]) < 10:
            falhas.append(f"{principal}: reprovação não bloqueou ou não anotou os erros")
        dominar(jid)
        res, difs, pergs = fazer(jid)
        if not res or not res["aprovado"] or not res["ganhos"]:
            falhas.append(f"{principal}: Prova do Aprendiz não aprovou acertando tudo")
        print(f"{principal:<10} Prova do Aprendiz: dificuldades {difs}")

    # cada subclasse: degrau a degrau, do 2 ao 5
    for sub in CLASSES:
        jid = novo(sub["principal"])
        ajustar(jid, xp=nivel_de(4), provas=[1])
        c.post(f"/api/jogador/{jid}/classe/subclasse", json={"id": sub["id"]})
        ajustar(jid, xp=nivel_de(15), chefesDerrotados=["chefe-reiSlime", "chefe-fenrir", "chefe-sapoRei"], dominio={sub["trilha"]: 60})
        linha = []
        for d in (2, 3, 4, 5):
            p = banco.carregar_progresso(jid)
            if habilidades.degrau(p) != d:
                falhas.append(f"{sub['id']}: esperava degrau {d}, está no {habilidades.degrau(p)}")
                break
            if d == 5:  # o topo do caminho não tem prova
                if c.post(f"/api/jogador/{jid}/prova/iniciar").status_code != 400:
                    falhas.append(f"{sub['id']}: abriu prova no último degrau")
                break
            dominar(jid)
            res, difs, pergs = fazer(jid)
            heroi = curriculo.heroi_do(banco.carregar_progresso(jid)) if res else None
            if not res:
                if d < 5:
                    falhas.append(f"{sub['id']}: prova do degrau {d} não abriu")
                break
            if len({b for b, _ in pergs}) != 10:
                falhas.append(f"{sub['id']} d{d}: pergunta repetida na prova")
            if any(q.get("classe") not in (None, sub["id"]) or (q.get("principal") and q["principal"] != sub["principal"]) or q["degrau"] > d for _, q in pergs):
                falhas.append(f"{sub['id']} d{d}: pergunta de outra classe ou acima do degrau")
            if sum(difs[:3]) / 3 >= sum(difs[-3:]) / 3:
                falhas.append(f"{sub['id']} d{d}: a dificuldade não subiu {difs}")
            if any(q["degrau"] != d for _, q in pergs[-3:]):
                falhas.append(f"{sub['id']} d{d}: o fim da prova não é da skill do degrau")
            if not res["aprovado"]:
                falhas.append(f"{sub['id']} d{d}: reprovou acertando tudo")
            linha.append(f"d{d}:{''.join(map(str, difs))}{'↑' if res['subiu'] else ''}")
        print(f"{sub['id']:<12} {' '.join(linha)} | degrau final {habilidades.degrau(banco.carregar_progresso(jid))}")
        if not habilidades.no_ultimo_degrau(banco.carregar_progresso(jid)):
            falhas.append(f"{sub['id']}: não chegou ao último degrau com as provas")

    # save antigo: sem o campo "provas", mantém o degrau que tinha
    jid = novo("mago")
    ajustar(jid, xp=nivel_de(4), provas=[1])
    c.post(f"/api/jogador/{jid}/classe/subclasse", json={"id": "runas"})
    p = banco.carregar_progresso(jid)
    p["xp"] = nivel_de(10)
    p["dominio"] = {"prompts": 60}
    p.pop("provas", None)
    banco.salvar_progresso(jid, p)
    estado = c.get(f"/api/jogador/{jid}").get_json()["estado"]
    print("save antigo: degrau", estado["status"]["degrauClasse"], "provas", estado["provas"])
    if estado["status"]["degrauClasse"] < 4:
        falhas.append("save antigo perdeu degrau")
finally:
    for jid in ids:
        c.delete(f"/api/jogador/{jid}")
    print("heróis de teste apagados:", len(ids))
    print("FALHAS:" if falhas else "sem falhas", *falhas[:25], sep="\n  ")
