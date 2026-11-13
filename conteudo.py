"""Todo o conteúdo do jogo, carregado dos arquivos JSON da pasta conteudo/.

Lições, perguntas, monstros, itens, enigmas e livros ficam em dados configuráveis: assim dá para
balancear ou criar conteúdo novo sem mexer na lógica (app.py e jogador.py só leem daqui).
"""

import json
import random
from pathlib import Path

from flask import abort

PASTA = Path(__file__).parent / "conteudo"


def carregar_json(nome):
    with open(PASTA / nome, encoding="utf-8") as arquivo:
        return json.load(arquivo)


def carregar_fases():
    """As lições dos três professores: Zetsu (iniciante), Kaela (intermediário) e Orion (avançado)."""
    fases = {}
    for arquivo in ("fases.json", "fases_kaela.json", "fases_orion.json"):
        dados = carregar_json(arquivo)
        for fase in dados["fases"]:
            fase.setdefault("professor", dados.get("professor", "zetsu"))
            fases[fase["id"]] = fase
    return fases


FASES = carregar_fases()
BIBLIOTECA = {livro["id"]: livro for livro in carregar_json("biblioteca.json")["livros"]}
CARREIRA = {guia["id"]: guia for guia in carregar_json("carreira.json")["guias"]}
PERGUNTAS_REINO = carregar_json("perguntas_reino.json")["perguntas"]
PUZZLES = {p["id"]: p for p in carregar_json("puzzles.json")["puzzles"]}
MONSTROS = carregar_json("monstros.json")["monstros"]
BONUS_NOITE = carregar_json("monstros.json")["bonus_noite"]
APTIDAO = carregar_json("aptidao.json")
CAMINHO_DAS_CLASSES = carregar_json("classes.json")
CLASSES = CAMINHO_DAS_CLASSES["classes"]  # as subclasses
PRINCIPAIS = CAMINHO_DAS_CLASSES["principais"]  # mago, guerreiro e arqueiro

# Recarga das magias de classe em horas de verdade (depois de usar, a magia espera esse tempo). Quem
# vence a luta sozinho (expulsar, apagar, derrubar) espera 1 dia; o resto depende da raridade. Uma magia
# pode ter "recarga_horas" própria no classes.json.
HORAS_DE_RECARGA = {"vence_sozinha": 24, "lendaria": 12, "epica": 6, "comum": 2}
VENCEM_SOZINHAS = {"expulsar", "apagar", "derrubar"}
for _classe in CLASSES:
    for _magia in _classe["magias"]:
        _magia.pop("recarga", None)  # a recarga antiga, contada em batalhas
        _magia.setdefault("recarga_horas", HORAS_DE_RECARGA["vence_sozinha"] if _magia["efeito"]["tipo"] in VENCEM_SOZINHAS
                          else HORAS_DE_RECARGA.get(_magia["raridade"], 2))
ITENS = carregar_json("itens.json")
# a Casa da Forja (gerada por gerar_forja.py): os materiais que os monstros soltam, as linhagens e os itens
# forjados, que entram no catálogo como visuais exclusivos (com a receita em "forja")
FORJA = carregar_json("forja.json")
ITENS["cosmeticos"] += FORJA["itens"]
ITENS["materiais"] = FORJA["materiais"]
ITENS["temas_forja"] = FORJA["temas"]
MATERIAIS = {m["id"]: m for m in FORJA["materiais"]}
DUNGEONS = {d["id"]: d for d in carregar_json("dungeons.json")["dungeons"]}
TRILHAS = carregar_json("trilhas.json")
REGIOES = carregar_json("regioes.json")["regioes"]
MISSOES = carregar_json("missoes.json")
HISTORIA = carregar_json("historia.json")
MAGIAS = carregar_json("magias.json")
HABILIDADES = carregar_json("habilidades.json")
DESAFIOS = carregar_json("desafios.json")
# O currículo de cada classe: as skills de cada degrau (com a lição) e as perguntas só daquela classe.
CURRICULO = carregar_json("curriculo.json")
PERGUNTAS_CLASSE = carregar_json("perguntas_classes.json")["perguntas"]
SKILLS = {s["id"]: s for s in CURRICULO["skills"]}


_CATALOGO_POR_ID = {item["id"]: item for grupo in ("trofeus", "cosmeticos", "consumiveis") for item in ITENS[grupo]}


def item_do_catalogo(item_id):
    return _CATALOGO_POR_ID.get(item_id)


# ---------- perguntas dos monstros do Reino ----------

def pergunta_por_ref(ref):
    """ref = "fase:<id>:<etapa>:<pergunta>", "dungeon:<id>:<sala>:<pergunta>", "reino:<nivel>:<indice>",
    "lacuna:<nivel>:<indice>" ou "ordem:<nivel>:<indice>" (os desafios de conteudo/desafios.json)."""
    try:
        tipo, origem, a, *resto = str(ref).split(":")
        if tipo == "reino":
            return PERGUNTAS_REINO[int(a)]
        if tipo == "classe":
            return PERGUNTAS_CLASSE[int(a)]
        if tipo in ("lacuna", "ordem"):
            return DESAFIOS[tipo][int(a)]
        b = int(resto[0])
        a = int(a)
        if tipo == "fase":
            return FASES[int(origem)]["etapas"][a]["perguntas"][b]
        if tipo == "dungeon":
            return DUNGEONS[origem]["salas"][a]["perguntas"][b]
    except (ValueError, KeyError, IndexError, TypeError):
        pass
    abort(400, "Pergunta inválida.")


def trilha_da_ref(ref):
    """A trilha de domínio de uma pergunta: a do banco do Reino, ou a da lição/dungeon de onde ela veio."""
    ref = base_da_ref(ref)
    tipo, origem, a, *_ = ref.split(":")
    if tipo == "reino":
        return PERGUNTAS_REINO[int(a)].get("trilha")
    if tipo == "classe":
        return PERGUNTAS_CLASSE[int(a)].get("trilha")
    if tipo in ("lacuna", "ordem"):
        return DESAFIOS[tipo][int(a)].get("trilha")
    if tipo == "fase":
        return FASES[int(origem)].get("trilha")
    return DUNGEONS[origem].get("trilha")


def fonte_da_ref(ref):
    """De onde a pergunta sai, para a batalha mostrar ("📖 livro · capítulo"): o capítulo da biblioteca ou o
    guia da Sala da Carreira (campo "fonte" da pergunta), a lição do mestre ou a dungeon."""
    ref = base_da_ref(ref)
    tipo, origem, a, *_ = ref.split(":")
    if tipo == "fase":
        fase = FASES.get(int(origem)) or {}
        return {"tipo": "licao", "titulo": fase.get("titulo", "Lição da Academia")}
    if tipo == "dungeon":
        return {"tipo": "dungeon", "titulo": DUNGEONS[origem]["nome"], "icone": DUNGEONS[origem].get("icone")}
    banco = PERGUNTAS_REINO if tipo == "reino" else PERGUNTAS_CLASSE if tipo == "classe" else DESAFIOS.get(tipo, [])
    fonte = (banco[int(a)] if int(a) < len(banco) else {}).get("fonte")
    if not fonte:
        return None
    acervo, chave, onde = (BIBLIOTECA, fonte.get("livro"), "livro") if fonte.get("livro") else (CARREIRA, fonte.get("guia"), "guia")
    livro = acervo.get(chave)
    if not livro or fonte["capitulo"] >= len(livro["capitulos"]):
        return None
    return {
        "tipo": onde, "id": chave, "capitulo": fonte["capitulo"], "titulo": livro["titulo"], "icone": livro["icone"],
        "capituloTitulo": livro["capitulos"][fonte["capitulo"]]["titulo"],
    }


CHANCE_TRILHA_PREFERIDA = 0.45


# ---------- o currículo da classe ----------
# Cada subclasse tem 4 skills (uma por degrau, do 2 ao 5) e cada classe principal uma skill de iniciante
# (degrau 1). As perguntas dessas skills ficam em perguntas_classes.json e só caem para o herói daquela
# classe: quanto mais alto o degrau, mais a batalha puxa delas, e a skill do degrau atual pesa mais
# (as dos degraus de baixo voltam como revisão).
CHANCE_DA_CLASSE = {1: 0.3, 2: 0.4, 3: 0.48, 4: 0.55, 5: 0.6}
CHANCE_SKILL_ATUAL = 0.6
# depois de dominada, a skill do degrau atual vira revisão: pesa menos e a fatia do currículo encolhe um
# pouco (o herói não fica respondendo as mesmas perguntas até o próximo degrau)
CHANCE_SKILL_ATUAL_DOMINADA = 0.3
FATOR_CLASSE_DOMINADA = 0.75


def da_classe_do_heroi(pergunta, heroi):
    """A pergunta é do currículo deste herói? (da subclasse dele ou, a de degrau 1, da classe principal)"""
    if pergunta.get("classe"):
        return pergunta["classe"] == heroi.get("classe")
    return pergunta.get("principal") == heroi.get("principal")


def refs_da_classe(heroi, trilha=None):
    """As perguntas do currículo que o herói já alcançou (até o degrau dele)."""
    if not heroi or not heroi.get("principal"):
        return []
    return [f"classe:{p['degrau']}:{i}" for i, p in enumerate(PERGUNTAS_CLASSE)
            if p["degrau"] <= heroi.get("degrau", 1) and da_classe_do_heroi(p, heroi) and (not trilha or p.get("trilha") == trilha)]


def skill_da_ref(ref):
    """A skill do currículo de uma pergunta (só as do banco das classes têm)."""
    ref = base_da_ref(ref)
    if not ref.startswith("classe:"):
        return None
    skill = SKILLS.get(PERGUNTAS_CLASSE[int(ref.split(":")[2])].get("skill"))
    if not skill:
        return None
    return {k: skill.get(k) for k in ("id", "nome", "icone", "degrau", "classe", "principal")}


def montar_pergunta(ref):
    """A pergunta pronta para a tela: alternativas embaralhadas (a ordem viaja na ref, "reino:2:71@2031"),
    de onde ela vem e, se for do currículo, a skill que ela treina."""
    pergunta = pergunta_por_ref(ref)
    ordem = list(range(len(pergunta["opcoes"])))
    random.shuffle(ordem)
    return {
        "ref": f"{ref}@{''.join(map(str, ordem))}", "pergunta": pergunta["pergunta"],
        "opcoes": [pergunta["opcoes"][i] for i in ordem],
        "codigo": pergunta.get("codigo"), "cenario": pergunta.get("cenario"), "trilha": trilha_da_ref(ref),
        "fonte": fonte_da_ref(ref), "skill": skill_da_ref(ref),
    }


def sortear_pergunta(nivel, concluidas, evitar, trilha=None, preferida=None, heroi=None):
    """Sorteia uma pergunta do nível de perigo (1 a 4), fora das vistas há pouco.

    O banco do Reino dá as perguntas do nível; nos níveis 1 e 2 entram também os quizzes das lições
    concluídas e, nos níveis 3 e 4, as perguntas das dungeons liberadas. Com trilha (fase de chefão),
    vale só aquela trilha, de qualquer perigo até o nível. Com heroi ({principal, classe, degrau}), uma
    parte que cresce com o degrau sai do currículo da classe dele (CHANCE_DA_CLASSE); com preferida (a
    trilha da subclasse), quase metade do resto sai dela.
    """
    nivel = min(max(int(nivel), 1), 4)
    evitar = {r.partition("@")[0] for r in evitar if r}
    dominada = bool(heroi and heroi.get("atualDominada"))
    chance = CHANCE_DA_CLASSE.get((heroi or {}).get("degrau", 1), 0.3) * (FATOR_CLASSE_DOMINADA if dominada else 1)
    if not trilha and heroi and random.random() < chance:
        da_classe = [r for r in refs_da_classe(heroi) if r not in evitar]
        atuais = [r for r in da_classe if int(r.split(":")[1]) == heroi.get("degrau", 1)]
        foco = CHANCE_SKILL_ATUAL_DOMINADA if dominada else CHANCE_SKILL_ATUAL
        if da_classe:
            return montar_pergunta(random.choice(atuais if atuais and random.random() < foco else da_classe))
    refs = [f"reino:{nivel}:{i}" for i, p in enumerate(PERGUNTAS_REINO) if p["nivel"] == nivel]
    if nivel <= 2:
        for fase_id in concluidas:
            fase = FASES.get(fase_id)
            for e, etapa in enumerate((fase or {}).get("etapas", [])):
                if etapa["tipo"] == "quiz":
                    refs += [f"fase:{fase_id}:{e}:{p}" for p in range(len(etapa["perguntas"]))]
    if nivel >= 3:
        for d in DUNGEONS.values():
            if d["requer_fase"] in concluidas:
                for s, sala in enumerate(d["salas"]):
                    refs += [f"dungeon:{d['id']}:{s}:{p}" for p in range(len(sala["perguntas"]))]
    if trilha:
        # na fase de chefão de uma trilha, o currículo do herói naquela trilha também vale
        da_trilha = [f"reino:{p['nivel']}:{i}" for i, p in enumerate(PERGUNTAS_REINO) if p["nivel"] <= nivel and p.get("trilha") == trilha]
        refs = list(dict.fromkeys([r for r in refs if trilha_da_ref(r) == trilha] + da_trilha + refs_da_classe(heroi, trilha))) or refs
    elif preferida and random.random() < CHANCE_TRILHA_PREFERIDA:
        favoritas = [r for r in refs if trilha_da_ref(r) == preferida and r not in evitar]
        refs = favoritas or refs
    # o estilo da classe principal: o mago puxa mais situações reais (cenários)
    if heroi and random.random() < heroi.get("cenario", 0):
        refs = [r for r in refs if pergunta_por_ref(r).get("cenario") and r not in evitar] or refs
    novas = [r for r in refs if r not in evitar]
    return montar_pergunta(random.choice(novas or refs))


def base_da_ref(ref):
    """A pergunta por trás da ref: sem a ordem embaralhada e sem o "vf|k|" do verdadeiro ou falso."""
    ref = str(ref).partition("@")[0]
    return ref.split("|", 2)[2] if ref.startswith("vf|") else ref


def com_tempo(pergunta, desafio, tempo=None):
    """Marca o tipo do desafio e quanto tempo ele dá (limite para responder e janela do crítico)."""
    return {**pergunta, "desafio": desafio, "tempo": DESAFIOS["tempos"][tempo or desafio]}


def embaralhado(n):
    """Uma ordem embaralhada de 0..n-1 que nunca sai igual à certa."""
    ordem = list(range(n))
    while n > 1 and ordem == sorted(ordem):
        random.shuffle(ordem)
    return ordem


def sortear_do_banco(tipo, nivel, evitar, trilha=None):
    """Um desafio de "ordem" ou "lacuna" do nível (ou abaixo), fora dos vistos há pouco."""
    nivel = min(max(int(nivel), 1), 4)
    evitar = {base_da_ref(r) for r in evitar if r}
    refs = [f"{tipo}:{d['nivel']}:{i}" for i, d in enumerate(DESAFIOS[tipo])
            if d["nivel"] <= nivel and (not trilha or d.get("trilha") == trilha) and f"{tipo}:{d['nivel']}:{i}" not in evitar]
    if not refs:
        return None
    return montar_desafio(random.choice(refs))


def montar_desafio(ref):
    """Um desafio de "ordem" ou "lacuna" pronto para a tela (itens ou alternativas embaralhados)."""
    tipo = ref.split(":")[0]
    desafio = pergunta_por_ref(ref)
    lista = desafio["itens"] if tipo == "ordem" else desafio["opcoes"]
    ordem = embaralhado(len(lista))
    mostrados = [lista[i] for i in ordem]
    pergunta = {
        "ref": f"{ref}@{''.join(map(str, ordem))}", "pergunta": desafio["pergunta"], "codigo": desafio.get("codigo"),
        "cenario": None, "trilha": desafio.get("trilha"), "fonte": fonte_da_ref(ref),
        "opcoes": [] if tipo == "ordem" else mostrados, "itens": mostrados if tipo == "ordem" else [],
    }
    return com_tempo(pergunta, tipo)


def como_verdadeiro_ou_falso(pergunta):
    """Transforma uma múltipla escolha num verdadeiro ou falso relâmpago: metade das vezes a afirmação
    mostra a alternativa certa, metade uma errada."""
    base = base_da_ref(pergunta["ref"])
    original = pergunta_por_ref(base)
    erradas = [i for i in range(len(original["opcoes"])) if i != original["correta"]]
    k = original["correta"] if random.random() < 0.5 or not erradas else random.choice(erradas)
    return com_tempo({**pergunta, "ref": f"vf|{k}|{base}", "afirmacao": original["opcoes"][k], "opcoes": ["Verdadeiro", "Falso"]}, "vf")


def estilo_da_classe(principal):
    """O jeito de aprender de cada classe principal (curriculo.json, "estilos"): o mago puxa situações
    reais, o guerreiro prática (completar código e pôr passos em ordem) e o arqueiro precisão
    (verdadeiro ou falso relâmpago)."""
    return CURRICULO["estilos"].get(principal or "", {})


def eco_de_erro(ref):
    """Uma pergunta que o herói errou, de volta para a revanche (o Grimório de Erros)."""
    tipo = ref.split(":")[0]
    pronta = montar_desafio(ref) if tipo in ("ordem", "lacuna") else montar_pergunta(ref)
    if tipo not in ("ordem", "lacuna"):
        pronta = com_tempo(pronta, "escolha", "cenario" if pronta["cenario"] else "codigo" if pronta["codigo"] else "escolha")
    return {**pronta, "eco": True}


def sortear_desafio(nivel, concluidas, evitar, trilha=None, preferida=None, heroi=None):
    """A pergunta da rodada da batalha: quase sempre múltipla escolha, mas às vezes um verdadeiro ou falso
    relâmpago, pôr os passos em ordem ou completar a lacuna do código (chances em desafios.json, trocadas
    pelo estilo da classe principal do herói)."""
    estilo = estilo_da_classe((heroi or {}).get("principal"))
    chances = {**DESAFIOS["chances"], **{k: v for k, v in estilo.items() if k in ("vf", "ordem", "lacuna")}}
    if heroi is not None:
        heroi = {**heroi, "cenario": estilo.get("cenario", 0)}
    sorte = random.random()
    tipo = "ordem" if sorte < chances["ordem"] else "lacuna" if sorte < chances["ordem"] + chances["lacuna"] else None
    desafio = sortear_do_banco(tipo, nivel, evitar, trilha) if tipo else None
    if desafio:
        return desafio
    pergunta = sortear_pergunta(nivel, concluidas, evitar, trilha, preferida, heroi)
    if not pergunta["cenario"] and random.random() < chances["vf"]:
        return como_verdadeiro_ou_falso(pergunta)
    return com_tempo(pergunta, "escolha", "cenario" if pergunta["cenario"] else "codigo" if pergunta["codigo"] else "escolha")


def corrigir_pergunta(ref, resposta):
    """Corrige uma pergunta sorteada (ref com a ordem embaralhada) e explica a resposta certa.
    "texto_certo" é a resposta certa por extenso, para a tela mostrar quando o herói erra."""
    ref = str(ref)
    if ref.startswith("vf|"):
        _, k, base = ref.split("|", 2)
        original = pergunta_por_ref(base)
        verdadeira = int(k) == original["correta"]
        certa = 0 if verdadeira else 1
        return {
            "correta": resposta == certa, "resposta_certa": certa, "texto_certo": "Verdadeiro" if verdadeira else "Falso",
            "explicacao": f"A resposta é \"{original['opcoes'][original['correta']]}\". {original['explicacao']}",
        }
    base, _, ordem = ref.partition("@")
    pergunta = pergunta_por_ref(base)
    lista = pergunta["itens"] if base.startswith("ordem:") else pergunta["opcoes"]
    indices = [int(c) for c in ordem] if ordem.isdigit() else list(range(len(lista)))
    if sorted(indices) != list(range(len(lista))):
        abort(400, "Ordem inválida.")
    if base.startswith("ordem:"):
        # a resposta é a lista das posições mostradas, na ordem em que o herói clicou
        valida = isinstance(resposta, list) and sorted(resposta) == list(range(len(lista))) and all(isinstance(i, int) for i in resposta)
        return {
            "correta": valida and [indices[i] for i in resposta] == list(range(len(lista))),
            "resposta_certa": [indices.index(i) for i in range(len(lista))],
            "texto_certo": " → ".join(lista), "explicacao": pergunta["explicacao"],
        }
    escolhida = indices[resposta] if isinstance(resposta, int) and 0 <= resposta < len(indices) else None
    return {
        "correta": escolhida == pergunta["correta"],
        "resposta_certa": indices.index(pergunta["correta"]),
        "texto_certo": pergunta["opcoes"][pergunta["correta"]],
        "explicacao": pergunta["explicacao"],
    }
