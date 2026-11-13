"""RPG IA (Academia Arcana de Elyndor): jogo para aprender o básico de IA com o professor Zetsu.

O servidor entrega o conteúdo das fases e corrige as respostas.
As respostas certas nunca vão para o navegador: quem corrige é o Python.
O progresso de cada jogador fica no banco (banco.py) e tudo que vale de verdade (XP, moedas, vida,
itens, vitórias) é decidido em jogador.py.
"""

import copy
import json
import os
import random
import re
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, abort, jsonify, render_template, request

load_dotenv()

import avaliador  # noqa: E402  (precisa do .env já carregado)
import banco  # noqa: E402
import mascotes  # noqa: E402
import progressao  # noqa: E402
import simulador  # noqa: E402
import zetsu_ia  # noqa: E402
from conteudo import APTIDAO, BIBLIOTECA, CAMINHO_DAS_CLASSES, CARREIRA, CLASSES, DUNGEONS, FASES, HABILIDADES, HISTORIA, ITENS, MAGIAS, MISSOES, MONSTROS, PERGUNTAS_REINO, PRINCIPAIS, PUZZLES, REGIOES, TRILHAS, corrigir_pergunta  # noqa: E402
from jogador import ENDERECOS_LOCAIS, endereco_de_quem_pede, jogador  # noqa: E402

PASTA = Path(__file__).parent
LIMITE_IA_POR_HORA = int(os.environ.get("LIMITE_IA_POR_HORA", "20"))
app = Flask(__name__)
app.json.sort_keys = False  # mantém a ordem dos JSONs de conteúdo (trilhas, regiões...)
# nenhum pedido do jogo passa disso (o progresso aceita até 200 KB, TAMANHO_MAXIMO_PROGRESSO); barra envios gigantes
app.config["MAX_CONTENT_LENGTH"] = 512 * 1024
app.register_blueprint(simulador.simulador)
app.register_blueprint(jogador)
banco.iniciar()

@app.url_defaults
def versao_dos_estaticos(endpoint, valores):
    """Todo url_for('static', ...) ganha ?v=<data do arquivo>: quando um JS/CSS muda, o endereço muda e o
    navegador baixa o novo (sem isso ele podia continuar com o script velho em cache depois de atualizar)."""
    if endpoint == "static" and "filename" in valores and "v" not in valores:
        arquivo = PASTA / "static" / valores["filename"]
        if arquivo.is_file():
            valores["v"] = int(arquivo.stat().st_mtime)


PASTA_CENARIO = PASTA / "static" / "img" / "cenario"


@app.post("/dev/cenario/<arquivo>")
def salvar_cenario(arquivo):
    """Ferramenta de desenvolvimento: guarda as imagens do cenário do Reino geradas no navegador
    (exportarCenarioHD() no console). Só funciona com o servidor em modo debug, no próprio computador."""
    if not app.debug or request.remote_addr not in ("127.0.0.1", "::1"):
        abort(404)
    if not re.fullmatch(r"[a-z0-9-]+\.(png|json)", arquivo):
        abort(400, "Nome de arquivo inválido.")
    dados = request.get_data()
    if arquivo.endswith(".png") and not dados.startswith(b"\x89PNG"):
        abort(400, "Não é um PNG.")
    PASTA_CENARIO.mkdir(parents=True, exist_ok=True)
    (PASTA_CENARIO / arquivo).write_bytes(dados)
    return jsonify(ok=True, arquivo=arquivo, bytes=len(dados))


def buscar_fase(fase_id):
    fase = FASES.get(fase_id)
    if fase is None or fase.get("em_breve"):
        abort(404)
    return fase


def buscar_etapa(fase, indice, tipo):
    etapas = fase["etapas"]
    if not isinstance(indice, int) or not 0 <= indice < len(etapas):
        abort(400, "Etapa inválida.")
    etapa = etapas[indice]
    if etapa["tipo"] != tipo:
        abort(400, f"A etapa {indice} não é do tipo {tipo}.")
    return etapa


def sem_gabarito(fase):
    """Copia a fase removendo as respostas certas antes de mandar pro navegador."""
    fase = copy.deepcopy(fase)
    for etapa in fase.get("etapas", []):
        for pergunta in etapa.get("perguntas", []):
            for chave in ("correta", "explicacao", "chave", "dica"):
                pergunta.pop(chave, None)
        etapa["checks"] = [{"descricao": c["descricao"]} for c in etapa.get("checks", [])]
        etapa.pop("proibidos", None)
        for trecho in etapa.get("trechos", []):
            trecho.pop("parte", None)
            trecho.pop("explicacao", None)
        etapa.pop("sensiveis", None)
        etapa.pop("manter", None)
        for item in etapa.get("itens", []):
            if isinstance(item, dict) and "verificacao" in item:
                verificacao = item["verificacao"]
                item["verificacao"] = {"rotulo": verificacao["rotulo"], "exemplo": verificacao.get("exemplo", "")}
        if etapa["tipo"] == "ordenar":
            etapa["itens"] = embaralhar(etapa["itens"])
    return fase


def embaralhar(itens):
    """Embaralha garantindo que não volte na ordem certa."""
    embaralhados = itens[:]
    while len(itens) > 1 and embaralhados == itens:
        random.shuffle(embaralhados)
    return embaralhados


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/privacidade")
def privacidade():
    """O que o jogo guarda e por quê (LGPD)."""
    return render_template("privacidade.html")


@app.get("/api/fases")
def listar_fases():
    resumo = [
        {chave: fase.get(chave) for chave in ("id", "titulo", "subtitulo", "icone", "xp", "em_breve", "local", "professor")}
        for fase in FASES.values()
    ]
    return jsonify(resumo)


@app.get("/api/aptidao")
def perguntas_aptidao():
    return jsonify({"perguntas": APTIDAO["perguntas"]})


@app.get("/api/classes")
def listar_classes():
    return jsonify(CLASSES)


@app.get("/api/itens")
def catalogo_itens():
    return jsonify(ITENS)


# ---------- dungeons ----------

def buscar_dungeon(dungeon_id):
    dungeon = DUNGEONS.get(dungeon_id)
    if dungeon is None:
        abort(404)
    return dungeon


def buscar_pergunta_dungeon(dungeon, dados):
    salas = dungeon["salas"]
    sala, indice = dados.get("sala"), dados.get("pergunta")
    if not isinstance(sala, int) or not 0 <= sala < len(salas):
        abort(400, "Sala inválida.")
    perguntas = salas[sala]["perguntas"]
    if not isinstance(indice, int) or not 0 <= indice < len(perguntas):
        abort(400, "Pergunta inválida.")
    return perguntas[indice]


# ---------- o Reino: monstros, curva de XP e enigmas ----------
# (as batalhas e as recompensas ficam em jogador.py: quem decide quem venceu é o servidor)

@app.get("/api/monstros")
def listar_monstros():
    """Os números de combate de cada monstro (o desenho e o jeito de andar ficam no reino.js)."""
    return jsonify(MONSTROS)


@app.get("/api/progressao")
def curva_de_xp():
    """Os parâmetros da curva de XP e as eras, para o navegador desenhar a barra igual ao servidor."""
    return jsonify({"xpBase": progressao.XP_BASE, "xpPorNivel": progressao.XP_POR_NIVEL, "xpCurva": progressao.XP_CURVA,
                    "nivelCurva": progressao.NIVEL_CURVA, "eras": progressao.ERAS})


@app.get("/api/jornada")
def regras_da_jornada():
    """Trilhas de domínio, regiões do Reino (com o nível de cada barreira), o quadro de missões, o grimório
    e a árvore de habilidades."""
    return jsonify({
        "trilhas": TRILHAS, "regioes": REGIOES, "missoes": MISSOES, "magias": MAGIAS, "habilidades": HABILIDADES,
        "classes": CLASSES, "principais": PRINCIPAIS, "historia": HISTORIA, "mascotes": mascotes.MASCOTES,
        "caminho": {chave: CAMINHO_DAS_CLASSES[chave] for chave in ("nivel_escolha", "degraus_das_magias", "degrau_da_passiva")},
    })

@app.get("/api/puzzles")
def listar_puzzles():
    """Enigmas espalhados pelo Reino, sem as respostas (a ordem dos passos vem embaralhada)."""
    publicos = []
    for p in PUZZLES.values():
        item = {chave: p[chave] for chave in ("id", "nome", "movel", "regiao", "tipo", "texto", "recompensa")}
        if p.get("codigo"):
            item["codigo"] = p["codigo"]
        if p["tipo"] in ("enigma", "lacuna"):
            item["opcoes"] = p["opcoes"]
        elif p["tipo"] == "relampago":
            item["afirmacoes"] = [a["texto"] for a in p["afirmacoes"]]
        else:
            item["itens"] = embaralhar(p["itens"])
        publicos.append(item)
    return jsonify(publicos)


@app.get("/api/dungeons")
def listar_dungeons():
    resumo = []
    for d in DUNGEONS.values():
        item = {chave: d[chave] for chave in ("id", "nome", "icone", "requer_fase", "dificuldade", "descricao", "recompensa")}
        item["mundo"] = d.get("mundo", "reino")
        item["salas"] = len(d["salas"])
        resumo.append(item)
    return jsonify(resumo)


@app.get("/api/dungeons/<dungeon_id>")
def detalhar_dungeon(dungeon_id):
    dungeon = copy.deepcopy(buscar_dungeon(dungeon_id))
    for sala in dungeon["salas"]:
        for pergunta in sala["perguntas"]:
            for chave in ("correta", "explicacao", "dica"):
                pergunta.pop(chave, None)
    return jsonify(dungeon)


@app.post("/api/dungeons/<dungeon_id>/responder")
def responder_dungeon(dungeon_id):
    dados = request.get_json(force=True)
    pergunta = buscar_pergunta_dungeon(buscar_dungeon(dungeon_id), dados)
    return jsonify({
        "correta": dados.get("resposta") == pergunta["correta"],
        "resposta_certa": pergunta["correta"],
        "explicacao": pergunta["explicacao"],
    })


@app.post("/api/dungeons/<dungeon_id>/pergaminho")
def pergaminho_dungeon(dungeon_id):
    pergunta = buscar_pergunta_dungeon(buscar_dungeon(dungeon_id), request.get_json(force=True))
    return jsonify({"dica": pergunta["dica"]})


@app.post("/api/dungeons/<dungeon_id>/pocao")
def pocao_dungeon(dungeon_id):
    pergunta = buscar_pergunta_dungeon(buscar_dungeon(dungeon_id), request.get_json(force=True))
    return jsonify({"remover": erradas_para_remover(pergunta)})


def erradas_para_remover(pergunta):
    """A Poção da Clareza some com duas respostas erradas, escolhidas ao acaso."""
    erradas = [i for i in range(len(pergunta["opcoes"])) if i != pergunta["correta"]]
    return random.sample(erradas, min(2, len(erradas)))


@app.post("/api/trilha")
def montar_trilha():
    """Monta a trilha do aluno a partir do teste de aptidão.

    Nenhuma fase some: as que o aluno já domina viram opcionais (abertas para revisar)
    e o caminho recomendado segue em ordem.
    """
    dados = request.get_json(force=True)
    ia = min(max(int(dados.get("ia", 0)), 0), 2)
    codigo = min(max(int(dados.get("codigo", 0)), 0), 2)

    opcionais = []
    if ia >= 1:
        opcionais.append(1)
    if ia >= 2:
        opcionais.append(2)
    if codigo >= 2:
        opcionais.append(3)
    # o teste de aptidão só monta a trilha do Zetsu; as salas da Kaela e do Orion abrem por mérito
    recomendadas = [fase_id for fase_id, fase in FASES.items() if fase["professor"] == "zetsu" and fase_id not in opcionais]

    return jsonify({
        "perfil": {"ia": ia, "codigo": codigo},
        "fala": APTIDAO["leituras"][ia + codigo],
        "recomendadas": recomendadas,
        "opcionais": opcionais,
        "motivos": {str(f): APTIDAO["motivos_opcionais"][str(f)] for f in opcionais},
    })


@app.get("/api/fases/<int:fase_id>")
def detalhar_fase(fase_id):
    return jsonify(sem_gabarito(buscar_fase(fase_id)))


@app.post("/api/fases/<int:fase_id>/quiz")
def responder_quiz(fase_id):
    dados = request.get_json(force=True)
    etapa = buscar_etapa(buscar_fase(fase_id), dados.get("etapa"), "quiz")
    perguntas = etapa["perguntas"]
    indice = dados.get("pergunta")
    if not isinstance(indice, int) or not 0 <= indice < len(perguntas):
        abort(400, "Pergunta inválida.")
    pergunta = perguntas[indice]
    return jsonify({
        "correta": dados.get("resposta") == pergunta["correta"],
        "resposta_certa": pergunta["correta"],
        "explicacao": pergunta["explicacao"],
    })


@app.post("/api/fases/<int:fase_id>/pocao")
def pocao_quiz(fase_id):
    dados = request.get_json(force=True)
    etapa = buscar_etapa(buscar_fase(fase_id), dados.get("etapa"), "quiz")
    indice = dados.get("pergunta")
    if not isinstance(indice, int) or not 0 <= indice < len(etapa["perguntas"]):
        abort(400, "Pergunta inválida.")
    return jsonify({"remover": erradas_para_remover(etapa["perguntas"][indice])})


@app.post("/api/fases/<int:fase_id>/classificar")
def corrigir_classificacao(fase_id):
    dados = request.get_json(force=True)
    etapa = buscar_etapa(buscar_fase(fase_id), dados.get("etapa"), "classificar")
    respostas = dados.get("respostas", [])
    detalhes = []
    for i, trecho in enumerate(etapa["trechos"]):
        escolhida = respostas[i] if i < len(respostas) else None
        detalhes.append({
            "certa": trecho["parte"],
            "acertou": escolhida == trecho["parte"],
            "explicacao": trecho.get("explicacao", ""),
        })
    acertos = sum(d["acertou"] for d in detalhes)
    return jsonify({"acertos": acertos, "total": len(detalhes), "detalhes": detalhes})


@app.post("/api/fases/<int:fase_id>/checklist")
def verificar_item(fase_id):
    """Confere o que o aluno colou do terminal e reconhece os erros mais comuns."""
    dados = request.get_json(force=True)
    etapa = buscar_etapa(buscar_fase(fase_id), dados.get("etapa"), "checklist")
    itens = etapa["itens"]
    indice = dados.get("item")
    if not isinstance(indice, int) or not 0 <= indice < len(itens) or "verificacao" not in itens[indice]:
        abort(400, "Item inválido.")
    verificacao = itens[indice]["verificacao"]
    resposta = (dados.get("resposta") or "").strip()

    if re.search(verificacao["padrao"], resposta, re.IGNORECASE):
        return jsonify({"ok": True, "mensagem": verificacao["sucesso"]})
    for erro in verificacao.get("erros", []):
        if re.search(erro["padrao"], resposta, re.IGNORECASE):
            return jsonify({"ok": False, "mensagem": erro["mensagem"]})
    return jsonify({"ok": False, "mensagem": verificacao["falha"]})


@app.post("/api/fases/<int:fase_id>/ordenar")
def corrigir_ordem(fase_id):
    dados = request.get_json(force=True)
    etapa = buscar_etapa(buscar_fase(fase_id), dados.get("etapa"), "ordenar")
    certa = etapa["itens"]
    enviada = dados.get("ordem", [])
    posicoes = [i < len(enviada) and enviada[i] == item for i, item in enumerate(certa)]
    return jsonify({"acertos": sum(posicoes), "total": len(certa), "posicoes": posicoes, "ordem_certa": certa})


@app.post("/api/fases/<int:fase_id>/anonimizar")
def corrigir_anonimizacao(fase_id):
    dados = request.get_json(force=True)
    etapa = buscar_etapa(buscar_fase(fase_id), dados.get("etapa"), "anonimizar")
    return jsonify(avaliador.avaliar_anonimizacao(dados.get("texto", ""), etapa))


@app.post("/api/fases/<int:fase_id>/verificar_codigo")
def verificar_codigo(fase_id):
    """Confere o código colado pelo aluno com a lista de requisitos da missão."""
    dados = request.get_json(force=True)
    etapa = buscar_etapa(buscar_fase(fase_id), dados.get("etapa"), "verificar_codigo")
    codigo = dados.get("codigo", "")
    resultados = []
    for check in etapa["checks"]:
        achados = len(re.findall(check["padrao"], codigo, re.IGNORECASE))
        ok = achados >= check.get("minimo", 1)
        resultados.append({"descricao": check["descricao"], "ok": ok, "dica": "" if ok else check["dica"]})
    problemas = [p["mensagem"] for p in etapa.get("proibidos", []) if re.search(p["padrao"], codigo, re.IGNORECASE)]
    return jsonify({
        "checks": resultados,
        "problemas": problemas,
        "aprovado": all(r["ok"] for r in resultados) and not problemas,
    })


def numero_em(texto):
    achado = re.search(r"-?\d+", texto)
    return int(achado.group()) if achado else None


@app.post("/api/fases/<int:fase_id>/missao")
def conferir_missao(fase_id):
    """Compara as respostas do aluno com o que o simulador sabe que é verdade."""
    dados = request.get_json(force=True)
    etapa = buscar_etapa(buscar_fase(fase_id), dados.get("etapa"), "missao_api")
    certas = simulador.respostas_missao()
    respostas = dados.get("respostas", [])
    resultados = []
    for i, pergunta in enumerate(etapa["perguntas"]):
        resposta = str(respostas[i] if i < len(respostas) else "")
        esperado = certas[pergunta["chave"]]
        if pergunta["tipo"] == "numero":
            ok = numero_em(resposta) == esperado
        else:
            normal = avaliador.normalizar(resposta)
            esperado_normal = avaliador.normalizar(esperado)
            # aceita o nome completo ou a palavra que diferencia o grupo ("linux")
            ok = esperado_normal in normal or esperado_normal.split()[-1] in normal.split()
        resultados.append({"ok": ok, "dica": "" if ok else pergunta["dica"]})
    return jsonify({"resultados": resultados, "aprovado": all(r["ok"] for r in resultados)})


@app.post("/api/fases/<int:fase_id>/canvas")
def avaliar_canvas(fase_id):
    dados = request.get_json(force=True)
    etapa = buscar_etapa(buscar_fase(fase_id), dados.get("etapa"), "canvas")
    return jsonify(avaliador.avaliar_canvas(dados.get("respostas", {}), etapa))


@app.post("/api/fases/<int:fase_id>/pitch")
def avaliar_pitch(fase_id):
    dados = request.get_json(force=True)
    etapa = buscar_etapa(buscar_fase(fase_id), dados.get("etapa"), "pitch")
    return jsonify(avaliador.avaliar_pitch(dados.get("texto", ""), dados.get("produto", ""), etapa))


@app.get("/api/fases/<int:fase_id>/dashboard")
def conferir_dashboard(fase_id):
    buscar_fase(fase_id)
    return jsonify(simulador.avaliar_dashboard())


@app.get("/api/fases/<int:fase_id>/solucao/<int:indice>")
def mostrar_solucao(fase_id, indice):
    etapa = buscar_fase(fase_id)["etapas"]
    if not 0 <= indice < len(etapa) or "solucao" not in etapa[indice]:
        abort(404)
    caminho = PASTA / "conteudo" / "solucoes" / etapa[indice]["solucao"]
    return jsonify({"arquivo": caminho.name, "codigo": caminho.read_text(encoding="utf-8")})


@app.post("/api/fases/<int:fase_id>/prompt")
def avaliar_prompt(fase_id):
    dados = request.get_json(force=True)
    etapa = buscar_etapa(buscar_fase(fase_id), dados.get("etapa"), "construir_prompt")
    resultado = avaliador.avaliar(dados.get("campos", {}), etapa)
    return jsonify(resultado)


@app.get("/api/ia/status")
def status_ia():
    return jsonify({"ativa": zetsu_ia.ativa()})


@app.post("/api/zetsu/opiniao")
def opiniao_zetsu():
    """Segunda opinião sobre o prompt, usando IA de verdade (opcional). Cada chamada custa: há um limite
    por endereço por hora (LIMITE_IA_POR_HORA)."""
    if not zetsu_ia.ativa():
        abort(503, "IA não configurada.")
    endereco = endereco_de_quem_pede()
    if endereco not in ENDERECOS_LOCAIS and banco.contar(f"ia:{endereco}", 3600) > LIMITE_IA_POR_HORA:
        abort(429, "O Zetsu precisa descansar a voz: tenta a segunda opinião daqui a pouco.")
    dados = request.get_json(force=True)
    if dados.get("tipo") == "pitch":
        texto = zetsu_ia.opinar_sobre_pitch(dados.get("ideia", ""), dados.get("pitch", ""))
    else:
        texto = zetsu_ia.opinar_sobre_prompt(dados.get("cenario", ""), dados.get("prompt", ""))
    return jsonify({"resposta": texto})


@app.get("/api/biblioteca")
def listar_livros():
    """Estantes da biblioteca: só o resumo de cada livro (os capítulos vêm ao abrir)."""
    return jsonify([
        {chave: livro[chave] for chave in ("id", "titulo", "icone", "cor", "estante", "resumo")}
        | {"capitulos": len(livro["capitulos"])}
        for livro in BIBLIOTECA.values()
    ])


@app.get("/api/biblioteca/<livro_id>")
def abrir_livro(livro_id):
    livro = BIBLIOTECA.get(livro_id)
    if not livro:
        abort(404, "Livro não encontrado.")
    return jsonify(livro)


@app.get("/api/praticar/<fonte>/<livro_id>/<int:capitulo>")
def perguntas_do_capitulo(fonte, livro_id, capitulo):
    """O teste rápido do fim de um capítulo: as perguntas de batalha que saem dele (sem o gabarito; quem
    corrige é /api/praticar/corrigir). Só treino: não dá prêmio nem domínio."""
    chave = {"biblioteca": "livro", "carreira": "guia"}.get(fonte)
    if not chave:
        abort(404)
    perguntas = [
        {"ref": f"reino:{p['nivel']}:{i}", "pergunta": p["pergunta"], "opcoes": p["opcoes"], "codigo": p.get("codigo"), "cenario": p.get("cenario")}
        for i, p in enumerate(PERGUNTAS_REINO)
        if (p.get("fonte") or {}).get(chave) == livro_id and p["fonte"].get("capitulo") == capitulo
    ]
    random.shuffle(perguntas)
    return jsonify(perguntas[:3])


@app.post("/api/praticar/corrigir")
def corrigir_pratica():
    dados = request.get_json(silent=True) or {}
    ref = str(dados.get("ref", ""))
    if not ref.startswith("reino:"):
        abort(400, "Pergunta inválida.")
    resultado = corrigir_pergunta(ref, dados.get("resposta"))
    return jsonify({chave: resultado[chave] for chave in ("correta", "resposta_certa", "explicacao")})


@app.get("/api/carreira")
def listar_guias():
    """Sala da Carreira: o resumo de cada guia da Mentora (os capítulos vêm ao abrir)."""
    return jsonify([
        {chave: guia[chave] for chave in ("id", "titulo", "icone", "cor", "movel", "resumo")}
        | {"capitulos": len(guia["capitulos"])}
        for guia in CARREIRA.values()
    ])


@app.get("/api/carreira/<guia_id>")
def abrir_guia(guia_id):
    guia = CARREIRA.get(guia_id)
    if not guia:
        abort(404, "Guia não encontrado.")
    return jsonify(guia)


@app.get("/api/salao")
def endereco_do_salao():
    """Onde fica o Salão (o servidor de tempo real do multijogador, salao.py). Publicado, o nginx passa
    /salao para ele (o navegador monta wss://<site>/salao); no computador, ele roda na porta SALAO_PORTA."""
    if os.environ.get("SALAO_URL"):
        return jsonify({"url": os.environ["SALAO_URL"]})
    if request.headers.get("X-Forwarded-Proto"):
        return jsonify({"url": "/salao"})
    return jsonify({"url": f"ws://{request.host.rsplit(':', 1)[0]}:{os.environ.get('SALAO_PORTA', '5051')}/"})


@app.errorhandler(400)
@app.errorhandler(404)
@app.errorhandler(413)
@app.errorhandler(429)
@app.errorhandler(503)
def erro_json(erro):
    return jsonify({"erro": erro.description}), erro.code


@app.get("/teste-ia")
def teste_ia():
    """Rota simples de teste para confirmar que o servidor está respondendo."""
    return jsonify({"mensagem": "IA a funcionar perfeitamente no RPG IA!"})


if __name__ == "__main__":
    # Só para rodar no próprio computador. O modo debug (recarregar sozinho e o depurador) fica ligado só
    # com FLASK_DEBUG=1: na internet o depurador deixaria qualquer um rodar código no servidor.
    # Publicado, quem sobe o jogo é o servidor WSGI da hospedagem (wsgi.py), não este bloco.
    depurar = os.environ.get("FLASK_DEBUG") == "1"
    # O Salão do multijogador (salao.py) sobe junto, numa linha de execução própria. Com o modo debug, o
    # Flask roda o jogo num processo filho (que reinicia a cada mudança no código): o Salão vai nele.
    # Publicado, ele é um serviço à parte (deploy/rpgia-salao.service). SALAO_DESLIGADO=1 não sobe.
    if os.environ.get("SALAO_DESLIGADO") != "1" and (not depurar or os.environ.get("WERKZEUG_RUN_MAIN") == "true"):
        try:
            import salao

            salao.rodar_em_linha()
        except ImportError as erro:
            print(f"[salao] o multijogador ficou desligado (falta o pacote: {erro.name}; pip install -r requirements.txt)")
    app.run(debug=depurar, port=int(os.environ.get("PORTA", "5050")))
