"""Curva de XP, níveis, eras e vida máxima.

Cada nível pede mais XP que o anterior: 50 + 30 × nível e, a partir do nível 4, mais 5 × (nível − 3)²
(a curva vai apertando: subir fica cada vez mais demorado). Os níveis se agrupam em eras, como no
documento de design. O navegador espelha estas contas só para desenhar a barra de XP; quem decide é o servidor.
"""

XP_BASE = 50
XP_POR_NIVEL = 30
XP_CURVA = 5  # o peso do termo quadrado
NIVEL_CURVA = 3  # a partir de que nível o termo quadrado começa a contar

# (nível em que a era começa, nome da era)
ERAS = [(1, "Era do Aprendiz"), (11, "Era do Explorador"), (21, "Era do Mestre"), (36, "Era do Arquimago")]
VIDA_INICIAL = 3
VIDA_MAXIMA = 10


def xp_para_subir(nivel):
    """Quanto XP leva para sair do nível e chegar ao próximo."""
    return XP_BASE + XP_POR_NIVEL * nivel + XP_CURVA * max(0, nivel - NIVEL_CURVA) ** 2


def xp_para_chegar(nivel):
    """XP total acumulado para chegar ao nível (o nível 1 começa em 0): a soma de xp_para_subir dos
    níveis anteriores, em fórmula fechada (a soma dos quadrados 1² + 2² + ... + m²)."""
    anteriores = nivel - 1
    m = max(0, anteriores - NIVEL_CURVA)
    return XP_BASE * anteriores + XP_POR_NIVEL * anteriores * nivel // 2 + XP_CURVA * m * (m + 1) * (2 * m + 1) // 6


def nivel_de(xp):
    nivel = 1
    while xp >= xp_para_chegar(nivel + 1):
        nivel += 1
    return nivel


def era_de(nivel):
    nome = ERAS[0][1]
    for inicio, era in ERAS:
        if nivel >= inicio:
            nome = era
    return nome


def vida_maxima(xp):
    return min(VIDA_INICIAL + nivel_de(xp), VIDA_MAXIMA)


def resumo(xp):
    nivel = nivel_de(xp)
    return {
        "nivel": nivel,
        "era": era_de(nivel),
        "xpNoNivel": xp - xp_para_chegar(nivel),
        "xpDoNivel": xp_para_subir(nivel),
        "vidaMaxima": vida_maxima(xp),
    }
