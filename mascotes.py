"""Os mascotes do herói: cada um dá atributos (somados aos bônus do equipamento) e tem um poder especial
que age sozinho nas batalhas.

O mascote é o "familiar" do avatar. Os grátis (coruja, gato, raposa, coelho) valem para todo mundo; os de
cosmético (golem, fênix, slime, lobinho, Lume, tartaruga, Cristalino e o Dragão da Academia, exclusivo) só valem se o herói tiver o cosmético
que libera o mascote. Quem comprou a raposa quando ela era vendida ganhou o dragão no lugar.

Poderes (a chance é por rodada):
- ataque: no acerto, chance de tirar 1 de vida a mais do monstro.
- defesa: no erro, chance de o mascote segurar o golpe.
- cura: no acerto, chance de curar 1 de vida do herói.
- renascer: o primeiro erro da batalha nunca machuca.
"""

import random

MASCOTES = {
    "coruja": {
        "nome": "Coruja", "icone": "🦉", "bonus": {"xp": 0.08, "tempo": 2},
        "poder": {"tipo": "ataque", "chance": 0.1, "nome": "Bico Sábio 🦉", "texto": "10% de chance de bicar o monstro (+1 de dano) quando tu acertas."},
    },
    "gato": {
        "nome": "Gato", "icone": "🐈", "bonus": {"sorte": 0.04, "moedas": 0.05},
        "poder": {"tipo": "defesa", "chance": 0.15, "nome": "Sete Vidas 🐈", "texto": "15% de chance de o gato se jogar na frente e o erro não machucar."},
    },
    "dragao": {
        "nome": "Dragão da Academia", "icone": "🐉", "bonus": {"mana": 1},
        "poder": {"tipo": "ataque", "chance": 0.22, "nome": "Baforada 🔥", "texto": "22% de chance de uma baforada de fogo (+1 de dano) quando tu acertas."},
    },
    "golem": {
        "nome": "Mini-golem", "icone": "🗿", "bonus": {"vida": 1},
        "poder": {"tipo": "defesa", "chance": 0.25, "nome": "Pele de Pedra 🗿", "texto": "25% de chance de o golem aguentar o golpe no teu lugar."},
    },
    "fenix": {
        "nome": "Fênix", "icone": "🔥", "bonus": {"xp": 0.05},
        "poder": {"tipo": "renascer", "chance": 1, "nome": "Renascer das Cinzas 🔥", "texto": "O primeiro erro de cada batalha nunca machuca."},
    },
    "raposa": {
        "nome": "Raposa", "icone": "🦊", "bonus": {"moedas": 0.08, "sorte": 0.03},
        "poder": {"tipo": "ataque", "chance": 0.12, "nome": "Mordida Astuta 🦊", "texto": "12% de chance de morder o monstro (+1 de dano) quando tu acertas."},
    },
    "slime": {
        "nome": "Slime de estimação", "icone": "🟢", "bonus": {"vida": 1},
        "poder": {"tipo": "cura", "chance": 0.15, "nome": "Gosma Curativa 💚", "texto": "15% de chance de curar 1 de vida quando tu acertas."},
    },
    "coelho": {
        "nome": "Coelho Lunar", "icone": "🐇", "bonus": {"xp": 0.05, "sorte": 0.02},
        "poder": {"tipo": "cura", "chance": 0.1, "nome": "Luz da Lua 🌙", "texto": "10% de chance de curar 1 de vida quando tu acertas."},
    },
    "lobo": {
        "nome": "Lobinho de Jade", "icone": "🐺", "bonus": {"sorte": 0.04, "moedas": 0.05},
        "poder": {"tipo": "ataque", "chance": 0.15, "nome": "Uivo de Caça 🐺", "texto": "15% de chance de o lobinho morder junto (+1 de dano) quando tu acertas."},
    },
    "lume": {
        "nome": "Lume, o fogo-fátuo", "icone": "🔵", "bonus": {"mana": 1},
        "poder": {"tipo": "ataque", "chance": 0.15, "nome": "Chama Fátua 🔵", "texto": "15% de chance de uma chama azul (+1 de dano) quando tu acertas."},
    },
    "tartaruga": {
        "nome": "Tartaruga Rúnica", "icone": "🐢", "bonus": {"vida": 1, "tempo": 1},
        "poder": {"tipo": "defesa", "chance": 0.22, "nome": "Casco de Runas 🐢", "texto": "22% de chance de o casco aguentar o golpe no teu lugar."},
    },
    "cristal": {
        "nome": "Cristalino", "icone": "💎", "bonus": {"xp": 0.06, "tempo": 1},
        "poder": {"tipo": "ataque", "chance": 0.18, "nome": "Raio Prismático 💎", "texto": "18% de chance de um raio de luz (+1 de dano) quando tu acertas."},
    },
}

# o cosmético que libera cada mascote bloqueado (o slime de estimação tem id diferente)
COSMETICO_DO_MASCOTE = {"golem": "golem", "fenix": "fenix", "dragao": "dragao-academia", "slime": "slime-pet",
                        "lobo": "lobo-pet", "lume": "lume-pet", "tartaruga": "tartaruga-pet", "cristal": "cristal-pet"}
# a raposa já foi vendida na loja: quem comprou ("raposa" nos cosméticos) tem o dragão liberado
LIBERA_TAMBEM = {"dragao-academia": ("raposa",)}


def tem_cosmetico(progresso, cosmetico):
    donos = progresso.get("cosmeticos") or []
    return cosmetico in donos or any(antigo in donos for antigo in LIBERA_TAMBEM.get(cosmetico, ()))


def do_heroi(progresso):
    """O mascote que o herói está usando agora (None se não tem ou se ainda não liberou)."""
    mascote_id = (progresso.get("avatar") or {}).get("familiar")
    mascote = MASCOTES.get(mascote_id)
    if not mascote:
        return None
    cosmetico = COSMETICO_DO_MASCOTE.get(mascote_id)
    if cosmetico and not tem_cosmetico(progresso, cosmetico):
        return None
    return {"id": mascote_id, **mascote}


def bonus(progresso):
    mascote = do_heroi(progresso)
    return mascote["bonus"] if mascote else {}


def poder(progresso, tipo):
    """O poder do mascote dispara nesta rodada? Devolve o nome do poder (para o placar de bônus) ou None."""
    mascote = do_heroi(progresso)
    if not mascote or mascote["poder"]["tipo"] != tipo:
        return None
    return mascote["poder"]["nome"] if random.random() < mascote["poder"]["chance"] else None
