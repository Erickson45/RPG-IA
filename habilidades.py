"""Árvore de habilidades e caminho da classe.

A árvore tem quatro ramos (Lâmina, Guardião, Arcano e Explorador) de três habilidades cada, e no topo
a habilidade lendária, que pede duas habilidades finais de ramos. O herói ganha 1 ponto por nível acima
do 1 e 1 por chefão vencido.

O caminho da classe (conteudo/classes.json) tem cinco degraus. Todo herói começa como iniciante da
classe principal (mago, guerreiro ou arqueiro); no nível de escolha vira uma das subclasses, e os
degraus seguintes pedem nível, domínio na trilha da subclasse e chefões vencidos. Os degraus 2, 3 e 5
liberam as três magias especiais da subclasse, e o degrau 4 dá a habilidade passiva dela de graça.
"""

import dominio
import equipamento
import progressao
from conteudo import CAMINHO_DAS_CLASSES, CLASSES, HABILIDADES, PRINCIPAIS

CATALOGO = {}
ANTERIOR = {}
FINAIS = []
for ramo in HABILIDADES["ramos"]:
    for i, h in enumerate(ramo["habilidades"]):
        CATALOGO[h["id"]] = h
        ANTERIOR[h["id"]] = ramo["habilidades"][i - 1]["id"] if i else None
    FINAIS.append(ramo["habilidades"][-1]["id"])
LENDA = HABILIDADES["lenda"]
CATALOGO[LENDA["id"]] = LENDA
ANTERIOR[LENDA["id"]] = None
CLASSES_POR_ID = {c["id"]: c for c in CLASSES}
PRINCIPAIS_POR_ID = {p["id"]: p for p in PRINCIPAIS}
NIVEL_ESCOLHA = CAMINHO_DAS_CLASSES["nivel_escolha"]
DEGRAUS_DAS_MAGIAS = CAMINHO_DAS_CLASSES["degraus_das_magias"]
DEGRAU_DA_PASSIVA = CAMINHO_DAS_CLASSES["degrau_da_passiva"]


def tem(progresso, habilidade_id):
    """Aprendida na árvore ou dada pela passiva da subclasse."""
    if habilidade_id in progresso["habilidades"]:
        return True
    classe = classe_do(progresso)
    return bool(classe) and classe["passiva"]["habilidade"] == habilidade_id and degrau(progresso) >= DEGRAU_DA_PASSIVA


def pode_aprender(progresso, habilidade_id):
    """Devolve o motivo de não poder (texto) ou None se a habilidade está aberta."""
    if habilidade_id == LENDA["id"]:
        feitas = sum(tem(progresso, f) for f in FINAIS)
        return None if feitas >= LENDA["requer_finais"] else f"Domina {LENDA['requer_finais']} habilidades finais de ramos primeiro."
    anterior = ANTERIOR[habilidade_id]
    return f"Primeiro aprende {CATALOGO[anterior]['nome']}." if anterior and not tem(progresso, anterior) else None


def pontos_totais(progresso):
    return progressao.nivel_de(progresso["xp"]) - 1 + len(progresso["chefesDerrotados"])


def pontos_livres(progresso):
    return pontos_totais(progresso) - sum(CATALOGO[h]["custo"] for h in progresso["habilidades"] if h in CATALOGO)


def vida_maxima(progresso):
    return progressao.vida_maxima(progresso["xp"]) + (1 if tem(progresso, "pele") else 0) + equipamento.bonus(progresso)["vida"]


def com_fortuna(progresso, recompensa):
    """Bolso Fundo e Mente Curiosa: +20% de moedas e de XP nas recompensas de monstros e missões."""
    bonus = HABILIDADES["bonus_fortuna"]
    recompensa = dict(recompensa)
    if tem(progresso, "bolso") and recompensa.get("moedas"):
        recompensa["moedas"] = round(recompensa["moedas"] * (1 + bonus))
    if tem(progresso, "curiosa") and recompensa.get("xp"):
        recompensa["xp"] = round(recompensa["xp"] * (1 + bonus))
    return recompensa


# ---------- caminho da classe ----------

def principal_do(progresso):
    return PRINCIPAIS_POR_ID.get((progresso.get("classe") or {}).get("principal"))


def classe_do(progresso):
    """A subclasse escolhida (None enquanto o herói ainda é iniciante)."""
    classe = CLASSES_POR_ID.get((progresso.get("classe") or {}).get("id"))
    principal = principal_do(progresso)
    return classe if classe and principal and classe["principal"] == principal["id"] else None


def trilha_preferida(progresso):
    """A trilha que o Reino puxa mais para o herói: a da subclasse ou, no iniciante, a da classe principal."""
    classe = classe_do(progresso)
    if classe:
        return classe["trilha"]
    principal = principal_do(progresso)
    return principal["trilha_inicial"] if principal else None


def migrar_classe(progresso):
    """Saves de antes das classes principais: a classe antiga (Runas, Alquimista...) vira subclasse do mago."""
    classe = progresso.get("classe")
    if not isinstance(classe, dict):
        progresso["classe"] = None
        return
    antiga = CLASSES_POR_ID.get(classe.get("id"))
    if not classe.get("principal") and antiga:
        classe["principal"] = antiga["principal"]
    progresso["classe"] = {"principal": classe.get("principal"), "id": classe.get("id")} if classe.get("principal") in PRINCIPAIS_POR_ID else None


def degrau(progresso, com_prova=True):
    """Quantos degraus do caminho o herói já subiu (1 a 5; 0 sem classe). O 1 é ser iniciante;
    do 2 em diante é preciso ter escolhido a subclasse. Cada subida pede, além do nível (e domínio e
    chefões nos últimos), a Prova do Degrau de onde ele está (progresso["provas"], curriculo.py)."""
    if not principal_do(progresso):
        return 0
    classe = classe_do(progresso)
    if not classe:
        return 1
    nivel = progressao.nivel_de(progresso["xp"])
    rank = dominio.rank_de(progresso["dominio"].get(classe["trilha"], 0))
    provas = set(progresso.get("provas") or [])
    subidos = 1
    for evolucao in classe["evolucoes"]:
        if nivel < evolucao["nivel"] or rank < evolucao.get("dominio", 0) or len(progresso["chefesDerrotados"]) < evolucao.get("chefes", 0):
            break
        # a escolha da subclasse já cobrou a prova do degrau 1; do 2 em diante cada subida cobra a sua
        if com_prova and subidos > 1 and subidos not in provas:
            break
        subidos += 1
    return subidos


def pode_escolher_subclasse(progresso):
    """Iniciante no nível de escolha e com a Prova do Aprendiz (degrau 1) aprovada."""
    return (bool(principal_do(progresso)) and not classe_do(progresso)
            and progressao.nivel_de(progresso["xp"]) >= NIVEL_ESCOLHA and 1 in set(progresso.get("provas") or []))


def no_ultimo_degrau(progresso):
    """Chegou ao fim do caminho da subclasse (o último título): é o que abre Umbraterra."""
    classe = classe_do(progresso)
    return bool(classe) and degrau(progresso) >= 1 + len(classe["evolucoes"])


def magias_da_classe(progresso):
    """As magias especiais liberadas: a comum no degrau 2, a épica no 3 e a lendária no 5."""
    classe = classe_do(progresso)
    if not classe:
        return []
    subido = degrau(progresso)
    return [m for m, precisa in zip(classe["magias"], DEGRAUS_DAS_MAGIAS) if subido >= precisa]
