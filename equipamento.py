"""Os bônus dos itens que o herói está vestindo e os drops dos monstros.

Cada visual do catálogo (conteudo/itens.json) tem "bonus" conforme a raridade: XP e ouro a mais nas
vitórias, mana e vida máximas, segundos a mais para responder e sorte de drop. Só vale o que o herói
tem E está usando agora (o avatar salvo bate com o visual do item). Os totais têm teto.
"""

import random

import mascotes
from conteudo import ITENS, MATERIAIS

COSMETICOS = {c["id"]: c for c in ITENS["cosmeticos"]}
CONSUMIVEIS = {c["id"]: c for c in ITENS["consumiveis"]}
TETOS = {"xp": 0.5, "moedas": 0.5, "mana": 3, "vida": 3, "tempo": 6, "sorte": 0.15}
VAZIO = {chave: 0 for chave in TETOS}

# chance de um monstro comum deixar cair um consumível (os chefões sempre deixam algo)
CHANCE_DROP = 0.07
# o ouro dos monstros: metade do que estava na tabela (o Reino ficou rico demais)
FATOR_OURO_MONSTRO = 0.5


def equipados(progresso):
    """Os visuais que o herói tem e está usando agora."""
    avatar = progresso.get("avatar") or {}
    donos = set(progresso.get("cosmeticos") or [])
    return [c for c in COSMETICOS.values()
            if c["id"] in donos and c.get("avatar") and all(avatar.get(k) == v for k, v in c["avatar"].items())]


def bonus(progresso):
    """Os bônus somados dos visuais vestidos e do mascote (com teto)."""
    total = dict(VAZIO)
    fontes = [item.get("bonus") or {} for item in equipados(progresso)] + [mascotes.bonus(progresso)]
    for fonte in fontes:
        for chave, valor in fonte.items():
            if chave in total:
                total[chave] += valor
    return {chave: round(min(valor, TETOS[chave]), 2) for chave, valor in total.items()}


def sortear_drops(progresso, tipo, kit):
    """O que o monstro deixou cair: às vezes um consumível e, bem raramente, um visual exclusivo da região
    (só da classe do herói, se for de classe, e só se ele ainda não tiver). Chefões sempre deixam um
    Grande Elixir e têm muito mais chance de visual raro."""
    sorte = bonus(progresso)["sorte"]
    chefe = bool(tipo.get("chefe"))
    itens = {}
    if chefe:
        itens["elixir-grande"] = 1
    if random.random() < CHANCE_DROP + sorte:
        lista = list(CONSUMIVEIS.values())
        escolhido = random.choices(lista, weights=[c.get("drop_peso", 1) for c in lista])[0]
        itens[escolhido["id"]] = itens.get(escolhido["id"], 0) + 1
    cosmetico = None
    for c in COSMETICOS.values():
        drop = c.get("drop")
        if not drop or drop.get("regiao") != tipo.get("regiao") or c["id"] in progresso["cosmeticos"]:
            continue
        if c.get("kit") and kit and c["kit"] != kit:
            continue
        chance = drop["chance"] * (20 if chefe else 1) * (1 + sorte * 4)
        if random.random() < chance:
            cosmetico = c["id"]
            break
    return itens, cosmetico


# ---------- os materiais da Casa da Forja ----------
# Cada região tem 3 materiais: o comum (quase todo monstro solta), o raro e a essência. Os chefões só se
# vencem uma vez, então a essência também cai (raramente) dos monstros fortes e dos da noite. O Fragmento do
# Oráculo cai de qualquer monstro, bem raramente (o dobro em Umbraterra), e todo chefão deixa dois.
MATERIAIS_DA_REGIAO = {}
for _m in MATERIAIS.values():
    MATERIAIS_DA_REGIAO.setdefault(_m["regiao"], {})[_m["tier"]] = _m["id"]
FRAGMENTO = next(m["id"] for m in MATERIAIS.values() if m["tier"] == "mitico")
CHANCE_COMUM = 0.85
CHANCE_RARO = {"Fraco": 0.05, "Médio": 0.09, "Forte": 0.15}
CHANCE_ESSENCIA = {"Fraco": 0.003, "Médio": 0.01, "Forte": 0.025}
EXTRA_DA_NOITE = {"raro": 0.08, "essencia": 0.015}
CHANCE_FRAGMENTO = 0.008
UMBRATERRA = {"fenda", "cinzas", "cristais", "abismo", "geleira", "trono"}
PREMIO_DO_CHEFE = {"comum": 6, "raro": 4, "essencia": 3, "fragmento": 2}


def sortear_materiais(progresso, tipo):
    """O que o monstro deixou para a Forja: {id do material: quantidade}. A sorte do equipamento ajuda."""
    regiao = MATERIAIS_DA_REGIAO.get(tipo.get("regiao"))
    if not regiao:
        return {}
    sorte = 1 + bonus(progresso)["sorte"] * 4
    if tipo.get("chefe"):
        return {regiao["comum"]: PREMIO_DO_CHEFE["comum"], regiao["raro"]: PREMIO_DO_CHEFE["raro"],
                regiao["essencia"]: PREMIO_DO_CHEFE["essencia"], FRAGMENTO: PREMIO_DO_CHEFE["fragmento"]}
    forca = tipo.get("forca") if tipo.get("forca") in CHANCE_RARO else "Médio"
    noite = bool(tipo.get("daNoite"))
    achou = {}
    if random.random() < CHANCE_COMUM:
        achou[regiao["comum"]] = 2 if forca == "Forte" or noite else 1
    if random.random() < (CHANCE_RARO[forca] + (EXTRA_DA_NOITE["raro"] if noite else 0)) * sorte:
        achou[regiao["raro"]] = 1
    if random.random() < (CHANCE_ESSENCIA[forca] + (EXTRA_DA_NOITE["essencia"] if noite else 0)) * sorte:
        achou[regiao["essencia"]] = 1
    if random.random() < CHANCE_FRAGMENTO * (2 if tipo.get("regiao") in UMBRATERRA else 1) * sorte:
        achou[FRAGMENTO] = 1
    return achou
