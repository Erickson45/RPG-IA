"""A Casa da Forja: os monstros soltam materiais, a receita cobra tudo certinho e o visual forjado vira do herói.

Uso (da raiz do projeto):  python testes/testar_forja.py .
Usa um banco à parte (num arquivo temporário): não toca o banco do jogo.
"""

import os
import random
import sys
import tempfile
from collections import Counter

RAIZ = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
sys.path.insert(0, RAIZ)
os.chdir(RAIZ)
os.environ["BANCO_ARQUIVO"] = os.path.join(tempfile.mkdtemp(), "forja-teste.db")

import app as aplicacao  # noqa: E402
import equipamento  # noqa: E402
from conteudo import ITENS, MATERIAIS, MONSTROS  # noqa: E402

falhas = []


def conferir(ok, texto):
    print(("  ok   " if ok else "  FALHOU ") + texto)
    if not ok:
        falhas.append(texto)


forjados = [c for c in ITENS["cosmeticos"] if c.get("forja")]
print("catálogo")
por_kit = Counter(c.get("kit") or "todos" for c in forjados)
conferir(len(forjados) >= 300, f"{len(forjados)} itens forjáveis")
for kit in ("mago", "guerreiro", "arqueiro"):
    conferir(por_kit[kit] + por_kit["todos"] > 100, f"{kit}: {por_kit[kit] + por_kit['todos']} itens para forjar")
conferir(all(m in MATERIAIS for c in forjados for m in c["forja"]["materiais"]), "toda receita usa materiais que existem")
for c in forjados:
    for chave, valor in c["bonus"].items():
        assert valor <= equipamento.TETOS[chave], c["id"]
conferir(True, "nenhum bônus passa do teto")
caindo = {m for t in MONSTROS.values() for m in equipamento.MATERIAIS_DA_REGIAO.get(t.get("regiao"), {}).values()}
conferir(all(m in caindo or MATERIAIS[m]["tier"] == "mitico" for m in MATERIAIS), "todo material cai de algum monstro")

print("drops")
progresso = {"avatar": {}, "cosmeticos": []}
random.seed(7)
fraco = next(t for t in MONSTROS.values() if t["regiao"] == "campos" and t["forca"] == "Fraco")
soma = Counter()
for _ in range(400):
    soma.update(equipamento.sortear_materiais(progresso, fraco))
conferir(soma["gosma-slime"] > 250, f"slime fraco solta gosma quase sempre ({soma['gosma-slime']} em 400)")
conferir(0 < soma["nucleo-slime"] < 60, f"o núcleo é raro ({soma['nucleo-slime']} em 400)")
chefe = MONSTROS["reiSlime"]
conferir(equipamento.sortear_materiais(progresso, chefe).get("coroa-gosmenta") == 3, "o Rei Slime deixa 3 essências")

print("forjar pela API")
cliente = aplicacao.app.test_client()
r = cliente.post("/api/jogador", json={"progresso": {"nome": "TesteClaude Forja", "avatar": {"kit": "mago"}}})
jid = r.get_json()["id"]
print("  herói de teste:", jid)
try:
    import banco
    from jogador import carregar
    alvo = next(c for c in forjados if c["id"] == "forja-carvalho-mago-cajado")
    r = cliente.post(f"/api/jogador/{jid}/forjar", json={"item": alvo["id"]})
    conferir(r.status_code == 400 and "Faltam materiais" in r.get_json().get("erro", r.get_data(as_text=True)), "sem material, a bigorna recusa")
    p = carregar(jid)
    p["materiais"] = {"gosma-slime": 9}
    p["moedas"] = 1000
    banco.salvar_progresso(jid, p)
    r = cliente.post(f"/api/jogador/{jid}/forjar", json={"item": alvo["id"]})
    estado = r.get_json().get("estado", {})
    conferir(r.status_code == 200 and alvo["id"] in estado.get("cosmeticos", []), "forjou o Cajado de Carvalho")
    conferir(estado.get("materiais", {}).get("gosma-slime") == 9 - alvo["forja"]["materiais"]["gosma-slime"], "gastou a gosma da receita")
    conferir(estado.get("moedas") == 1000 - alvo["forja"]["moedas"], "cobrou as moedas")
    r = cliente.post(f"/api/jogador/{jid}/forjar", json={"item": alvo["id"]})
    conferir(r.status_code == 400, "não forja duas vezes a mesma peça")
    r = cliente.post(f"/api/jogador/{jid}/forjar", json={"item": "pocao"})
    conferir(r.status_code == 400, "consumível não sai da bigorna")
    # o navegador não consegue inventar materiais: o campo é do servidor
    cliente.put(f"/api/jogador/{jid}/progresso", json={"local": "reino", "materiais": {"fragmento-oraculo": 99}})
    conferir(carregar(jid)["materiais"].get("fragmento-oraculo", 0) == 0, "materiais vindos do navegador são ignorados")
    # vestir a peça dá o bônus dela
    p = carregar(jid)
    p["avatar"] = {**p["avatar"], "item": alvo["avatar"]["item"]}
    conferir(equipamento.bonus(p)["xp"] >= alvo["bonus"]["xp"], "o cajado forjado vestido dá o bônus")
finally:
    banco.apagar_jogador(jid)
    print("  herói de teste apagado:", jid)

print()
print("TUDO CERTO" if not falhas else f"{len(falhas)} FALHA(S): {falhas}")
sys.exit(1 if falhas else 0)
