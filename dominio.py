"""Domínio por trilha: acertos, lições, dungeons e livros rendem pontos na trilha de conhecimento.

Cada trilha tem patentes (Novato, Aprendiz, Adepto...). Subir de patente paga um bônus em moedas e,
a partir de Adepto, cada acerto daquela trilha vira um golpe certeiro (tira 2 de vida do monstro).
"""

from conteudo import BIBLIOTECA, TRILHAS

RANKS = TRILHAS["ranks"]
PONTOS = TRILHAS["pontos"]


def rank_de(pontos):
    """Posição da patente (0 = Novato) para uma quantidade de pontos."""
    return max(i for i, rank in enumerate(RANKS) if pontos >= rank["pontos"])


def golpe_certeiro(progresso, trilha):
    """A partir de Adepto (ou de Aprendiz, com a habilidade Golpe de Mestre), acertar a trilha tira 2 de vida."""
    a_partir_de = TRILHAS["golpe_a_partir_de"] - (1 if "golpe-mestre" in progresso.get("habilidades", []) else 0)
    return bool(trilha) and rank_de(progresso["dominio"].get(trilha, 0)) >= a_partir_de


def somar(progresso, trilha, pontos):
    """Soma domínio na trilha. Devolve a posição da patente nova quando sobe (para pagar o bônus), senão None."""
    if trilha not in TRILHAS["trilhas"] or pontos <= 0:
        return None
    antes = progresso["dominio"].get(trilha, 0)
    progresso["dominio"][trilha] = antes + pontos
    depois = rank_de(antes + pontos)
    return depois if depois > rank_de(antes) else None


def trilha_da_leitura(fonte, item_id):
    """Os livros contam para a trilha da estante; os guias da Sala da Carreira, para IA no Trabalho."""
    if fonte == "carreira":
        return "trabalho"
    return TRILHAS["estantes"].get(BIBLIOTECA[item_id].get("estante"))
