"""Gera conteudo/forja.json: os materiais que os monstros soltam e os itens da Casa da Forja.

Cada item forjado é uma variação de cor de um desenho-base do herói (arma, chapéu) ou uma cor de manto, com o
efeito de partículas e o bônus da raridade (os mesmos tetos do equipamento.py). São 19 linhagens (temas), uma
ou duas por região, e cada linhagem tem as peças das três classes e o manto:

    mago:      cajado, varinha, grimório, orbe, chapéu pontudo, capuz
    guerreiro: espada, espada e escudo, machado, martelo, elmo, bandana
    arqueiro:  arco, arco longo, besta, chapéu de caçador, capuz, bandana
    todos:     manto

19 x (6 + 6 + 6 + 1) = 361 itens, 133 para cada classe. Rodar de novo depois de mudar algo aqui:

    python gerar_forja.py
"""

import json
import math
from pathlib import Path

RAIZ = Path(__file__).resolve().parent

# ---------- os materiais: comum, raro e a essência de cada região, mais o Fragmento do Oráculo ----------
MATERIAIS = {
    "campos": [("gosma-slime", "Gosma de Slime", "🟢", "Pegajosa e morna. Os slimes dos Campos soltam aos montes."),
               ("nucleo-slime", "Núcleo de Slime", "💠", "O coraçãozinho cristalino de um slime. Brilha quando alguém pensa."),
               ("coroa-gosmenta", "Coroa Gosmenta", "👑", "Um pedaço da coroa do Rei Slime. Ainda treme sozinha.")],
    "floresta": [("pelo-lobo", "Pelo de Lobo", "🐾", "Pelo grosso e prateado dos lobos da Floresta Uivante."),
                 ("presa-nevoa", "Presa da Névoa", "🦷", "Fria ao toque. Dizem que corta até a dúvida."),
                 ("uivo-fenrir", "Uivo de Fenrir", "🌕", "Um uivo preso numa pedra de lua. Quem segura ouve a floresta inteira.")],
    "pantano": [("lodo-brejo", "Lodo do Brejo", "🫧", "Lama do Pântano das Alucinações. Cheira a resposta inventada."),
                ("fatuo-engarrafado", "Fogo-Fátuo Engarrafado", "🕯️", "Uma luzinha que mente: mostra o caminho errado com toda a certeza."),
                ("lagrima-sapo-rei", "Lágrima do Sapo Rei", "💧", "Verde-ouro e pesada. O Sapo Rei só chora quando perde.")],
    "deserto": [("areia-bug", "Areia de Bug", "⏳", "Cada grão é um errinho de digitação. Juntos, viram vidro."),
                ("osso-compilado", "Osso Compilado", "🦴", "Osso de esqueleto que passou em todos os testes."),
                ("ferrao-imperial", "Ferrão Imperial", "🦂", "O ferrão dourado do Escorpião Imperador. Ainda pinga veneno de sol.")],
    "montanhas": [("minerio-montanha", "Minério da Montanha", "🪨", "Pedra escura das Montanhas do Dragão, cheia de veios de ferro."),
                  ("escama-dragao", "Escama de Dragão", "🐲", "Quente como brasa e dura como certeza. Os dragões trocam de escama no inverno."),
                  ("coracao-ignis", "Coração de Ignis", "❤️‍🔥", "Uma brasa que nunca apaga, do peito do Dragão Rei.")],
    "fenda": [("sombra-partida", "Sombra Partida", "🌑", "Um pedaço de sombra que não pertence a ninguém."),
              ("eco-ruptura", "Eco da Ruptura", "🌀", "O som da Grande Ruptura, preso num redemoinho."),
              ("coracao-sombra", "Coração da Sombra", "🖤", "O que sobra quando a Sombra da Fenda se desfaz.")],
    "cinzas": [("cinza-ardente", "Cinza Ardente", "🌋", "Cinza dos Ermos que ainda queima por dentro."),
               ("escama-salamandra", "Escama de Salamandra", "🦎", "Muda de cor com o calor, como um prompt mal escrito."),
               ("nucleo-magma", "Núcleo de Magma", "🔥", "O coração derretido do Colosso de Magma.")],
    "cristais": [("po-cristal", "Pó de Cristal", "✨", "Brilha em todas as cores. Os aprendizes usam para marcar páginas."),
                 ("seda-cristal", "Seda de Cristal", "🕸️", "Fio da Aranha de Cristal: mais fino que cabelo, mais forte que aço."),
                 ("lagrima-rainha", "Lágrima da Rainha", "💎", "Uma lágrima perfeita da Rainha de Cristal. Reflete quem olha.")],
    "abismo": [("lodo-abissal", "Lodo Abissal", "🌊", "Negro e frio. Puxa a luz para dentro."),
               ("olho-vazio", "Olho do Vazio", "👁️", "Ainda pisca. Às vezes."),
               ("escama-leviata", "Escama do Leviatã", "🐋", "Do tamanho de um escudo, pesada como o fundo do mar.")],
    "geleira": [("gelo-silencio", "Gelo do Silêncio", "🧊", "Quem segura esquece o barulho do mundo por um instante."),
                ("uivo-congelado", "Uivo Congelado", "❄️", "O último uivo do Lobo do Silêncio, preso no gelo."),
                ("coracao-ymir", "Coração de Ymir", "💙", "Bate uma vez por hora. Gelado, mas vivo.")],
    "trono": [("po-vazio", "Pó do Vazio", "🌌", "Cheio de estrelas apagadas."),
              ("asa-wyvern", "Asa de Wyvern", "🦇", "Couro fino como papel e escuro como a noite sem lua."),
              ("coroa-vazio", "Coroa do Vazio", "♛", "Um pedaço da coroa do Trono. Pesa como uma pergunta sem resposta.")],
}
FRAGMENTO = ("fragmento-oraculo", "Fragmento do Oráculo", "✴️",
             "Um caco do Oráculo de Malakar. Sozinho não responde nada: só faz pensar. É o material mais raro de Elyndor.")
TIERS = ("comum", "raro", "essencia")
RARIDADE_DO_TIER = {"comum": "comum", "raro": "raro", "essencia": "epico", "mitico": "lendario"}

# ---------- as peças ----------
PECAS = {
    "mago": [("cajado", "item", "Cajado", "🪄"), ("varinha", "item", "Varinha", "✨"), ("grimorio", "item", "Grimório", "📕"),
             ("orbe", "item", "Orbe", "🔮"), ("pontudo", "chapeu", "Chapéu", "🎩"), ("capuz", "chapeu", "Capuz", "🧙")],
    "guerreiro": [("espadaFerro", "item", "Espada", "🗡️"), ("espadaEscudo", "item", "Espada e Escudo", "🛡️"),
                  ("machado", "item", "Machado", "🪓"), ("martelo", "item", "Martelo", "🔨"),
                  ("elmoFerro", "chapeu", "Elmo", "⛑️"), ("bandana", "chapeu", "Bandana", "🎗️")],
    "arqueiro": [("arco", "item", "Arco", "🏹"), ("arcoElfico", "item", "Arco Longo", "🏹"), ("besta", "item", "Besta", "🎯"),
                 ("cacador", "chapeu", "Chapéu de Caçador", "🤠"), ("capuz", "chapeu", "Capuz", "🧝"), ("bandana", "chapeu", "Bandana", "🎗️")],
}

# quais letras da paleta de cada desenho-base levam cada papel do tema
# papéis: metal (claro, médio, brilho), madeira (clara, escura), gema (1, clara, escura), detalhe (1, 2),
# pano (1, 2, claro, sombra), brilho
LETRAS = {
    "cajado": {"B": "madeira1", "b": "madeira2", "D": "detalhe1", "G": "gema1", "g": "gema2", "X": "gema3", "W": "brilho"},
    "varinha": {"B": "madeira1", "b": "madeira2", "G": "gema1", "g": "gema2"},
    "grimorio": {"R": "pano1", "b": "pano4", "D": "detalhe1", "G": "gema1", "g": "gema2", "X": "gema3"},
    "orbe": {"G": "gema1", "g": "gema2", "X": "gema3", "W": "brilho"},
    "espadaFerro": {"w": "metal3", "A": "metal1", "a": "metal2", "b": "madeira2", "B": "madeira1"},
    "espadaEscudo": {"M": "pano1", "n": "pano3", "D": "detalhe1", "a": "metal2", "A": "metal1"},
    "machado": {"A": "metal1", "a": "metal2", "w": "metal3", "B": "madeira1", "b": "madeira2"},
    "martelo": {"A": "metal1", "a": "metal2", "w": "metal3", "D": "detalhe1", "B": "madeira1", "b": "madeira2"},
    "arco": {"B": "madeira1", "b": "madeira2", "J": "brilho", "Z": "brilho", "D": "detalhe1"},
    "arcoElfico": {"G": "gema1", "g": "gema2", "c": "metal1", "C": "metal2", "D": "detalhe1"},
    "besta": {"a": "metal2", "A": "metal1", "R": "gema1", "B": "madeira1", "b": "madeira2", "c": "metal3"},
    "pontudo": {"M": "pano1", "m": "pano2", "n": "pano3", "V": "pano4", "D": "detalhe1", "d": "detalhe2", "Q": "brilho", "G": "gema1", "X": "gema3"},
    "capuz": {"M": "pano1", "m": "pano2", "n": "pano3", "V": "pano4", "D": "detalhe1", "Y": "detalhe1"},
    "elmoFerro": {"A": "metal1", "a": "metal2", "w": "metal3", "B": "pano1", "b": "pano2"},
    "bandana": {"D": "pano1", "d": "pano2", "Q": "detalhe1"},
    "cacador": {"M": "pano1", "m": "pano2", "n": "pano3", "Q": "gema1", "D": "detalhe1", "d": "detalhe2"},
}


def paleta(metal, madeira, gema, detalhe, pano, brilho):
    return {
        "metal1": metal[0], "metal2": metal[1], "metal3": metal[2], "madeira1": madeira[0], "madeira2": madeira[1],
        "gema1": gema[0], "gema2": gema[1], "gema3": gema[2], "detalhe1": detalhe[0], "detalhe2": detalhe[1],
        "pano1": pano[0], "pano2": pano[1], "pano3": pano[2], "pano4": pano[3], "brilho": brilho,
    }


# ---------- as 19 linhagens ----------
# id, nome da linhagem, região, raridade, efeito (tipo, "r, g, b") ou None, cor do manto, paleta, parceira
# (a outra região que entra na receita), frases do lore e, nos lendários, o nome próprio de cada arma
TEMAS = [
    dict(id="carvalho", nome="de Carvalho dos Campos", regiao="campos", raridade="comum", efeito=None, manto="#6b8e23",
         paleta=paleta(("#b08d57", "#7a5a2b", "#e0c590"), ("#8b5a2b", "#5c3418"), ("#7dff9a", "#d4ffe0", "#2e8b57"),
                       ("#c9952a", "#7a5a12"), ("#6b8e23", "#4a6418", "#8db040", "#2a3a0e"), "#fff3b0"),
         lore=["Madeira simples dos Campos de Elyndor, presa com bronze.", "Feito para quem está começando: leve, honesto e confiável.",
               "O primeiro passo de toda lenda é uma peça humilde."]),
    dict(id="lua-uivante", nome="da Lua Uivante", regiao="floresta", raridade="comum", efeito=None, manto="#4a4a6a",
         paleta=paleta(("#c9cbe0", "#8a8b99", "#ffffff"), ("#5a4a3a", "#3a2a1a"), ("#9fd4ff", "#e6fdff", "#4f6fbf"),
                       ("#8a8b99", "#5a5b68"), ("#4a4a6a", "#2e2e4a", "#6a6a8a", "#1b1b33"), "#e6fdff"),
         lore=["Prata dos lobos da Floresta Uivante, polida ao luar.", "Brilha um pouco mais nas noites de lua cheia.",
               "Os caçadores de Pinhalva juram que dá para ouvir um uivo baixinho."]),
    dict(id="gosma-real", nome="da Gosma Real", regiao="campos", raridade="raro", efeito=("bolha", "125, 255, 154"), manto="#3f9a4a",
         paleta=paleta(("#7dd87a", "#3f9a4a", "#d4ffd0"), ("#4c9a2a", "#2f6e1c"), ("#6ef0b0", "#d0fff0", "#2e8b57"),
                       ("#f5c451", "#c9952a"), ("#3f9a4a", "#2a6e32", "#6cc070", "#163a1a"), "#d4ffd0"),
         lore=["Gosma de slime endurecida no forno da Forja. Treme quando alguém acerta.",
               "Solta bolhinhas quando o dono está pensando. Muitas bolhinhas.", "O Rei Slime jamais aprovaria. Por isso é tão bonito."]),
    dict(id="nevoa", nome="da Névoa Prateada", regiao="floresta", raridade="raro", efeito=("fumaca", "210, 220, 240"), manto="#5a6a8a",
         paleta=paleta(("#e6e8f5", "#a3a6c2", "#ffffff"), ("#3a3f4b", "#23262e"), ("#c8d6ff", "#ffffff", "#7a8ab8"),
                       ("#e6e8f5", "#8a8b99"), ("#5a6a8a", "#3a4a6a", "#7a8aaa", "#22304a"), "#ffffff"),
         lore=["Forjado com as presas dos lobos da névoa. Uma bruma fina nunca sai de perto.",
               "Some e aparece na névoa como o Lobo Alfa.", "Quem usa enxerga através da neblina das perguntas difíceis."]),
    dict(id="brejo", nome="do Brejo Alucinado", regiao="pantano", raridade="raro", efeito=("bolha", "194, 123, 160"), manto="#2f5e1a",
         paleta=paleta(("#6aa84f", "#38761d", "#b6d7a8"), ("#4a3a2a", "#2a1f14"), ("#c27ba0", "#ead1dc", "#741b47"),
                       ("#b38cff", "#5a3aa6"), ("#38761d", "#274e13", "#6aa84f", "#162b0a"), "#ead1dc"),
         lore=["Lodo do Pântano das Alucinações, curado até perder a mania de inventar coisas.",
               "Às vezes mostra uma resposta que não existe. Confere sempre a fonte!", "Borbulha baixinho, como o brejo à noite."]),
    dict(id="dunas", nome="das Dunas de Qadir", regiao="deserto", raridade="raro", efeito=("areia", "240, 200, 120"), manto="#c9955b",
         paleta=paleta(("#e0c590", "#b08d57", "#fff3d0"), ("#c46a1b", "#7a3d0e"), ("#ff9f43", "#ffe0b0", "#c46a1b"),
                       ("#f5c451", "#c9952a"), ("#d9a05b", "#a8703a", "#f0c890", "#6a4520"), "#fff3d0"),
         lore=["Areia de bug derretida em vidro dourado, do jeito que os mestres de Qadir ensinam.",
               "Um rastro de areia fina segue o dono por onde ele anda.", "Feito sob o sol do Deserto dos Bugs, que não perdoa erro de digitação."]),
    dict(id="fatuo", nome="do Fogo-Fátuo", regiao="pantano", raridade="epico", efeito=("faisca", "110, 240, 255"), manto="#1f4a4a",
         parceira="floresta",
         paleta=paleta(("#6ef0ff", "#2e7bd0", "#e6fdff"), ("#1f3a3a", "#0f2020"), ("#6ef0ff", "#e6fdff", "#1f7a8a"),
                       ("#7dff9a", "#2e8b57"), ("#1f4a4a", "#0f2f2f", "#2f6a6a", "#081a1a"), "#e6fdff"),
         lore=["Fogos-fátuos presos em vidro azul. Eles mentem, mas aqui dentro só iluminam.",
               "Brilha como as luzinhas do pântano, mas aponta o caminho certo.", "Faíscas frias dançam em volta, sem queimar ninguém."]),
    dict(id="farao", nome="do Faraó Compilado", regiao="deserto", raridade="epico", efeito=("runa", "245, 196, 81"), manto="#1b4d8a",
         parceira="pantano",
         paleta=paleta(("#f5c451", "#c9952a", "#fff3b0"), ("#1b4d6a", "#0f2f45"), ("#2e7bd0", "#9fd4ff", "#1b3f7a"),
                       ("#2e7bd0", "#1b3f7a"), ("#1b4d6a", "#0f2f45", "#2e6e9a", "#081a2a"), "#fff3b0"),
         lore=["Ouro e lápis-lazúli das tumbas do deserto, com runas que compilam sozinhas.",
               "Os esqueletos compiladores se curvam quando veem este brilho.", "Escrito nas runas: \"testado e aprovado, há mil anos\"."]),
    dict(id="runico", nome="de Ferro Rúnico", regiao="montanhas", raridade="epico", efeito=("runa", "110, 240, 255"), manto="#2f3e5c",
         parceira="deserto",
         paleta=paleta(("#8a93a8", "#4a5268", "#c4cbd8"), ("#3a3f4b", "#23262e"), ("#6ef0ff", "#e6fdff", "#2e7bd0"),
                       ("#6ef0ff", "#2e7bd0"), ("#3a4a6a", "#23304a", "#5a6a8a", "#141c2e"), "#e6fdff"),
         lore=["Ferro das Montanhas do Dragão, gravado com runas que acendem a cada acerto.",
               "Os anões de Picogelo levaram três invernos para aprender estas runas.", "Pesado na mão, leve na cabeça."]),
    dict(id="silencio", nome="do Gelo do Silêncio", regiao="geleira", raridade="epico", efeito=("neve", "200, 230, 255"), manto="#5a8ac8",
         parceira="abismo",
         paleta=paleta(("#e6fdff", "#9fd4ff", "#ffffff"), ("#4f6fbf", "#2e4a8a"), ("#9fd4ff", "#ffffff", "#4fa8ff"),
                       ("#c8e6ff", "#7aa8d9"), ("#6a9ad9", "#3f6aa8", "#9fc4f0", "#1f3a6a"), "#ffffff"),
         lore=["Gelo da Geleira do Silêncio que nunca derrete. Em volta, neva sempre um pouquinho.",
               "Quem usa pensa com calma: o barulho do mundo some.", "Ymir dormia em cima deste gelo."]),
    dict(id="ruptura", nome="da Ruptura", regiao="fenda", raridade="epico", efeito=("vazio", "200, 140, 255"), manto="#33196a",
         parceira="montanhas",
         paleta=paleta(("#7a5ad1", "#3b2680", "#c9b0ff"), ("#1b1533", "#0b0918"), ("#d07bff", "#f3e0ff", "#7a3fd1"),
                       ("#d07bff", "#7a3fd1"), ("#33196a", "#1b1238", "#4a3290", "#0b0918"), "#f3e0ff"),
         lore=["Forjado com a sombra da Fenda. A luz em volta é puxada para dentro.",
               "Guarda o eco da Grande Ruptura: quem encosta ouve o Oráculo se partindo.", "Não é deste mundo. Nem do outro."]),
    dict(id="brasa", nome="da Brasa Eterna", regiao="cinzas", raridade="epico", efeito=("brasa", "255, 122, 26"), manto="#5a2a12",
         parceira="fenda",
         paleta=paleta(("#5a5a66", "#2b2b35", "#9a9bab"), ("#3d220e", "#2a1608"), ("#ff7a1a", "#ffd166", "#c0392b"),
                       ("#ff9f43", "#c46a1b"), ("#5a2a12", "#2a160a", "#7a3a1a", "#1a0a04"), "#ffd166"),
         lore=["Ferro negro dos Ermos de Cinza, com brasas vivas presas nas rachaduras.",
               "Nunca esfria. Os ferreiros usam luvas de três camadas.", "Solta brasas a cada passo, como o chão dos Ermos."]),
    dict(id="prisma", nome="do Cristal Prismático", regiao="cristais", raridade="epico", efeito=("faisca", "255, 122, 217"), manto="#9a4ac8",
         parceira="cinzas",
         paleta=paleta(("#ff9fe0", "#c45aa8", "#ffe6f7"), ("#6a4a8a", "#3f2a5a"), ("#6ef0ff", "#ffffff", "#ff7ad9"),
                       ("#b38cff", "#6c48c9"), ("#8a4ab8", "#5a2a85", "#b07ad9", "#2e1450"), "#ffe6f7"),
         lore=["Cristal do Bosque de Cristal, cortado para partir a luz em todas as cores.",
               "Cada faísca é uma cor diferente. Ninguém nunca contou todas.", "A Aranha de Cristal teceu os fios deste brilho."]),
    dict(id="dragao", nome="da Escama de Dragão", regiao="montanhas", raridade="lendario", efeito=("brasa", "255, 106, 40"), manto="#8a1414",
         parceira="deserto",
         paleta=paleta(("#d9442f", "#7b1010", "#ff9a7a"), ("#2b1810", "#1a0e08"), ("#ffd166", "#fff3b0", "#ff7a1a"),
                       ("#f5c451", "#c9952a"), ("#8a1010", "#5c0808", "#c0392b", "#330404"), "#fff3b0"),
         lore=["Escamas de dragão rubro, forjadas no bafo de Ignis. Pesa como uma montanha e queima como o céu do norte.",
               "Dizem que Ignis ainda reconhece as próprias escamas, e respeita quem as usa.",
               "O fogo dentro nunca apaga: é o fôlego de um Dragão Rei."],
         nomes={"cajado": "Ignifax", "varinha": "Fagulha de Ignis", "grimorio": "Códex Draconis", "orbe": "Olho de Ignis",
                "espadaFerro": "Presa do Dragão Rei", "espadaEscudo": "Égide Escarlate", "machado": "Ceifa-Escamas",
                "martelo": "Bigorna do Vulcão", "arco": "Asa Rubra", "arcoElfico": "Sopro de Ignis", "besta": "Garra Flamejante"}),
    dict(id="fenix", nome="da Fênix das Cinzas", regiao="cinzas", raridade="lendario", efeito=("chama", "255, 170, 60"), manto="#d9381e",
         parceira="montanhas",
         paleta=paleta(("#ffd166", "#ff7a1a", "#fff3b0"), ("#c0392b", "#7b1010"), ("#ff4d1a", "#ffd166", "#a8100a"),
                       ("#fff3b0", "#f5c451"), ("#d9381e", "#9a1f10", "#ff7a3a", "#5a0a04"), "#fff3b0"),
         lore=["Nasceu das cinzas do Colosso de Magma. Cada vez que o dono cai, a chama volta mais forte.",
               "Pena de fogo e ouro derretido. Arde, mas não machuca quem tem coragem.",
               "Cair, aprender, renascer: está gravado por dentro."],
         nomes={"cajado": "Renascença", "varinha": "Pena de Fênix", "grimorio": "Livro das Cinzas", "orbe": "Coração de Fênix",
                "espadaFerro": "Aurora Ardente", "espadaEscudo": "Asa Protetora", "machado": "Lâmina do Renascer",
                "martelo": "Martelo do Sol Nascente", "arco": "Voo da Fênix", "arcoElfico": "Canção das Brasas", "besta": "Chama Eterna"}),
    dict(id="rainha", nome="da Rainha de Cristal", regiao="cristais", raridade="lendario", efeito=("estrela", "230, 250, 255"), manto="#b8dcf5",
         parceira="geleira",
         paleta=paleta(("#e6fdff", "#9fd4ff", "#ffffff"), ("#c9cbe0", "#8a8b99"), ("#ffffff", "#e6fdff", "#6ef0ff"),
                       ("#ff9fe0", "#c45aa8"), ("#c8e6ff", "#8ab6e0", "#e6f4ff", "#4a6a8a"), "#ffffff"),
         lore=["Feito das lágrimas da Rainha de Cristal: puro, frio e brilhante como uma ideia clara.",
               "Estrelinhas acendem e apagam em volta, como pensamentos.", "A Rainha deu sua lágrima a quem a venceu com a verdade."],
         nomes={"cajado": "Cetro da Rainha", "varinha": "Lasca Estelar", "grimorio": "Tomo Prismático", "orbe": "Lágrima Cristalina",
                "espadaFerro": "Gládio de Diamante", "espadaEscudo": "Muralha de Cristal", "machado": "Partidora de Prismas",
                "martelo": "Malho Cristalino", "arco": "Arco-Íris Real", "arcoElfico": "Seda de Luz", "besta": "Estilhaço Real"}),
    dict(id="abissal", nome="do Abismo", regiao="abismo", raridade="lendario", efeito=("fumaca", "63, 240, 192"), manto="#0f2a3a",
         parceira="cristais",
         paleta=paleta(("#2f5a6a", "#0b1a24", "#5fa0b0"), ("#0b1a24", "#050d12"), ("#3ff0c0", "#c0fff0", "#1f8a7a"),
                       ("#3ff0c0", "#1f8a7a"), ("#0f2a3a", "#06151f", "#1f4a5a", "#020a0f"), "#c0fff0"),
         lore=["Escama do Leviatã e lodo das profundezas. Uma maré verde-escura sobe em volta.",
               "Lá no fundo do Brejo do Abismo, a luz é verde e fria assim.", "Pesa como o mar inteiro, mas flutua na mão de quem merece."],
         nomes={"cajado": "Âncora do Abismo", "varinha": "Maré Negra", "grimorio": "Tomo das Profundezas", "orbe": "Pérola do Leviatã",
                "espadaFerro": "Lâmina das Fossas", "espadaEscudo": "Casco do Leviatã", "machado": "Quebra-Ondas",
                "martelo": "Peso das Profundezas", "arco": "Arco da Maré", "arcoElfico": "Canto Abissal", "besta": "Arpão do Leviatã"}),
    dict(id="vazio", nome="do Trono do Vazio", regiao="trono", raridade="lendario", efeito=("raio", "210, 150, 255"), manto="#140c30",
         parceira="geleira",
         paleta=paleta(("#3a2d6a", "#140c30", "#8a7ab8"), ("#2b1d5c", "#140c30"), ("#e07bff", "#ffffff", "#8a2fd1"),
                       ("#f5c451", "#c9952a"), ("#140c30", "#0b0918", "#2b1d5c", "#05030a"), "#f3e0ff"),
         lore=["Forjado com a coroa partida do Trono do Vazio. Raios roxos estalam em volta.",
               "Nyxar voava com escamas desta cor. Agora elas protegem quem pensa por conta própria.",
               "O Vazio queria uma mente só. Esta peça prefere mil."],
         nomes={"cajado": "Cetro do Vazio", "varinha": "Fio do Nada", "grimorio": "Grimório da Mente Única", "orbe": "Olho de Nyxar",
                "espadaFerro": "Eclipse", "espadaEscudo": "Bastião do Trono", "machado": "Devoradora de Estrelas",
                "martelo": "Martelo do Silêncio Final", "arco": "Asa de Nyxar", "arcoElfico": "Sussurro do Vazio", "besta": "Ferrão do Eclipse"}),
    dict(id="aurora", nome="da Aurora do Saber", regiao="todas", raridade="lendario", efeito=("estrela", "255, 230, 140"), manto="#f7f0dc",
         mitico=True,
         paleta=paleta(("#ffffff", "#f5c451", "#fff3b0"), ("#f3ead2", "#c9b98a"), ("#ff7ad9", "#ffffff", "#6ef0ff"),
                       ("#f5c451", "#c9952a"), ("#f3ead2", "#c9b98a", "#ffffff", "#8a7a4a"), "#fff3b0"),
         lore=["Feito com os Fragmentos do Oráculo, juntados de novo. Não responde nada: ensina a perguntar.",
               "A peça mais rara de Elyndor. Cada pedaço veio de um canto diferente do Reino e de Umbraterra.",
               "Malakar quis uma mente que respondesse tudo. Esta peça é o contrário: uma mente que pensa."],
         nomes={"cajado": "Cajado do Primeiro Porquê", "varinha": "Centelha da Dúvida", "grimorio": "O Livro Que Pergunta",
                "orbe": "Oráculo Restaurado", "espadaFerro": "Lâmina da Razão", "espadaEscudo": "Escudo do Pensamento Próprio",
                "machado": "Machado do Argumento", "martelo": "Martelo da Evidência", "arco": "Arco da Hipótese",
                "arcoElfico": "Arco da Curiosidade", "besta": "Besta do Método"}),
]

# ---------- bônus (dentro dos tetos do equipamento.py) ----------
BONUS = {
    "comum": {"item": {"xp": 0.05}, "chapeu": {"sorte": 0.02}, "manto": {"moedas": 0.05}},
    "raro": {"item": {"xp": 0.08, "tempo": 1}, "chapeu": {"xp": 0.06, "mana": 1}, "manto": {"moedas": 0.08, "vida": 1}},
    "epico": {"item": {"xp": 0.12, "tempo": 2, "mana": 1, "sorte": 0.03}, "chapeu": {"xp": 0.1, "mana": 1, "sorte": 0.04},
              "manto": {"moedas": 0.12, "vida": 1, "sorte": 0.03}},
    "lendario": {"item": {"xp": 0.2, "moedas": 0.12, "tempo": 3, "mana": 1, "vida": 1, "sorte": 0.05},
                 "chapeu": {"xp": 0.15, "moedas": 0.1, "tempo": 2, "mana": 2, "sorte": 0.05},
                 "manto": {"moedas": 0.2, "xp": 0.1, "vida": 2, "sorte": 0.05}},
    "mitico": {"item": {"xp": 0.25, "moedas": 0.15, "tempo": 4, "mana": 2, "vida": 1, "sorte": 0.06},
               "chapeu": {"xp": 0.15, "moedas": 0.12, "tempo": 2, "mana": 2, "sorte": 0.06},
               "manto": {"moedas": 0.25, "xp": 0.12, "vida": 2, "sorte": 0.06}},
}
# o quanto cada parte custa perto da arma
FATOR_DA_PARTE = {"item": 1.0, "chapeu": 0.75, "manto": 0.6}
MOEDAS = {"comum": 120, "raro": 350, "epico": 900, "lendario": 2200, "mitico": 4000}
ORDEM_DAS_ESSENCIAS = ["campos", "floresta", "pantano", "deserto", "montanhas", "fenda", "cinzas", "cristais", "abismo", "geleira", "trono"]


def mat(regiao, tier):
    return MATERIAIS[regiao][TIERS.index(tier)][0]


def receita(tema, parte, indice):
    r = tema["raridade"]
    f = FATOR_DA_PARTE[parte]
    q = lambda n: max(1, math.ceil(n * f))  # noqa: E731
    reg = tema["regiao"]
    if tema.get("mitico"):
        # a Aurora pede Fragmentos do Oráculo e as essências de duas regiões diferentes (gira por peça)
        a = ORDEM_DAS_ESSENCIAS[indice % len(ORDEM_DAS_ESSENCIAS)]
        b = ORDEM_DAS_ESSENCIAS[(indice * 3 + 5) % len(ORDEM_DAS_ESSENCIAS)]
        if b == a:
            b = ORDEM_DAS_ESSENCIAS[(indice + 4) % len(ORDEM_DAS_ESSENCIAS)]
        materiais = {FRAGMENTO[0]: 3 if parte == "item" else 2, mat(a, "essencia"): q(2), mat(b, "essencia"): q(2),
                     mat(a, "raro"): q(4), mat(b, "raro"): q(4)}
        return materiais, round(MOEDAS["mitico"] * f / 10) * 10
    if r == "comum":
        materiais = {mat(reg, "comum"): q(5)}
    elif r == "raro":
        materiais = {mat(reg, "comum"): q(6), mat(reg, "raro"): q(2)}
    elif r == "epico":
        materiais = {mat(reg, "comum"): q(8), mat(reg, "raro"): q(4), mat(reg, "essencia"): 1, mat(tema["parceira"], "comum"): q(4)}
    else:
        materiais = {mat(reg, "comum"): q(12), mat(reg, "raro"): q(6), mat(reg, "essencia"): q(3), mat(tema["parceira"], "raro"): q(3)}
    return materiais, round(MOEDAS[r] * f / 10) * 10


def gerar():
    materiais = []
    for regiao, trio in MATERIAIS.items():
        for tier, (mid, nome, icone, descricao) in zip(TIERS, trio):
            materiais.append({"id": mid, "nome": nome, "icone": icone, "descricao": descricao, "regiao": regiao, "tier": tier,
                              "raridade": RARIDADE_DO_TIER[tier]})
    materiais.append({"id": FRAGMENTO[0], "nome": FRAGMENTO[1], "icone": FRAGMENTO[2], "descricao": FRAGMENTO[3], "regiao": "todas",
                      "tier": "mitico", "raridade": "lendario"})

    itens = []
    temas = []
    for tema in TEMAS:
        nivel = "mitico" if tema.get("mitico") else tema["raridade"]
        temas.append({"id": tema["id"], "nome": tema["nome"], "regiao": tema["regiao"], "raridade": tema["raridade"],
                      "mitico": bool(tema.get("mitico")), "cor": tema["paleta"]["gema1"], "manto": tema["manto"]})
        indice = 0
        for kit, pecas in PECAS.items():
            for base, slot, rotulo, icone in pecas:
                cid = f"forja-{tema['id']}-{kit}-{base}".lower()
                cores = {letra: tema["paleta"][papel] for letra, papel in LETRAS[base].items()}
                visual = {"slot": slot, "id": cid, "base": base, "cores": cores}
                if tema["efeito"]:
                    visual["efeito"] = {"tipo": tema["efeito"][0], "cor": tema["efeito"][1]}
                proprio = (tema.get("nomes") or {}).get(base) if slot == "item" else None
                nome = proprio or f"{rotulo} {tema['nome']}"
                lore = tema["lore"][indice % len(tema["lore"])]
                descricao = f"{rotulo} {tema['nome']}. {lore}" if proprio else lore
                materiais_r, moedas = receita(tema, slot, indice)
                itens.append({
                    "id": cid, "icone": icone, "nome": nome, "descricao": descricao, "kit": kit, "raridade": tema["raridade"],
                    "avatar": {slot: cid}, "visual": visual, "preco": 0, "exclusivo": True,
                    "origem": "Forjado na Casa da Forja, em Elyndor", "bonus": BONUS[nivel][slot],
                    "forja": {"tema": tema["id"], "materiais": materiais_r, "moedas": moedas},
                })
                indice += 1
        # o manto da linhagem: de todas as classes
        materiais_r, moedas = receita(tema, "manto", indice)
        itens.append({
            "id": f"forja-{tema['id']}-manto", "icone": "🧣", "nome": f"Manto {tema['nome']}", "descricao": tema["lore"][0],
            "raridade": tema["raridade"], "avatar": {"manto": tema["manto"]}, "visual": {"slot": "manto", "cor": tema["manto"]},
            "preco": 0, "exclusivo": True, "origem": "Forjado na Casa da Forja, em Elyndor", "bonus": BONUS[nivel]["manto"],
            "forja": {"tema": tema["id"], "materiais": materiais_r, "moedas": moedas},
        })
    return {"_leia": "Gerado por gerar_forja.py: mude lá e rode de novo.", "materiais": materiais, "temas": temas, "itens": itens}


def conferir(dados):
    """Os mantos da Forja não podem repetir a cor de outro manto (o bônus é achado pela cor vestida)."""
    catalogo = json.loads((RAIZ / "conteudo" / "itens.json").read_text(encoding="utf-8"))
    cores = {}
    for c in catalogo["cosmeticos"] + dados["itens"]:
        cor = (c.get("avatar") or {}).get("manto")
        if cor:
            assert cor.lower() not in cores, f"manto repetido: {cor} em {c['id']} e {cores[cor.lower()]}"
            cores[cor.lower()] = c["id"]
    ids = [c["id"] for c in catalogo["cosmeticos"] + dados["itens"]]
    assert len(ids) == len(set(ids)), "id repetido"


if __name__ == "__main__":
    dados = gerar()
    conferir(dados)
    (RAIZ / "conteudo" / "forja.json").write_text(json.dumps(dados, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    por_kit = {}
    for c in dados["itens"]:
        por_kit[c.get("kit") or "todos"] = por_kit.get(c.get("kit") or "todos", 0) + 1
    print(len(dados["itens"]), "itens,", len(dados["materiais"]), "materiais,", por_kit)
