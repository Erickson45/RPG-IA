"""O jogador e tudo que muda o progresso de verdade: XP, moedas, vida, itens, troféus e vitórias.

O navegador não decide nada disso. Ele pede uma ação ("respondi esta pergunta", "quero comprar
isto") e o servidor confere as regras, aplica a recompensa e devolve o estado novo. O que é só
visual ou de navegação (avatar, sala onde o herói está, posição no mapa) o navegador salva sozinho.
"""

import copy
import math
import os
import random
import time
import uuid
from datetime import datetime, timedelta

from flask import Blueprint, abort, g, jsonify, request

import banco
import combate
import curriculo
import dominio
import equipamento
import habilidades
import mascotes
import missoes
import progressao
import quests
from conteudo import (
    BIBLIOTECA, BONUS_NOITE, CARREIRA, DESAFIOS, DUNGEONS, FASES, HABILIDADES, ITENS, MATERIAIS, MISSOES, MONSTROS, PERGUNTAS_REINO, PUZZLES,
    REGIOES, TRILHAS, base_da_ref, corrigir_pergunta, eco_de_erro, item_do_catalogo, montar_pergunta, pergunta_por_ref,
    sortear_desafio, trilha_da_ref,
)

jogador = Blueprint("jogador", __name__, url_prefix="/api/jogador")


@jogador.before_request
def travar_jogador():
    """Um pedido de cada vez por jogador (vale entre os processos do servidor publicado): cada ação lê o
    progresso, muda e grava de volta, e dois pedidos juntos se atropelariam."""
    jogador_id = (request.view_args or {}).get("jogador_id")
    if jogador_id:
        g.trava = banco.trava_do_jogador(jogador_id)
        g.trava.__enter__()


@jogador.teardown_request
def soltar_jogador(_erro=None):
    trava = g.pop("trava", None)
    if trava:
        trava.__exit__(None, None, None)

# campos que só o servidor altera; o resto do progresso é do navegador
CAMPOS_DO_SERVIDOR = {
    "xp", "moedas", "vida", "inventario", "cosmeticos", "trofeus", "fases", "dungeons", "bausAbertos",
    "livrosLidos", "puzzlesResolvidos", "chefesDerrotados", "dungeonAtual", "recentesReino", "fragmentos",
    "dominio", "missoes", "habilidades", "recargas", "classe", "sequencia", "ataquePendente", "enigmaAberto", "mana", "quests",
    "skills", "grimorioErros", "ecosVencidos", "provas", "prova", "provaEspera", "estatisticas",
    # o multijogador: a Casa do herói, os prêmios do Salão no dia (com limite), o Desafio do Dia e as semanas
    # em que ele foi o Campeão da Liga
    "casa", "salaoDia", "desafioDia", "campeaoSemanas",
    # a Casa da Forja: os materiais que o herói juntou dos monstros
    "materiais",
}
HABILIDADES_MAPA = {h["id"]: h for h in combate.MAGIAS["habilidades_mapa"]}
PADROES = {
    "xp": 0, "inventario": {}, "cosmeticos": [], "trofeus": [], "fases": {}, "dungeons": {}, "bausAbertos": [],
    "livrosLidos": [], "puzzlesResolvidos": [], "chefesDerrotados": [], "dungeonAtual": None, "recentesReino": [],
    "fragmentos": [], "dominio": {}, "missoes": {"ativas": [], "ultimas": [], "cumpridas": 0}, "habilidades": [],
    "recargas": {}, "sequencia": 0, "ataquePendente": None, "enigmaAberto": None, "mana": None,
    "quests": {"ativas": {}, "concluidas": []},
    # o currículo da classe: acertos por skill, as perguntas erradas que vão voltar e quantos ecos já venceu
    "skills": {}, "grimorioErros": [], "ecosVencidos": 0,
    # a Prova do Degrau: a que está em andamento e quando dá para tentar de novo depois de reprovar
    "prova": None, "provaEspera": 0.0,  # float: é um time.time() (com 0 inteiro a normalização zeraria a espera)
    # o placar da vida inteira do herói (o Currículo do Herói): acertos e erros (no total e por trilha),
    # monstros derrotados (no total e por tipo), maior sequência e desmaios. "desde": quando começou a contar
    "estatisticas": {},
    "casa": None, "salaoDia": None, "desafioDia": None, "campeaoSemanas": [],
    "materiais": {},
}
RECOMPENSA_LEITURA = {"xp": 30, "moedas": 15}
PRECO_DESCANSO = 40
PERDA_AO_DESMAIAR = 0.1
TAMANHO_MAXIMO_PROGRESSO = 200_000  # bytes de JSON vindos do navegador


# ---------- estado do jogador ----------

def normalizar(progresso):
    """Completa os campos que faltam (inclusive em progresso antigo, de antes de cada sistema existir)."""
    for chave, padrao in PADROES.items():
        if padrao is None:
            progresso.setdefault(chave, None)
        elif not isinstance(progresso.get(chave), type(padrao)):
            progresso[chave] = copy.deepcopy(padrao)
    if not isinstance(progresso.get("moedas"), int):
        progresso["moedas"] = ITENS["moedas_iniciais"]
    habilidades.migrar_classe(progresso)
    # saves de antes da Prova do Degrau: os degraus que o herói já tinha valem como provas aprovadas
    if not isinstance(progresso.get("provas"), list):
        antigo = habilidades.degrau(progresso, com_prova=False)
        progresso["provas"] = list(range(1, antigo)) if habilidades.classe_do(progresso) else []
    maxima = habilidades.vida_maxima(progresso)
    vida = progresso.get("vida")
    atual = vida.get("atual") if isinstance(vida, dict) else None
    progresso["vida"] = {"atual": min(atual, maxima) if isinstance(atual, int) else maxima}
    recarregar_mana(progresso)
    missoes.garantir(progresso)
    estatisticas_de(progresso)
    return progresso


def estatisticas_de(progresso):
    """O placar do Currículo do Herói, completo (saves antigos começam a contar daqui, com "desde" = agora)."""
    est = progresso["estatisticas"]
    for chave in ("acertos", "erros", "monstros", "maiorSequencia", "desmaios"):
        if not isinstance(est.get(chave), int):
            est[chave] = 0
    for chave in ("porTrilha", "porMonstro"):
        if not isinstance(est.get(chave), dict):
            est[chave] = {}
    if not isinstance(est.get("desde"), (int, float)):
        est["desde"] = time.time()
    return est


def contar_resposta(progresso, correta, trilha=None):
    """Soma um acerto ou um erro no placar do herói (e na trilha da pergunta, se ela tiver uma)."""
    est = estatisticas_de(progresso)
    est["acertos" if correta else "erros"] += 1
    if trilha:
        por = est["porTrilha"].setdefault(trilha, {"acertos": 0, "erros": 0})
        por["acertos" if correta else "erros"] += 1


# ---------- mana: uma só, no mapa e na batalha ----------

def recarregar_mana(progresso):
    """A mana volta sozinha, 1 ponto a cada regen_segundos ("em" marca de quando conta o próximo ponto)."""
    maxima = combate.mana_maxima(progresso)
    agora = time.time()
    mana = progresso.get("mana")
    if not isinstance(mana, dict) or not isinstance(mana.get("atual"), int):
        mana = {"atual": maxima, "em": agora}
    ganhos = int((agora - mana.get("em", agora)) // combate.MANA["regen_segundos"])
    if ganhos > 0:
        mana["atual"] += ganhos
        mana["em"] += ganhos * combate.MANA["regen_segundos"]
    if mana["atual"] >= maxima:
        mana.update(atual=maxima, em=agora)
    progresso["mana"] = mana


def definir_mana(progresso, valor):
    """Depois de uma batalha (ou de gastar), a mana do herói passa a ser esse valor e volta a recarregar."""
    mana = progresso["mana"]
    if mana["atual"] >= combate.mana_maxima(progresso):
        mana["em"] = time.time()  # estava cheia: o relógio da recarga começa agora
    mana["atual"] = max(0, min(int(valor), combate.mana_maxima(progresso)))


def tempo_por_extenso(segundos):
    """3h 20min, 45min, 1min..."""
    minutos = max(1, round(segundos / 60))
    horas, resto = divmod(minutos, 60)
    return f"{horas}h {resto:02d}min" if horas else f"{resto}min"


def gastar_mana(progresso, quanto):
    if progresso["mana"]["atual"] < quanto:
        abort(400, "Falta mana. Ela recarrega sozinha com o tempo (e cada acerto na batalha devolve um pouco).")
    definir_mana(progresso, progresso["mana"]["atual"] - quanto)


def estado(progresso):
    """O que o navegador precisa para atualizar a tela depois de uma ação."""
    dados = {chave: progresso[chave] for chave in CAMPOS_DO_SERVIDOR}
    dados["status"] = {
        **progressao.resumo(progresso["xp"]), "vidaMaxima": habilidades.vida_maxima(progresso),
        "pontosHabilidade": habilidades.pontos_livres(progresso), "degrauClasse": habilidades.degrau(progresso),
        "manaMaxima": combate.mana_maxima(progresso), "manaRegen": combate.MANA["regen_segundos"],
        "bonus": equipamento.bonus(progresso), "umbraterra": habilidades.no_ultimo_degrau(progresso),
    }
    dados["curriculo"] = curriculo.resumo(progresso)
    return dados


def carregar(jogador_id):
    progresso = banco.carregar_progresso(jogador_id)
    if progresso is None:
        abort(404, "Jogador não encontrado.")
    progresso = normalizar(progresso)
    # golpe que ficou no ar sem o herói tentar aparar (fechou a tela, caiu a rede): cai inteiro
    ataque = progresso.get("ataquePendente")
    if ataque and time.time() - ataque["em"] > combate.JANELA_APARAR[1] + 2:
        cobrar_ataque(jogador_id, progresso)
    return progresso


def responder(jogador_id, progresso, **extras):
    banco.salvar_progresso(jogador_id, progresso)
    return jsonify({**extras, "estado": estado(progresso)})


# ---------- regras: recompensas, vida e itens ----------

def conceder(jogador_id, progresso, recompensa, motivo):
    """Aplica uma recompensa e devolve a lista do que foi ganho, pronta para a tela mostrar."""
    ganhos = []
    moedas = int(recompensa.get("moedas") or 0)
    xp = int(recompensa.get("xp") or 0)
    if moedas:
        progresso["moedas"] += moedas
        ganhos.append({"icone": "🪙", "texto": f"{moedas} moedas"})
    if xp:
        progresso["xp"] += xp
        ganhos.append({"icone": "⭐", "texto": f"{xp} XP"})
    for item_id, qtd in (recompensa.get("itens") or {}).items():
        item = item_do_catalogo(item_id)
        progresso["inventario"][item_id] = progresso["inventario"].get(item_id, 0) + qtd
        ganhos.append({"icone": item["icone"], "texto": f"{item['nome']} ×{qtd}", "item": item_id})
    for material_id, qtd in (recompensa.get("materiais") or {}).items():
        material = MATERIAIS[material_id]
        progresso["materiais"][material_id] = progresso["materiais"].get(material_id, 0) + qtd
        ganhos.append({"icone": material["icone"], "texto": f"{material['nome']} ×{qtd}", "material": material_id,
                       "raro": material["tier"] in ("essencia", "mitico")})
    cosmetico = recompensa.get("cosmetico")
    if cosmetico and cosmetico not in progresso["cosmeticos"]:
        progresso["cosmeticos"].append(cosmetico)
        item = item_do_catalogo(cosmetico)
        ganhos.append({"icone": item["icone"], "texto": f"Visual novo: {item['nome']}", "raro": True, "item": cosmetico})
    trofeu = recompensa.get("trofeu")
    if trofeu and trofeu not in progresso["trofeus"]:
        progresso["trofeus"].append(trofeu)
        item = item_do_catalogo(trofeu)
        ganhos.append({"icone": item["icone"], "texto": f"Troféu: {item['nome']}", "raro": True})
    if ganhos:
        banco.registrar(jogador_id, "recompensa", {"motivo": motivo, "ganhos": [g["texto"] for g in ganhos]})
    return ganhos


def dominar(jogador_id, progresso, trilha, pontos):
    """Soma domínio na trilha; subir de patente paga o bônus (a tela percebe a patente nova pelo estado)."""
    patente = dominio.somar(progresso, trilha, pontos)
    if patente is not None:
        nome = TRILHAS["trilhas"][trilha]["nome"]
        conceder(jogador_id, progresso, {"moedas": TRILHAS["bonus_por_rank"] * patente}, f"dominio:{trilha}:{dominio.RANKS[patente]['nome']}")
        banco.registrar(jogador_id, "patente", {"trilha": nome, "patente": dominio.RANKS[patente]["nome"]})


def ferir(jogador_id, progresso, dano, motivo):
    """Tira vida. Se zerar, o herói desmaia: perde 10% das moedas (nada, com a Segunda Chance) e acorda
    com a vida cheia."""
    progresso["vida"]["atual"] = max(0, progresso["vida"]["atual"] - dano)
    if progresso["vida"]["atual"] > 0:
        return {"desmaiou": False, "perda": 0}
    perda = 0 if habilidades.tem(progresso, "segunda-chance") else math.floor(progresso["moedas"] * PERDA_AO_DESMAIAR)
    progresso["moedas"] -= perda
    progresso["vida"]["atual"] = habilidades.vida_maxima(progresso)
    estatisticas_de(progresso)["desmaios"] += 1
    banco.registrar(jogador_id, "desmaio", {"motivo": motivo, "moedasPerdidas": perda})
    return {"desmaiou": True, "perda": perda}


def ameacar(progresso, dano, motivo, batalha_id=None):
    """Errou: o golpe fica no ar até o herói tentar aparar (Defesa ativa, rota /aparar)."""
    progresso["ataquePendente"] = {"dano": dano, "motivo": motivo, "em": time.time(), "batalha": batalha_id}


def cobrar_ataque(jogador_id, progresso, apertou=False):
    """Faz o golpe no ar cair: aparado dentro da janela, tira 1 do dano. Desmaiar encerra a batalha."""
    ataque = progresso.get("ataquePendente")
    progresso["ataquePendente"] = None
    if not ataque:
        return None
    aparado = combate.aparou(apertou, time.time() - ataque["em"])
    dano = max(0, ataque["dano"] - (1 if aparado else 0))
    golpe = ferir(jogador_id, progresso, dano, ataque["motivo"]) if dano else {"desmaiou": False, "perda": 0}
    if golpe["desmaiou"] and ataque.get("batalha"):
        banco.atualizar_batalha(ataque["batalha"], encerrada=1)
        banco.registrar(jogador_id, "batalha", {"monstro": ataque["motivo"].partition(":")[2], "resultado": "desmaio"})
    return {"aparou": aparado, "dano": dano, **golpe}


def golpe_atrasado(jogador_id, progresso):
    """Antes de qualquer outra ação da batalha, um golpe ainda no ar cai inteiro."""
    if not progresso.get("ataquePendente"):
        return
    if cobrar_ataque(jogador_id, progresso)["desmaiou"]:
        banco.salvar_progresso(jogador_id, progresso)
        abort(400, "Tu desmaiaste com o último golpe.")


def somar_sequencia(progresso):
    """Mais um acerto na Sequência; devolve True quando ela fecha um Golpe Final (a cada 5)."""
    progresso["sequencia"] += 1
    est = estatisticas_de(progresso)
    est["maiorSequencia"] = max(est["maiorSequencia"], progresso["sequencia"])
    return progresso["sequencia"] % combate.GOLPE_FINAL_A_CADA == 0


def zerar_sequencia(progresso):
    perdida = progresso["sequencia"]
    progresso["sequencia"] = 0
    return perdida


def curar(progresso, quanto=None):
    maxima = habilidades.vida_maxima(progresso)
    progresso["vida"]["atual"] = maxima if quanto is None else min(maxima, progresso["vida"]["atual"] + quanto)


def gastar(progresso, item_id):
    if progresso["inventario"].get(item_id, 0) <= 0:
        abort(400, "Tu não tens esse item.")
    progresso["inventario"][item_id] -= 1


def corpo():
    return request.get_json(silent=True) or {}


# limite contra abuso: heróis novos por endereço (cada um é uma linha no banco). Folgado de propósito: numa
# escola ou empresa a turma inteira sai pela internet com o mesmo IP. Ajustável no .env.
LIMITE_CRIAR_POR_HORA = int(os.environ.get("LIMITE_CRIAR_POR_HORA", "150"))
# no próprio computador (desenvolvimento e testes) não há limite; publicado, o IP real vem do proxy
ENDERECOS_LOCAIS = {"127.0.0.1", "::1", "localhost"}


def endereco_de_quem_pede():
    """O IP do jogador (atrás do proxy da hospedagem, ele vem no X-Forwarded-For)."""
    return (request.headers.get("X-Forwarded-For") or request.remote_addr or "?").split(",")[0].strip()


# ---------- o nome do herói: único no jogo ----------
# Dois heróis não podem ter o mesmo nome ("Ana", "ana" e "Ána" contam como o mesmo, ver banco.chave_do_nome),
# e os nomes dos personagens da história ficam reservados. Quem escolhe o nome é o criador do herói, que
# pergunta antes em /nome-livre; o PUT do progresso não deixa trocar para um nome que já é de outro.
TAMANHO_MAXIMO_NOME = 30
NOMES_RESERVADOS = {banco.chave_do_nome(n) for n in ("Zetsu", "Malakar", "Lyra", "Brina", "Íris", "Oráculo", "Bento")}


def problema_do_nome(nome, jogador_id=None):
    """Por que esse nome não serve (texto para mostrar ao jogador), ou None se ele está livre."""
    chave = banco.chave_do_nome(nome)
    if not chave:
        return "Escolhe um nome, aventureiro."
    if len(str(nome).strip()) > TAMANHO_MAXIMO_NOME:
        return f"Esse nome é comprido demais (até {TAMANHO_MAXIMO_NOME} letras)."
    if chave in NOMES_RESERVADOS:
        return "Esse nome é de um personagem do reino. Escolhe outro só teu."
    if banco.nome_em_uso(nome, jogador_id):
        return "Esse nome já é de outro herói. Tenta uma variação só tua."
    return None


def nome_livre_parecido(nome):
    """Para um save que chega pronto (migração, cópia): o mesmo nome com um número no fim, se ele já existe."""
    base = " ".join(str(nome).split())[:TAMANHO_MAXIMO_NOME - 3]
    for numero in range(2, 100):
        candidato = f"{base} {numero}"
        if not problema_do_nome(candidato):
            return candidato
    return f"{base[:20]} {uuid.uuid4().hex[:6]}"


@jogador.get("/nome-livre")
def conferir_nome():
    """O criador do herói pergunta se o nome está livre antes de aceitar."""
    motivo = problema_do_nome(request.args.get("nome", ""), request.args.get("id") or None)
    return jsonify({"livre": motivo is None, "motivo": motivo})


# ---------- criar, carregar e salvar ----------

@jogador.post("")
def criar_jogador():
    """Cria um jogador. Quem já jogava antes do servidor guardar o progresso traz o save do navegador."""
    endereco = endereco_de_quem_pede()
    if endereco not in ENDERECOS_LOCAIS and banco.contar(f"criar:{endereco}", 3600) > LIMITE_CRIAR_POR_HORA:
        abort(429, "Muitos heróis criados daqui nesta hora. Tenta de novo mais tarde.")
    antigo = corpo().get("progresso")
    progresso = normalizar(antigo if isinstance(antigo, dict) else {})
    # um save que chega com nome (migração do navegador, cópia) não falha: ganha um número no fim
    if progresso.get("nome") and problema_do_nome(progresso["nome"]):
        progresso["nome"] = nome_livre_parecido(progresso["nome"])
    jogador_id = banco.criar_jogador(progresso)
    banco.registrar(jogador_id, "criado", {"migrado": bool(antigo)})
    return jsonify({"id": jogador_id, "progresso": progresso, "estado": estado(progresso)})


@jogador.get("/<jogador_id>")
def ver_jogador(jogador_id):
    progresso = carregar(jogador_id)
    banco.salvar_progresso(jogador_id, progresso)  # guarda as missões que o carregar acabou de sortear
    return jsonify({"progresso": progresso, "estado": estado(progresso)})


@jogador.delete("/<jogador_id>")
def apagar_jogador(jogador_id):
    """Apaga o save (o navegador pede confirmação antes)."""
    carregar(jogador_id)
    banco.apagar_jogador(jogador_id)
    return jsonify({"apagado": True})


@jogador.put("/<jogador_id>/progresso")
def salvar_progresso(jogador_id):
    """Salva o que é do navegador (avatar, sala, posição...). Os campos do servidor são ignorados."""
    if (request.content_length or 0) > TAMANHO_MAXIMO_PROGRESSO:
        abort(400, "Progresso grande demais.")
    novo = corpo()
    if not isinstance(novo, dict):
        abort(400, "Progresso inválido.")
    progresso = carregar(jogador_id)
    # trocar de nome só para um que esteja livre (o criador já confere antes; aqui fica a garantia)
    if "nome" in novo and banco.chave_do_nome(novo["nome"]) != banco.chave_do_nome(progresso.get("nome")):
        if problema_do_nome(novo["nome"], jogador_id):
            novo = {chave: valor for chave, valor in novo.items() if chave != "nome"}
    progresso.update({chave: valor for chave, valor in novo.items() if chave not in CAMPOS_DO_SERVIDOR})
    return responder(jogador_id, progresso)


@jogador.get("/<jogador_id>/historico")
def ver_historico(jogador_id):
    carregar(jogador_id)
    return jsonify(banco.historico(jogador_id))


# ---------- vida e itens ----------

@jogador.post("/<jogador_id>/usar")
def usar_item(jogador_id):
    """Gasta um item. Os que curam (elixir, pão de viagem, grande elixir) curam na hora; os outros têm
    o efeito na tela (lição, dungeon)."""
    item_id = corpo().get("item")
    item = next((i for i in ITENS["consumiveis"] if i["id"] == item_id), None)
    if not item:
        abort(400, "Item inválido.")
    progresso = carregar(jogador_id)
    if "cura" in item and progresso["vida"]["atual"] >= habilidades.vida_maxima(progresso):
        abort(400, "Tua vida já está cheia.")
    if "mana" in item:
        recarregar_mana(progresso)
        if progresso["mana"]["atual"] >= combate.mana_maxima(progresso):
            abort(400, "Tua mana já está cheia.")
    gastar(progresso, item_id)
    if "cura" in item:
        curar(progresso, None if item["cura"] == "tudo" else item["cura"])
    if "mana" in item:
        maxima = combate.mana_maxima(progresso)
        definir_mana(progresso, maxima if item["mana"] == "tudo" else progresso["mana"]["atual"] + item["mana"])
    return responder(jogador_id, progresso)


@jogador.post("/<jogador_id>/dano")
def tomar_dano(jogador_id):
    """Dano de uma resposta errada numa dungeon (só tira vida, nunca dá nada)."""
    dano = corpo().get("dano", 1)
    if not isinstance(dano, int) or not 1 <= dano <= 3:
        abort(400, "Dano inválido.")
    progresso = carregar(jogador_id)
    resultado = ferir(jogador_id, progresso, dano, corpo().get("motivo", "dungeon"))
    return responder(jogador_id, progresso, **resultado)


@jogador.post("/<jogador_id>/enfermaria")
def enfermaria(jogador_id):
    """A Irmã Flora cura de graça na Academia."""
    progresso = carregar(jogador_id)
    curar(progresso)
    return responder(jogador_id, progresso)


@jogador.post("/<jogador_id>/descansar")
def descansar(jogador_id):
    """Um quarto na Estalagem do Grifo: custa moedas e enche a vida."""
    progresso = carregar(jogador_id)
    if progresso["vida"]["atual"] >= habilidades.vida_maxima(progresso):
        abort(400, "Tu tá com a vida cheia! Guarda as moedas para uma poção.")
    if progresso["moedas"] < PRECO_DESCANSO:
        abort(400, "Hmm, faltam moedas... Os slimes lá fora costumam carregar umas, sabia?")
    progresso["moedas"] -= PRECO_DESCANSO
    curar(progresso)
    banco.registrar(jogador_id, "descanso", {"moedas": -PRECO_DESCANSO})
    return responder(jogador_id, progresso)


@jogador.post("/<jogador_id>/comprar")
def comprar(jogador_id):
    item = item_do_catalogo(corpo().get("item"))
    if not item or not item.get("preco"):
        abort(400, "Esse item não está à venda.")
    progresso = carregar(jogador_id)
    consumivel = any(i["id"] == item["id"] for i in ITENS["consumiveis"])
    if not consumivel and item["id"] in progresso["cosmeticos"]:
        abort(400, "Esse visual já é teu!")
    principal = habilidades.principal_do(progresso)
    if item.get("kit") and principal and item["kit"] != principal["id"]:
        abort(400, "Esse item é de outra classe, aventureiro. Dá uma olhada nas coisas feitas para ti!")
    if progresso["moedas"] < item["preco"]:
        abort(400, "Hmm... faltam moedas, aventureiro. Os monstros e os enigmas do Reino pagam bem!")
    progresso["moedas"] -= item["preco"]
    if consumivel:
        progresso["inventario"][item["id"]] = progresso["inventario"].get(item["id"], 0) + 1
    else:
        progresso["cosmeticos"].append(item["id"])
    banco.registrar(jogador_id, "compra", {"item": item["id"], "moedas": -item["preco"]})
    return responder(jogador_id, progresso)


@jogador.post("/<jogador_id>/forjar")
def forjar(jogador_id):
    """A Casa da Forja: gasta os materiais e as moedas da receita e o visual forjado passa a ser do herói."""
    item = item_do_catalogo(corpo().get("item"))
    if not item or not item.get("forja"):
        abort(400, "Essa peça não sai da bigorna.")
    progresso = carregar(jogador_id)
    if item["id"] in progresso["cosmeticos"]:
        abort(400, "Essa peça já é tua!")
    principal = habilidades.principal_do(progresso)
    if item.get("kit") and principal and item["kit"] != principal["id"]:
        abort(400, "Essa peça é de outra classe. O Duran forja as da tua!")
    receita = item["forja"]
    faltam = {m: q - progresso["materiais"].get(m, 0) for m, q in receita["materiais"].items() if progresso["materiais"].get(m, 0) < q}
    if faltam:
        nomes = ", ".join(f"{MATERIAIS[m]['nome']} ×{q}" for m, q in faltam.items())
        abort(400, f"Faltam materiais: {nomes}. Os monstros do Reino soltam tudo isso!")
    if progresso["moedas"] < receita["moedas"]:
        abort(400, "Faltam moedas para pagar o carvão e o suor do Duran.")
    for m, q in receita["materiais"].items():
        progresso["materiais"][m] -= q
        if not progresso["materiais"][m]:
            del progresso["materiais"][m]
    progresso["moedas"] -= receita["moedas"]
    progresso["cosmeticos"].append(item["id"])
    estatisticas_de(progresso)["forjados"] = estatisticas_de(progresso).get("forjados", 0) + 1
    banco.registrar(jogador_id, "forja", {"item": item["id"], "moedas": -receita["moedas"], "materiais": receita["materiais"]})
    return responder(jogador_id, progresso, forjado=item["id"])


# ---------- leituras e enigmas ----------

@jogador.post("/<jogador_id>/leitura")
def terminar_leitura(jogador_id):
    """Terminou um livro da biblioteca ou um guia da carreira: a primeira leitura dá moedas e XP."""
    dados = corpo()
    acervo = {"biblioteca": BIBLIOTECA, "carreira": CARREIRA}.get(dados.get("fonte"))
    if acervo is None or dados.get("id") not in acervo:
        abort(400, "Leitura inválida.")
    progresso = carregar(jogador_id)
    primeira = dados["id"] not in progresso["livrosLidos"]
    ganhos = []
    if primeira:
        progresso["livrosLidos"].append(dados["id"])
        ganhos = conceder(jogador_id, progresso, RECOMPENSA_LEITURA, f"leitura:{dados['id']}")
        dominar(jogador_id, progresso, dominio.trilha_da_leitura(dados["fonte"], dados["id"]), dominio.PONTOS["leitura"])
        missoes.registrar(progresso, "leitura")
    return responder(jogador_id, progresso, primeiraVez=primeira, ganhos=ganhos)


def tempo_do_enigma(puzzle):
    tipo = puzzle["tipo"]
    return DESAFIOS["tempos"]["enigma-ordem" if tipo == "ordem" else "enigma-relampago" if tipo == "relampago" else "enigma"]


@jogador.post("/<jogador_id>/puzzles/<puzzle_id>/abrir")
def abrir_puzzle(jogador_id, puzzle_id):
    """O herói abriu o enigma: o relógio começa aqui (resolver rápido vale o bônus Relâmpago)."""
    puzzle = PUZZLES.get(puzzle_id)
    if not puzzle:
        abort(404, "Enigma não encontrado.")
    progresso = carregar(jogador_id)
    progresso["enigmaAberto"] = {"id": puzzle_id, "em": time.time()}
    return responder(jogador_id, progresso, tempo=tempo_do_enigma(puzzle))


@jogador.post("/<jogador_id>/puzzles/<puzzle_id>")
def resolver_puzzle(jogador_id, puzzle_id):
    """Enigma do Reino: acertar dá o tesouro (uma vez só), mais ainda se foi rápido e com Sequência;
    errar zera a Sequência e solta um golpe que o herói ainda pode aparar (rota /aparar)."""
    puzzle = PUZZLES.get(puzzle_id)
    if not puzzle:
        abort(404, "Enigma não encontrado.")
    resposta = corpo().get("resposta")
    certa = {"ordem": puzzle.get("itens"), "relampago": [a["verdade"] for a in puzzle.get("afirmacoes", [])]}.get(puzzle["tipo"], puzzle.get("correta"))
    correta = resposta == certa
    progresso = carregar(jogador_id)
    aberto = progresso["enigmaAberto"] or {}
    progresso["enigmaAberto"] = None
    rapido = aberto.get("id") == puzzle_id and combate.foi_rapido(tempo_do_enigma(puzzle), time.time() - aberto["em"])
    # a explicação entrega a resposta: só vai para quem acertou
    resultado = {"correta": correta, "explicacao": puzzle["explicacao"] if correta else "", "ganhos": [], "relampago": False}
    if correta and puzzle_id not in progresso["puzzlesResolvidos"]:
        progresso["puzzlesResolvidos"].append(puzzle_id)
        somar_sequencia(progresso)
        fator = combate.fator_sequencia(progresso["sequencia"]) * (1.5 if rapido else 1)
        recompensa = {**puzzle["recompensa"], "moedas": round(puzzle["recompensa"]["moedas"] * fator), "xp": round(puzzle["recompensa"]["xp"] * fator)}
        resultado["ganhos"] = conceder(jogador_id, progresso, recompensa, f"enigma:{puzzle_id}")
        resultado["relampago"] = rapido
        missoes.registrar(progresso, "enigma")
    elif not correta:
        resultado["sequenciaPerdida"] = zerar_sequencia(progresso)
        ameacar(progresso, 1, f"enigma:{puzzle_id}")
        resultado["aparar"] = True
    return responder(jogador_id, progresso, sequencia=progresso["sequencia"], **resultado)


@jogador.post("/<jogador_id>/aparar")
def aparar(jogador_id):
    """Defesa ativa: o herói tentou aparar o golpe no ar (ou o tempo do anel acabou). O servidor confere
    se o clique caiu na janela e aplica o dano que sobrou."""
    progresso = carregar(jogador_id)
    resultado = cobrar_ataque(jogador_id, progresso, corpo().get("apertou"))
    if resultado is None:
        abort(400, "Não há golpe para aparar.")
    return responder(jogador_id, progresso, **resultado)


# ---------- lições ----------

def formado(progresso):
    opcionais = (progresso.get("trilha") or {}).get("opcionais") or []
    obrigatorias = [f for f in FASES.values() if not f.get("em_breve") and f["id"] not in opcionais]
    return bool(obrigatorias) and all(str(f["id"]) in progresso["fases"] for f in obrigatorias)


@jogador.post("/<jogador_id>/fases/<int:fase_id>/concluir")
def concluir_fase(jogador_id, fase_id):
    """Fim de uma lição: XP pelas estrelas (só o que melhorou), baú da primeira vez e presente de formatura.

    Por enquanto as estrelas ainda são contadas no navegador (cada resposta já é corrigida aqui);
    o servidor limita de 1 a 3 e nunca dá o XP da mesma lição duas vezes.
    """
    fase = FASES.get(fase_id)
    if not fase or fase.get("em_breve"):
        abort(404)
    estrelas = corpo().get("estrelas")
    if not isinstance(estrelas, int) or not 1 <= estrelas <= 3:
        abort(400, "Estrelas inválidas.")
    progresso = carregar(jogador_id)
    chave = str(fase_id)
    anterior = progresso["fases"].get(chave)
    xp_da_fase = round(fase["xp"] * estrelas / 3)
    ganho = 0
    if not anterior or xp_da_fase > anterior.get("xp", 0):
        ganho = xp_da_fase - (anterior.get("xp", 0) if anterior else 0)
        estrelas_novas = estrelas - (anterior.get("estrelas", 0) if anterior else 0)
        progresso["xp"] += ganho
        progresso["fases"][chave] = {"estrelas": estrelas, "xp": xp_da_fase}
        banco.registrar(jogador_id, "licao", {"fase": fase_id, "estrelas": estrelas, "xp": ganho})
        dominar(jogador_id, progresso, fase.get("trilha"), dominio.PONTOS["estrela_nova"] * estrelas_novas)
    missoes.registrar(progresso, "licao", estrelas=estrelas)
    bau = []
    if chave in ITENS["baus_das_fases"] and fase_id not in progresso["bausAbertos"]:
        progresso["bausAbertos"].append(fase_id)
        bau = conceder(jogador_id, progresso, ITENS["baus_das_fases"][chave], f"bau:{fase_id}")
    presente = []
    if formado(progresso) and "fenix" not in progresso["cosmeticos"]:
        presente = conceder(jogador_id, progresso, {"cosmetico": "fenix", "trofeu": "diploma"}, "formatura")
    return responder(jogador_id, progresso, ganho=ganho, bau=bau, presente=presente)


# ---------- dungeons ----------

@jogador.post("/<jogador_id>/dungeons/<dungeon_id>/entrar")
def entrar_dungeon(jogador_id, dungeon_id):
    d = DUNGEONS.get(dungeon_id)
    if not d:
        abort(404)
    progresso = carregar(jogador_id)
    if str(d["requer_fase"]) not in progresso["fases"]:
        abort(400, "A névoa ainda cobre esta dungeon.")
    if d.get("mundo") == "umbra" and not habilidades.no_ultimo_degrau(progresso):
        abort(403, "As dungeons de Umbraterra só se abrem no último degrau da subclasse.")
    amuleto = bool(corpo().get("amuleto"))
    if amuleto:
        gastar(progresso, "amuleto")
    # a corrida no labirinto: as perguntas acertadas (sala:pergunta) e os baús já abertos
    progresso["dungeonAtual"] = {"id": dungeon_id, "amuleto": amuleto, "acertos": [], "baus": []}
    return responder(jogador_id, progresso)


def corrida_na_dungeon(progresso, dungeon_id):
    atual = progresso.get("dungeonAtual") or {}
    if atual.get("id") != dungeon_id:
        abort(400, "Tu não estás nesta dungeon.")
    atual.setdefault("acertos", [])
    atual.setdefault("baus", [])
    return atual


@jogador.post("/<jogador_id>/dungeons/<dungeon_id>/responder")
def responder_na_dungeon(jogador_id, dungeon_id):
    """Uma resposta a um guardião do labirinto. O servidor corrige e anota o acerto (a vitória só vale com
    todos); errar tira 1 de vida aqui mesmo. "extra" (monstro errante) não conta para a vitória."""
    d = DUNGEONS.get(dungeon_id) or abort(404)
    dados = corpo()
    progresso = carregar(jogador_id)
    atual = corrida_na_dungeon(progresso, dungeon_id)
    sala, indice = dados.get("sala"), dados.get("pergunta")
    if not isinstance(sala, int) or not 0 <= sala < len(d["salas"]) or not isinstance(indice, int) or not 0 <= indice < len(d["salas"][sala]["perguntas"]):
        abort(400, "Pergunta inválida.")
    pergunta = d["salas"][sala]["perguntas"][indice]
    correta = dados.get("resposta") == pergunta["correta"]
    contar_resposta(progresso, correta, d.get("trilha"))
    resultado = {"correta": correta, "resposta_certa": pergunta["correta"], "explicacao": pergunta["explicacao"], "desmaiou": False, "perda": 0}
    if correta:
        chave = f"{sala}:{indice}"
        if not dados.get("extra") and chave not in atual["acertos"]:
            atual["acertos"].append(chave)
        missoes.registrar(progresso, "acerto", trilha=d.get("trilha"))
    else:
        resultado.update(ferir(jogador_id, progresso, 1, f"dungeon:{dungeon_id}"))
        if resultado["desmaiou"]:
            progresso["dungeonAtual"] = None  # desmaiou: a corrida acaba e o herói acorda lá fora
    return responder(jogador_id, progresso, **resultado)


# o que um baú do labirinto pode guardar (o baú 0 de cada corrida guarda a chave do portão do chefão)
TESOUROS_DO_LABIRINTO = [("moedas", 55), ("pocao", 14), ("pergaminho", 11), ("elixir", 12), ("tonico-mana", 8)]


@jogador.post("/<jogador_id>/dungeons/<dungeon_id>/bau")
def abrir_bau_do_labirinto(jogador_id, dungeon_id):
    """Abre um baú do labirinto (uma vez por corrida): moedas ou um consumível sorteado; o baú 0 traz
    também a chave do portão do chefão."""
    if dungeon_id not in DUNGEONS:
        abort(404)
    numero = corpo().get("bau")
    if not isinstance(numero, int) or not 0 <= numero < 8:
        abort(400, "Baú inválido.")
    progresso = carregar(jogador_id)
    atual = corrida_na_dungeon(progresso, dungeon_id)
    if numero in atual["baus"]:
        abort(400, "Esse baú já está vazio.")
    atual["baus"].append(numero)
    tesouro = random.choices([t for t, _ in TESOUROS_DO_LABIRINTO], weights=[p for _, p in TESOUROS_DO_LABIRINTO])[0]
    premio = {"moedas": random.randint(15, 45)} if tesouro == "moedas" else {"itens": {tesouro: 1}}
    ganhos = conceder(jogador_id, progresso, premio, f"bau-dungeon:{dungeon_id}")
    return responder(jogador_id, progresso, ganhos=ganhos, chave=numero == 0)


@jogador.post("/<jogador_id>/dungeons/<dungeon_id>/vitoria")
def vencer_dungeon(jogador_id, dungeon_id):
    """Dungeon conquistada: recompensa cheia na primeira vez, 30% nas seguintes, mais 10 moedas por sala."""
    d = DUNGEONS.get(dungeon_id)
    progresso = carregar(jogador_id)
    atual = progresso.get("dungeonAtual") or {}
    if not d or atual.get("id") != dungeon_id:
        abort(400, "Tu não estavas nesta dungeon.")
    # a vitória só vale com todos os guardiões vencidos (cada pergunta acertada nesta corrida)
    faltam = [f"{s}:{k}" for s, sala in enumerate(d["salas"]) for k in range(len(sala["perguntas"])) if f"{s}:{k}" not in atual.get("acertos", [])]
    if faltam:
        abort(400, "Ainda há guardiões de pé no labirinto.")
    registro = progresso["dungeons"].get(dungeon_id) or {"vitorias": 0}
    primeira = not registro["vitorias"]
    moedas = (d["recompensa"]["moedas"] if primeira else round(d["recompensa"]["moedas"] * 0.3)) + 10 * len(d["salas"])
    if atual.get("amuleto"):
        moedas *= 2
    recompensa = {"moedas": moedas}
    if primeira:
        recompensa.update({k: d["recompensa"].get(k) for k in ("xp", "itens", "cosmetico", "trofeu")})
        dominar(jogador_id, progresso, d.get("trilha"), dominio.PONTOS["dungeon_primeira"])
    missoes.registrar(progresso, "dungeon", dungeon=dungeon_id)
    registro["vitorias"] += 1
    progresso["dungeons"][dungeon_id] = registro
    progresso["dungeonAtual"] = None
    ganhos = conceder(jogador_id, progresso, recompensa, f"dungeon:{dungeon_id}")
    return responder(jogador_id, progresso, primeira=primeira, ganhos=ganhos, amuleto=atual.get("amuleto", False))


# ---------- batalhas no Reino ----------

@jogador.post("/<jogador_id>/batalhas")
def comecar_batalha(jogador_id):
    """Encostou num monstro: o servidor guarda a vida dele e quem vence é decidido aqui."""
    dados = corpo()
    tipo = MONSTROS.get(dados.get("tipo"))
    monstro_id = str(dados.get("monstroId") or "")[:80]
    if not tipo or not monstro_id:
        abort(400, "Monstro inválido.")
    progresso = carregar(jogador_id)
    if tipo.get("chefe") and monstro_id in progresso["chefesDerrotados"]:
        abort(400, "Esse chefão já foi vencido.")
    regiao = REGIOES[tipo["regiao"]]
    if progressao.nivel_de(progresso["xp"]) < regiao["nivelMinimo"]:
        abort(403, f"A barreira de {regiao['nome']} só deixa passar heróis de nível {regiao['nivelMinimo']}.")
    if regiao.get("mundo") == "umbra" and not habilidades.no_ultimo_degrau(progresso):
        abort(403, "Umbraterra só se abre para quem chegou ao último degrau da subclasse.")
    # o Golpe Arcano acertou o monstro no mapa: a luta começa com ele ferido (sem morrer de primeira)
    golpe = bool(dados.get("golpe"))
    if golpe:
        gastar_mana(progresso, HABILIDADES_MAPA["golpe"]["custo"])
    vida = max(1, tipo["vida"] - 1) if golpe else tipo["vida"]
    # a mana é a mesma do mapa: a luta começa com o que o herói tem agora
    mana = progresso["mana"]["atual"]
    batalha_id = banco.criar_batalha(jogador_id, dados["tipo"], monstro_id, vida, mana)
    # recarga em tempo de verdade: "recargas" guarda quando cada magia de classe fica pronta de novo
    agora = time.time()
    especiais = [{**m, "recargaRestante": max(0, round(progresso["recargas"].get(m["id"], 0) - agora))}
                 for m in habilidades.magias_da_classe(progresso)]
    return responder(
        jogador_id, progresso, batalha=batalha_id, vida=vida, golpe=golpe, monstro=tipo, mana=mana,
        manaMaxima=combate.mana_maxima(progresso),
        magias=combate.magias_liberadas(progresso["xp"]), especiais=especiais, fase=1, efeitosFase=combate.efeitos_da_fase(tipo, 1),
    )


def batalha_aberta(jogador_id, batalha_id):
    batalha = banco.carregar_batalha(jogador_id, batalha_id)
    if not batalha or batalha["encerrada"]:
        abort(400, "Essa batalha já acabou.")
    return batalha, MONSTROS[batalha["tipo_monstro"]]


def sortear_para(progresso, tipo, batalha):
    """A pergunta da rodada: perigo do monstro (mais o da fase do chefão) e, se a fase pedir, uma trilha só."""
    efeitos = combate.efeitos_da_fase(tipo, combate.fase_de(tipo, batalha["vida"]))
    concluidas = {int(f) for f in progresso["fases"] if str(f).isdigit()} or {1}
    # um erro antigo do Grimório de Erros pode voltar como eco (fora das fases de chefão de uma trilha só)
    eco = None if efeitos["trilha"] else curriculo.eco_vencido(progresso, progresso["recentesReino"])
    pergunta = eco_de_erro(eco) if eco else sortear_desafio(
        tipo["nivel"] + efeitos["perigo"], concluidas, progresso["recentesReino"], efeitos["trilha"],
        habilidades.trilha_preferida(progresso), curriculo.heroi_do(progresso))
    progresso["recentesReino"] = (progresso["recentesReino"] + [base_da_ref(pergunta["ref"])])[-40:]
    batalha["efeitos"].pop("visao", None)  # a Visão Clara vale só para a pergunta em que foi lançada
    # o relógio da rodada: responder rápido vale crítico; o tempo acabar vale como erro (o equipamento
    # pode dar uns segundos a mais)
    segundos = equipamento.bonus(progresso)["tempo"]
    if segundos:
        pergunta["tempo"] = {**pergunta["tempo"], "limite": pergunta["tempo"]["limite"] + segundos}
    batalha["efeitos"].update(perguntaEm=time.time(), tempo=pergunta["tempo"])
    banco.atualizar_batalha(batalha["id"], pergunta_atual=pergunta["ref"], efeitos=batalha["efeitos"])
    return {k: v for k, v in pergunta.items() if k != "ref"}


@jogador.post("/<jogador_id>/batalhas/<batalha_id>/pergunta")
def proxima_pergunta(jogador_id, batalha_id):
    """Sorteia a pergunta da rodada no nível do monstro, fora das últimas 40 que o herói viu."""
    batalha, tipo = batalha_aberta(jogador_id, batalha_id)
    progresso = carregar(jogador_id)
    golpe_atrasado(jogador_id, progresso)
    pergunta = sortear_para(progresso, tipo, batalha)
    banco.salvar_progresso(jogador_id, progresso)
    return jsonify(pergunta)


@jogador.post("/<jogador_id>/batalhas/<batalha_id>/magia")
def lancar_magia(jogador_id, batalha_id):
    """Uma magia do grimório, lançada antes de responder a pergunta da rodada."""
    batalha, tipo = batalha_aberta(jogador_id, batalha_id)
    progresso = carregar(jogador_id)
    golpe_atrasado(jogador_id, progresso)
    magia = combate.GRIMORIO.get(corpo().get("magia"))
    if not magia or magia not in combate.magias_liberadas(progresso["xp"]):
        abort(400, "Essa magia ainda não está no teu grimório.")
    if not batalha["pergunta_atual"]:
        abort(400, "Espera a pergunta da rodada para lançar magias.")
    if magia["id"] == "visao" and str(batalha["pergunta_atual"]).startswith(("vf|", "ordem:")):
        abort(400, "A Visão Clara só dissolve alternativas: neste desafio não há o que dissolver.")
    efeitos = batalha["efeitos"]
    if efeitos.get(magia["id"]):
        abort(400, f"{magia['nome']} já está valendo nesta rodada.")
    if magia["id"] == "cura" and progresso["vida"]["atual"] >= habilidades.vida_maxima(progresso):
        abort(400, "Tua vida já está cheia.")
    preco = combate.custo(magia, combate.efeitos_da_fase(tipo, combate.fase_de(tipo, batalha["vida"])), progresso, efeitos)
    if batalha["mana"] < preco:
        abort(400, "Falta mana para essa magia.")
    if habilidades.tem(progresso, "eco"):
        efeitos["ecoUsado"] = True  # o Eco do Grimório paga só a primeira magia da batalha
    resultado = {}
    if magia["id"] == "renovar":
        resultado["pergunta"] = sortear_para(progresso, tipo, batalha)
    elif magia["id"] == "visao":
        efeitos["visao"] = resultado["dissolver"] = combate.alternativas_para_dissolver(batalha["pergunta_atual"])
    elif magia["id"] == "cura":
        curar(progresso, 1)
    else:
        efeitos[magia["id"]] = True  # escudo e lâmina esperam o próximo erro ou acerto
    batalha["mana"] -= preco
    banco.atualizar_batalha(batalha_id, mana=batalha["mana"], efeitos=efeitos)
    definir_mana(progresso, batalha["mana"])
    banco.registrar(jogador_id, "magia", {"magia": magia["id"], "monstro": batalha["tipo_monstro"]})
    return responder(jogador_id, progresso, mana=batalha["mana"], efeitos=efeitos, **resultado)


def resultado_vazio(batalha):
    return {
        "vidaMonstro": batalha["vida"], "fim": None, "ganhos": [], "perda": 0, "golpe": False, "lamina": False,
        "escudo": False, "dano": 0, "mana": batalha["mana"], "bonus": [],
    }


def acertar(jogador_id, progresso, batalha, tipo, resultado, trilha, extra=0):
    """Um acerto (de verdade, da AGI ou dos 20 anos de experiência): tira vida (1, mais golpe certeiro,
    Lâmina, habilidades, combos e o que vier de extra), soma na Sequência (a cada 5, o Golpe Final),
    devolve mana, pode trocar a fase do chefão e, se zerar, vence."""
    efeitos = batalha["efeitos"]
    fase_antes = combate.fase_de(tipo, batalha["vida"])
    if somar_sequencia(progresso):
        resultado["golpeFinal"] = True
        resultado["bonus"].append("GOLPE FINAL 🔥")
        extra += combate.DANO_GOLPE_FINAL
    resultado["sequencia"] = progresso["sequencia"]
    resultado["golpe"] = dominio.golpe_certeiro(progresso, trilha)
    resultado["lamina"] = bool(efeitos.pop("lamina", False))
    extras = combate.bonus_de_acerto(progresso, efeitos)
    # o mascote ajuda: uns atacam junto (mais 1 de dano), o slime cura
    ataque_mascote = mascotes.poder(progresso, "ataque")
    if ataque_mascote:
        extras.append(ataque_mascote)
    cura_mascote = mascotes.poder(progresso, "cura")
    if cura_mascote:
        curar(progresso, 1)
        resultado["bonus"].append(cura_mascote)
    resultado["bonus"] += extras
    resultado["vidaMonstro"] = max(0, batalha["vida"] - 1 - resultado["golpe"] - resultado["lamina"] - len(extras) - extra)
    resultado["mana"] = min(batalha["mana"] + combate.mana_por_acerto(progresso), combate.mana_maxima(progresso))
    banco.atualizar_batalha(batalha["id"], vida=resultado["vidaMonstro"], pergunta_atual=None, mana=resultado["mana"], efeitos=efeitos)
    marcar_fase(tipo, fase_antes, resultado)
    if trilha:
        dominar(jogador_id, progresso, trilha, dominio.PONTOS["acerto_por_perigo"] * tipo["nivel"])
        missoes.registrar(progresso, "acerto", trilha=trilha)
    if resultado["vidaMonstro"] <= 0:
        vencer(jogador_id, progresso, batalha, tipo, resultado)


def marcar_fase(tipo, fase_antes, resultado, vida=None):
    """Se o chefão passou de um terço de vida, avisa a fase nova no resultado."""
    vida = resultado["vidaMonstro"] if vida is None else vida
    fase_depois = combate.fase_de(tipo, vida)
    if vida > 0 and fase_depois > fase_antes:
        resultado["fase"] = fase_depois
        resultado["efeitosFase"] = combate.efeitos_da_fase(tipo, fase_depois)


def vencer(jogador_id, progresso, batalha, tipo, resultado, fator=1.0, sem_premio=False):
    """O monstro caiu: missões, chefão, fragmento da história e prêmio (fator < 1 paga só uma parte)."""
    resultado.update(fim="vitoria", vidaMonstro=0)
    banco.atualizar_batalha(batalha["id"], vida=0, pergunta_atual=None, encerrada=1)
    da_noite = bool(tipo.get("daNoite"))
    missoes.registrar(progresso, "monstro", tipo=batalha["tipo_monstro"], regiao=tipo["regiao"], forca=tipo["forca"], noite=da_noite)
    est = estatisticas_de(progresso)
    est["monstros"] += 1
    est["porMonstro"][batalha["tipo_monstro"]] = est["porMonstro"].get(batalha["tipo_monstro"], 0) + 1
    # a Sequência engorda o prêmio, e quem caça no escuro ganha o bônus da noite
    fator *= combate.fator_sequencia(progresso["sequencia"]) * (1 + BONUS_NOITE if da_noite else 1)
    resultado["bonusNoite"] = da_noite
    if tipo.get("chefe"):
        progresso["chefesDerrotados"].append(batalha["monstro_id"])
        missoes.registrar(progresso, "chefe", tipo=batalha["tipo_monstro"])
    # o chefão revela um pedaço da história da Grande Ruptura
    if tipo.get("fragmento"):
        resultado["fragmento"] = tipo["fragmento"]
        if batalha["tipo_monstro"] not in progresso["fragmentos"]:
            progresso["fragmentos"].append(batalha["tipo_monstro"])
    if not sem_premio:
        premio = habilidades.com_fortuna(progresso, {"moedas": tipo["moedas"], "xp": tipo["xp"], **(tipo.get("premio") or {})})
        # o equipamento soma XP e ouro; o ouro dos monstros é metade da tabela (o Reino ficou rico demais)
        extra = equipamento.bonus(progresso)
        premio["moedas"] = round(premio["moedas"] * fator * equipamento.FATOR_OURO_MONSTRO * (1 + extra["moedas"]))
        premio["xp"] = round(premio["xp"] * fator * (1 + extra["xp"]))
        premio["itens"] = {**(premio.get("itens") or {})}
        if habilidades.tem(progresso, "faro") and random.random() < HABILIDADES["chance_faro"]:
            premio["itens"]["pocao"] = premio["itens"].get("pocao", 0) + 1
            resultado["faro"] = True
        # o que o monstro deixou cair: às vezes um consumível e, bem raramente, um visual exclusivo
        principal = habilidades.principal_do(progresso)
        drops, raro = equipamento.sortear_drops(progresso, tipo, principal["id"] if principal else None)
        for item_id, qtd in drops.items():
            premio["itens"][item_id] = premio["itens"].get(item_id, 0) + qtd
        if raro:
            premio["cosmetico"] = raro
            resultado["dropRaro"] = raro
        # e os materiais da Casa da Forja
        premio["materiais"] = equipamento.sortear_materiais(progresso, tipo)
        if drops or raro:
            resultado["drop"] = True
        resultado["ganhos"] = conceder(jogador_id, progresso, premio, f"monstro:{batalha['tipo_monstro']}")
    banco.registrar(jogador_id, "batalha", {"monstro": batalha["tipo_monstro"], "resultado": "vitoria"})


@jogador.post("/<jogador_id>/batalhas/<batalha_id>/especial")
def magia_de_classe(jogador_id, batalha_id):
    """Uma das 3 magias especiais da classe: uma vez por batalha, e as lendárias ainda pedem recarga.
    Quando a magia resolve a rodada (expulsa, apaga ou derruba o monstro, ou responde por ti), devolve
    em "resposta" um resultado igual ao de responder."""
    batalha, tipo = batalha_aberta(jogador_id, batalha_id)
    progresso = carregar(jogador_id)
    golpe_atrasado(jogador_id, progresso)
    magia = next((m for m in habilidades.magias_da_classe(progresso) if m["id"] == corpo().get("magia")), None)
    if not magia:
        abort(400, "Essa magia de classe ainda não é tua.")
    if not batalha["pergunta_atual"]:
        abort(400, "Espera a pergunta da rodada para lançar magias.")
    efeitos = batalha["efeitos"]
    efeito = magia["efeito"]
    chefe = tipo.get("chefe")
    if magia["id"] in efeitos.get("especiais", []):
        abort(400, f"{magia['nome']} já foi usada nesta batalha.")
    falta = progresso["recargas"].get(magia["id"], 0) - time.time()
    if falta > 0:
        abort(400, f"{magia['nome']} ainda recarrega: falta {tempo_por_extenso(falta)}.")
    if efeito["tipo"] in ("expulsar", "apagar") and chefe:
        abort(400, "Chefões são imunes: eles têm atendimento VIP e backup em três datacenters.")
    efeitos.setdefault("especiais", []).append(magia["id"])
    progresso["recargas"][magia["id"]] = time.time() + magia["recarga_horas"] * 3600
    banco.registrar(jogador_id, "magia", {"magia": magia["id"], "monstro": batalha["tipo_monstro"]})

    fase_antes = combate.fase_de(tipo, batalha["vida"])
    resposta = {"correta": True, "resposta_certa": None, "explicacao": "", **resultado_vazio(batalha), "especial": magia["nome"]}
    resultado = {"falhou": False}
    tipo_efeito = efeito["tipo"]
    if tipo_efeito == "expulsar" or (tipo_efeito == "derrubar" and not chefe):
        vencer(jogador_id, progresso, batalha, tipo, resposta, fator=efeito.get("fator", 1.0))
        resultado["resposta"] = resposta
    elif tipo_efeito == "apagar":
        resposta["perdeuPremio"] = random.random() < efeito["chance_perder"]
        vencer(jogador_id, progresso, batalha, tipo, resposta, sem_premio=resposta["perdeuPremio"])
        resultado["resposta"] = resposta
    elif tipo_efeito == "auto_acerto":
        certa = corrigir_pergunta(batalha["pergunta_atual"], 0)
        resposta.update(resposta_certa=certa["resposta_certa"], explicacao=certa["explicacao"])
        acertar(jogador_id, progresso, batalha, tipo, resposta, None, extra=efeito["valor"])
        resultado["resposta"] = resposta
    elif tipo_efeito in ("dano", "metade", "derrubar"):
        if random.random() < efeito.get("chance_falha", 0):
            resultado["falhou"] = True  # o deploy quebrou a produção: a mana vai junto
            batalha["mana"] = 0
        else:
            dano = math.ceil(batalha["vida"] / 2) if tipo_efeito == "metade" else efeito["valor"]
            batalha["vida"] = max(0, batalha["vida"] - dano)
            resposta["vidaMonstro"] = batalha["vida"]
            if batalha["vida"] <= 0:
                vencer(jogador_id, progresso, batalha, tipo, resposta)
                resultado["resposta"] = resposta
            else:
                marcar_fase(tipo, fase_antes, resultado, batalha["vida"])
    if "resposta" in resultado:  # acertar/vencer já mexeram na vida e na mana
        batalha["vida"] = resultado["resposta"]["vidaMonstro"]
        batalha["mana"] = resultado["resposta"]["mana"]
    # efeitos que ficam valendo pelo resto da batalha
    efeitos["protecao"] = efeitos.get("protecao", 0) + (efeito["valor"] if tipo_efeito == "protecao" else efeito.get("protecao", 0))
    efeitos["combo"] = efeitos.get("combo", 0) + (efeito["valor"] if tipo_efeito == "combo" else efeito.get("combo", 0))
    if tipo_efeito == "cura":
        curar(progresso, efeito["vida"])
    if efeito.get("mana_cheia") and not resultado["falhou"]:
        batalha["mana"] = combate.mana_maxima(progresso)
    batalha["mana"] = min(batalha["mana"] + efeito.get("mana", 0), combate.mana_maxima(progresso))
    banco.atualizar_batalha(batalha_id, vida=batalha["vida"], mana=batalha["mana"], efeitos=efeitos)
    if "resposta" in resultado:
        resultado["resposta"].update(mana=batalha["mana"], efeitos=efeitos)
    definir_mana(progresso, batalha["mana"])
    return responder(jogador_id, progresso, mana=batalha["mana"], efeitos=efeitos, vidaMonstro=batalha["vida"], **resultado)


@jogador.post("/<jogador_id>/batalhas/<batalha_id>/responder")
def responder_batalha(jogador_id, batalha_id):
    """Acertou: o monstro perde vida (1, mais 1 do golpe certeiro, da Lâmina de Luz, de cada habilidade de
    ataque que valer, do Relâmpago se foi rápido e do Ritual se era pôr em ordem) e o herói recupera mana;
    se zerar, vem o prêmio. Errou (ou o tempo acabou, resposta nula): a Sequência zera e o monstro ataca,
    a não ser que o Escudo de Runas ou a Esquiva segurem; o golpe fica no ar para o herói tentar aparar.
    Chefões trocam de fase a cada terço de vida perdida. Cada acerto rende domínio e avança as missões."""
    batalha, tipo = batalha_aberta(jogador_id, batalha_id)
    if not batalha["pergunta_atual"]:
        abort(400, "Não há pergunta para responder.")
    resposta = corpo().get("resposta")
    correcao = corrigir_pergunta(batalha["pergunta_atual"], resposta)
    progresso = carregar(jogador_id)
    golpe_atrasado(jogador_id, progresso)
    efeitos = batalha["efeitos"]
    fase_antes = combate.fase_de(tipo, batalha["vida"])
    resultado = {**correcao, **resultado_vazio(batalha), "esgotou": resposta is None, "sequencia": progresso["sequencia"]}
    # o placar do Currículo do Herói conta a resposta de verdade (antes das habilidades que salvam o erro)
    contar_resposta(progresso, correcao["correta"], trilha_da_ref(batalha["pergunta_atual"]))
    # o currículo: acerto de verdade soma na skill e empurra o eco; erro vai para o Grimório de Erros
    if correcao["correta"]:
        resultado["skillDominada"] = curriculo.contar_acerto(progresso, batalha["pergunta_atual"])
        resultado["eco"] = curriculo.anotar_acerto_do_eco(progresso, batalha["pergunta_atual"])
    else:
        curriculo.anotar_erro(progresso, batalha["pergunta_atual"])
    rapido = combate.foi_rapido(efeitos.get("tempo") or DESAFIOS["tempos"]["escolha"], time.time() - efeitos.get("perguntaEm", 0))
    # Tenho 20 Anos de Experiência: uma vez por batalha, o erro vira acerto (e o monstro nem percebe)
    if not correcao["correta"] and habilidades.tem(progresso, "experiencia") and not efeitos.get("experiencia"):
        efeitos["experiencia"] = True
        resultado.update(correta=True, convenceu=True, bonus=["20 Anos de Experiência 🧓"])
    if resultado["correta"]:
        extra = 0
        if rapido and not resultado.get("convenceu"):
            resultado["bonus"].append("Relâmpago ⚡")
            resultado["relampago"] = True
            extra += 1
        if correcao["correta"] and str(batalha["pergunta_atual"]).startswith("ordem:"):
            resultado["bonus"].append("Ritual completo 📜")
            extra += 1
        acertar(jogador_id, progresso, batalha, tipo, resultado, trilha_da_ref(batalha["pergunta_atual"]), extra=extra)
    else:
        efeitos["seguidos"] = 0
        resultado["sequenciaPerdida"] = zerar_sequencia(progresso)
        resultado["sequencia"] = 0
        resultado["escudo"] = bool(efeitos.pop("escudo", False))
        # magias de classe que seguram erros (Loop Infinito, Foi Culpa da IA...) vêm depois do escudo
        if not resultado["escudo"] and efeitos.get("protecao", 0) > 0:
            efeitos["protecao"] -= 1
            resultado["bonus"].append("Magia de classe 🌀")
        # a Esquiva livra o primeiro erro da batalha (escudo e magia de classe, se ativos, são gastos antes)
        elif not resultado["escudo"] and habilidades.tem(progresso, "esquiva") and not efeitos.get("esquivou"):
            efeitos["esquivou"] = True
            resultado["bonus"].append("Esquiva 💨")
        # o mascote também protege: a fênix segura o primeiro erro, o gato e o golem às vezes
        elif not resultado["escudo"] and not efeitos.get("renasceu") and mascotes.poder(progresso, "renascer"):
            efeitos["renasceu"] = True
            resultado["bonus"].append(mascotes.do_heroi(progresso)["poder"]["nome"])
        elif not resultado["escudo"] and (defesa := mascotes.poder(progresso, "defesa")):
            resultado["bonus"].append(defesa)
        protegido = resultado["escudo"] or resultado["bonus"]
        banco.atualizar_batalha(batalha_id, pergunta_atual=None, efeitos=efeitos)
        resultado["dano"] = 0 if protegido else tipo.get("dano", 1) + combate.efeitos_da_fase(tipo, fase_antes)["dano"]
        if resultado["dano"]:
            # o golpe fica no ar: a tela mostra o anel da Defesa ativa e chama /aparar com o resultado
            ameacar(progresso, resultado["dano"], f"monstro:{batalha['tipo_monstro']}", batalha_id)
            resultado["aparar"] = True
    resultado["efeitos"] = efeitos
    definir_mana(progresso, resultado["mana"])
    return responder(jogador_id, progresso, **resultado)


# ---------- habilidades do mapa (barra de baixo, teclas 1 a 5) ----------

@jogador.post("/<jogador_id>/habilidades-mapa/<habilidade_id>")
def usar_habilidade_mapa(jogador_id, habilidade_id):
    """Corrida, Luz Arcana, Cura e Teleporte gastam mana aqui; o efeito na tela (correr, iluminar, sumir e
    aparecer no portal) é do navegador. O Golpe Arcano é cobrado ao começar a batalha com o monstro atingido."""
    habilidade = HABILIDADES_MAPA.get(habilidade_id)
    if not habilidade or habilidade_id == "golpe":
        abort(404, "Habilidade não encontrada.")
    progresso = carregar(jogador_id)
    if habilidade_id == "cura" and progresso["vida"]["atual"] >= habilidades.vida_maxima(progresso):
        abort(400, "Tua vida já está cheia.")
    gastar_mana(progresso, habilidade["custo"])
    if habilidade_id == "cura":
        curar(progresso, 1)
    banco.registrar(jogador_id, "habilidade", {"habilidade": habilidade_id})
    return responder(jogador_id, progresso, habilidade=habilidade_id, duracao=habilidade.get("duracao"))


@jogador.post("/<jogador_id>/batalhas/<batalha_id>/fugir")
def fugir_batalha(jogador_id, batalha_id):
    batalha, _ = batalha_aberta(jogador_id, batalha_id)
    banco.atualizar_batalha(batalha_id, encerrada=1)
    banco.registrar(jogador_id, "batalha", {"monstro": batalha["tipo_monstro"], "resultado": "fuga"})
    return jsonify({"ok": True})


# ---------- missões sorteadas ----------

@jogador.post("/<jogador_id>/missoes/<missao_id>/resgatar")
def resgatar_missao(jogador_id, missao_id):
    """Missão cumprida: paga a recompensa e sorteia outra no lugar."""
    progresso = carregar(jogador_id)
    missao = next((m for m in progresso["missoes"]["ativas"] if m["id"] == missao_id), None)
    if missao and not missoes.pronta(missao):
        abort(400, "Essa missão ainda não foi cumprida.")
    missoes.tirar(progresso, missao_id)
    progresso["missoes"]["cumpridas"] += 1
    recompensa = habilidades.com_fortuna(progresso, missoes.MODELOS[missao_id]["recompensa"])
    ganhos = conceder(jogador_id, progresso, recompensa, f"missao:{missao_id}")
    missoes.garantir(progresso)
    return responder(jogador_id, progresso, ganhos=ganhos)


@jogador.post("/<jogador_id>/missoes/<missao_id>/trocar")
def trocar_missao(jogador_id, missao_id):
    """Não curtiu a missão? Troca por outra, pagando umas moedas ao quadro de avisos."""
    progresso = carregar(jogador_id)
    preco = MISSOES["preco_troca"]
    if progresso["moedas"] < preco:
        abort(400, f"Trocar uma missão custa {preco} moedas.")
    missoes.tirar(progresso, missao_id)
    progresso["moedas"] -= preco
    missoes.garantir(progresso)
    return responder(jogador_id, progresso)


# ---------- classe principal e subclasse ----------

@jogador.post("/<jogador_id>/classe/principal")
def escolher_principal(jogador_id):
    """Mago, guerreiro ou arqueiro: escolhida uma vez, quando o personagem é criado."""
    progresso = carregar(jogador_id)
    escolhida = corpo().get("id")
    if escolhida not in habilidades.PRINCIPAIS_POR_ID:
        abort(404, "Classe não encontrada.")
    if habilidades.principal_do(progresso):
        abort(400, "Tua classe já foi escolhida.")
    progresso["classe"] = {"principal": escolhida, "id": None}
    banco.registrar(jogador_id, "classe", {"principal": escolhida})
    return responder(jogador_id, progresso)


@jogador.post("/<jogador_id>/classe/subclasse")
def escolher_subclasse(jogador_id):
    """Deixa de ser iniciante: escolhe uma das subclasses da classe principal, no nível de escolha."""
    progresso = carregar(jogador_id)
    principal = habilidades.principal_do(progresso)
    classe = habilidades.CLASSES_POR_ID.get(corpo().get("id"))
    if not principal or not classe or classe["principal"] != principal["id"]:
        abort(400, "Essa subclasse não é da tua classe.")
    if habilidades.classe_do(progresso):
        abort(400, "Tu já escolheste tua subclasse.")
    if progressao.nivel_de(progresso["xp"]) < habilidades.NIVEL_ESCOLHA:
        abort(400, f"A subclasse se escolhe no nível {habilidades.NIVEL_ESCOLHA}.")
    if not habilidades.pode_escolher_subclasse(progresso):
        abort(400, "Antes da subclasse, passa na Prova do Aprendiz (Livro do Herói, aba Ofício).")
    progresso["classe"] = {"principal": principal["id"], "id": classe["id"]}
    banco.registrar(jogador_id, "classe", {"subclasse": classe["id"]})
    return responder(jogador_id, progresso)


# ---------- a Prova do Degrau (curriculo.py) ----------

def pergunta_da_prova(prova):
    """A pergunta da vez, pronta para a tela (sem a ref, que guarda a ordem das alternativas)."""
    ref = prova["refs"][prova["atual"]]
    pergunta = montar_pergunta(ref.partition("@")[0])
    # a ordem embaralhada fica fixa na prova: a mesma pergunta não muda de ordem se a tela recarregar
    if "@" not in ref:
        prova["refs"][prova["atual"]] = pergunta["ref"]
    else:
        base, _, ordem = ref.partition("@")
        pergunta["opcoes"] = [pergunta_por_ref(base)["opcoes"][int(i)] for i in ordem]
    dificuldade_atual = curriculo.ROTEIRO_DA_PROVA[min(prova["atual"], len(curriculo.ROTEIRO_DA_PROVA) - 1)][0]
    return {k: v for k, v in pergunta.items() if k != "ref"} | {
        "numero": prova["atual"] + 1, "total": len(prova["refs"]), "dificuldade": dificuldade_atual, "acertos": prova["acertos"],
    }


@jogador.post("/<jogador_id>/prova/iniciar")
def iniciar_prova(jogador_id):
    """Começa (ou retoma) a Prova do Degrau: 10 perguntas do currículo da classe, do fácil ao difícil."""
    progresso = carregar(jogador_id)
    prova = progresso.get("prova")
    if not prova:
        situacao = curriculo.situacao_da_prova(progresso)
        if not situacao or not situacao["pode"]:
            abort(400, (situacao or {}).get("motivo", "Escolhe tua classe primeiro."))
        refs = curriculo.montar_prova(progresso)
        if len(refs) < curriculo.PERGUNTAS_DA_PROVA:
            abort(400, "Ainda não há perguntas suficientes para essa prova.")
        prova = progresso["prova"] = {"degrau": situacao["degrau"], "skill": situacao["skill"], "refs": refs, "atual": 0, "acertos": 0,
                                      "respostas": [], "em": time.time()}
        banco.registrar(jogador_id, "prova", {"degrau": prova["degrau"], "inicio": True})
    pergunta = pergunta_da_prova(prova)
    return responder(jogador_id, progresso, pergunta=pergunta, provaDegrau=prova["degrau"], skillDaProva=prova["skill"])


@jogador.post("/<jogador_id>/prova/responder")
def responder_prova(jogador_id):
    """Corrige a pergunta da vez. Na última, dá o resultado: aprovado (7 ou mais) sobe o degrau (se o
    resto dos requisitos já estiver cumprido) e ganha prêmio; reprovado espera um pouco para tentar de novo."""
    progresso = carregar(jogador_id)
    prova = progresso.get("prova")
    if not prova:
        abort(400, "Não há prova em andamento.")
    ref = prova["refs"][prova["atual"]]
    correcao = corrigir_pergunta(ref, corpo().get("resposta"))
    if correcao["correta"]:
        prova["acertos"] += 1
        curriculo.contar_acerto(progresso, ref)
    else:
        curriculo.anotar_erro(progresso, ref)
    prova["respostas"].append(bool(correcao["correta"]))
    prova["atual"] += 1
    extras = {"correcao": correcao, "acertos": prova["acertos"], "numero": prova["atual"], "total": len(prova["refs"])}
    if prova["atual"] < len(prova["refs"]):
        extras["pergunta"] = pergunta_da_prova(prova)
        return responder(jogador_id, progresso, **extras)
    # fim da prova
    aprovado = prova["acertos"] >= curriculo.NOTA_APROVACAO
    degrau_antes = habilidades.degrau(progresso)
    ganhos = []
    if aprovado:
        progresso["provas"] = sorted(set(progresso.get("provas") or []) | {prova["degrau"]})
        perfeita = prova["acertos"] == len(prova["refs"])
        ganhos = conceder(jogador_id, progresso, {"xp": 120 * prova["degrau"] + (80 if perfeita else 0), "moedas": 60 * prova["degrau"]},
                          f"prova:{prova['degrau']}")
    else:
        progresso["provaEspera"] = time.time() + curriculo.ESPERA_REPROVADO
    banco.registrar(jogador_id, "prova", {"degrau": prova["degrau"], "acertos": prova["acertos"], "aprovado": aprovado})
    extras["resultado"] = {
        "aprovado": aprovado, "acertos": prova["acertos"], "total": len(prova["refs"]), "nota": curriculo.NOTA_APROVACAO,
        "degrau": prova["degrau"], "skill": prova["skill"], "respostas": prova["respostas"], "ganhos": ganhos,
        "subiu": habilidades.degrau(progresso) > degrau_antes, "espera": curriculo.ESPERA_REPROVADO if not aprovado else 0,
    }
    progresso["prova"] = None
    return responder(jogador_id, progresso, **extras)


# ---------- árvore de habilidades ----------

@jogador.post("/<jogador_id>/habilidades/<habilidade_id>/aprender")
def aprender_habilidade(jogador_id, habilidade_id):
    """Gasta pontos numa habilidade, se a anterior do ramo já foi aprendida."""
    habilidade = habilidades.CATALOGO.get(habilidade_id)
    if not habilidade:
        abort(404, "Habilidade não encontrada.")
    progresso = carregar(jogador_id)
    if habilidades.tem(progresso, habilidade_id):
        abort(400, "Tu já sabes essa habilidade.")
    motivo = habilidades.pode_aprender(progresso, habilidade_id)
    if motivo:
        abort(400, motivo)
    if habilidades.pontos_livres(progresso) < habilidade["custo"]:
        abort(400, "Faltam pontos de habilidade. Sobe de nível ou vence um chefão!")
    progresso["habilidades"].append(habilidade_id)
    if habilidade_id == "pele":
        progresso["vida"]["atual"] += 1  # o coração novo já vem cheio
    banco.registrar(jogador_id, "habilidade", {"habilidade": habilidade_id})
    return responder(jogador_id, progresso)


@jogador.post("/<jogador_id>/habilidades/reiniciar")
def reiniciar_habilidades(jogador_id):
    """Devolve todos os pontos (por umas moedas) para montar a árvore de outro jeito."""
    progresso = carregar(jogador_id)
    preco = HABILIDADES["preco_reiniciar"]
    if not progresso["habilidades"]:
        abort(400, "Tua árvore já está vazia.")
    if progresso["moedas"] < preco:
        abort(400, f"Reiniciar a árvore custa {preco} moedas.")
    progresso["moedas"] -= preco
    progresso["habilidades"] = []
    curar(progresso, 0)  # sem a Pele de Pergaminho, a vida volta ao teto normal
    banco.registrar(jogador_id, "habilidade", {"reiniciou": True, "moedas": -preco})
    return responder(jogador_id, progresso)


# ---------- a história e as quests dos moradores ----------

@jogador.post("/<jogador_id>/quests/<quest_id>/aceitar")
def aceitar_quest(jogador_id, quest_id):
    """Falou com o morador e aceitou a quest: ela entra no diário com os objetivos zerados."""
    progresso = carregar(jogador_id)
    quest = quests.aceitar(progresso, quest_id)
    banco.registrar(jogador_id, "quest", {"quest": quest_id, "acao": "aceitou"})
    return responder(jogador_id, progresso, quest=quest_id, titulo=quest["titulo"])


@jogador.post("/<jogador_id>/quests/<quest_id>/entregar")
def entregar_quest(jogador_id, quest_id):
    """Voltou ao morador com os objetivos cumpridos: a recompensa é paga e a quest vai para as concluídas."""
    progresso = carregar(jogador_id)
    principal = habilidades.principal_do(progresso)
    recompensa = quests.entregar(progresso, quest_id, principal["id"] if principal else None)
    ganhos = conceder(jogador_id, progresso, recompensa, f"quest:{quest_id}")
    banco.registrar(jogador_id, "quest", {"quest": quest_id, "acao": "entregou"})
    return responder(jogador_id, progresso, ganhos=ganhos)


@jogador.post("/<jogador_id>/quests/evento")
def evento_de_quest(jogador_id):
    """Os dois eventos que só o navegador vê: falar com um morador e chegar numa cidade."""
    dados = corpo()
    evento = dados.get("evento")
    chave = quests.EVENTOS_DO_NAVEGADOR.get(evento)
    if not chave or not isinstance(dados.get(chave), str):
        abort(400, "Evento inválido.")
    progresso = carregar(jogador_id)
    quests.registrar(progresso, evento, **{chave: dados[chave][:40]})
    return responder(jogador_id, progresso)


# ---------- o Desafio do Dia ----------
# Cinco perguntas por dia, as MESMAS para todo mundo (sorteadas com a data como semente: dá para comparar com
# os amigos), da mais fácil para a mais difícil. Uma tentativa por dia. Acertar 3 ou mais conta para a
# sequência de dias seguidos (🔥); a cada 7 dias seguidos abre o baú da semana.
PERGUNTAS_DO_DIA = 5
ACERTOS_PARA_CONTAR = 3
BAU_A_CADA = 7


def refs_do_dia(data):
    """As perguntas de hoje (ref com a ordem das alternativas embaralhada pela mesma semente)."""
    sorte = random.Random(f"desafio-do-dia:{data}")
    refs = []
    for nivel, quantas in ((1, 2), (2, 2), (3, 1)):
        candidatas = [f"reino:{p['nivel']}:{i}" for i, p in enumerate(PERGUNTAS_REINO) if p["nivel"] == nivel and len(p["opcoes"]) >= 2]
        for ref in sorte.sample(candidatas, quantas):
            ordem = list(range(len(pergunta_por_ref(ref)["opcoes"])))
            sorte.shuffle(ordem)
            refs.append(f"{ref}@{''.join(map(str, ordem))}")
    return refs


def pergunta_do_dia_publica(ref, numero):
    base, _, ordem = ref.partition("@")
    p = pergunta_por_ref(base)
    return {"numero": numero, "total": PERGUNTAS_DO_DIA, "pergunta": p["pergunta"], "opcoes": [p["opcoes"][int(i)] for i in ordem],
            "codigo": p.get("codigo"), "cenario": p.get("cenario"), "trilha": trilha_da_ref(base)}


def desafio_de_hoje(progresso):
    """O estado do Desafio do Dia, criando o de hoje se ainda não existe (a sequência vem do dia anterior)."""
    hoje = banco.hoje()
    antigo = progresso.get("desafioDia") if isinstance(progresso.get("desafioDia"), dict) else {}
    if antigo.get("data") != hoje:
        progresso["desafioDia"] = {
            "data": hoje, "refs": refs_do_dia(hoje), "atual": 0, "acertos": 0, "respostas": [], "feito": False,
            "sequencia": int(antigo.get("sequencia") or 0), "ultimoDia": antigo.get("ultimoDia"), "baus": int(antigo.get("baus") or 0),
        }
    return progresso["desafioDia"]


def sequencia_valendo(d):
    """A sequência só vale se o último dia contado foi ontem ou hoje (senão a chama apagou)."""
    if not d.get("ultimoDia"):
        return 0
    ontem = (datetime.fromisoformat(d["data"]) - timedelta(days=1)).date().isoformat()
    return d["sequencia"] if d["ultimoDia"] in (d["data"], ontem) else 0


def desafio_publico(d):
    return {
        "data": d["data"], "feito": d["feito"], "acertos": d["acertos"], "respostas": d["respostas"], "sequencia": sequencia_valendo(d),
        "total": PERGUNTAS_DO_DIA, "precisa": ACERTOS_PARA_CONTAR, "bauA": BAU_A_CADA,
        "pergunta": None if d["feito"] else pergunta_do_dia_publica(d["refs"][d["atual"]], d["atual"] + 1),
    }


@jogador.get("/<jogador_id>/desafio-dia")
def ver_desafio_do_dia(jogador_id):
    progresso = carregar(jogador_id)
    d = desafio_de_hoje(progresso)
    banco.salvar_progresso(jogador_id, progresso)
    return jsonify(desafio_publico(d))


@jogador.post("/<jogador_id>/desafio-dia/responder")
def responder_desafio_do_dia(jogador_id):
    progresso = carregar(jogador_id)
    d = desafio_de_hoje(progresso)
    if d["feito"]:
        abort(400, "O Desafio de hoje já foi. Volta amanhã para manter a chama acesa!")
    ref = d["refs"][d["atual"]]
    resultado = corrigir_pergunta(ref, corpo().get("resposta"))
    correta = bool(resultado["correta"])
    contar_resposta(progresso, correta, trilha_da_ref(base_da_ref(ref)))
    d["respostas"].append(correta)
    d["acertos"] += int(correta)
    d["atual"] += 1
    extra = {"correta": correta, "resposta_certa": resultado["resposta_certa"], "texto_certo": resultado.get("texto_certo"), "explicacao": resultado["explicacao"]}
    if d["atual"] >= PERGUNTAS_DO_DIA:
        d["feito"] = True
        ganhos = []
        bau = False
        if d["acertos"] >= ACERTOS_PARA_CONTAR:
            d["sequencia"] = sequencia_valendo(d) + 1
            d["ultimoDia"] = d["data"]
            ganhos = conceder(jogador_id, progresso, {"xp": 25 + 10 * d["acertos"], "moedas": 15 + 5 * d["acertos"]}, "desafio-do-dia")
            if d["sequencia"] % BAU_A_CADA == 0:
                bau = True
                d["baus"] += 1
                ganhos += conceder(jogador_id, progresso, {"moedas": 150, "itens": {"elixir-grande": 2}, "cosmetico": "manto-sequencia"}, "bau-da-sequencia")
            if (progresso.get("casa") or {}).get("id"):
                banco.somar_pontos_da_casa(jogador_id, progresso["casa"]["id"], 3)
        extra["fim"] = {"acertos": d["acertos"], "contou": d["acertos"] >= ACERTOS_PARA_CONTAR, "sequencia": sequencia_valendo(d), "ganhos": ganhos, "bau": bau}
    banco.salvar_progresso(jogador_id, progresso)
    return jsonify({**extra, "desafio": desafio_publico(d), "estado": estado(progresso)})