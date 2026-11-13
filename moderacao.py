"""Moderação do texto que os jogadores escrevem no multijogador: o chat de balão, os recados do Quadro de
Anotações e as perguntas que um jogador escreve para o outro no duelo.

O lobby é público e tem alunos, então o filtro é de propósito rigoroso: recusa (não esconde com asteriscos)
palavrões e ofensas, links e endereços, e-mails e telefones (ninguém passa contato para estranho dentro do
jogo) e textos gritados ou repetidos. Quem escreve recebe o motivo e reescreve.

A comparação é feita no texto "achatado": sem acentos, em minúsculas, com os truques comuns desfeitos
(0 vira o, 1 vira i, 3 vira e, 4 e @ viram a, 5 e $ viram s, 7 vira t) e sem os espaços e pontos que
separam as letras ("p.u.t.a", "p u t a"). As palavras proibidas ficam numa lista daqui; para acrescentar,
basta pôr a raiz (minúscula, sem acento).
"""

import re
import unicodedata

# raízes proibidas (português e um pouco de inglês); bate no começo de uma palavra do texto
PROIBIDAS = {
    "porra", "caralh", "buceta", "bucet", "xoxota", "xereca", "piroca", "cacete",
    "puta", "putinha", "puto", "fdp", "filhadaput", "filhodaput", "vtnc", "vsf", "pqp",
    "merda", "bosta", "cuzao", "cuzinho", "arrombad", "babaca", "otario", "otaria", "imbecil", "idiota",
    "retardad", "mongoloid", "viado", "viadinho", "sapatao", "traveco", "boiola", "baitola",
    "vagabund", "piranha", "safad", "corno", "chifrud", "punheta", "punheteiro", "siririca", "foder", "fode",
    "fodase", "fodasse", "fudido", "fuder", "transar", "porno", "pornografia", "nude",
    "crioulo", "neguinho", "nazista", "hitler", "estupr", "pedofil", "suicid",
    "desgracad", "nojent", "escroto", "escrota", "fuck", "shit", "bitch",
    "pussy", "nigg", "faggot", "whore", "slut", "asshole", "cunt",
}
# palavras inteiras que só são ofensa sozinhas (como raiz pegariam palavras boas: "cu" em "curso",
# "pica" em "picante", "rola" em "rolar")
PROIBIDAS_INTEIRAS = {"cu", "ku", "krl", "crl", "pica", "bicha", "tnc", "sexo", "kys", "dick", "vadia", "macaco"}
# palavras boas que começam igual a uma raiz proibida e não podem ser barradas
LIBERADAS = {"putz", "puts"}

TROCAS = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "@": "a", "5": "s", "$": "s", "7": "t", "!": "i", "|": "i"})
LINK = re.compile(
    r"(https?://|www\.|\b[\w-]+\.(com|net|org|br|io|gg|me|tv|xyz|app|dev|info|link|ly|co|site|online|ru|cn)\b|discord\.gg|t\.me/|wa\.me/|bit\.ly)",
    re.IGNORECASE,
)
EMAIL = re.compile(r"[\w.+-]+\s*(@|\(at\)|\[at\])\s*[\w-]+\s*\.\s*\w+", re.IGNORECASE)
# 8 dígitos ou mais (com espaços, pontos e traços no meio): telefone, CPF, conta...
NUMERAO = re.compile(r"(\d[\s.\-()]*){8,}")
PEDE_CONTATO = re.compile(r"\b(whats|zap|zapzap|insta|instagram|telegram|tiktok|meu numero|meu fone|me chama no|me add|me adiciona)\b")


def achatar(texto):
    """Sem acentos, minúsculo e com os números de disfarce trocados pelas letras."""
    sem_acento = "".join(c for c in unicodedata.normalize("NFKD", str(texto)) if not unicodedata.combining(c))
    return sem_acento.casefold().translate(TROCAS)


def _palavras(achatado):
    return re.findall(r"[a-z]+", achatado)


def _tem_proibida(palavras):
    for palavra in palavras:
        if palavra in LIBERADAS:
            continue
        if palavra in PROIBIDAS_INTEIRAS:
            return True
        # letras repetidas para fugir do filtro ("poooorra") contam como uma só
        enxuta = re.sub(r"(.)\1+", r"\1", palavra)
        for raiz in PROIBIDAS:
            if palavra.startswith(raiz) or enxuta.startswith(re.sub(r"(.)\1+", r"\1", raiz)):
                return True
    return False


def motivo_para_recusar(texto, tamanho_maximo=280):
    """Por que este texto não pode ir para o jogo (frase para mostrar a quem escreveu), ou None se pode."""
    texto = str(texto or "")
    limpo = " ".join(texto.split())
    if not limpo:
        return "Escreve alguma coisa primeiro."
    if len(limpo) > tamanho_maximo:
        return f"Texto comprido demais (até {tamanho_maximo} letras)."
    if any(unicodedata.category(c) in ("Cc", "Cf", "Co", "Cs") for c in texto if c not in "\n\t"):
        return "Esse texto tem caracteres invisíveis. Escreve de novo, só com letras."
    if LINK.search(limpo) or LINK.search(limpo.replace(" ", "")):
        return "Links e endereços de sites não podem ir no salão."
    if EMAIL.search(limpo):
        return "Nada de e-mail no salão: aqui ninguém passa contato."
    if NUMERAO.search(limpo):
        return "Números grandes (telefone, documento) não podem ir no salão."
    achatado = achatar(limpo)
    if PEDE_CONTATO.search(achatado):
        return "Combinar contato fora do jogo não vale aqui. Conversa pelo salão mesmo!"
    # as palavras como estão e com as letras separadas juntadas ("p u t a", "p.u.t.a")
    palavras = _palavras(achatado)
    soltas = re.findall(r"(?:\b[a-z]\b[\s.\-_*]*){3,}", achatado)
    candidatas = palavras + ["".join(re.findall(r"[a-z]", s)) for s in soltas]
    if _tem_proibida(candidatas):
        return "Essa linguagem não combina com a Academia. Reescreve com outras palavras."
    letras = [c for c in limpo if c.isalpha()]
    if len(letras) >= 12 and sum(c.isupper() for c in letras) / len(letras) > 0.7:
        return "Sem gritar, aventureiro: tira o CAPS LOCK."
    # "kkkkkk" é risada e passa; uma linha inteira da mesma letra, não
    if re.search(r"(.)\1{15,}", limpo) or re.search(r"(\S{2,6})\1{9,}", limpo.replace(" ", "")):
        return "Texto repetido demais."
    return None


def limpar(texto):
    """O texto como ele é guardado e mostrado: espaços normalizados (as quebras de linha ficam, no máximo 6)."""
    linhas = [" ".join(linha.split()) for linha in str(texto or "").splitlines()]
    linhas = [linha for linha in linhas if linha][:6]
    return "\n".join(linhas)
