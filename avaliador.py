"""Avaliador roteirizado de prompts (P-C-T-F).

Não usa IA: confere cada parte do prompt com regras simples e devolve
nota, dicas e elogios. Cada parte vale até 25 pontos.
"""

import re
import unicodedata

VERBOS_TAREFA = [
    "crie", "cria", "gere", "gera", "escreva", "escreve", "faca", "faz", "monte", "monta",
    "liste", "lista", "explique", "explica", "desenvolva", "desenvolve", "leia", "le",
    "conte", "conta", "calcule", "calcula", "mostre", "mostra", "analise", "resuma",
    "implemente", "elabore", "construa", "agrupe", "some", "retorne", "exiba", "imprima",
]
PALAVRAS_PAPEL = [
    "voce e", "atue como", "aja como", "seja", "voce sera", "faca o papel", "como um", "como uma",
]
PROFISSOES = [
    "analista", "desenvolvedor", "programador", "especialista", "engenheiro", "professor",
    "cientista", "consultor", "tecnico", "arquiteto", "dev", "senior", "instrutor",
]
PALAVRAS_FORMATO = [
    "script", "codigo", "tabela", "lista", "topico", "json", "markdown", "comentad",
    "passo a passo", "passos", "bloco", "arquivo", "csv", "saida", "linhas", "paragrafo",
    "exemplo", "explicacao", ".py", "funcao", "resumo", "terminal", "print",
]


def normalizar(texto):
    """Minúsculas e sem acento, pra comparar sem se preocupar com 'código' vs 'codigo'."""
    texto = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    return texto.lower().strip()


def contem(texto, palavras):
    return any(re.search(rf"\b{re.escape(p)}", texto) for p in palavras)


def tem_numero(texto):
    return bool(re.search(r"\d", texto))


def avaliar_papel(texto):
    pontos, dicas, elogios = 0, [], []
    if not texto:
        return 0, ["Você deixou o Papel em branco. Diga quem a IA deve ser, tipo \"Você é um desenvolvedor Python\"."], []
    if contem(texto, PALAVRAS_PAPEL):
        pontos += 10
        elogios.append("Começou definindo o papel da IA. Isso aí!")
    else:
        dicas.append("Comece com \"Você é...\" ou \"Atue como...\" para deixar o papel claro.")
    if contem(texto, PROFISSOES):
        pontos += 10
        elogios.append("Deu uma profissão para a IA, ela vai responder como especialista.")
    else:
        dicas.append("Diga qual especialista a IA deve ser (analista, desenvolvedor, professor...).")
    if len(texto) >= 25:
        pontos += 5
    else:
        dicas.append("Dá para detalhar um pouco mais: experiente em quê? Explicando para quem?")
    return pontos, dicas, elogios


def avaliar_contexto(texto, pistas):
    pontos, dicas, elogios = 0, [], []
    if not texto:
        return 0, ["Sem Contexto a IA chuta. Conte a situação: que arquivo, que colunas, que sistema."], []
    encontradas = [p for p in pistas if p in texto]
    if len(encontradas) >= 3:
        pontos += 15
        elogios.append("Contexto rico, com os detalhes do cenário. A IA agradece!")
    elif encontradas:
        pontos += 8
        dicas.append("Bom começo! Traga mais detalhes do cenário: nome do arquivo, colunas, onde vai rodar.")
    else:
        dicas.append("O Contexto não fala do cenário. Releia o pedido do coordenador e traga os detalhes.")
    if len(texto) >= 40:
        pontos += 5
    else:
        dicas.append("Contexto muito curto. Mais detalhe = resposta mais certeira.")
    if tem_numero(texto) or re.search(r"\w+\.\w{2,4}\b", texto):
        pontos += 5
        elogios.append("Citou nomes de arquivo ou números concretos. Precisão é tudo.")
    else:
        dicas.append("Cite algo concreto, como o nome do arquivo (chamados.csv) ou a versão do Python.")
    return pontos, dicas, elogios


def avaliar_tarefa(texto):
    pontos, dicas, elogios = 0, [], []
    if not texto:
        return 0, ["A Tarefa é o coração do prompt! Diga o que a IA deve fazer."], []
    if contem(texto, VERBOS_TAREFA):
        pontos += 10
        elogios.append("Usou um verbo de ação claro. A IA sabe o que fazer.")
    else:
        dicas.append("Comece a Tarefa com um verbo de ação: crie, escreva, liste, calcule...")
    if len(texto) >= 40:
        pontos += 8
    else:
        dicas.append("Detalhe mais a Tarefa: o que exatamente o resultado precisa ter?")
    if contem(texto, ["apenas", "somente", "so ", "status", "por categoria", "agrup", "filtr", "ordene", "ordenad", "quantidade", "contar", "conte"]):
        pontos += 7
        elogios.append("Colocou regras na tarefa (filtrar, agrupar, contar). Bem específico!")
    else:
        dicas.append("Diga as regras: considerar só chamados abertos? Agrupar por categoria? Ordenar?")
    return pontos, dicas, elogios


def avaliar_formato(texto):
    pontos, dicas, elogios = 0, [], []
    if not texto:
        return 0, ["Sem Formato, a IA escolhe por você. Diga como quer a resposta: script comentado, tabela, passo a passo..."], []
    if contem(texto, PALAVRAS_FORMATO):
        pontos += 15
        elogios.append("Formato definido. Você vai receber a resposta do jeito que precisa.")
    else:
        dicas.append("Diga o formato: script Python comentado, tabela, lista de passos...")
    if len(texto) >= 20:
        pontos += 5
    else:
        dicas.append("Formato um pouco vago. Quer só o código? Código + explicação? Como rodar?")
    if contem(texto, ["comentad", "explica", "como rodar", "como executar", "passo a passo", "exemplo"]):
        pontos += 5
        elogios.append("Pediu explicação ou comentários. Ótimo para aprender com a resposta!")
    else:
        dicas.append("Peça o código comentado ou com instruções de como rodar. Você aprende junto.")
    return pontos, dicas, elogios


PADROES_SENSIVEIS = [
    ("um CPF", "[CPF]", r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b"),
    ("um e-mail", "[EMAIL]", r"[\w.+-]+@[\w-]+\.[\w.]+"),
    ("um telefone", "[TELEFONE]", r"\(?\b\d{2}\)?\s?9\d{4}-?\d{4}\b"),
    ("uma chave ou token", "TOKEN_AQUI", r"\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[a-zA-Z])[A-Za-z0-9_-]{32,}\b"),
]
# "senha: algo" só é problema se o valor não for um marcador, tipo SENHA_AQUI ou [TOKEN]
CREDENCIAL = re.compile(
    r"\b(senha|password|token|api[ _-]?key)\s*(?:é|:|=)\s*((?=\S*[\d@#$%!&*])\S{4,})", re.IGNORECASE
)
MARCADOR = re.compile(r"aqui|xxx|\*\*\*|[<\[{]|seu_|sua_|meu_|exemplo|env|variavel|vari[aá]vel", re.IGNORECASE)


def detectar_dados_sensiveis(texto):
    """Procura no prompt coisas que nunca deveriam ir para uma IA pública."""
    alertas = []
    for descricao, marcador, padrao in PADROES_SENSIVEIS:
        if re.search(padrao, texto):
            alertas.append(f"Parece ter {descricao} no teu prompt. Troque por um marcador, tipo {marcador}.")
    for _, valor in CREDENCIAL.findall(texto):
        if not MARCADOR.search(valor):
            alertas.append("Tem uma senha ou token de verdade no prompt! Use um marcador como TOKEN_AQUI.")
            break
    return alertas


def avaliar_anonimizacao(texto, etapa):
    """Confere se o aluno tirou os dados sensíveis sem apagar o problema técnico."""
    normal = normalizar(texto)
    so_digitos = re.sub(r"\D", "", texto)

    vazamentos = []
    for sensivel in etapa["sensiveis"]:
        palavras = [normalizar(p) for p in sensivel.get("palavras", [])]
        vazou = any(re.search(rf"(?<![\w@.]){re.escape(p)}(?![\w@])", normal) for p in palavras)
        if sensivel.get("digitos") and sensivel["digitos"] in so_digitos:
            vazou = True
        if vazou:
            vazamentos.append(sensivel["tipo"])

    faltando = [m["motivo"] for m in etapa["manter"] if normalizar(m["trecho"]) not in normal]
    usou_marcadores = bool(re.search(r"\[[^\]]+\]", texto))

    if vazamentos:
        fala = f"Ainda tem dado sensível aí: **{', '.join(vazamentos)}**. Caça esses e troca por marcadores!"
    elif faltando:
        fala = "Dados protegidos, mas você apagou demais! Sem o problema técnico a IA não consegue ajudar."
    else:
        fala = "Perfeito! Nenhum dado pessoal e o problema continua claro. É assim que se manda um chamado para a IA."
        if not usou_marcadores:
            fala += " Dica: marcadores como [NOME] deixam o texto mais fácil de entender."

    return {
        "aprovado": not vazamentos and not faltando,
        "vazamentos": vazamentos,
        "faltando": faltando,
        "protegidos": len(etapa["sensiveis"]) - len(vazamentos),
        "total": len(etapa["sensiveis"]),
        "fala": fala,
    }


def avaliar_canvas(respostas, etapa):
    """Cada campo vale o mesmo: 60% por estar bem preenchido, 40% por usar as palavras-pista."""
    campos = []
    for campo in etapa["campos"]:
        texto = normalizar(respostas.get(campo["chave"], ""))
        preenchido = len(texto) >= campo["minimo"]
        pistas = campo.get("pistas", [])
        usou_pista = not pistas or any(re.search(rf"\b{re.escape(normalizar(p))}", texto) for p in pistas)
        pontos = (60 if preenchido else 20 if texto else 0) + (40 if usou_pista and texto else 0)
        if not texto:
            retorno = "Ficou em branco. " + campo["dica"]
        elif not preenchido:
            retorno = "Tá curto. " + campo["dica"]
        elif not usou_pista:
            retorno = "Bom, mas dá para ser mais claro. " + campo["dica"]
        else:
            retorno = "Mandou bem!"
        campos.append({"chave": campo["chave"], "pontos": pontos, "ok": pontos == 100, "retorno": retorno})

    nota = round(sum(c["pontos"] for c in campos) / len(campos))
    alertas = detectar_dados_sensiveis("\n".join(str(v) for v in respostas.values()))
    if alertas:
        nota = min(nota, 30)
    aprovado = nota >= 60 and all(c["pontos"] > 0 for c in campos)

    if alertas:
        fala = "Opa, tem dado sensível no teu canvas. Ideia de negócio não precisa de CPF nem de e-mail de ninguém!"
    elif nota >= 85:
        fala = "Que ideia bem pensada! Problema claro, solução clara e já sabe como ganhar dinheiro."
    elif aprovado:
        fala = "A ideia tá de pé! Olha as dicas para deixar ela mais afiada."
    else:
        fala = "Ainda tá nebulosa. Preenche cada campo com calma: quem pensa bem aqui economiza muito prompt depois."
    return {"nota": nota, "estrelas": estrelas_para(nota), "aprovado": aprovado, "campos": campos, "alertas": alertas, "fala": fala}


GANCHO = ["?", "imagine", "imagina", "voce ja", "quantas vezes", "sabia que", "e se"]
CHAMADA = ["experimente", "teste", "baixe", "assine", "vem", "venha", "junte", "invista", "conte comigo",
           "vamos", "bora", "acesse", "cadastre", "convido", "contrate", "procure", "fale comigo", "chama"]


def avaliar_pitch(texto, nome_produto, etapa):
    """Cinco critérios de 20 pontos: duração, gancho, nome do produto, número concreto e pedido final."""
    normal = normalizar(texto)
    palavras = len(re.findall(r"\w+", normal))
    segundos = round(palavras / 150 * 60)  # fala tranquila: ~150 palavras por minuto
    nome = normalizar(nome_produto)

    def tem(lista, trecho):
        return any(p in trecho for p in lista)

    criterios = [
        ("Cabe em 1 minuto", etapa["palavras_min"] <= palavras <= etapa["palavras_max"],
         f"Teu pitch tem {palavras} palavras (~{segundos}s falando). O ideal é entre {etapa['palavras_min']} e {etapa['palavras_max']}."),
        ("Começa com um gancho", tem(GANCHO, normal[:160]),
         "Abra com uma pergunta ou um \"Imagina...\". Os primeiros 5 segundos decidem se alguém vai prestar atenção."),
        ("Fala o nome do produto", bool(nome) and nome in normal,
         f"Cite o nome do produto ({nome_produto or 'o do teu canvas'}). Quem ouve precisa lembrar dele depois."),
        ("Tem um número concreto", bool(re.search(r"\d", normal)),
         "Coloque um número: quanto tempo economiza, quanto custa, quantas pessoas têm o problema."),
        ("Termina com um pedido", tem(CHAMADA, normal[-200:]),
         "Termine pedindo algo: \"experimente\", \"vamos conversar\", \"invista\"... Pitch sem pedido é só conversa."),
    ]
    resultado = [{"descricao": d, "ok": ok, "dica": "" if ok else dica} for d, ok, dica in criterios]
    nota = 20 * sum(c["ok"] for c in resultado)
    if nota == 100:
        fala = "Arrepiou! Gancho, problema, solução, número e pedido. Eu sairia dessa sala querendo testar."
    elif nota >= 60:
        fala = "Pitch convincente! Ajusta o que falta e ele fica imbatível."
    else:
        fala = "A ideia é boa, mas o pitch ainda não vende. Segue as dicas, um critério de cada vez."
    return {"nota": nota, "estrelas": estrelas_para(nota), "aprovado": nota >= 60,
            "palavras": palavras, "segundos": segundos, "criterios": resultado, "fala": fala}


def estrelas_para(nota):
    if nota >= 85:
        return 3
    if nota >= 60:
        return 2
    if nota >= 35:
        return 1
    return 0


def montar_prompt(campos):
    partes = [campos.get(p, "").strip() for p in ("papel", "contexto", "tarefa", "formato")]
    return "\n".join(p for p in partes if p)


def avaliar(campos, etapa):
    """Avalia os quatro campos do prompt e devolve o resultado completo."""
    pistas = [normalizar(p) for p in etapa.get("pistas_contexto", [])]
    textos = {nome: normalizar(campos.get(nome, "")) for nome in ("papel", "contexto", "tarefa", "formato")}

    avaliacoes = {
        "papel": avaliar_papel(textos["papel"]),
        "contexto": avaliar_contexto(textos["contexto"], pistas),
        "tarefa": avaliar_tarefa(textos["tarefa"]),
        "formato": avaliar_formato(textos["formato"]),
    }

    partes = {
        nome: {"pontos": pontos, "maximo": 25, "dicas": dicas, "elogios": elogios}
        for nome, (pontos, dicas, elogios) in avaliacoes.items()
    }
    nota = sum(p["pontos"] for p in partes.values())
    alertas = detectar_dados_sensiveis(montar_prompt(campos))
    if alertas:
        nota = min(nota, 30)  # prompt com dado sensível nunca passa, por melhor que seja
    estrelas = estrelas_para(nota)
    aprovado = nota >= etapa.get("nota_minima", 60)

    if alertas:
        fala = "Opa, opa! Achei dado sensível no teu prompt. Esse prompt **não pode** ir para uma IA. Tira e tenta de novo."
    elif estrelas == 3:
        fala = "Que prompt, aprendiz! Qualquer IA vai entender exatamente o que você quer."
    elif aprovado:
        fala = "Mandou bem! Já é um prompt que funciona. Olha as dicas para chegar nas 3 estrelas."
    else:
        fala = "Ainda não, mas tá no caminho! Olha as dicas de cada parte e tenta de novo."

    return {
        "nota": nota,
        "estrelas": estrelas,
        "aprovado": aprovado,
        "fala": fala,
        "partes": partes,
        "alertas": alertas,
        "prompt_montado": montar_prompt(campos),
    }
