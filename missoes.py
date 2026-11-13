"""Missões sorteadas: o herói sempre tem algumas tarefas do Reino, que se renovam quando são resgatadas.

O sorteio só oferece o que o herói consegue fazer agora: respeita o nível da missão, as regiões
liberadas, os chefões que ainda faltam, os livros não lidos e as dungeons abertas.
"""

import random

from flask import abort

import habilidades
import progressao
import quests
from conteudo import BIBLIOTECA, CARREIRA, DUNGEONS, MISSOES, MONSTROS, PUZZLES, REGIOES

MODELOS = {m["id"]: m for m in MISSOES["missoes"]}
LEMBRAR_ULTIMAS = 3  # missões recém-resgatadas que não voltam logo em seguida
PESO_TRILHA_PREFERIDA = 4  # missões da trilha da classe/subclasse saem esse tanto mais vezes


def como_lista(valor):
    return valor if isinstance(valor, list) else [valor]


def regioes_da_missao(modelo):
    filtro = modelo.get("filtro") or {}
    regioes = set(como_lista(filtro["regiao"])) if "regiao" in filtro else set()
    if "tipo" in filtro:
        regioes |= {MONSTROS[t]["regiao"] for t in como_lista(filtro["tipo"])}
    return regioes


def regiao_liberada(progresso, regiao_id):
    regiao = REGIOES[regiao_id]
    if regiao.get("mundo") == "umbra":
        import habilidades  # aqui dentro: habilidades também depende das missões
        if not habilidades.no_ultimo_degrau(progresso):
            return False
    return progressao.nivel_de(progresso["xp"]) >= regiao["nivelMinimo"]


def disponivel(modelo, progresso):
    if progressao.nivel_de(progresso["xp"]) < modelo.get("nivel", 1):
        return False
    regioes = regioes_da_missao(modelo)
    if regioes and not any(regiao_liberada(progresso, r) for r in regioes):
        return False
    evento = modelo["evento"]
    if evento == "chefe":
        return any(
            m.get("chefe") and regiao_liberada(progresso, m["regiao"]) and f"chefe-{tipo}" not in progresso["chefesDerrotados"]
            for tipo, m in MONSTROS.items()
        )
    if evento == "leitura":
        return len(set(progresso["livrosLidos"])) < len(BIBLIOTECA) + len(CARREIRA)
    if evento == "enigma":
        return len(progresso["puzzlesResolvidos"]) < len(PUZZLES)
    if evento == "dungeon":
        return any(str(d["requer_fase"]) in progresso["fases"] for d in DUNGEONS.values())
    return True


def pronta(missao):
    return missao["feito"] >= MODELOS[missao["id"]]["alvo"]


def garantir(progresso):
    """Completa as vagas de missão com sorteios novos (e tira as que deixaram de fazer sentido)."""
    estado = progresso["missoes"]
    estado["ativas"] = [
        m for m in estado.get("ativas", [])
        if m.get("id") in MODELOS and (pronta(m) or disponivel(MODELOS[m["id"]], progresso))
    ]
    while len(estado["ativas"]) < MISSOES["ativas"]:
        ativas = {m["id"] for m in estado["ativas"]}
        opcoes = [m for m in MODELOS.values() if m["id"] not in ativas and disponivel(m, progresso)]
        frescas = [m for m in opcoes if m["id"] not in estado.get("ultimas", [])]
        if not opcoes:
            break
        sorteio = frescas or opcoes
        preferida = habilidades.trilha_preferida(progresso)
        pesos = [PESO_TRILHA_PREFERIDA if (m.get("filtro") or {}).get("trilha") == preferida else 1 for m in sorteio]
        estado["ativas"].append({"id": random.choices(sorteio, weights=pesos)[0]["id"], "feito": 0})


def registrar(progresso, evento, **detalhes):
    """Algo aconteceu no jogo: avança as missões ativas que esperam por isso (e os objetivos das quests)."""
    quests.registrar(progresso, evento, **detalhes)
    for missao in progresso["missoes"]["ativas"]:
        modelo = MODELOS[missao["id"]]
        if modelo["evento"] != evento or pronta(missao):
            continue
        filtro = modelo.get("filtro") or {}
        if all(detalhes.get(chave) in como_lista(valor) for chave, valor in filtro.items()):
            missao["feito"] += 1


def tirar(progresso, missao_id):
    """Remove uma missão ativa (resgatada ou trocada) e lembra dela para não sortear de novo já."""
    estado = progresso["missoes"]
    missao = next((m for m in estado["ativas"] if m["id"] == missao_id), None)
    if not missao:
        abort(404, "Essa missão não está no teu diário.")
    estado["ativas"].remove(missao)
    estado["ultimas"] = (estado.get("ultimas", []) + [missao_id])[-LEMBRAR_ULTIMAS:]
    return missao
