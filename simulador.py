"""Simuladores de Zabbix e Grafana para as missões da Fase 5.

O aluno escreve scripts de verdade (com ajuda da IA) que chamam estas APIs,
sem precisar de um Zabbix ou Grafana instalados. Os dados são fictícios e
sempre os mesmos (semente fixa), então o jogo sabe as respostas certas.
"""

import random
import re
import unicodedata
from collections import Counter
from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request

TOKEN = "zetsu-treino-2026"

simulador = Blueprint("simulador", __name__, url_prefix="/simulador")

GRUPOS = {
    "Servidores Linux": (["srv-app-01", "srv-app-02", "srv-batch-01", "srv-files-01"], 38),
    "Rede": (["sw-core-01", "sw-andar-02", "fw-borda-01"], 20),
    "Servidores Windows": (["win-ad-01", "win-iis-01", "win-print-01"], 18),
    "Banco de Dados": (["db-postgres-01", "db-postgres-02", "db-oracle-01"], 14),
    "Aplicações Web": (["web-portal", "web-api-pagamentos"], 10),
}
TIPOS = ["Disco cheio", "CPU alta", "Memória alta", "Serviço parado", "Host indisponível", "Latência alta"]
SEVERIDADES = ["Informação", "Aviso", "Média", "Alta", "Desastre"]


def _gerar_problemas():
    """Gera 180 problemas nos últimos 60 dias.

    Os dias 29 a 32 ficam vazios de propósito: assim "últimos 30 dias" dá o mesmo
    resultado com qualquer jeito razoável de calcular a data de corte.
    """
    sorteio = random.Random(42)
    hoje = date.today()
    dias_validos = [d for d in range(60) if not 29 <= d <= 32]
    nomes_grupos = list(GRUPOS)
    pesos = [peso for _, peso in GRUPOS.values()]

    problemas = []
    for i in range(180):
        grupo = sorteio.choices(nomes_grupos, weights=pesos)[0]
        dia = hoje - timedelta(days=sorteio.choice(dias_validos))
        inicio = datetime(dia.year, dia.month, dia.day, sorteio.randint(0, 23), sorteio.randint(0, 59))
        problemas.append({
            "eventid": str(10500 + i),
            "host": sorteio.choice(GRUPOS[grupo][0]),
            "grupo": grupo,
            "tipo": sorteio.choice(TIPOS),
            "severidade": sorteio.choice(SEVERIDADES),
            "inicio": inicio.isoformat(timespec="minutes"),
        })
    problemas.sort(key=lambda p: p["inicio"], reverse=True)
    return problemas


PROBLEMAS = _gerar_problemas()
_ultimo_dashboard = {"dados": None}


def problemas_desde(desde):
    return [p for p in PROBLEMAS if p["inicio"] >= desde.isoformat()]


def respostas_missao():
    """As respostas certas da missão de coleta, calculadas dos mesmos dados da API."""
    ultimo_mes = problemas_desde(date.today() - timedelta(days=30))
    por_grupo = Counter(p["grupo"] for p in ultimo_mes)
    return {
        "total": len(ultimo_mes),
        "grupo_mais": por_grupo.most_common(1)[0][0],
        "linux_disco": sum(1 for p in ultimo_mes if p["grupo"] == "Servidores Linux" and p["tipo"] == "Disco cheio"),
    }


def _autorizado():
    cabecalho = request.headers.get("Authorization", "")
    return cabecalho == f"Bearer {TOKEN}"


def _erro_token():
    return jsonify({
        "erro": "Token inválido ou ausente.",
        "dica": "Envie o cabeçalho Authorization: Bearer SEU_TOKEN. O token de treino aparece na missão.",
    }), 401


# ---------- Zabbix simulado ----------

@simulador.get("/api/problemas")
def listar_problemas():
    if not _autorizado():
        return _erro_token()
    resultado = PROBLEMAS
    desde = request.args.get("desde")
    if desde:
        try:
            resultado = problemas_desde(date.fromisoformat(desde))
        except ValueError:
            return jsonify({"erro": "Parâmetro desde inválido. Use o formato AAAA-MM-DD, tipo 2026-10-01."}), 400
    grupo = request.args.get("grupo")
    if grupo:
        resultado = [p for p in resultado if p["grupo"].lower() == grupo.lower()]
    return jsonify({"total": len(resultado), "problemas": resultado})


@simulador.get("/api/grupos")
def listar_grupos():
    if not _autorizado():
        return _erro_token()
    return jsonify({"grupos": list(GRUPOS)})


# ---------- Grafana simulado ----------

def _slug(texto):
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", sem_acento.lower()).strip("-") or "dashboard"


@simulador.post("/grafana/api/dashboards/db")
def criar_dashboard():
    if not _autorizado():
        return jsonify({"message": "Unauthorized. Envie Authorization: Bearer SEU_TOKEN."}), 401
    corpo = request.get_json(silent=True)
    if not isinstance(corpo, dict) or not isinstance(corpo.get("dashboard"), dict):
        return jsonify({"message": "Corpo inválido: envie um JSON com a chave \"dashboard\"."}), 400
    dashboard = corpo["dashboard"]
    if not str(dashboard.get("title", "")).strip():
        return jsonify({"message": "Dashboard title cannot be empty"}), 400

    versao = (_ultimo_dashboard["dados"] or {}).get("version", 0) + 1
    slug = _slug(dashboard["title"])
    _ultimo_dashboard["dados"] = {"dashboard": dashboard, "version": versao, "recebido": datetime.now().isoformat(timespec="seconds")}
    return jsonify({"id": 1, "uid": "zetsu01", "url": f"/d/zetsu01/{slug}", "status": "success", "version": versao, "slug": slug})


def avaliar_dashboard():
    """Confere o último dashboard recebido com as regras de um bom painel executivo."""
    dados = _ultimo_dashboard["dados"]
    if not dados:
        return {"encontrado": False}

    dashboard = dados["dashboard"]
    paineis = [p for p in dashboard.get("panels", []) if isinstance(p, dict) and p.get("type") != "row"]
    tipos = {p.get("type") for p in paineis}

    def posicao(p):
        pos = p.get("gridPos") or {}
        if all(isinstance(pos.get(k), int) for k in ("x", "y", "w", "h")):
            return pos
        return None

    posicoes = [posicao(p) for p in paineis]
    todas_posicionadas = bool(paineis) and all(posicoes)
    sobrepostos = False
    if todas_posicionadas:
        for i, a in enumerate(posicoes):
            for b in posicoes[i + 1:]:
                if a["x"] < b["x"] + b["w"] and b["x"] < a["x"] + a["w"] and a["y"] < b["y"] + b["h"] and b["y"] < a["y"] + a["h"]:
                    sobrepostos = True

    checks = [
        ("O dashboard tem título", bool(str(dashboard.get("title", "")).strip()),
         "Coloque um title, tipo \"Visão Executiva\"."),
        ("Tem pelo menos 4 painéis", len(paineis) >= 4,
         f"Encontrei {len(paineis)}. Um painel executivo precisa de pelo menos 4 informações."),
        ("Todo painel tem título", bool(paineis) and all(str(p.get("title", "")).strip() for p in paineis),
         "Gestor não adivinha: cada painel precisa dizer o que mostra."),
        ("Tem número em destaque (stat ou gauge)", bool(tipos & {"stat", "gauge"}),
         "KPI bom é número grande: use um painel do tipo stat ou gauge."),
        ("Tem gráfico (timeseries, barchart ou piechart)", bool(tipos & {"timeseries", "barchart", "piechart", "graph"}),
         "Mostre uma tendência ou comparação com um painel timeseries ou barchart."),
        ("Todo painel tem posição (gridPos com x, y, w, h)", todas_posicionadas,
         "Sem gridPos o Grafana empilha tudo. Cada painel precisa de x, y, w e h."),
        ("Nenhum painel passa da largura (x + w até 24)", todas_posicionadas and all(p["x"] + p["w"] <= 24 for p in posicoes),
         "A grade do Grafana tem 24 colunas. Confere os x e w."),
        ("Nenhum painel em cima do outro", todas_posicionadas and not sobrepostos,
         "Tem painel sobreposto. Ajuste os y para empilhar as linhas."),
    ]
    return {
        "encontrado": True,
        "recebido": dados["recebido"],
        "versao": dados["version"],
        "titulo": dashboard.get("title", ""),
        "paineis": [{"id": p.get("id"), "titulo": p.get("title", ""), "tipo": p.get("type", "?"), "pos": posicao(p)} for p in paineis],
        "checks": [{"descricao": d, "ok": ok, "dica": "" if ok else dica} for d, ok, dica in checks],
        "aprovado": all(ok for _, ok, _ in checks),
    }
