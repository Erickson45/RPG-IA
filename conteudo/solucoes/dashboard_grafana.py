# Cria um dashboard executivo no Grafana pela API.
# Antes de rodar, no PowerShell:
#   pip install requests
#   $env:ZETSU_TOKEN = "zetsu-treino-2026"
import os

import requests

URL = "http://localhost:5050/simulador/grafana/api/dashboards/db"
TOKEN = os.environ["ZETSU_TOKEN"]


def painel(id_, tipo, titulo, x, y, w, h):
    """Monta um painel. A grade do Grafana tem 24 colunas de largura."""
    return {"id": id_, "type": tipo, "title": titulo, "gridPos": {"x": x, "y": y, "w": w, "h": h}}


dashboard = {
    "dashboard": {
        "title": "Visão Executiva - Monitoramento",
        "panels": [
            # linha 1: os números que o gestor quer ver primeiro
            painel(1, "stat", "Disponibilidade dos serviços (%)", 0, 0, 6, 4),
            painel(2, "stat", "Incidentes críticos no mês", 6, 0, 6, 4),
            painel(3, "stat", "Tempo médio de resolução (h)", 12, 0, 6, 4),
            painel(4, "gauge", "SLA cumprido (%)", 18, 0, 6, 4),
            # linha 2: tendência e comparação
            painel(5, "timeseries", "Problemas por dia", 0, 4, 16, 8),
            painel(6, "barchart", "Problemas por grupo de host", 16, 4, 8, 8),
        ],
    },
    "overwrite": True,
}

resposta = requests.post(
    URL,
    json=dashboard,
    headers={"Authorization": f"Bearer {TOKEN}"},
    timeout=10,
)
print(resposta.status_code, resposta.json())
