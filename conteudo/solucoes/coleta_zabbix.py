# Levantamento de problemas do último mês, por grupo de host e tipo.
# Antes de rodar, no PowerShell:
#   pip install requests
#   $env:ZETSU_TOKEN = "zetsu-treino-2026"
import os
from collections import Counter
from datetime import date, timedelta

import requests

URL = "http://localhost:5050/simulador/api/problemas"
TOKEN = os.environ["ZETSU_TOKEN"]  # o token vem do ambiente, nunca escrito no código

# "último mês" = últimos 30 dias
desde = (date.today() - timedelta(days=30)).isoformat()

resposta = requests.get(
    URL,
    params={"desde": desde},
    headers={"Authorization": f"Bearer {TOKEN}"},
    timeout=10,
)
resposta.raise_for_status()  # para o script se a API devolver erro
problemas = resposta.json()["problemas"]

print(f"Problemas desde {desde}: {len(problemas)}\n")

print("Por grupo de host:")
for grupo, quantidade in Counter(p["grupo"] for p in problemas).most_common():
    print(f"  {grupo:<22} {quantidade}")

print("\nPor grupo e tipo de problema:")
por_grupo_e_tipo = Counter((p["grupo"], p["tipo"]) for p in problemas)
for (grupo, tipo), quantidade in sorted(por_grupo_e_tipo.items()):
    print(f"  {grupo:<22} {tipo:<20} {quantidade}")
