// As escolhas do aventureiro (AVATAR_OPCOES alimenta o criador de personagem) e o retrato de busto.
// O corpo inteiro é desenhado em heroi.js; o retrato (avatarHtml) é um recorte dele, com o mascote.
// Depende de pixel.js (desenharTexto, tom, contornar...) e de heroi.js (heroiParado).

// "aba" agrupa as opções no criador; "kit" diz de qual vocação é cada arma.
const AVATAR_OPCOES = {
  kit: {
    rotulo: "Vocação", tipo: "kit", aba: "classe",
    valores: [
      { id: "mago", nome: "Mago", icone: "🔮", descricao: "Casaco bordado, chapéu pontudo e um cajado que brilha." },
      { id: "guerreiro", nome: "Guerreiro", icone: "⚔️", descricao: "Armadura, sobreveste, capa e aço na mão." },
      { id: "arqueiro", nome: "Arqueiro", icone: "🏹", descricao: "Túnica, colete de couro, aljava e arco." },
    ],
  },
  item: {
    rotulo: "Arma", tipo: "estilo", aba: "classe",
    valores: [
      { id: "cajado", nome: "Cajado", kit: "mago" }, { id: "varinha", nome: "Varinha", kit: "mago" },
      { id: "grimorio", nome: "Grimório", kit: "mago" }, { id: "orbe", nome: "Orbe", kit: "mago" },
      { id: "espadaFerro", nome: "Espada de Ferro", kit: "guerreiro" }, { id: "espadaEscudo", nome: "Espada e Escudo", kit: "guerreiro" },
      { id: "machado", nome: "Machado de Guerra", kit: "guerreiro" }, { id: "martelo", nome: "Martelo", kit: "guerreiro" },
      { id: "espada", nome: "Lâmina Rúnica", kit: "guerreiro", bloqueio: "espada" },
      { id: "espadaFlamejante", nome: "Espada Flamejante", kit: "guerreiro", bloqueio: "espada-flamejante" },
      { id: "arco", nome: "Arco Longo", kit: "arqueiro" }, { id: "arcoElfico", nome: "Arco Élfico", kit: "arqueiro" },
      { id: "besta", nome: "Besta", kit: "arqueiro" },
      { id: "arcoDourado", nome: "Arco Dourado", kit: "arqueiro", bloqueio: "arco-dourado" },
      { id: "arcoGelo", nome: "Arco do Inverno", kit: "arqueiro", bloqueio: "arco-gelo" },
      { id: "arcoSombrio", nome: "Arco das Sombras", kit: "arqueiro", bloqueio: "arco-sombrio" },
      { id: "arcoFlorido", nome: "Arco da Primavera", kit: "arqueiro", bloqueio: "arco-florido" },
      { id: "bestaPesada", nome: "Besta de Cerco", kit: "arqueiro", bloqueio: "besta-pesada" },
      { id: "bestaRunica", nome: "Besta Rúnica", kit: "arqueiro", bloqueio: "besta-runica" },
      { id: "cajadoCristal", nome: "Cajado de Cristal", kit: "mago", bloqueio: "cajado-cristal" },
      { id: "cajadoSombrio", nome: "Cajado do Modo Escuro", kit: "mago", bloqueio: "cajado-sombrio" },
      { id: "cajadoSolar", nome: "Cajado do Modo Claro", kit: "mago", bloqueio: "cajado-solar" },
      { id: "varinhaEstelar", nome: "Varinha Estelar", kit: "mago", bloqueio: "varinha-estelar" },
      { id: "grimorioDourado", nome: "Grimório Dourado", kit: "mago", bloqueio: "grimorio-dourado" },
      { id: "grimorioProibido", nome: "Grimório Proibido", kit: "mago", bloqueio: "grimorio-proibido" },
      { id: "orbeTempestade", nome: "Orbe da Tempestade", kit: "mago", bloqueio: "orbe-tempestade" },
      { id: "espadaGelo", nome: "Lâmina Congelada", kit: "guerreiro", bloqueio: "espada-gelo" },
      { id: "espadaSombria", nome: "Espada do Código Legado", kit: "guerreiro", bloqueio: "espada-sombria" },
      { id: "escudoDragao", nome: "Espada e Escudo de Dragão", kit: "guerreiro", bloqueio: "escudo-dragao" },
      { id: "machadoDourado", nome: "Machado Dourado", kit: "guerreiro", bloqueio: "machado-dourado" },
      { id: "marteloTrovao", nome: "Martelo do Trovão", kit: "guerreiro", bloqueio: "martelo-trovao" },
    ],
  },
  magia: { rotulo: "Cor da magia", tipo: "cor", livre: true, aba: "classe", valores: ["#6ef0ff", "#7dff9a", "#ff7ad9", "#ffb347", "#b38cff"] },
  corpo: {
    rotulo: "Corpo", tipo: "estilo", aba: "corpo",
    valores: [{ id: "masculino", nome: "Masculino" }, { id: "feminino", nome: "Feminino" }],
  },
  pele: { rotulo: "Pele", tipo: "cor", livre: true, aba: "corpo", valores: ["#ffe0c4", "#f6d3b3", "#e9b98f", "#c98d63", "#9a6440", "#6b4128", "#4a2c1a"] },
  rosto: {
    rotulo: "Expressão", tipo: "estilo", aba: "rosto",
    valores: [
      { id: "sorriso", nome: "Sorridente" }, { id: "alegre", nome: "Alegre" }, { id: "confiante", nome: "Confiante" },
      { id: "serio", nome: "Sério" }, { id: "bravo", nome: "Bravo" }, { id: "surpreso", nome: "Surpreso" },
      { id: "piscadela", nome: "Piscadela" }, { id: "timido", nome: "Tímido" },
    ],
  },
  corOlhos: { rotulo: "Cor dos olhos", tipo: "cor", livre: true, aba: "rosto", valores: ["#3d8bd9", "#2e9e5a", "#8b5a2b", "#7a4ad9", "#d94a6a", "#e2b04a", "#5a6b7a"] },
  acessorio: {
    rotulo: "Detalhe do rosto", tipo: "estilo", aba: "rosto",
    valores: [
      { id: "nenhum", nome: "Nenhum" }, { id: "oculos", nome: "Óculos" }, { id: "sardas", nome: "Sardas" },
      { id: "cicatriz", nome: "Cicatriz" }, { id: "tapaolho", nome: "Tapa-olho" }, { id: "bigode", nome: "Bigode" },
      { id: "cavanhaque", nome: "Cavanhaque" }, { id: "barba", nome: "Barba" }, { id: "brinco", nome: "Brinco de cristal" },
      { id: "cachecol", nome: "Cachecol" },
    ],
  },
  cabelo: {
    rotulo: "Cabelo", tipo: "estilo", aba: "cabelo",
    valores: [
      { id: "curto", nome: "Curto" }, { id: "espetado", nome: "Espetado" }, { id: "franja", nome: "Franja lateral" },
      { id: "longo", nome: "Longo" }, { id: "rabo", nome: "Rabo de cavalo" }, { id: "trancas", nome: "Tranças" },
      { id: "chiquinhas", nome: "Maria-chiquinha" }, { id: "coque", nome: "Coque" }, { id: "cacheado", nome: "Cacheado" },
      { id: "moicano", nome: "Moicano" }, { id: "raspado", nome: "Raspado" },
    ],
  },
  corCabelo: {
    rotulo: "Cor do cabelo", tipo: "cor", livre: true, aba: "cabelo",
    valores: ["#1b1b2f", "#2b1d14", "#6b3e1f", "#b5532a", "#e2b04a", "#e8e4dc", "#5b6ee1", "#e86fa8", "#7a4ad9", "#2e9e5a"],
  },
  chapeu: {
    rotulo: "Na cabeça", tipo: "estilo", aba: "roupa",
    valores: [
      { id: "nenhum", nome: "Nada" }, { id: "pontudo", nome: "Chapéu de mago" }, { id: "capuz", nome: "Capuz" },
      { id: "cacador", nome: "Chapéu de caçador" }, { id: "bandana", nome: "Bandana" }, { id: "elmoFerro", nome: "Elmo de ferro" },
      { id: "tiara", nome: "Tiara arcana" }, { id: "boina", nome: "Boina" },
      { id: "flores", nome: "Coroa de Flores", bloqueio: "coroa-flores" }, { id: "cartola", nome: "Cartola do Ilusionista", bloqueio: "cartola" },
      { id: "coroa", nome: "Coroa do Arquimago", bloqueio: "coroa" }, { id: "elmo", nome: "Elmo de Dragão", bloqueio: "elmo" },
      { id: "pontudoEstrelado", nome: "Chapéu da Noite Estrelada", kit: "mago", bloqueio: "chapeu-estrelado" },
      { id: "pontudoFogo", nome: "Chapéu de Fênix", kit: "mago", bloqueio: "chapeu-fogo" },
      { id: "capuzArcano", nome: "Capuz Arcano", kit: "mago", bloqueio: "capuz-arcano" },
      { id: "elmoDourado", nome: "Elmo Dourado", kit: "guerreiro", bloqueio: "elmo-dourado" },
      { id: "elmoSombrio", nome: "Elmo do Plantão", kit: "guerreiro", bloqueio: "elmo-sombrio" },
      { id: "bandanaGuerra", nome: "Bandana de Guerra", kit: "guerreiro", bloqueio: "bandana-guerra" },
      { id: "cacadorReal", nome: "Chapéu do Caçador Real", kit: "arqueiro", bloqueio: "chapeu-cacador-real" },
      { id: "cacadorNoturno", nome: "Chapéu da Ronda Noturna", kit: "arqueiro", bloqueio: "chapeu-cacador-noturno" },
      { id: "capuzFloresta", nome: "Capuz da Floresta", kit: "arqueiro", bloqueio: "capuz-floresta" },
    ],
  },
  manto: {
    rotulo: "Cor da roupa", tipo: "cor", livre: true, aba: "roupa",
    valores: ["#5a3aa6", "#2e5cb8", "#1f7a5c", "#a8323e", "#2b2540", "#e9e4d4", "#c46a1b",
      { cor: "#16b8b8", bloqueio: "manto-turquesa" }, { cor: "#d4a52c", bloqueio: "manto-dourado" },
      { cor: "#0f9d58", bloqueio: "manto-esmeralda" }, { cor: "#23235e", bloqueio: "manto-noite" },
      { cor: "#7b3fd1", kit: "mago", bloqueio: "manto-ametista" },
      { cor: "#8a1010", kit: "guerreiro", bloqueio: "manto-carmesim" }, { cor: "#5a6170", kit: "guerreiro", bloqueio: "manto-aco" },
      { cor: "#4a6b2a", kit: "arqueiro", bloqueio: "manto-musgo" }, { cor: "#b5651d", kit: "arqueiro", bloqueio: "manto-outono" }],
  },
  detalhe: { rotulo: "Bordado e detalhes", tipo: "cor", livre: true, aba: "roupa", valores: ["#f5c451", "#cfd6e6", "#6ef0ff", "#ff9fb2", "#7dff9a"] },
  aura: {
    rotulo: "Aura", tipo: "estilo", aba: "roupa",
    valores: [{ id: "simples", nome: "Simples" }, { id: "estrelas", nome: "Estrelas", bloqueio: "aura-estrelas" }, { id: "chamas", nome: "Chamas espectrais", bloqueio: "aura-chamas" }, { id: "raios", nome: "Raios", bloqueio: "aura-raios" },
      { id: "gelo", nome: "Glacial", bloqueio: "aura-gelo" }, { id: "folhas", nome: "Floresta", bloqueio: "aura-folhas" },
      { id: "arcana", nome: "Círculo Arcano", bloqueio: "aura-arcana" }, { id: "vazio", nome: "Vazio", bloqueio: "aura-vazio" }],
  },
  familiar: {
    rotulo: "Mascote", tipo: "estilo", aba: "mascote",
    valores: [
      { id: "coruja", nome: "Coruja" }, { id: "gato", nome: "Gato" }, { id: "raposa", nome: "Raposa" }, { id: "nenhum", nome: "Nenhum" },
      { id: "dragao", nome: "Dragão da Academia", bloqueio: "dragao-academia" },
      { id: "golem", nome: "Mini-golem", bloqueio: "golem" }, { id: "fenix", nome: "Fênix", bloqueio: "fenix" },
      { id: "slime", nome: "Slime de estimação", bloqueio: "slime-pet" },
      { id: "coelho", nome: "Coelho Lunar" },
      { id: "lobo", nome: "Lobinho de Jade", bloqueio: "lobo-pet" },
      { id: "lume", nome: "Lume, o fogo-fátuo", bloqueio: "lume-pet" },
      { id: "tartaruga", nome: "Tartaruga Rúnica", bloqueio: "tartaruga-pet" },
      { id: "cristal", nome: "Cristalino", bloqueio: "cristal-pet" },
    ],
  },
  corFamiliar: { rotulo: "Cor do mascote", tipo: "cor", livre: true, aba: "mascote", valores: ["#8b5a2b", "#2b2540", "#27ae60", "#e8e4dc", "#e2b04a", "#5b6ee1"] },
};

const ABAS_CRIADOR = [
  { id: "classe", nome: "⚔️ Vocação" }, { id: "corpo", nome: "🧍 Corpo" }, { id: "rosto", nome: "🙂 Rosto" },
  { id: "cabelo", nome: "💇 Cabelo" }, { id: "roupa", nome: "👘 Roupa" }, { id: "mascote", nome: "🦉 Mascote" },
];

// as armas de cada vocação, na ordem do criador (a primeira é a que vem na mão)
const ITENS_DO_KIT = {};
AVATAR_OPCOES.item.valores.forEach((v) => (ITENS_DO_KIT[v.kit] ||= []).push(v.id));

function kitDoItem(item) {
  return AVATAR_OPCOES.item.valores.find((v) => v.id === item)?.kit || "mago";
}

// cor natural de cada mascote, usada enquanto o aluno não escolhe outra
const COR_NATURAL_FAMILIAR = { coruja: "#8b5a2b", gato: "#2b2540", dragao: "#b8322a", golem: "#8a8fa3", fenix: "#e74c3c", raposa: "#e8742a", slime: "#5fd35f",
  coelho: "#e8e4f0", lobo: "#8a8fa3", lume: "#2fd6e8", tartaruga: "#4a7a5a", cristal: "#9fe8ff" };

const AVATAR_PADRAO = {
  kit: "mago", corpo: "masculino", pele: "#e9b98f", cabelo: "curto", corCabelo: "#6b3e1f", rosto: "sorriso", corOlhos: "#3d8bd9",
  chapeu: "pontudo", manto: "#2e5cb8", detalhe: "#f5c451", item: "cajado", magia: "#6ef0ff", aura: "simples", acessorio: "nenhum", familiar: "coruja",
};

// Uma opção pode ser só o valor ("#hex" ou { id }) ou trazer "bloqueio": o visual que precisa ser conquistado.
function valorDaOpcao(opcao) {
  return typeof opcao === "string" ? opcao : opcao.cor || opcao.id;
}

function bloqueioDaOpcao(opcao) {
  return typeof opcao === "string" ? null : opcao.bloqueio || null;
}

function paletaAvatar(a) {
  const corFamiliar = a.corFamiliar || COR_NATURAL_FAMILIAR[a.familiar] || "#8b5a2b";
  return {
    S: a.pele, s: tom(a.pele, 0.8), H: a.corCabelo, h: tom(a.corCabelo, 0.68), I: tom(a.corCabelo, 1.45),
    M: a.manto, m: tom(a.manto, 0.68), n: tom(a.manto, 1.3), V: tom(a.manto, 0.45), D: a.detalhe, d: tom(a.detalhe, 0.72), Q: tom(a.detalhe, 1.5),
    G: a.magia, g: tom(a.magia, 1.55), X: tom(a.magia, 0.62), K: "#1b1533", E: "#1b1533", W: "#ffffff", R: "#b33a3a", P: "#f08a8a",
    B: "#8b5a2b", b: "#5c3418", Y: "#f5c451", y: "#c9952a", A: "#d8dee9", a: "#8a93a8", O: "#ff7a1a", o: "#ffd166",
    F: corFamiliar, f: tom(corFamiliar, 0.68), L: tom(corFamiliar, 1.45),
  };
}

// Pinta pixels soltos: lista de [x, y, cor] ou faixas [x1, x2, y, cor].
function pontos(ctx, paleta, lista) {
  lista.forEach(([x, y, c]) => retangulo(ctx, x, y, 1, 1, paleta[c]));
}
function faixas(ctx, paleta, lista) {
  lista.forEach(([x1, x2, y, c]) => retangulo(ctx, x1, y, x2 - x1 + 1, 1, paleta[c]));
}

const DESENHOS_FAMILIAR = {
  coruja: [".F.....F.", ".FFFFFFF.", "FWWFFFWWF", "FWKFFFKWF", "FFFYYYFFF", "FFLLLLLFF", "FfLLLLLfF", ".fLLLLLf.", "..Y...Y.."],
  gato: ["F......F.", "FF....FF.", "FFFFFFFF.", "FYKFFYKF.", "FFFPPFFF.", ".FFFFFF..", ".FFFFFFF.", ".FFFFFFFF", ".FF.FF..F"],
  dragao: ["...L.....", "..LLF....", ".LLFFFF..", "...FFFWF.", "..FFFFFFY", ".FFFFFF..", "FFfFFFf..", "F.FF.FF..", "........."],
  golem: ["..FFFFF..", "..FGFGF..", "..FFFFF..", "FFFFFFFFF", "FfFFFFFfF", "F.FFFFF.F", "..FF.FF..", "..ff.ff..", "........."],
  fenix: ["...YY....", "..FFF....", "..FWFF...", "...FFFY..", "..FFFF...", ".OFFFFF..", "OOoFFF...", "OoO......", "o........"],
  raposa: [".F.....F.", ".FF...FF.", ".FFFFFFF.", "FFKFFFKFF", ".FLLWLLF.", "..FLKLF..", "..FFFFF.F", ".FFFFFFFL", ".f.f.f.f."],
  slime: ["....L....", "...FFF...", "..FLFFF..", ".FLFFFFF.", ".FKFFFKF.", ".FFFFFFF.", "FFFFKFFFF", "fFFFFFFFf", ".fffffff."],
};

// O retrato: o busto detalhado do herói (o mesmo da ficha do inventário e das conversas, retrato.js),
// centralizado num quadro quadrado de 80 x 80 (todos os retratos do jogo saem daqui: o topo, a batalha,
// o Mercado, o certificado...). Sem o retrato.js carregado, cai no recorte antigo do corpo inteiro.
function avatarCanvas(escolhas, { comFamiliar = true } = {}) {
  if (typeof retratoBusto === "function") {
    const busto = retratoBusto(escolhas);
    const { canvas, ctx } = criarTela(80, 80);
    ctx.drawImage(busto, Math.round((80 - busto.width) / 2), 80 - busto.height);
    return canvas;
  }
  const a = { ...AVATAR_PADRAO, ...(escolhas || {}) };
  const p = paletaAvatar(a);
  const { canvas, ctx } = criarTela(36, 36);
  ctx.drawImage(heroiParado(escolhas), 0, 0, LARGURA_HEROI, 36, 2, 0, LARGURA_HEROI, 36);
  const mascote = comFamiliar ? familiarCanvas(a, { mini: true }) : null;
  if (mascote) ctx.drawImage(mascote, 0, 25);
  if (a.aura === "estrelas") {
    [[3, 5], [2, 17], [32, 12], [8, 1]].forEach(([x, y]) => {
      pontos(ctx, p, [[x, y, "Y"], [x - 1, y, "o"], [x + 1, y, "o"], [x, y - 1, "o"], [x, y + 1, "o"]]);
    });
  }
  return canvas;
}

// ---------- os mascotes grandes (16 x 16), com sombra, brilho e quadros de animação ----------
// Letras: F a cor do mascote, f a sombra dela, e a sombra mais funda, L o brilho; W branco, K o preto dos
// olhos, Y/y ouro, O/o laranja, P rosa, G a cor da magia (olhos e núcleo do golem). O dragão não é
// desenhado aqui: é o mesmo dragão que voa sobre a Academia, só que filhote.
const MASCOTES_GRANDES = {
  coruja: [
    "................",
    "..e.........e...",
    "..eF.......Fe...",
    "..fFFFFFFFFFf...",
    ".fFLLLFFFLLLFf..",
    ".fLWWWLFLWWWLf..",
    ".fLWKKWFWKKWLf..",
    ".fLWKWWYWKWWLf..",
    ".fFLWWYYYWWLFf..",
    ".fFFLLLYLLLFFf..",
    "efFLLeLLLeLLFfe.",
    "efFLLLLeLLLLFfe.",
    ".efFLeLLLeLFfe..",
    "..efFLLLLLFfe...",
    "...eeYYeYYee....",
    "....Y.Y.Y.Y.....",
  ],
  gato: [
    "................",
    "..e.......e.....",
    "..fe.....ef.....",
    "..fPe...ePf.....",
    "..fFFFFFFFf.....",
    ".fFFLFFFLFFf....",
    ".fFYKFFFYKFf....",
    ".fFYKFFFYKFf....",
    "WfFFFFPFFFFfW...",
    "..fFLWKWLFf....e",
    "...fFFFFFf....ef",
    "..fFFLLLFFf..ef.",
    ".fFFLLLLLFFfef..",
    ".fFFLLLLLFFFf...",
    ".fFeFLLLFeFf....",
    "..eWe...eWe.....",
  ],
  raposa: [
    "................",
    ".e.........e....",
    ".fe.......ef....",
    ".fPF.....FPf....",
    ".fFFFFFFFFFf....",
    "fFFLFFFFFLFFf...",
    "fFWKFFFFFKWFf...",
    ".fFWWFFFWWFf....",
    ".fWWWWKWWWWf....",
    "..fWWWWWWWf.....",
    "...fFFFFFf...fF.",
    "..fFFWWWFFf.fFFL",
    ".fFFWWWWWFFfFFWW",
    ".fFFFWWWFFFFFWW.",
    ".ffeFffFeFfFWW..",
    "..eKe..eKe......",
  ],
  golem: [
    "................",
    "....ffffff......",
    "...fFLLLLFf.....",
    "...fFGffGFf.....",
    "...fFFFFFFf.....",
    "....fFeeFf......",
    ".ff.fFFFFf.ff...",
    "fFLffFGGFFfFLf..",
    "fFFffGGGGFfFFf..",
    "fFFffFGGFFfFFf..",
    ".ee.fFFFFf.ee...",
    "....fFvFFf......",
    "...fFFf.fFFf....",
    "...fFLf.fLFf....",
    "...eeee.eeee....",
    "................",
  ],
  fenix: [
    "......Y.........",
    ".....YoY........",
    "....OOOOY.......",
    "...OOWKOO.......",
    "...OOOOOYY......",
    "..oOOOOOY.......",
    ".oOOFFOOO.......",
    "oOOFFFFOOO......",
    "OOFFFFFFOOO.....",
    "OFFFFFFFOOOo....",
    ".OFFFFfOOOOOo...",
    "..OFFfOOO.ooo...",
    "...OfOO....ooY..",
    "....OO......oY..",
    "....Y.Y......Y..",
    "................",
  ],
  slime: [
    "................",
    "......LL........",
    ".....LFFF.......",
    "....FLFFFF......",
    "...FLLFFFFF.....",
    "..FLWFFFFFFF....",
    "..FLFFFFFFFFF...",
    ".FFFKWFFFKWFF...",
    ".FFFKKFFFKKFF...",
    ".FFFFFFPFFFFFf..",
    "FFFFFFKKFFFFFFf.",
    "FfFFFFFFFFFFFff.",
    "fffFFFFFFFFFfff.",
    ".fffffffffffff..",
    "..eeeeeeeeeee...",
    "................",
  ],
};
// os que voam (pairam ao lado do herói no mapa, com a sombra no chão)
const MASCOTES_VOAM = new Set(["coruja", "fenix", "dragao", "cristal", "lume"]);

function paletaMascote(a) {
  const p = paletaAvatar(a);
  return { ...p, e: tom(p.F, 0.42), v: "#5aa05a" };
}

// O dragão da Academia, filhote: o mesmo desenho do que voa sobre as torres (titulo.js), menor, com a
// cor do mascote no corpo. Vira pixel de verdade: o que ficou meio transparente nas beiradas some ou
// fica cheio, e ganha o contorno escuro como todo personagem.
function quadroDragaoMascote(a, fase) {
  const corpo = a.corFamiliar || COR_NATURAL_FAMILIAR.dragao;
  const cores = { corpo, asaTras: tom(corpo, 0.6), barriga: "#f5c451", chifre: "#f4ecd8", membrana: tom(corpo, 1.55) };
  const { canvas, ctx } = criarTela(38, 26);
  ctx.save();
  ctx.translate(23, 16);
  ctx.scale(0.55, 0.55);
  // fase de 0 a 1: uma batida de asa inteira (o desenho bate as asas pelo tempo t)
  const t = (fase * Math.PI * 2) / 5.5;
  desenharDragaoVoando(ctx, 0, 0, t, Math.sin(t * 5.5), cores);
  ctx.restore();
  const imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = imagem.data;
  for (let i = 3; i < px.length; i += 4) px[i] = px[i] >= 110 ? 255 : 0;
  ctx.putImageData(imagem, 0, 0);
  volumeDoMascote(canvas);
  return contornar(canvas, "auto");
}

// os mascotes ganham o mesmo volume do herói (luz de cima à esquerda, sombra fria embaixo), antes do contorno
function volumeDoMascote(canvas) {
  if (typeof iluminarVolume === "function") iluminarVolume(canvas, "lado");
  return canvas;
}

// Os quadros do mascote: o dragão bate as asas (4 quadros); os outros respiram (o corpo desce 1 pixel
// com os pés no chão) e piscam de vez em quando. Guardados por visual.
const cacheQuadrosMascote = new Map();
function familiarQuadros(escolhas) {
  const a = { ...AVATAR_PADRAO, ...(escolhas || {}) };
  if (!a.familiar || a.familiar === "nenhum") return null;
  const chave = `${a.familiar}|${a.corFamiliar || ""}`;
  if (cacheQuadrosMascote.has(chave)) return cacheQuadrosMascote.get(chave);
  let quadros = null;
  const doBestiario = typeof mascoteArte === "function" ? mascoteArte(a.familiar, a.corFamiliar || COR_NATURAL_FAMILIAR[a.familiar]) : null;
  if (a.familiar === "dragao" && typeof desenharDragaoVoando === "function") {
    quadros = [0, 0.25, 0.5, 0.75].map((fase) => quadroDragaoMascote(a, fase));
  } else if (doBestiario) {
    // o mascote desenhado como os monstros do bestiário (bestiario.js): 8 quadros parado
    quadros = doBestiario.parado;
  } else if (MASCOTES_GRANDES[a.familiar]) {
    const desenho = MASCOTES_GRANDES[a.familiar];
    const p = paletaMascote(a);
    const base = criarTela(18, 18);
    desenharTexto(base.ctx, desenho, p, 1, 1);
    volumeDoMascote(base.canvas);
    // respirando: as linhas de cima descem 1 pixel, as de baixo (pés) ficam
    const respira = criarTela(18, 18);
    respira.ctx.drawImage(base.canvas, 0, 11, 18, 7, 0, 11, 18, 7);
    respira.ctx.drawImage(base.canvas, 0, 0, 18, 11, 0, 1, 18, 11);
    // piscando: onde há pupila (K), vira a cor do corpo com uma linha de pálpebra
    const pisca = criarTela(18, 18);
    desenharTexto(pisca.ctx, desenho.map((linha, y) => (y <= 7 ? linha.replace(/K/g, "f") : linha)), p, 1, 1);
    volumeDoMascote(pisca.canvas);
    const [parado, respirando, piscando] = [base.canvas, respira.canvas, pisca.canvas].map((c) => contornar(c, "auto"));
    quadros = [parado, respirando, parado, respirando, parado, respirando, piscando];
  }
  cacheQuadrosMascote.set(chave, quadros);
  return quadros;
}

// ---------- a corrida de cada mascote ----------
// Os quadros da corrida saem do próprio desenho, cortado em partes que se mexem cada uma do seu jeito
// (as partes cobrem o desenho inteiro, sem sobra, então nada some). Cada parte: [x, y, largura, altura]
// no desenho de 18 x 18, e por quadro o quanto ela anda: [dx, dy].
//   galope (gato, raposa): patas da frente e de trás em tesoura, o corpo sobe no meio do salto, o rabo balança
//   pisada (golem): uma perna levanta, o corpo desce com tudo no pisão, depois a outra
//   asas (coruja) e voo (fênix): as asas batem para cima e para baixo, o corpo sobe e desce junto
//   quique (slime): o mesmo desenho; quem pula e achata é o mapa (na hora de desenhar)
const CORRIDA_MASCOTE = {
  gato: { estilo: "galope", ritmo: 11, partes: [
    [[0, 0, 12, 14], [0, 0], [0, -1], [0, -1], [0, 0]],
    [[12, 0, 6, 14], [0, -1], [0, 0], [0, 1], [0, 0]],
    [[0, 14, 9, 4], [-1, 0], [0, -1], [1, 0], [0, 0]],
    [[9, 14, 9, 4], [1, 0], [0, 0], [-1, 0], [0, -1]],
  ] },
  raposa: { estilo: "galope", ritmo: 12, partes: [
    [[0, 0, 12, 14], [0, 0], [0, -1], [0, -1], [0, 0]],
    [[12, 0, 6, 14], [0, 1], [0, 0], [0, -1], [0, 0]],
    [[0, 14, 9, 4], [-1, 0], [0, -1], [1, 0], [0, 0]],
    [[9, 14, 9, 4], [1, 0], [0, 0], [-1, 0], [0, -1]],
  ] },
  golem: { estilo: "pisada", ritmo: 6, partes: [
    [[0, 0, 18, 13], [0, -1], [0, 1], [0, -1], [0, 1]],
    [[0, 13, 9, 5], [0, -2], [0, 0], [0, 0], [0, 0]],
    [[9, 13, 9, 5], [0, 0], [0, 0], [0, -2], [0, 0]],
  ] },
  coruja: { estilo: "asas", ritmo: 12, partes: [
    [[0, 0, 4, 18], [0, -2], [0, 0], [0, 2], [0, 0]],
    [[4, 0, 10, 18], [0, -1], [0, 0], [0, 1], [0, 0]],
    [[14, 0, 4, 18], [0, -2], [0, 0], [0, 2], [0, 0]],
  ] },
  fenix: { estilo: "voo", ritmo: 12, partes: [
    [[0, 0, 8, 5], [0, -1], [0, 0], [0, 1], [0, 0]],
    [[0, 5, 8, 8], [0, -3], [0, 0], [0, 2], [0, 0]],
    [[0, 13, 8, 5], [0, -1], [0, 0], [0, 1], [0, 0]],
    [[8, 0, 10, 18], [0, -1], [0, 0], [0, 1], [0, 0]],
  ] },
};
const cacheCorridaMascote = new Map();
function familiarCorrida(escolhas) {
  const a = { ...AVATAR_PADRAO, ...(escolhas || {}) };
  if (!a.familiar || a.familiar === "nenhum") return null;
  const chave = `${a.familiar}|${a.corFamiliar || ""}`;
  if (cacheCorridaMascote.has(chave)) return cacheCorridaMascote.get(chave);
  let corrida = null;
  const doBestiario = typeof mascoteArte === "function" && a.familiar !== "dragao" ? mascoteArte(a.familiar, a.corFamiliar || COR_NATURAL_FAMILIAR[a.familiar]) : null;
  if (doBestiario && typeof CORRIDA_DO_BESTIARIO !== "undefined" && CORRIDA_DO_BESTIARIO[a.familiar]) {
    const [estilo, ritmo] = CORRIDA_DO_BESTIARIO[a.familiar];
    corrida = { estilo, ritmo, quadros: doBestiario.correndo };
  } else if (a.familiar === "dragao") {
    // o dragão já tem as 4 batidas de asa: na corrida elas ficam mais rápidas
    const quadros = familiarQuadros(a);
    corrida = quadros ? { estilo: "voo", ritmo: 14, quadros } : null;
  } else if (a.familiar === "slime") {
    const quadros = familiarQuadros(a);
    corrida = quadros ? { estilo: "quique", ritmo: 3, quadros: [quadros[0]] } : null;
  } else if (CORRIDA_MASCOTE[a.familiar] && MASCOTES_GRANDES[a.familiar]) {
    const { estilo, ritmo, partes } = CORRIDA_MASCOTE[a.familiar];
    const base = criarTela(18, 18);
    desenharTexto(base.ctx, MASCOTES_GRANDES[a.familiar], paletaMascote(a), 1, 1);
    volumeDoMascote(base.canvas);
    const quadros = [0, 1, 2, 3].map((k) => {
      const { canvas, ctx } = criarTela(18, 18);
      partes.forEach(([[x, y, w, h], ...passos]) => {
        const [dx, dy] = passos[k];
        ctx.drawImage(base.canvas, x, y, w, h, x + dx, y + dy, w, h);
      });
      return contornar(canvas, "auto");
    });
    corrida = { estilo, ritmo, quadros };
  }
  cacheCorridaMascote.set(chave, corrida);
  return corrida;
}

// O mascote sozinho (o primeiro quadro, grande). mini: o desenho pequeno antigo (9 x 9), para o canto
// do retrato, onde o grande não cabe.
function familiarCanvas(escolhas, { mini = false } = {}) {
  const a = { ...AVATAR_PADRAO, ...(escolhas || {}) };
  if (!mini) {
    const quadros = familiarQuadros(a);
    if (quadros?.length) return quadros[0];
  }
  const desenho = DESENHOS_FAMILIAR[a.familiar];
  if (!desenho) return null;
  const { canvas, ctx } = criarTela(11, 11);
  desenharTexto(ctx, desenho, paletaAvatar(a), 1, 1);
  return contornar(canvas, "auto");
}

const cacheAvatares = new Map();

function avatarDataUrl(escolhas, opcoes) {
  const chave = JSON.stringify([escolhas, opcoes]);
  if (!cacheAvatares.has(chave)) cacheAvatares.set(chave, avatarCanvas(escolhas, opcoes).toDataURL());
  return cacheAvatares.get(chave);
}

function avatarHtml(escolhas, rotulo = "Teu personagem") {
  return `<img class="avatar pixel" src="${avatarDataUrl(escolhas)}" alt="${rotulo}">`;
}

// nome antigo, mantido porque o jogo inteiro chama assim
const avatarSvg = avatarHtml;

// Os personagens da Academia saem do mesmo sistema.
const VISUAL_ZETSU = {
  pele: "#f1c9a5", cabelo: "longo", corCabelo: "#eeeae0", rosto: "sorriso", chapeu: "pontudo", manto: "#5a3aa6",
  detalhe: "#f5c451", item: "cajado", magia: "#6ef0ff", aura: "estrelas", acessorio: "barba", familiar: "nenhum",
};
