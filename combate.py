"""Regras da batalha por turnos: mana, magias do grimório e as três fases dos chefões.

Cada rodada o herói pode lançar magias (gastando mana) e depois responde a pergunta. Acertar devolve
mana; errar deixa o monstro atacar. Os chefões mudam de fase conforme perdem vida, e cada fase pode
endurecer a luta: perguntas mais difíceis, golpes mais fortes, magias mais caras ou um tema só.
"""

import random

import equipamento
import habilidades
import progressao
from conteudo import MAGIAS, pergunta_por_ref

MANA = MAGIAS["mana"]
GRIMORIO = {m["id"]: m for m in MAGIAS["magias"]}
SEM_EFEITO = {"nome": "", "fala": "", "dano": 0, "perigo": 0, "silencio": False, "trilha": None}

# A Sequência: acertos seguidos (em batalhas e enigmas) que só um erro zera. A cada 5, um Golpe Final;
# e cada ponto de sequência aumenta o prêmio.
GOLPE_FINAL_A_CADA = 5
DANO_GOLPE_FINAL = 2
BONUS_POR_SEQUENCIA = 0.05
TETO_BONUS_SEQUENCIA = 0.5
# o relógio do servidor dá uma folga pela rede e pelo texto que ainda está sendo escrito na tela
FOLGA_TEMPO = 3
# Defesa ativa: o anel fecha cerca de 1 s depois do golpe; aparar só vale dentro desta janela (segundos)
JANELA_APARAR = (0.45, 2.3)


def fator_sequencia(sequencia):
    """Quanto a sequência aumenta o prêmio: +5% por ponto, até +50%."""
    return 1 + min(sequencia * BONUS_POR_SEQUENCIA, TETO_BONUS_SEQUENCIA)


def foi_rapido(tempo, decorrido):
    return decorrido <= tempo["rapido"] + FOLGA_TEMPO


def aparou(apertou, decorrido):
    return bool(apertou) and JANELA_APARAR[0] <= decorrido <= JANELA_APARAR[1]


def mana_maxima(progresso):
    """Cresce com o nível (até o teto); o Poço de Mana e o equipamento somam por cima."""
    base = min(MANA["base"] + progressao.nivel_de(progresso["xp"]) // MANA["por_niveis"], MANA["maxima"])
    return base + (1 if habilidades.tem(progresso, "poco-mana") else 0) + equipamento.bonus(progresso)["mana"]


def mana_por_acerto(progresso):
    return MANA["por_acerto"] + (1 if habilidades.tem(progresso, "fluxo") else 0)


def magias_liberadas(xp):
    nivel = progressao.nivel_de(xp)
    return [m for m in MAGIAS["magias"] if nivel >= m["nivel"]]


def fase_de(tipo, vida):
    """Chefões têm 3 fases, trocadas a cada terço de vida perdida; monstros comuns, uma só."""
    if not tipo.get("fases"):
        return 1
    total = tipo["vida"]
    return min(3, 1 + (total - vida) * 3 // total)


def efeitos_da_fase(tipo, fase):
    fases = tipo.get("fases") or []
    return {**SEM_EFEITO, **(fases[fase - 1] if fase <= len(fases) else {})}


def custo(magia, efeitos_fase, progresso=None, efeitos_batalha=None):
    """No silêncio de algumas fases, toda magia custa 1 de mana a mais. Com o Eco do Grimório, a
    primeira magia da batalha sai de graça."""
    if progresso and habilidades.tem(progresso, "eco") and not (efeitos_batalha or {}).get("ecoUsado"):
        return 0
    return magia["custo"] + (1 if efeitos_fase["silencio"] else 0)


def bonus_de_acerto(progresso, efeitos):
    """Primeiro Golpe e Sequência Arcana: vida extra tirada do monstro neste acerto (e os nomes, para a tela)."""
    efeitos["acertos"] = efeitos.get("acertos", 0) + 1
    efeitos["seguidos"] = efeitos.get("seguidos", 0) + 1
    bonus = []
    if efeitos["acertos"] == 1 and habilidades.tem(progresso, "primeiro-golpe"):
        bonus.append("Primeiro Golpe 🗡️")
    if efeitos["seguidos"] >= 3 and habilidades.tem(progresso, "sequencia"):
        efeitos["seguidos"] = 0
        bonus.append("Sequência Arcana 🔗")
    # Stack Overflow e Na Minha Máquina Funciona deixam alguns acertos com +1
    if efeitos.get("combo", 0) > 0:
        efeitos["combo"] -= 1
        bonus.append("Combo de classe 🔥")
    return bonus


def alternativas_para_dissolver(ref):
    """Visão Clara: duas alternativas erradas, na ordem embaralhada que o herói está vendo."""
    base, _, ordem = str(ref).partition("@")
    pergunta = pergunta_por_ref(base)
    indices = [int(c) for c in ordem] if ordem.isdigit() else list(range(len(pergunta["opcoes"])))
    certa = indices.index(pergunta["correta"])
    erradas = [i for i in range(len(indices)) if i != certa]
    return sorted(random.sample(erradas, min(2, len(erradas) - 1)))
