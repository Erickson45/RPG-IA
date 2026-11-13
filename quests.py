"""A história principal e as quests dos moradores (conteudo/historia.json).

Quests principais saem uma de cada vez, na ordem dos capítulos; as secundárias aparecem quando o herói
tem o nível pedido. Para aceitar e para entregar, o herói fala com o morador que dá a quest (o navegador
leva até ele; quem confere as regras e paga é o servidor). Os objetivos andam pelos mesmos eventos das
missões do quadro (monstro, chefe, acerto, enigma, leitura, licao, dungeon) e por dois só das quests:
falar com um morador e visitar uma cidade. As de Umbraterra ("mundo": "umbra") só saem no último degrau.
"""

from flask import abort

import progressao
from conteudo import HISTORIA

PRINCIPAIS = [{**q, "tipo": "principal"} for q in HISTORIA["principais"]]
SECUNDARIAS = [{**q, "tipo": "secundaria"} for q in HISTORIA["secundarias"]]
TODAS = {q["id"]: q for q in PRINCIPAIS + SECUNDARIAS}
EVENTOS_DO_NAVEGADOR = {"falar": "npc", "visitar": "cidade"}


def como_lista(valor):
    return valor if isinstance(valor, list) else [valor]


def estado(progresso):
    q = progresso["quests"]
    q.setdefault("ativas", {})
    q.setdefault("concluidas", [])
    return q


def proxima_principal(progresso):
    feitas = set(estado(progresso)["concluidas"])
    return next((q for q in PRINCIPAIS if q["id"] not in feitas), None)


def liberada_no_mundo(quest, progresso):
    """As quests de Umbraterra ("mundo": "umbra") só saem no último degrau da subclasse."""
    if quest.get("mundo") != "umbra":
        return True
    import habilidades  # aqui dentro: habilidades depende das missões, que dependem das quests
    return habilidades.no_ultimo_degrau(progresso)


def disponiveis(progresso):
    """As quests que o herói pode aceitar agora (a próxima da história e as secundárias liberadas)."""
    q = estado(progresso)
    nivel = progressao.nivel_de(progresso["xp"])
    feitas = set(q["concluidas"])
    lista = []
    principal = proxima_principal(progresso)
    if principal and principal["id"] not in q["ativas"] and nivel >= principal.get("nivel", 1) and liberada_no_mundo(principal, progresso):
        lista.append(principal)
    for s in SECUNDARIAS:
        if s["id"] in feitas or s["id"] in q["ativas"] or nivel < s.get("nivel", 1):
            continue
        if s.get("requer") and s["requer"] not in feitas:
            continue
        lista.append(s)
    return lista


def aceitar(progresso, quest_id):
    if quest_id not in {q["id"] for q in disponiveis(progresso)}:
        abort(400, "Essa quest não está disponível agora.")
    quest = TODAS[quest_id]
    estado(progresso)["ativas"][quest_id] = {"feito": [0] * len(quest["objetivos"])}
    return quest


def completa(progresso, quest_id):
    andamento = estado(progresso)["ativas"].get(quest_id)
    quest = TODAS.get(quest_id)
    return bool(andamento and quest) and all(f >= o["alvo"] for f, o in zip(andamento["feito"], quest["objetivos"]))


def registrar(progresso, evento, **detalhes):
    """Algo aconteceu no jogo: avança os objetivos das quests ativas que esperam por isso."""
    for quest_id, andamento in estado(progresso)["ativas"].items():
        quest = TODAS.get(quest_id)
        if not quest:
            continue
        for i, objetivo in enumerate(quest["objetivos"]):
            if objetivo["evento"] != evento or andamento["feito"][i] >= objetivo["alvo"]:
                continue
            filtro = objetivo.get("filtro") or {}
            if all(detalhes.get(chave) in como_lista(valor) for chave, valor in filtro.items()):
                andamento["feito"][i] += 1


def entregar(progresso, quest_id, kit):
    """Tira a quest das ativas, marca como concluída e devolve a recompensa pronta para conceder (o visual
    "por classe" vira o da classe do herói)."""
    if not completa(progresso, quest_id):
        abort(400, "Ainda falta cumprir os objetivos dessa quest.")
    q = estado(progresso)
    del q["ativas"][quest_id]
    q["concluidas"].append(quest_id)
    recompensa = dict(TODAS[quest_id]["recompensa"])
    por_classe = recompensa.pop("cosmetico_por_classe", None)
    if por_classe:
        recompensa["cosmetico"] = por_classe.get(kit or "mago")
    return recompensa
