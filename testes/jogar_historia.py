"""Joga a história principal inteira no servidor, do capítulo I ao Vazio, com um herói de teste:
aceita cada quest, cumpre os objetivos pelas rotas de verdade (batalhas respondidas certo, dungeons,
leituras, conversas, visitas) e entrega. Só o "grind" é simulado: quando falta nível, domínio ou a
subclasse, o script ajusta o save direto no banco (isso no jogo vem de muitas batalhas).
Uso: python jogar_historia.py <raiz do jogo>. No fim apaga o herói de teste."""
import os
import sys
import time

RAIZ = sys.argv[1]
sys.path.insert(0, RAIZ)
os.chdir(RAIZ)

import banco  # noqa: E402
import dominio  # noqa: E402
import habilidades  # noqa: E402
import progressao  # noqa: E402
import quests  # noqa: E402
from app import app  # noqa: E402
import curriculo  # noqa: E402
from conteudo import pergunta_por_ref  # noqa: E402
from conteudo import BIBLIOTECA, DUNGEONS, FASES, MONSTROS, PUZZLES, corrigir_pergunta  # noqa: E402

c = app.test_client()
falhas = []
resumo = {"batalhas": 0, "perguntas": 0, "dungeons": 0}


def post(rota, corpo=None, ok=(200,)):
    r = c.post(f"/api/jogador/{jid}/{rota}", json=corpo or {})
    if r.status_code not in ok:
        raise RuntimeError(f"{rota} -> {r.status_code}: {r.get_json() or r.get_data(as_text=True)[:200]}")
    return r.get_json()


def save():
    return banco.carregar_progresso(jid)


def ajustar(**campos):
    p = save()
    p.update(campos)
    banco.salvar_progresso(jid, p)


def xp_do_nivel(n):
    baixo, alto = 0, 10 ** 9
    while baixo < alto:
        meio = (baixo + alto) // 2
        if progressao.nivel_de(meio) >= n:
            alto = meio
        else:
            baixo = meio + 1
    return baixo


def garantir_nivel(n):
    p = save()
    if progressao.nivel_de(p["xp"]) < n:
        ajustar(xp=xp_do_nivel(n))


def fazer_provas():
    """As Provas do Degrau pelas rotas de verdade: domina a skill do degrau (o treino nas batalhas é
    simulado no save) e faz a prova inteira acertando tudo, enquanto houver prova para fazer."""
    for _ in range(6):
        p = save()
        s = curriculo.situacao_da_prova(p)
        if not s or s.get("fim") or s["aprovada"]:
            return
        if s["skill"]:
            p["skills"][s["skill"]["id"]] = curriculo.ACERTOS_PARA_DOMINAR
            p["provaEspera"] = 0
            banco.salvar_progresso(jid, p)
        post("prova/iniciar")
        for _ in range(curriculo.PERGUNTAS_DA_PROVA):
            ref = save()["prova"]["refs"][save()["prova"]["atual"]]
            base, _, ordem = ref.partition("@")
            certa = ordem.index(str(pergunta_por_ref(base)["correta"]))
            r = post("prova/responder", {"resposta": certa})
        if not r["resultado"]["aprovado"]:
            falhas.append(f"prova do degrau {s['degrau']} reprovada acertando tudo")
            return
        resumo["provas"] = resumo.get("provas", 0) + 1


def curar():
    p = save()
    p["vida"]["atual"] = habilidades.vida_maxima(p)
    banco.salvar_progresso(jid, p)


def batalha(tipo, monstro_id):
    """Uma batalha inteira, sempre respondendo certo. Devolve True se venceu."""
    curar()
    r = post("batalhas", {"tipo": tipo, "monstroId": monstro_id})
    bid = r["batalha"]
    resumo["batalhas"] += 1
    for _ in range(60):
        post(f"batalhas/{bid}/pergunta")
        ref = banco.carregar_batalha(jid, bid)["pergunta_atual"]
        certa = corrigir_pergunta(ref, 0)["resposta_certa"]
        res = post(f"batalhas/{bid}/responder", {"resposta": certa})
        resumo["perguntas"] += 1
        if not res.get("correta"):
            falhas.append(f"resposta certa recusada em {ref}")
        if res.get("fim") == "vitoria":
            return True
    falhas.append(f"batalha contra {tipo} não terminou")
    return False


def monstros_do_filtro(f):
    tipos = f.get("tipo")
    tipos = tipos if isinstance(tipos, list) else [tipos] if tipos else None
    regioes = f.get("regiao")
    regioes = regioes if isinstance(regioes, list) else [regioes] if regioes else None
    lista = [t for t, m in MONSTROS.items() if not m.get("chefe")
             and (not tipos or t in tipos) and (not regioes or m["regiao"] in regioes)
             and (not f.get("forca") or m["forca"] == f["forca"]) and (not f.get("noite") or m.get("daNoite"))]
    return lista


def feito(quest_id, i):
    return save()["quests"]["ativas"][quest_id]["feito"][i]


def cumprir(q):
    for i, o in enumerate(q["objetivos"]):
        f = o.get("filtro") or {}
        ev = o["evento"]
        tentativas = 0
        while feito(q["id"], i) < o["alvo"]:
            tentativas += 1
            if tentativas > 400:
                falhas.append(f"{q['id']}: objetivo '{o['texto']}' não andou")
                break
            if ev == "falar":
                post("quests/evento", {"evento": "falar", "npc": f["npc"]})
            elif ev == "visitar":
                post("quests/evento", {"evento": "visitar", "cidade": f["cidade"]})
            elif ev == "chefe":
                batalha(f["tipo"], f"chefe-{f['tipo']}")
            elif ev == "monstro":
                opcoes = monstros_do_filtro(f)
                if not opcoes:
                    falhas.append(f"{q['id']}: nenhum monstro serve para {f}")
                    break
                batalha(opcoes[tentativas % len(opcoes)], f"teste-{q['id']}-{tentativas}")
            elif ev == "acerto":
                # monstro de perigo 4 (o banco de perguntas mais variado) da região liberada mais difícil
                batalha("dragao", f"teste-acerto-{q['id']}-{tentativas}")
            elif ev == "leitura":
                livro = list(BIBLIOTECA)[tentativas % len(BIBLIOTECA)]
                post("leitura", {"fonte": "biblioteca", "id": livro})
            elif ev == "licao":
                fase_id = list(FASES)[tentativas % len(FASES)]
                post(f"fases/{fase_id}/concluir", {"estrelas": 3})
            elif ev == "enigma":
                # o próximo enigma ainda não resolvido, com a resposta certa (a mesma conta do servidor)
                pid = next(i for i in PUZZLES if i not in save()["puzzlesResolvidos"])
                pz = PUZZLES[pid]
                certa = {"ordem": pz.get("itens"), "relampago": [a["verdade"] for a in pz.get("afirmacoes", [])]}.get(pz["tipo"], pz.get("correta"))
                post(f"puzzles/{pid}/abrir")
                if not post(f"puzzles/{pid}", {"resposta": certa}).get("correta"):
                    falhas.append(f"enigma {pid} recusou a resposta certa")
            elif ev == "dungeon":
                d = f.get("dungeon", "cripta")
                post(f"dungeons/{d}/entrar")
                # o labirinto: todos os guardiões (cada pergunta de cada sala) vencidos antes da vitória
                for s, sala in enumerate(DUNGEONS[d]["salas"]):
                    for k, pergunta in enumerate(sala["perguntas"]):
                        post(f"dungeons/{d}/responder", {"sala": s, "pergunta": k, "resposta": pergunta["correta"]})
                post(f"dungeons/{d}/vitoria")
                resumo["dungeons"] += 1
            else:
                falhas.append(f"{q['id']}: evento {ev} sem roteiro no teste")
                break


r = c.post("/api/jogador", json={"progresso": {"nome": "TesteClaude", "avatar": {"kit": "mago", "familiar": "coruja"}}})
jid = r.get_json()["id"]
inicio = time.time()
try:
    post("classe/principal", {"id": "mago"})
    # as lições concluídas pela rota de verdade (abrem as dungeons e os quizzes)
    for fase_id, fase in FASES.items():
        if not fase.get("em_breve"):
            post(f"fases/{fase_id}/concluir", {"estrelas": 3})
    capitulo = None
    for q in quests.PRINCIPAIS:
        garantir_nivel(q.get("nivel", 1))
        fazer_provas()
        p = save()
        if progressao.nivel_de(p["xp"]) >= 4 and not habilidades.classe_do(p):
            post("classe/subclasse", {"id": "runas"})
            fazer_provas()
        if q.get("mundo") == "umbra" and not habilidades.no_ultimo_degrau(save()):
            # o fim do caminho da subclasse: nível 15, patente 2 na trilha dela e 3 chefões (já vencidos)
            p = save()
            trilha = habilidades.classe_do(p)["trilha"]
            p["dominio"][trilha] = max(p["dominio"].get(trilha, 0), 60)
            banco.salvar_progresso(jid, p)
            fazer_provas()
            if not habilidades.no_ultimo_degrau(save()):
                falhas.append(f"{q['id']}: o último degrau não abriu (degrau {habilidades.degrau(save())})")
        disponiveis = [x["id"] for x in quests.disponiveis(save())]
        if q["id"] not in disponiveis:
            falhas.append(f"{q['id']}: não estava disponível (disponíveis: {disponiveis})")
            break
        post(f"quests/{q['id']}/aceitar")
        cumprir(q)
        r = post(f"quests/{q['id']}/entregar")
        if q["capitulo"] != capitulo:
            capitulo = q["capitulo"]
            print(f"Capítulo {capitulo}")
        print(f"  ok {q['id']:<14} nível {progressao.nivel_de(save()['xp']):>2}  ganhos: {', '.join(g['texto'] for g in r.get('ganhos', []))[:90]}")
    p = save()
    print("concluídas:", len(p["quests"]["concluidas"]), "de", len(quests.PRINCIPAIS), "| chefões:", len(p["chefesDerrotados"]),
          "| fragmentos:", len(p["fragmentos"]), "| troféus:", len(p["trofeus"]))
finally:
    c.delete(f"/api/jogador/{jid}")
    print("herói de teste apagado:", c.get(f"/api/jogador/{jid}").status_code == 404)
    print("resumo:", resumo, f"{time.time() - inicio:.0f}s")
    print("FALHAS:" if falhas else "sem falhas", *falhas, sep="\n  ")
