// O Reino de Elyndor: um mundo enorme em pixel art, com regiões de perigo crescente e seis cidades.
// cenarioReino(lugares, puzzles) descreve o Reino para o motor de mundos (mundo.js).
// Depende de pixel.js, avatar.js e heroi.js.

const TILE = 16;
// o Reino tem 320 × 224 tiles (o dobro do primeiro mapa em cada direção); VERSAO_MAPA muda quando o
// mapa muda de forma, para a posição salva do herói não cair dentro de uma parede nova
const COLUNAS = 320;
const LINHAS = 224;
const VERSAO_MAPA = 2;
const T = { AGUA: 0, AREIA: 1, GRAMA: 2, CAMINHO: 3, ROCHA: 4, PONTE: 5, NEVE: 6, LAMA: 7, MATA: 8, PEDRA: 9, PLANTACAO: 10 };
// o centro da capital (a praça)
const VILA = [160, 160];

// As regiões do Reino: quanto mais longe da capital, mais perigo (e mais difícil a pergunta dos monstros).
const REGIOES = {
  vale: { nome: "Vale de Elyndor", perigo: 1 },
  campos: { nome: "Campos de Elyndor", perigo: 1 },
  floresta: { nome: "Floresta Uivante", perigo: 2 },
  pantano: { nome: "Pântano das Alucinações", perigo: 2 },
  deserto: { nome: "Deserto dos Bugs", perigo: 3 },
  montanhas: { nome: "Montanhas do Dragão", perigo: 4 },
};

function regiaoDe(x, y) {
  const r = ruidoMundo(x * 0.25, y * 0.25) * 8;
  if (Math.hypot(x - VILA[0], (y - VILA[1]) * 1.2) < 36) return "vale";
  if (y < 68 + r) return "montanhas";
  if (x > 228 + r) return "deserto";
  if (x < 108 + r) return y > 160 + r ? "pantano" : "floresta";
  return "campos";
}

// a região onde está um ponto do mundo (em pixels)
function regiaoNoPonto(px, py) {
  return REGIOES[regiaoDe(Math.floor(px / TILE), Math.floor(py / TILE))];
}

// O nível de cada barreira vem do servidor (conteudo/regioes.json); quem decide a luta é ele.
function regiaoLiberada(regiaoId, nivelHeroi) {
  return nivelHeroi >= (REGIOES[regiaoId].nivelMinimo || 1);
}

// Sombra das regiões que o herói ainda não pode visitar, para o minimapa.
function sombraRegioesTrancadas(nivelHeroi) {
  return spriteReino(`sombra-${nivelHeroi}`, () => {
    const { regioes } = prepararMundo();
    const { canvas, ctx } = criarTela(COLUNAS, LINHAS);
    for (let y = 0; y < LINHAS; y++) for (let x = 0; x < COLUNAS; x++) {
      if (!regiaoLiberada(regioes[y][x], nivelHeroi)) retangulo(ctx, x, y, 1, 1, "rgba(12, 6, 30, 0.6)");
    }
    return canvas;
  });
}

// Onde fica cada lugar: [coluna, linha] da porta (o tile logo abaixo é a entrada).
// O portal fica na cabeceira da praça da capital; o mercado e a estalagem, na avenida do meio.
const POSICAO_LUGARES = {
  portal: [160, 150], mercado: [146, 157], estalagem: [174, 157], cripta: [56, 198], bugs: [276, 144], cofre: [208, 32],
  // a Casa da Forja do Duran, do lado do Mercado (onde os materiais dos monstros viram armas)
  forja: [137, 157],
  // a Fenda da Ruptura, ao norte da capital: o caminho para Umbraterra (abre no último degrau da subclasse)
  fenda: [184, 118],
};
const TAMANHO_LUGARES = { portal: [32, 44], mercado: [48, 46], estalagem: [48, 44], cripta: [40, 40], bugs: [48, 36], cofre: [48, 40], fenda: [36, 46], forja: [48, 48] };
// Casas, lojas, árvores e pedras são desenhadas no tamanho original e ampliadas por este fator (pixels
// inteiros, sem borrar): assim as construções ficam maiores que as pessoas, como deve ser.
const ESCALA_CENARIO = 2;

// Os tiles que uma construção ampliada ocupa: a largura toda da base e as linhas de baixo (o telhado
// fica livre para o herói passar por trás).
function tilesDaBase(centro, cy, larguraPx, linhas) {
  const meia = (larguraPx * ESCALA_CENARIO) / 2 - 6;
  const lista = [];
  for (let x = Math.floor((centro - meia) / TILE); x <= Math.floor((centro + meia) / TILE); x++) {
    for (let y = cy - linhas + 1; y <= cy; y++) lista.push(`${x},${y}`);
  }
  return lista;
}

// o centro (em pixels) de uma construção de w tiles: no meio do tile se w é ímpar, na divisa se é par
const centroConstrucao = (cx, w) => cx * TILE + (w % 2 ? 8 : 0);

// Envolve a animação de uma construção para ela crescer junto com o desenho ampliado.
function animarAmpliado(animar) {
  return (ctx, x, y, t) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(ESCALA_CENARIO, ESCALA_CENARIO);
    animar(ctx, 0, 0, t);
    ctx.restore();
  };
}

// enigmas espalhados pelo mapa (o conteúdo vem do servidor; aqui só a posição)
const POSICAO_PUZZLES = {
  "enigma-vale": [204, 150], "enigma-campos": [222, 192], "enigma-floresta": [52, 100], "enigma-torre": [80, 130],
  "enigma-pantano": [88, 200], "enigma-bruxa": [24, 186], "enigma-deserto": [256, 100], "enigma-ruinas": [284, 186],
  "enigma-oasis": [262, 206], "enigma-neve": [128, 40], "enigma-dragao": [244, 28], "enigma-pico": [72, 24],
  "enigma-espantalho": [216, 202], "enigma-arvore": [62, 114], "enigma-miragem": [268, 124],
};

// construções fora das cidades: [tipo, coluna, linha (base), largura em tiles, altura em tiles, extra]
// (as das cidades são montadas pelos planos de CIDADES, mais abaixo)
const CONSTRUCOES = [
  ["moinho", 206, 176, 3, 2], ["torre", 76, 124, 2, 2],
  ["piramide", 296, 112, 5, 3], ["coluna", 276, 178, 1, 1], ["coluna", 284, 178, 1, 1], ["coluna", 292, 178, 1, 1],
  ["fortaleza", 116, 28, 5, 3], ["ninho", 236, 24, 3, 1], ["posto", 160, 82, 2, 2],
];

// moradores do Reino fora das cidades: conversam, dão dicas e contam a história de cada região
// (os das cidades vêm junto com o plano de cada cidade)
const HABITANTES = [
  {
    id: "fazendeira", nome: "Rosa, a Fazendeira", tx: 200, ty: 178,
    visual: { corpo: "feminino", pele: "#c98d63", cabelo: "trancas", corCabelo: "#e2b04a", rosto: "sorriso", chapeu: "boina", manto: "#8b5a2b", detalhe: "#7dff9a", item: "cajado", magia: "#7dff9a", acessorio: "cachecol" },
    falas: ["Meu marido escondeu um baú perto do moinho e esqueceu a ordem do ritual. Tu consegue abrir?", "Plantação boa é como automação: dá trabalho no começo e depois colhe sozinha."],
  },
  {
    id: "capita", nome: "Capitã Ivy", tx: 164, ty: 85,
    visual: { corpo: "feminino", pele: "#f1c9a5", cabelo: "longo", corCabelo: "#e8e4dc", rosto: "serio", chapeu: "elmo", manto: "#7a1f3d", detalhe: "#f5c451", item: "espada", magia: "#ff7ad9", acessorio: "nenhum" },
    falas: ["Daqui para o norte começam as **Montanhas do Dragão**. Só sobe quem já domina agentes, RAG e segurança.", "Um dragão de verdade pergunta duas vezes e tira dois corações. Volta para a capital se a vida estiver baixa."],
  },
  {
    id: "ermitao", nome: "Ulf, o Ermitão", tx: 132, ty: 44,
    visual: { pele: "#f6d3b3", cabelo: "longo", corCabelo: "#e8e4dc", rosto: "sorriso", chapeu: "capuz", manto: "#e8eef5", detalhe: "#6ef0ff", item: "cajado", magia: "#6ef0ff", acessorio: "barba" },
    falas: ["Morei na Fortaleza Congelada por 40 anos. Aprendi que o melhor prompt é o que tu revisa duas vezes.", "O ninho do grande dragão fica a leste. O tesouro dele pede o pipeline do RAG."],
  },
];

// placas nos caminhos para o viajante não se perder (as placas com o nome de cada cidade vêm dos planos)
const PLACAS = [
  { id: "placa-norte", tx: 164, ty: 128, texto: "⬆ **Norte:** Posto da Guarda, a vila de **Picogelo** e as Montanhas do Dragão (☠☠☠☠) · ⬇ Elyndor, a Capital" },
  { id: "placa-oeste", tx: 124, ty: 164, texto: "⬅ **Oeste:** Floresta Uivante e a vila de **Pinhalva** (☠☠) · ↙ **Lodaçal**, o Pântano e a Cripta (☠☠) · ➡ Capital" },
  { id: "placa-leste", tx: 196, ty: 164, texto: "➡ **Leste:** o moinho, o Deserto dos Bugs e a cidade de **Qadir**, no oásis (☠☠☠) · ⬅ Capital" },
  { id: "placa-sul", tx: 164, ty: 197, texto: "⬇ **Sul:** **Porto Sereno**, o cais e o farol · ⬆ Elyndor, a Capital" },
];

// a estátua do Arquimago no meio da praça da capital
const ESTATUA_PRACA = [160, 163];
const TEXTO_ESTATUA = "🧙 **Erickson, o Arquimago de Elyndor**\n\nFundador da Academia Arcana. Contam que, na noite da Grande Ruptura, ele só cruzou os braços, sorriu e disse: *\"Calma, a gente confere a fonte.\"* E o Vazio recuou.\n\nSeu cajado de cristal ainda flutua ao lado da estátua, esperando o próximo grande mago.";

// ---------- as cidades ----------
// Cada cidade sai de um plano: limites, chão de base, praça, ruas em grade, fileiras de casas viradas
// para a rua (a porta fica embaixo), cerca ou muralha com portões, lampiões, árvores plantadas, moradores
// e uma placa com o nome na entrada. Os planos só anotam tudo; gerarMundo pinta o chão e as listas
// CONSTRUCOES, HABITANTES e PLACAS recebem as peças.

const CIDADES = [];
const ARVORES_CIDADE = []; // árvores e arbustos plantados de propósito (fora deles, cidade não tem mato)

function planoDeCidade({ id, nome, icone, x0, y0, x1, y1, chao, aguaFica = false, placa }) {
  const cidade = { id, nome, icone, x0, y0, x1, y1, chao, aguaFica, centro: [Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2)], formas: [] };
  CIDADES.push(cidade);
  const obra = (tipo, x, y, w, h, extra) => CONSTRUCOES.push([tipo, x, y, w, h, extra]);
  const plano = {
    // um retângulo de chão (ruas, calçadas, cais)
    rua: (ax, ay, bx, by, tile = T.CAMINHO) => cidade.formas.push({ tipo: "ret", ax: Math.min(ax, bx), ay: Math.min(ay, by), bx: Math.max(ax, bx), by: Math.max(ay, by), tile }),
    praca: (cx, cy, raio, tile = T.PEDRA) => cidade.formas.push({ tipo: "circ", cx, cy, raio, tile }),
    agua: (cx, cy, raio) => cidade.formas.push({ tipo: "circ", cx, cy, raio, tile: T.AGUA }),
    // uma fileira de casas com a porta na linha "base", nas colunas xs, alternando as cores
    casas: (tipo, base, xs, cores, w = 3, h = 2) => xs.forEach((x, i) => obra(tipo, x, base, w, h, cores[i % cores.length])),
    obra,
    lampioes: (pontos, cor) => pontos.forEach(([x, y]) => obra("lampiao", x, y, 0.5, 0.5, cor)),
    arvores: (pontos, tipo = "redonda") => pontos.forEach(([x, y]) => ARVORES_CIDADE.push({ x, y, tipo })),
    morador: (h) => HABITANTES.push(h),
    // o contorno: muralha de pedra com torres (ou cerca de madeira), com portões abertos nos vãos
    contorno: (tipo, { norte = [], sul = [], oeste = [], leste = [] } = {}) => {
      const muro = tipo === "muralha";
      const frente = muro ? "muralha" : "cerca";
      const lado = muro ? "muralhaLado" : "cercaLado";
      const vao = (lista, v) => lista.some(([a, b]) => v >= a && v <= b);
      for (let x = x0 + 1; x < x1; x += 2) {
        if (!vao(norte, x) && !vao(norte, x + 1)) obra(frente, x, y0, 1, 1);
        if (!vao(sul, x) && !vao(sul, x + 1)) obra(frente, x, y1, 1, 1);
      }
      for (let y = y0 + 1; y < y1; y++) {
        if (!vao(oeste, y)) obra(lado, x0, y, 0.5, 1);
        if (!vao(leste, y)) obra(lado, x1, y, 0.5, 1);
      }
      if (muro) {
        // torres nos cantos e dos dois lados de cada portão
        const torres = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
        norte.forEach(([a, b]) => torres.push([a - 2, y0], [b + 2, y0]));
        sul.forEach(([a, b]) => torres.push([a - 2, y1], [b + 2, y1]));
        oeste.forEach(([a, b]) => torres.push([x0, a - 2], [x0, b + 2]));
        leste.forEach(([a, b]) => torres.push([x1, a - 2], [x1, b + 2]));
        torres.forEach(([x, y]) => obra("torreMuralha", x, y, 1.5, 1));
      }
    },
  };
  if (placa) PLACAS.push({ id: `placa-${id}`, tx: placa[0], ty: placa[1], nome, icone, texto: placa[2], cidade: true });
  return plano;
}

const VISUAL = (v) => ({ magia: "#6ef0ff", acessorio: "nenhum", ...v });

// ---- Elyndor, a Capital: muralha com quatro portões, avenidas em cruz, praça, feira e bairros ----
(() => {
  const c = planoDeCidade({
    id: "elyndor", nome: "Elyndor, a Capital", icone: "🏰", x0: 128, y0: 132, x1: 192, y1: 194, chao: T.GRAMA,
    placa: [155, 197, "🏰 **Elyndor, a Capital do Reino**\n\nMuralhas de pedra, a praça do Arquimago, o Portal da Academia, o Mercado, a Estalagem do Grifo e a feira da avenida. Daqui saem as estradas para todas as cidades."],
  });
  // as duas avenidas de pedra, a praça redonda e as ruas dos bairros
  c.rua(159, 133, 161, 193, T.PEDRA);
  c.rua(129, 159, 191, 161, T.PEDRA);
  c.praca(160, 160, 8.5);
  c.rua(130, 145, 190, 146, T.PEDRA);
  c.rua(130, 174, 190, 175, T.PEDRA);
  c.rua(130, 186, 190, 187, T.PEDRA);
  c.rua(130, 133, 131, 193, T.CAMINHO);
  c.rua(189, 133, 190, 193, T.CAMINHO);
  // calçadas de quem passa por trás do portal (o portal fica na cabeceira da praça)
  c.rua(153, 146, 155, 152, T.PEDRA);
  c.rua(165, 146, 167, 152, T.PEDRA);
  c.contorno("muralha", { norte: [[158, 162]], sul: [[158, 162]], oeste: [[158, 162]], leste: [[158, 162]] });
  // bairro norte, bairro sul e as casas da avenida
  const cores = ["#a8323e", "#2e5cb8", "#1f7a5c", "#c46a1b", "#6c48c9", "#8a5a2b"];
  c.casas("casa", 144, [135, 143, 151, 169, 177, 185], cores);
  c.casas("casa", 173, [135, 143, 151, 169, 177, 185], cores.slice(2).concat(cores));
  c.casas("casa", 185, [135, 143, 151, 169, 177, 185], cores.slice(4).concat(cores));
  c.casas("casa", 157, [185], ["#a8323e"]);
  // a feira: bancas dos dois lados da avenida, ao sul
  c.casas("banca", 166, [137, 144, 176, 183], ["#a8323e", "#2e5cb8", "#1f7a5c", "#c46a1b"], 1.75, 1);
  // a praça: estátua no meio (vem do cenário), duas fontes e lampiões em volta
  c.obra("fonte", 154, 164, 2, 1);
  c.obra("fonte", 166, 164, 2, 1);
  c.lampioes([[152, 154], [168, 154], [152, 168], [168, 168], [157, 138], [163, 138], [157, 180], [163, 180], [157, 191], [163, 191],
    [132, 159], [186, 162], [140, 147], [180, 147], [140, 176], [180, 176]]);
  // jardins entre a muralha e os bairros
  c.arvores([[134, 137], [141, 136], [148, 137], [172, 137], [179, 136], [186, 137], [135, 191], [143, 192], [177, 192], [185, 191]]);
  c.arvores([[137, 138], [182, 138], [139, 191], [181, 191]], "arbusto");
  const morador = c.morador;
  morador({
    id: "guarda", nome: "Bento, o Guarda do Portal", tx: 163, ty: 152,
    visual: VISUAL({ pele: "#c98d63", cabelo: "curto", corCabelo: "#2b1d14", rosto: "serio", chapeu: "elmoFerro", manto: "#5a5a6e", detalhe: "#f5c451", item: "espadaEscudo" }),
    falas: [
      "Quanto mais longe da capital, mais forte o monstro. Os slimes dos campos são fáceis; os dragões do norte... nem tanto.",
      "O minimapa no canto mostra onde tu está. Aperta **M** para ver o Reino inteiro, com todas as cidades.",
      "Viu o véu roxo nas fronteiras? É a **barreira mágica** dos magos da Academia. Ela só deixa passar quem tem nível para aguentar o que vive do outro lado.",
      "O quadro de avisos sempre tem **missões**. Aperta **J** para ver as tuas e resgatar a recompensa quando cumprir.",
    ],
  });
  morador({
    id: "cartografa", nome: "Mira, a Cartógrafa", tx: 155, ty: 170,
    visual: VISUAL({ corpo: "feminino", pele: "#f6d3b3", cabelo: "coque", corCabelo: "#b5532a", rosto: "sorriso", chapeu: "boina", manto: "#2e8b57", detalhe: "#ffd166", item: "grimorio", magia: "#ffd166", acessorio: "oculos" }),
    falas: [
      "Desenhei o Reino todo! São **seis cidades**: a capital Elyndor, **Porto Sereno** ao sul, **Pinhalva** na floresta, **Lodaçal** no pântano, **Qadir** no oásis do deserto e **Picogelo** nas montanhas.",
      "**Oeste**: Floresta Uivante (☠☠). **Sudoeste**: Pântano das Alucinações (☠☠). **Leste**: Deserto dos Bugs (☠☠☠). **Norte**: Montanhas do Dragão (☠☠☠☠).",
      "Viu uma pedra brilhando ou um baú perdido? São **enigmas**: resolve e leva o tesouro!",
    ],
  });
  morador({
    id: "ferreiro", nome: "Duran, o Ferreiro", tx: 139, ty: 158,
    visual: VISUAL({ pele: "#9a6440", cabelo: "raspado", corCabelo: "#2b1d14", rosto: "confiante", chapeu: "nenhum", manto: "#5c3418", detalhe: "#c9cbe0", item: "martelo", magia: "#ff7a1a", acessorio: "barba" }),
    falas: [
      "Espada boa é como script bom: testa antes de levar para a batalha.",
      "Traz os **materiais** que os monstros soltam para a minha **Casa da Forja**, aqui do lado. Com eles eu forjo peças que nenhuma loja vende!",
      "Escama de dragão, lágrima de rainha, coroa do Vazio... Já ouviste falar da **Aurora do Saber**? Só se forja com **Fragmentos do Oráculo**.",
    ],
  });
  morador({
    id: "crianca", nome: "Pipo", tx: 165, ty: 169,
    visual: VISUAL({ pele: "#e9b98f", cabelo: "cacheado", corCabelo: "#6b3e1f", rosto: "surpreso", chapeu: "nenhum", manto: "#e86fa8", detalhe: "#ffd166", item: "varinha", magia: "#ff7ad9" }),
    falas: ["Quando eu crescer quero ser arquimago igual ao Orion!", "Vi um dragãozinho voando lá na Academia. Será que ele é filho dos dragões das montanhas?"],
  });
  morador({
    id: "feirante", nome: "Dona Lúcia, a Feirante", tx: 147, ty: 168,
    visual: VISUAL({ corpo: "feminino", pele: "#8a5a3a", cabelo: "coque", corCabelo: "#2b1d14", rosto: "sorriso", chapeu: "nenhum", manto: "#c46a1b", detalhe: "#ffd166", item: "grimorio", magia: "#ffd166", acessorio: "brinco" }),
    falas: ["Fruta fresca, pergunta fresca! Na feira da capital tudo é conferido duas vezes.", "Quem vem de Qadir traz especiarias; quem vem de Porto Sereno traz peixe e histórias de marinheiro."],
  });
})();

// ---- Porto Sereno: a rua da beira-mar com casas viradas para o mar, cais de madeira e o farol ----
(() => {
  const c = planoDeCidade({
    id: "porto", nome: "Porto Sereno", icone: "⚓", x0: 126, y0: 198, x1: 202, y1: 210, chao: T.GRAMA, aguaFica: true,
    placa: [156, 207, "⚓ **Porto Sereno**\n\nA cidade do cais: pescadores, marinheiros e o farol que guia os barcos de volta. Diz a lenda que, nas noites claras, dá para ver as luzes da Academia refletidas no mar."],
  });
  c.rua(128, 206, 200, 207, T.CAMINHO);
  c.rua(159, 195, 161, 205, T.PEDRA);
  // os cais entram no mar (a água continua embaixo, e eles viram ponte)
  c.rua(150, 208, 151, 223, T.PONTE);
  c.rua(176, 208, 177, 223, T.PONTE);
  c.casas("casa", 205, [132, 140, 148, 168, 176, 184, 192], ["#2e5cb8", "#e8eef5", "#1f7a5c", "#2e5cb8", "#a8323e", "#e8eef5", "#2e5cb8"]);
  c.obra("farol", 198, 212, 1.5, 1);
  c.casas("banca", 210, [142, 170], ["#2e5cb8", "#1f7a5c"], 1.75, 1);
  c.lampioes([[136, 208], [156, 208], [164, 208], [180, 208], [196, 208]], "#ffe08a");
  c.arvores([[129, 204], [200, 204]], "palmeira");
  c.morador({
    id: "pescador", nome: "Tito, o Pescador", tx: 151, ty: 214,
    visual: VISUAL({ pele: "#6b4128", cabelo: "curto", corCabelo: "#e8e4dc", rosto: "sorriso", chapeu: "boina", manto: "#2e5cb8", detalhe: "#e9e4d4", item: "cajado", acessorio: "barba" }),
    falas: ["Esse rio desce das montanhas e deságua bem ali, do lado do porto.", "Paciência, aprendiz. Peixe e resposta boa não vêm na pressa."],
  });
  c.morador({
    id: "faroleira", nome: "Marina, a Faroleira", tx: 195, ty: 213,
    visual: VISUAL({ corpo: "feminino", pele: "#c98d63", cabelo: "longo", corCabelo: "#1b1b1b", rosto: "confiante", chapeu: "boina", manto: "#a8323e", detalhe: "#f2ebdc", item: "orbe", magia: "#ffe08a", acessorio: "cachecol" }),
    falas: ["O farol é como uma boa documentação: ninguém nota, até a noite em que todo mundo precisa dele.", "Os barcos voltam guiados pela luz. Respostas de IA também precisam de um farol: a fonte confiável."],
  });
})();

// ---- Pinhalva: a vila dos lenhadores, numa clareira cercada no meio da Floresta Uivante ----
(() => {
  const c = planoDeCidade({
    id: "pinhalva", nome: "Pinhalva", icone: "🌲", x0: 24, y0: 124, x1: 56, y1: 154, chao: T.GRAMA,
    placa: [58, 142, "🌲 **Pinhalva, a vila dos lenhadores**\n\nCercada de troncos, no coração da Floresta Uivante. Aqui ninguém sai à noite sem lanterna: os lobos escutam tudo."],
  });
  c.rua(39, 125, 41, 153);
  c.rua(25, 139, 55, 141);
  c.praca(40, 145, 3.5, T.CAMINHO);
  c.contorno("cerca", { norte: [[39, 41]], sul: [[39, 41]], oeste: [[139, 141]], leste: [[139, 141]] });
  c.casas("cabana", 137, [30, 50], ["#8b5a2b", "#6b4423"], 2.75, 2);
  c.casas("cabana", 151, [30, 50], ["#7a4f28", "#8b5a2b"], 2.75, 2);
  c.obra("poco", 40, 146, 1, 1);
  c.lampioes([[37, 138], [43, 138], [37, 143], [43, 143]], "#ffb347");
  c.arvores([[28, 128], [52, 128], [27, 145], [53, 146]], "pinheiro");
  c.morador({
    id: "lenhador", nome: "Bruno, o Lenhador", tx: 35, ty: 142,
    visual: VISUAL({ pele: "#e9b98f", cabelo: "curto", corCabelo: "#a8323e", rosto: "confiante", chapeu: "nenhum", manto: "#a8323e", detalhe: "#2b2540", item: "machado", magia: "#ffb347", acessorio: "barba" }),
    falas: ["Cuidado com os lobos! Eles **correm atrás de ti** quando te veem.", "Tem uma torre em ruínas a leste daqui. O baú dela pede a ordem de um script robusto."],
  });
  c.morador({
    id: "cacadora", nome: "Ana, a Caçadora", tx: 46, ty: 142,
    visual: VISUAL({ corpo: "feminino", pele: "#f1c9a5", cabelo: "rabo", corCabelo: "#6b3e1f", rosto: "serio", chapeu: "capuz", manto: "#2e6a3a", detalhe: "#c9952a", item: "arco", magia: "#7dff9a" }),
    falas: ["O rei dos lobos, **Fenrir**, vive ao norte daqui. Só vai quem domina o básico da IA.", "Rastro de lobo é como log de erro: quem sabe ler chega na origem do problema."],
  });
})();

// ---- Lodaçal: palafitas ligadas por passarelas de madeira, no meio do Pântano das Alucinações ----
(() => {
  const c = planoDeCidade({
    id: "lodacal", nome: "Lodaçal", icone: "🛶", x0: 28, y0: 160, x1: 60, y1: 186, chao: T.LAMA,
    placa: [62, 173, "🛶 **Lodaçal, a vila das palafitas**\n\nCasas em cima de estacas e passarelas de madeira. No pântano, nada é o que parece: aqui se aprende a desconfiar de toda resposta bonita demais."],
  });
  c.rua(29, 172, 59, 173, T.PONTE);
  c.rua(43, 161, 44, 185, T.PONTE);
  c.rua(33, 178, 55, 179, T.PONTE);
  c.casas("palafita", 170, [35, 52], ["#5a7a4a", "#4a6a5a"], 2.5, 2);
  c.casas("palafita", 184, [35], ["#4a5a3a"], 2.5, 2);
  c.obra("cabanaBruxa", 52, 184, 3, 2);
  c.lampioes([[41, 174], [47, 174], [41, 168], [47, 180]], "#7dff9a");
  c.arvores([[31, 163], [58, 165], [30, 183], [58, 183]], "morta");
  c.morador({
    id: "bruxa", nome: "Morgana, a Bruxa do Brejo", tx: 46, ty: 176,
    visual: VISUAL({ corpo: "feminino", pele: "#9be36b", cabelo: "longo", corCabelo: "#2b2540", rosto: "confiante", chapeu: "pontudo", manto: "#2b2540", detalhe: "#7dff9a", item: "orbe", magia: "#7dff9a", acessorio: "brinco" }),
    falas: ["Hihihi... meu caldeirão só abre para quem sabe a receita da **privacidade**.", "Neste pântano, as respostas parecem verdade mas são alucinações. Confere tudo, aprendiz!"],
  });
  c.morador({
    id: "barqueiro", nome: "Grilo, o Barqueiro", tx: 39, ty: 174,
    visual: VISUAL({ pele: "#c98d63", cabelo: "curto", corCabelo: "#6b3e1f", rosto: "surpreso", chapeu: "boina", manto: "#4a6a5a", detalhe: "#e2b04a", item: "cajado", magia: "#7dff9a" }),
    falas: ["As passarelas aguentam qualquer um, menos quem anda distraído olhando o próprio reflexo.", "O **Sapo Rei** mora no brejo a leste. Coroa de ouro, língua mais rápida que flecha!"],
  });
})();

// ---- Qadir: a cidade de adobe em volta do oásis, com o bazar na rua principal ----
(() => {
  const c = planoDeCidade({
    id: "qadir", nome: "Qadir", icone: "🐪", x0: 232, y0: 166, x1: 264, y1: 198, chao: T.AREIA, aguaFica: true,
    placa: [230, 178, "🐪 **Qadir, a cidade do oásis**\n\nCasas de adobe, o bazar das especiarias e a única água doce do Deserto dos Bugs. Os mercadores daqui negociam tudo, menos dados de cliente."],
  });
  c.rua(233, 176, 263, 177, T.PEDRA);
  c.rua(247, 167, 249, 185, T.PEDRA);
  c.praca(248, 190, 6.5, T.PEDRA);
  c.agua(248, 190, 4.2);
  c.contorno("muralha", { oeste: [[175, 178]], leste: [[175, 178]], norte: [[247, 249]] });
  c.casas("casaAdobe", 175, [237, 242, 254, 259], ["#2e8b9a", "#a8323e", "#c46a1b", "#6c48c9"], 2.5, 2);
  c.casas("casaAdobe", 189, [237, 259], ["#a8323e", "#2e8b9a"], 2.5, 2);
  c.casas("banca", 181, [238, 258], ["#c46a1b", "#6c48c9"], 1.75, 1);
  c.lampioes([[245, 178], [251, 178], [245, 183], [251, 183]], "#ffb347");
  c.arvores([[242, 186], [254, 186], [242, 195], [254, 195]], "palmeira");
  c.morador({
    id: "nomade", nome: "Zaki, o Nômade", tx: 250, ty: 179,
    visual: VISUAL({ pele: "#9a6440", cabelo: "curto", corCabelo: "#2b1d14", rosto: "serio", chapeu: "capuz", manto: "#e2b04a", detalhe: "#a8323e", item: "besta", magia: "#ffb347", acessorio: "cachecol" }),
    falas: ["O deserto é cheio de bugs. Os escorpiões perguntam sobre APIs e Git, e ferroam forte.", "Há ruínas antigas a leste e uma pirâmide ao norte. As duas guardam enigmas."],
  });
  c.morador({
    id: "samira", nome: "Samira, a Mercadora", tx: 244, ty: 182,
    visual: VISUAL({ corpo: "feminino", pele: "#c98d63", cabelo: "longo", corCabelo: "#1b1b1b", rosto: "sorriso", chapeu: "capuz", manto: "#2e8b9a", detalhe: "#ffd166", item: "grimorio", magia: "#ffd166", acessorio: "brinco" }),
    falas: ["No bazar, quem não confere o troco sai perdendo. Com IA é igual: confere a resposta!", "O **Escorpião Imperador** guarda as dunas do norte. Ouvi dizer que ele odeia código sem teste."],
  });
})();

// ---- Picogelo: a vila de pedra e neve, no caminho das Montanhas do Dragão ----
(() => {
  const c = planoDeCidade({
    id: "picogelo", nome: "Picogelo", icone: "🏔️", x0: 78, y0: 34, x1: 106, y1: 60, chao: T.NEVE,
    placa: [92, 62, "🏔️ **Picogelo, a vila da neve**\n\nCasas de pedra com telhado branco, lareira acesa o ano todo e a última parada antes dos dragões. Quem sobe daqui, sobe preparado."],
  });
  c.rua(91, 35, 93, 59, T.PEDRA);
  c.rua(79, 46, 105, 47, T.PEDRA);
  c.rua(79, 55, 105, 56, T.PEDRA);
  c.contorno("cerca", { sul: [[91, 93]], norte: [[91, 93]], oeste: [[46, 47]], leste: [[46, 47]] });
  c.casas("casaNeve", 45, [84, 100], ["#5a6a8a", "#7a3a3a"]);
  c.casas("casaNeve", 54, [84, 100], ["#3a5a4a", "#5a6a8a"]);
  c.obra("fonte", 92, 51, 2, 1);
  c.lampioes([[89, 48], [95, 48], [89, 57], [95, 57]], "#ffe08a");
  c.arvores([[80, 39], [104, 39], [80, 58], [104, 58]], "pinheiroNeve");
  c.morador({
    id: "helga", nome: "Helga, a Guia da Montanha", tx: 89, ty: 50,
    visual: VISUAL({ corpo: "feminino", pele: "#f1c9a5", cabelo: "trancas", corCabelo: "#e2b04a", rosto: "confiante", chapeu: "capuz", manto: "#5a6a8a", detalhe: "#e8eef5", item: "cajado", magia: "#6ef0ff", acessorio: "cachecol" }),
    falas: ["Daqui para cima é território de dragão. Leva elixir e paciência.", "**Ignis**, o Dragão Rei, dorme ao norte e a leste. Dizem que ele só respeita quem entende **agentes** e **RAG**."],
  });
})();

// o retângulo de uma cidade (com uma folga em volta): ali não nasce mato nem monstro
function dentroDeCidade(x, y, folga = 0) {
  return CIDADES.some((c) => x >= c.x0 - folga && x <= c.x1 + folga && y >= c.y0 - folga && y <= c.y1 + folga);
}

// O mundo continua existindo entre uma visita e outra (monstros derrotados, posições).
const estadoMundo = { derrotados: {}, monstros: null };

function derrotarMonstro(id) {
  estadoMundo.derrotados[id] = Date.now();
}

function ruidoMundo(x, y) {
  return Math.sin(x * 0.31 + 1.7) * Math.cos(y * 0.37 - 0.4) * 0.5
    + Math.sin(x * 0.83 + y * 0.61) * 0.3 + Math.cos(x * 0.13 - y * 0.92) * 0.2;
}

function hashTile(x, y, n = 0) {
  const v = Math.sin(x * 127.1 + y * 311.7 + n * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

// ---------- geração do mapa ----------

// o rio desce das montanhas, passa a oeste da capital e deságua ao lado de Porto Sereno
const rioX = (y) => 120 + Math.round(Math.sin(y * 0.06) * 8 + Math.sin(y * 0.025 + 2) * 6);

// ---------- clima e vida ----------
// Chove de vez em quando nos campos, no vale e na floresta (o mesmo céu para todo mundo: depende do
// relógio); neva sempre nas montanhas; o pântano tem névoa andando; o deserto, rajadas de areia. À noite
// aparecem vagalumes. Tudo desenhado por cima, na tela (os pássaros ficam em desenharPassaros).
function estaChovendo(agora = Date.now()) {
  // uma pancada de uns 5 minutos a cada ~45 (antes chovia quase um terço do tempo)
  return Math.sin(agora / 1000 / 420) > 0.92;
}

function desenharClima(ctx, camera, w, h, t, regiao, noite) {
  const chuva = estaChovendo() && ["campos", "vale", "floresta"].includes(regiao);
  if (chuva) {
    ctx.fillStyle = "rgba(20, 30, 60, 0.18)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(190, 210, 255, 0.55)";
    for (let i = 0; i < 140; i++) {
      const x = ((i * 97.3 + t * 30) % (w + 40)) - 20;
      const y = ((i * 53.7 + t * 260) % (h + 20)) - 10;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 5);
    }
    // os pingos batendo no chão
    for (let i = 0; i < 12; i++) {
      const k = (t * 3 + i * 0.37) % 1;
      ctx.fillStyle = `rgba(200, 220, 255, ${0.5 * (1 - k)})`;
      ctx.fillRect(Math.round((i * 131) % w), Math.round((i * 71) % h), Math.round(1 + k * 4), 1);
    }
  }
  if (regiao === "montanhas") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    for (let i = 0; i < 90; i++) {
      const x = ((i * 61.1 + Math.sin(t * 0.8 + i) * 12 + t * 8) % (w + 20)) - 10;
      const y = ((i * 43.9 + t * (18 + (i % 5) * 4)) % (h + 10)) - 5;
      ctx.fillRect(Math.round(x), Math.round(y), i % 4 ? 1 : 2, i % 4 ? 1 : 2);
    }
  }
  if (regiao === "pantano") {
    for (let i = 0; i < 6; i++) {
      const y = (i * 0.17 + 0.08) * h;
      ctx.fillStyle = `rgba(170, 210, 180, ${0.07 + 0.03 * Math.sin(t * 0.5 + i)})`;
      ctx.fillRect(Math.round(((t * (5 + i * 2)) % (w * 0.6)) - w * 0.3), Math.round(y), Math.round(w * 1.2), 10);
    }
  }
  if (regiao === "deserto" && Math.sin(t * 0.3) > 0.3) {
    ctx.fillStyle = "rgba(240, 210, 150, 0.45)";
    for (let i = 0; i < 50; i++) {
      const x = ((i * 77 + t * 140) % (w + 60)) - 30;
      const y = (i * 37) % h + Math.sin(t * 2 + i) * 4;
      ctx.fillRect(Math.round(x), Math.round(y), 4, 1);
    }
  }
  if (noite && ["campos", "vale", "floresta", "pantano"].includes(regiao) && !chuva) {
    for (let i = 0; i < 22; i++) {
      const x = (i * 83 + Math.sin(t * 0.7 + i * 2) * 20) % w;
      const y = (i * 59 + Math.cos(t * 0.6 + i) * 14) % h;
      const brilho = Math.max(0, Math.sin(t * 2.2 + i * 1.3));
      ctx.fillStyle = `rgba(210, 255, 120, ${brilho})`;
      ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
      ctx.fillStyle = `rgba(210, 255, 120, ${brilho * 0.25})`;
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 6, 6);
    }
  }
  // (o bando antigo de pássaros, preso na tela, saiu: os pássaros agora são os de desenharPassaros,
  // presos no mundo, com sombra no chão)
}

// o som do passo em cada tipo de chão (Reino e Umbraterra)
const CHAO_DO_PASSO = {
  [T.GRAMA]: "grama", [T.MATA]: "grama", [T.PLANTACAO]: "grama", [T.CAMINHO]: "areia", [T.AREIA]: "areia",
  [T.PEDRA]: "pedra", [T.ROCHA]: "pedra", [T.PONTE]: "madeira", [T.NEVE]: "neve", [T.LAMA]: "lama",
};

function chaoDaRegiao(regiao) {
  return { floresta: T.MATA, pantano: T.LAMA, deserto: T.AREIA, montanhas: T.NEVE }[regiao] ?? T.GRAMA;
}

// as plantações em volta do moinho, a leste da capital: talhões retangulos, bem arrumados
const PLANTACOES = [[196, 179, 214, 188], [216, 168, 226, 178], [196, 190, 206, 196]];

function gerarMundo() {
  const mapa = Array.from({ length: LINHAS }, () => new Array(COLUNAS).fill(T.AGUA));
  const meioX = COLUNAS / 2;
  const meioY = LINHAS / 2;
  for (let y = 0; y < LINHAS; y++) {
    for (let x = 0; x < COLUNAS; x++) {
      // a ilha: um "quadrado arredondado" com a costa recortada pelo ruído
      const nx = (x - meioX) / (meioX - 6);
      const ny = (y - meioY) / (meioY - 6);
      const d = Math.pow(nx ** 4 + ny ** 4, 0.25) + ruidoMundo(x * 0.5, y * 0.5) * 0.05;
      if (d >= 1) continue;
      const regiao = regiaoDe(x, y);
      let t = chaoDaRegiao(regiao);
      if (d > 0.93 && regiao !== "montanhas") t = T.AREIA;
      if (regiao === "montanhas" && ruidoMundo(x * 0.65, y * 0.65) > 0.2) t = T.ROCHA;
      if (regiao === "deserto" && ruidoMundo(x * 0.45 + 40, y * 0.45) > 0.55) t = T.ROCHA;
      if (regiao === "floresta" && ruidoMundo(x * 0.35 + 90, y * 0.35) > 0.62) t = T.AGUA;
      if (regiao === "pantano" && ruidoMundo(x * 0.55 + 13, y * 0.55) > 0.3) t = T.AGUA;
      if (y > 60 && Math.abs(x - rioX(y)) <= 2 && d < 0.97) t = T.AGUA;
      mapa[y][x] = t;
    }
  }
  PLANTACOES.forEach(([ax, ay, bx, by]) => {
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) mapa[y][x] = T.PLANTACAO;
  });

  // as cidades: o chão de base em todo o retângulo (a água fica onde a cidade pede, como o oásis e o mar
  // do porto) e, por cima, as ruas, as praças e o cais, na ordem do plano
  CIDADES.forEach((c) => {
    for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) {
      if (mapa[y]?.[x] === undefined || (c.aguaFica && mapa[y][x] === T.AGUA)) continue;
      mapa[y][x] = c.chao;
    }
    c.formas.forEach((f) => {
      if (f.tipo === "ret") {
        for (let y = f.ay; y <= f.by; y++) for (let x = f.ax; x <= f.bx; x++) {
          if (mapa[y]?.[x] === undefined) continue;
          // no cais, o que é água vira ponte; o resto vira o chão pedido
          mapa[y][x] = f.tile;
        }
      } else {
        const r = Math.ceil(f.raio);
        for (let y = f.cy - r; y <= f.cy + r; y++) for (let x = f.cx - r; x <= f.cx + r; x++) {
          if (Math.hypot(x - f.cx, y - f.cy) <= f.raio && mapa[y]?.[x] !== undefined) mapa[y][x] = f.tile;
        }
      }
    });
  });

  // clareiras: em volta de lugares, enigmas, moradores e construções o chão fica livre
  const limpar = (cx, cy, rx, ry) => {
    for (let y = cy - ry; y <= cy + ry; y++) {
      for (let x = cx - rx; x <= cx + rx; x++) {
        const t = mapa[y]?.[x];
        if (t === undefined || t === T.PEDRA || t === T.PLANTACAO || t === T.PONTE || t === T.CAMINHO) continue;
        if (dentroDeCidade(x, y)) continue; // dentro da cidade o plano já arrumou o chão
        if (t === T.AGUA && !(Math.abs(x - rioX(y)) > 2 || y <= 60)) continue;
        if ([T.AGUA, T.ROCHA].includes(t) || t === T.AREIA) mapa[y][x] = chaoDaRegiao(regiaoDe(x, y));
      }
    }
  };
  Object.values(POSICAO_LUGARES).forEach(([cx, cy]) => limpar(cx, cy, 4, 3));
  Object.values(POSICAO_PUZZLES).forEach(([cx, cy]) => limpar(cx, cy, 2, 2));
  HABITANTES.forEach((h) => limpar(h.tx, h.ty, 1, 1));
  PLACAS.forEach((p) => limpar(p.tx, p.ty, 1, 1));
  CHEFES.forEach(({ tx, ty }) => limpar(tx, ty - 2, 6, 5));
  CONSTRUCOES.forEach(([, cx, cy, w, h]) => limpar(cx, cy - h, Math.ceil(w * ESCALA_CENARIO / 2) + 1, Math.ceil(h * ESCALA_CENARIO / 2) + 1));

  // tiles ocupados por construções e lugares, já no tamanho ampliado (os caminhos desviam deles)
  const ocupado = new Set();
  CONSTRUCOES.forEach(([, cx, cy, w, h]) => tilesDaBase(centroConstrucao(cx, w), cy, w * TILE, h * ESCALA_CENARIO).forEach((t) => ocupado.add(t)));
  HABITANTES.forEach((h) => ocupado.add(`${h.tx},${h.ty}`));
  PLACAS.forEach((p) => ocupado.add(`${p.tx},${p.ty}`));
  Object.entries(POSICAO_LUGARES).forEach(([id, [cx, cy]]) => tilesDaBase(cx * TILE + 8, cy, TAMANHO_LUGARES[id][0], 3).forEach((t) => ocupado.add(t)));
  Object.values(POSICAO_PUZZLES).forEach(([cx, cy]) => ocupado.add(`${cx},${cy}`));
  ocupado.add(`${ESTATUA_PRACA[0]},${ESTATUA_PRACA[1]}`);
  ARVORES_CIDADE.forEach((a) => ocupado.add(`${a.x},${a.y}`));

  // estradas: menor custo saindo da praça até cada destino (atravessar água vira ponte)
  const custo = (t, x, y) => {
    if (ocupado.has(`${x},${y}`)) return undefined;
    return { [T.CAMINHO]: 0.4, [T.PONTE]: 0.4, [T.PEDRA]: 0.4, [T.GRAMA]: 1, [T.MATA]: 1.3, [T.AREIA]: 1.3, [T.NEVE]: 1.4, [T.LAMA]: 1.6, [T.PLANTACAO]: 4, [T.ROCHA]: 30, [T.AGUA]: 18 }[t];
  };
  const origem = [VILA[0], VILA[1] + 4];
  const destinos = [
    ...Object.values(POSICAO_LUGARES).map(([cx, cy]) => [cx, cy + 1]),
    ...Object.values(POSICAO_PUZZLES).map(([cx, cy]) => [cx, cy + 1]),
    ...HABITANTES.map((h) => [h.tx, h.ty + 1]),
    ...CHEFES.map(({ tx, ty }) => [tx, ty + 4]),
    // as placas na entrada de cada cidade: é por elas que as estradas chegam (e ligam as cidades)
    ...PLACAS.map((p) => [p.tx, p.ty + 1]),
  ];
  // uma busca só a partir da praça: dela sai o caminho mais barato até cada destino
  const veio = arvoreDeCaminhos(mapa, origem, custo, new Set(destinos.map(([x, y]) => y * COLUNAS + x)));
  destinos.forEach(([dx, dy]) => {
    for (let k = dy * COLUNAS + dx; k !== -1; k = veio[k]) {
      const x = k % COLUNAS;
      const y = (k - x) / COLUNAS;
      if ([T.PEDRA, T.PLANTACAO, T.PONTE, T.CAMINHO].includes(mapa[y][x])) continue;
      // dentro das cidades as ruas já existem: a estrada só atravessa água (vira ponte)
      if (dentroDeCidade(x, y) && mapa[y][x] !== T.AGUA) continue;
      mapa[y][x] = mapa[y][x] === T.AGUA ? T.PONTE : T.CAMINHO;
    }
  });

  // vegetação e pedras, conforme a região. As árvores ampliadas pedem espaço: nenhuma nasce encostada
  // em outra (sobra pelo menos um tile entre elas, para o herói e os monstros passarem e aparecerem)
  const decoracao = [];
  const arvores = new Set();
  const temArvoreAoLado = (x, y) => [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-2, 0], [0, -2]].some(([dx, dy]) => arvores.has(`${x + dx},${y + dy}`));
  const GRANDES = new Set(["pinheiro", "pinheiroNeve", "redonda", "escura", "morta", "palmeira", "cacto"]);
  const naEstrada = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => [T.CAMINHO, T.PONTE, T.PEDRA].includes(mapa[y + dy]?.[x + dx]));
  const pertoDeAlgo = (x, y) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (ocupado.has(`${x + dx},${y + dy}`)) return true;
    return false;
  };
  for (let y = 1; y < LINHAS - 1; y++) {
    for (let x = 1; x < COLUNAS - 1; x++) {
      const t = mapa[y][x];
      if (![T.GRAMA, T.MATA, T.LAMA, T.AREIA, T.NEVE].includes(t) || naEstrada(x, y) || pertoDeAlgo(x, y)) continue;
      if (dentroDeCidade(x, y, 2)) continue; // cidade não tem mato: só as árvores plantadas
      // o covil de cada chefão fica limpo, para ele aparecer inteiro
      if (CHEFES.some((c) => Math.abs(x - c.tx) <= 6 && y >= c.ty - 6 && y <= c.ty + 3)) continue;
      const regiao = regiaoDe(x, y);
      const h = hashTile(x, y);
      const h2 = hashTile(x, y, 5);
      let tipo = null;
      if (t === T.AREIA && regiao !== "deserto") tipo = h > 0.97 ? "palmeira" : null;
      else if (regiao === "floresta") tipo = h > 0.42 ? (h2 > 0.5 ? "escura" : h2 > 0.2 ? "pinheiro" : "redonda") : h > 0.33 ? "arbusto" : h > 0.31 ? "cogumelo" : null;
      else if (regiao === "pantano") tipo = h > 0.86 ? "morta" : h > 0.74 ? "junco" : h > 0.71 ? "cogumelo" : null;
      else if (regiao === "deserto") tipo = h > 0.95 ? "cacto" : h > 0.935 ? "rocha" : h > 0.925 ? "osso" : null;
      else if (regiao === "montanhas") tipo = h > 0.84 ? "pinheiroNeve" : h > 0.8 ? "rochaNeve" : null;
      else tipo = h > 0.955 ? (h2 > 0.5 ? "redonda" : "pinheiro") : h > 0.93 ? "arbusto" : h > 0.925 ? "rocha" : null;
      if (tipo && GRANDES.has(tipo)) {
        if (temArvoreAoLado(x, y)) continue;
        arvores.add(`${x},${y}`);
      }
      if (tipo) decoracao.push({ x, y, tipo });
    }
  }
  // as árvores, palmeiras e arbustos plantados nas praças e jardins das cidades
  ARVORES_CIDADE.forEach((a) => decoracao.push(a));
  return { mapa, decoracao };
}

// Dijkstra com fila de prioridade (heap) a partir de um ponto, para o mapa todo de uma vez.
// Devolve, para cada tile, de qual tile se chega nele (-1 na origem). Os destinos sempre aceitam entrar.
function arvoreDeCaminhos(mapa, inicio, custo, destinos) {
  const COLUNAS = mapa[0].length; // vale para qualquer mapa (o Reino e Umbraterra)
  const LINHAS = mapa.length;
  const n = COLUNAS * LINHAS;
  const dist = new Float64Array(n).fill(Infinity);
  const veio = new Int32Array(n).fill(-1);
  const heap = [];
  const subir = (i) => {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const descer = (i) => {
    for (;;) {
      const e = i * 2 + 1;
      const d = e + 1;
      let m = i;
      if (e < heap.length && heap[e][0] < heap[m][0]) m = e;
      if (d < heap.length && heap[d][0] < heap[m][0]) m = d;
      if (m === i) break;
      [heap[m], heap[i]] = [heap[i], heap[m]];
      i = m;
    }
  };
  const k0 = inicio[1] * COLUNAS + inicio[0];
  dist[k0] = 0;
  heap.push([0, k0]);
  while (heap.length) {
    const [d, k] = heap[0];
    const ultimo = heap.pop();
    if (heap.length) {
      heap[0] = ultimo;
      descer(0);
    }
    if (d > dist[k]) continue;
    const x = k % COLUNAS;
    const y = (k - x) / COLUNAS;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const vx = x + dx;
      const vy = y + dy;
      if (vx < 0 || vy < 0 || vx >= COLUNAS || vy >= LINHAS) continue;
      const vk = vy * COLUNAS + vx;
      const c = destinos.has(vk) ? 0.4 : custo(mapa[vy][vx], vx, vy);
      if (c === undefined) continue;
      if (d + c < dist[vk]) {
        dist[vk] = d + c;
        veio[vk] = k;
        heap.push([d + c, vk]);
        subir(heap.length - 1);
      }
    }
  }
  return veio;
}

// ---------- arte dos tiles ----------

const CORES_TILE = {
  [T.AGUA]: "#2f7fbf", [T.AREIA]: "#e8d39a", [T.GRAMA]: "#5fa84a", [T.CAMINHO]: "#c9a26b", [T.ROCHA]: "#7a7266",
  [T.PONTE]: "#8b5a2b", [T.NEVE]: "#e8eef5", [T.LAMA]: "#5b6340", [T.MATA]: "#3f7d3a", [T.PEDRA]: "#a39a88", [T.PLANTACAO]: "#7a5230",
};

function pintarTile(ctx, mapa, x, y) {
  const t = mapa[y][x];
  const ox = x * TILE;
  const oy = y * TILE;
  const ponto = (px, py, cor) => retangulo(ctx, ox + px, oy + py, 1, 1, cor);
  const salpicar = (quantos, cor, n) => {
    for (let i = 0; i < quantos; i++) ponto(Math.floor(hashTile(x, y, n + i) * 16), Math.floor(hashTile(x, y, n + i + 50) * 16), cor);
  };
  const vizinho = (dx, dy) => mapa[y + dy]?.[x + dx];
  const naoAgua = (v) => v !== undefined && v !== T.AGUA && v !== T.PONTE;

  if (t === T.AGUA) {
    const pantano = regiaoDe(x, y) === "pantano";
    retangulo(ctx, ox, oy, TILE, TILE, pantano ? "#3d6b5a" : "#2f7fbf");
    salpicar(6, pantano ? "#4a7d68" : "#3d8fc9", 1);
    const espuma = pantano ? "#8fb39a" : "#a7dcff";
    if (naoAgua(vizinho(0, -1))) retangulo(ctx, ox, oy, TILE, 2, espuma);
    if (naoAgua(vizinho(-1, 0))) retangulo(ctx, ox, oy, 1, TILE, espuma);
    if (naoAgua(vizinho(1, 0))) retangulo(ctx, ox + 15, oy, 1, TILE, espuma);
    return;
  }
  if (t === T.AREIA) {
    const deserto = regiaoDe(x, y) === "deserto";
    retangulo(ctx, ox, oy, TILE, TILE, deserto ? "#e2c27a" : "#e8d39a");
    salpicar(8, deserto ? "#cfa95e" : "#d9c07f", 2);
    salpicar(4, "#f5e6b8", 20);
    if (deserto && hashTile(x, y, 11) > 0.7) retangulo(ctx, ox + 2, oy + 9, 10, 1, "#cfa95e");
    return;
  }
  if (t === T.ROCHA) {
    const alto = regiaoDe(x, y) === "montanhas";
    retangulo(ctx, ox, oy, TILE, TILE, alto ? "#8a8b99" : "#a0703f");
    salpicar(10, alto ? "#6b6c7a" : "#8a5c32", 3);
    salpicar(6, alto ? "#a3a6c2" : "#c08a52", 30);
    if (vizinho(0, -1) !== T.ROCHA) retangulo(ctx, ox, oy, TILE, 3, alto ? "#f2f4ff" : "#d9a066");
    if (vizinho(0, 1) !== undefined && vizinho(0, 1) !== T.ROCHA) retangulo(ctx, ox, oy + 13, TILE, 3, alto ? "#5d5e6b" : "#6e4a28");
    return;
  }
  if (t === T.NEVE) {
    retangulo(ctx, ox, oy, TILE, TILE, "#e8eef5");
    salpicar(6, "#cfd8e6", 12);
    salpicar(3, "#ffffff", 70);
    return;
  }
  if (t === T.LAMA) {
    retangulo(ctx, ox, oy, TILE, TILE, "#5b6340");
    salpicar(8, "#4a5233", 14);
    salpicar(3, "#7a8455", 80);
    if (hashTile(x, y, 12) > 0.85) retangulo(ctx, ox + 5, oy + 6, 3, 2, "#3d6b5a");
    return;
  }
  if (t === T.PEDRA) {
    retangulo(ctx, ox, oy, TILE, TILE, "#a39a88");
    for (let i = 0; i < 4; i++) {
      retangulo(ctx, ox, oy + i * 4, TILE, 1, "#8a8170");
      retangulo(ctx, ox + ((i % 2) * 4 + 2), oy + i * 4, 1, 4, "#8a8170");
      retangulo(ctx, ox + ((i % 2) * 4 + 10), oy + i * 4, 1, 4, "#8a8170");
    }
    salpicar(3, "#b8ae9a", 90);
    return;
  }
  if (t === T.PLANTACAO) {
    retangulo(ctx, ox, oy, TILE, TILE, "#7a5230");
    for (let i = 0; i < 4; i++) {
      retangulo(ctx, ox, oy + i * 4 + 2, TILE, 1, "#5c3c22");
      for (let j = 0; j < 4; j++) {
        retangulo(ctx, ox + j * 4 + 1, oy + i * 4, 1, 2, "#5fa84a");
        if ((i + j + x) % 3 === 0) retangulo(ctx, ox + j * 4 + 2, oy + i * 4, 1, 1, "#ffd166");
      }
    }
    return;
  }
  // grama (e mata escura) por baixo de caminho e ponte também
  const mata = t === T.MATA || (t !== T.GRAMA && regiaoDe(x, y) === "floresta");
  retangulo(ctx, ox, oy, TILE, TILE, mata ? "#3f7d3a" : "#5fa84a");
  salpicar(7, mata ? "#356b31" : "#4f9a3e", 4);
  salpicar(4, mata ? "#4f9445" : "#78c25e", 40);
  if ((t === T.GRAMA || t === T.MATA) && hashTile(x, y, 7) > (mata ? 0.93 : 0.86)) {
    const cor = ["#fff6c9", "#ff7ad9", "#ffd166", "#a7dcff"][Math.floor(hashTile(x, y, 8) * 4)];
    const fx = 3 + Math.floor(hashTile(x, y, 9) * 10);
    const fy = 3 + Math.floor(hashTile(x, y, 10) * 10);
    ponto(fx, fy + 1, "#3b7d2e");
    ponto(fx, fy, cor);
    ponto(fx - 1, fy, cor);
    ponto(fx + 1, fy, cor);
    ponto(fx, fy - 1, cor);
  }
  if (t === T.CAMINHO) {
    retangulo(ctx, ox, oy, TILE, TILE, "#c9a26b");
    salpicar(6, "#b08a55", 5);
    salpicar(3, "#dcb98a", 60);
    [[0, -1, 0, 0, TILE, 1], [0, 1, 0, 15, TILE, 1], [-1, 0, 0, 0, 1, TILE], [1, 0, 15, 0, 1, TILE]].forEach(([dx, dy, rx, ry, w, h]) => {
      const v = vizinho(dx, dy);
      if ([T.GRAMA, T.MATA, T.AREIA, T.NEVE, T.LAMA].includes(v)) {
        const borda = CORES_TILE[v];
        for (let i = 0; i < Math.max(w, h); i += 2) {
          if (hashTile(x, y, i + dx * 3 + dy * 7) > 0.4) {
            retangulo(ctx, ox + rx + (w > 1 ? i : 0), oy + ry + (h > 1 ? i : 0), w > 1 ? 2 : 1, h > 1 ? 2 : 1, borda);
          }
        }
      }
    });
  }
  if (t === T.PONTE) {
    retangulo(ctx, ox, oy, TILE, TILE, "#2f7fbf");
    const vertical = naoAgua(vizinho(0, -1)) || naoAgua(vizinho(0, 1));
    for (let i = 0; i < TILE; i += 4) {
      if (vertical) {
        retangulo(ctx, ox, oy + i, TILE, 3, "#8b5a2b");
        retangulo(ctx, ox, oy + i + 3, TILE, 1, "#5c3418");
      } else {
        retangulo(ctx, ox + i, oy, 3, TILE, "#8b5a2b");
        retangulo(ctx, ox + i + 3, oy, 1, TILE, "#5c3418");
      }
    }
  }
}

// ---------- sprites ----------

const cacheSpritesReino = {};
function spriteReino(nome, criar) {
  if (!cacheSpritesReino[nome]) cacheSpritesReino[nome] = criar();
  return cacheSpritesReino[nome];
}

// Enquanto um monstro está sendo desenhado (comoCriatura), cada desenho ganha o volume do herói (luz de cima
// à esquerda e a sombra fria) antes do contorno. Casas, árvores e o resto do cenário ficam como são.
let desenhandoCriatura = 0;
function desenhar(largura, altura, pintar, contorno = "auto") {
  const { canvas, ctx } = criarTela(largura + 2, altura + 2);
  ctx.translate(1, 1);
  pintar(ctx);
  if (desenhandoCriatura) iluminarVolume(canvas, "lado");
  return contorno ? contornar(canvas, contorno) : canvas;
}
function comoCriatura(criar) {
  return (...args) => {
    desenhandoCriatura++;
    try {
      return criar(...args);
    } finally {
      desenhandoCriatura--;
    }
  };
}
// os desenhos (e os quadros de andar) de todos os monstros passam a sair com volume; chamado no fim de umbra.js,
// depois que os de Umbraterra entram na lista
function monstrosComVolume() {
  Object.values(TIPOS_MONSTRO).forEach((tipo) => {
    if (tipo.comVolume) return;
    if (tipo.sprite) tipo.sprite = comoCriatura(tipo.sprite);
    if (tipo.quadros) tipo.quadros = comoCriatura(tipo.quadros);
    tipo.comVolume = true;
  });
}

function bola(ctx, cx, cy, r, cor) {
  ctx.fillStyle = cor;
  for (let y = -r; y <= r; y++) {
    const meia = Math.round(Math.sqrt(r * r - y * y));
    ctx.fillRect(cx - meia, cy + y, meia * 2 + 1, 1);
  }
}

const SPRITES_DECORACAO = {
  pinheiro: () => desenhar(18, 26, (ctx) => {
    for (let i = 0; i < 18; i++) {
      const meia = Math.floor(i / 3) + 2 - (i % 6 === 5 ? 1 : 0);
      retangulo(ctx, 9 - meia, 2 + i, meia * 2, 1, i % 6 < 2 ? "#2f8a4c" : i % 6 < 4 ? "#256e3c" : "#1d5a31");
      if (i % 6 === 0) retangulo(ctx, 9 - meia + 1, 2 + i, 2, 1, "#4aa35b");
    }
    retangulo(ctx, 8, 20, 2, 5, "#6b4423");
  }, "#14301c"),
  pinheiroNeve: () => desenhar(18, 26, (ctx) => {
    for (let i = 0; i < 18; i++) {
      const meia = Math.floor(i / 3) + 2 - (i % 6 === 5 ? 1 : 0);
      retangulo(ctx, 9 - meia, 2 + i, meia * 2, 1, i % 6 < 1 ? "#ffffff" : i % 6 < 3 ? "#2a6b4c" : "#1d5a40");
    }
    retangulo(ctx, 8, 20, 2, 5, "#6b4423");
  }, "#14302a"),
  redonda: () => desenhar(18, 26, (ctx) => {
    [[9, 9, 7, "#2f7d46"], [6, 11, 5, "#2f7d46"], [12, 11, 5, "#2a6b40"], [9, 7, 5, "#3b9150"]].forEach(([cx, cy, r, cor]) => bola(ctx, cx, cy, r, cor));
    [[7, 5], [8, 4], [10, 6], [5, 9]].forEach(([x, y]) => retangulo(ctx, x, y, 1, 1, "#5fb86b"));
    retangulo(ctx, 8, 17, 2, 8, "#6b4423");
  }, "#14301c"),
  escura: () => desenhar(20, 30, (ctx) => {
    [[10, 10, 8, "#1f5a33"], [6, 13, 6, "#1d5030"], [14, 13, 6, "#1a4a2b"], [10, 7, 6, "#2a6b40"]].forEach(([cx, cy, r, cor]) => bola(ctx, cx, cy, r, cor));
    [[8, 5], [11, 4], [6, 9]].forEach(([x, y]) => retangulo(ctx, x, y, 1, 1, "#3b9150"));
    retangulo(ctx, 9, 20, 3, 9, "#4a2f18");
  }, "#0d2414"),
  morta: () => desenhar(16, 24, (ctx) => {
    retangulo(ctx, 7, 6, 2, 18, "#4a3a2a");
    [[4, 4, 3, 1], [3, 3, 1, 2], [9, 8, 4, 1], [12, 6, 1, 2], [5, 11, 2, 1], [9, 13, 3, 1]].forEach(([x, y, w, h]) => retangulo(ctx, x, y, w, h, "#4a3a2a"));
    retangulo(ctx, 6, 22, 4, 2, "#3a2d20");
  }, "#1d1712"),
  palmeira: () => desenhar(20, 28, (ctx) => {
    for (let i = 0; i < 18; i++) retangulo(ctx, 9 + Math.round(Math.sin(i * 0.15) * 2), 9 + i, 2, 1, i % 3 ? "#8b5a2b" : "#6b4423");
    [[-1, 0], [1, 0], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
      for (let i = 0; i < 9; i++) retangulo(ctx, 10 + sx * i, 6 + sy * Math.round(i * 0.5) + Math.round(i * i * 0.04), 2, 2, i % 2 ? "#2f8a4c" : "#3b9150");
    });
    retangulo(ctx, 9, 7, 2, 2, "#8b5a2b");
  }, "#14301c"),
  cacto: () => desenhar(14, 22, (ctx) => {
    retangulo(ctx, 5, 2, 4, 20, "#3f8f4a");
    retangulo(ctx, 6, 2, 1, 20, "#5fb86b");
    retangulo(ctx, 1, 8, 2, 6, "#3f8f4a");
    retangulo(ctx, 1, 13, 4, 2, "#3f8f4a");
    retangulo(ctx, 11, 5, 2, 6, "#3f8f4a");
    retangulo(ctx, 9, 10, 4, 2, "#3f8f4a");
    retangulo(ctx, 6, 0, 2, 2, "#ff7ad9");
  }, "#14301c"),
  arbusto: () => desenhar(14, 10, (ctx) => {
    bola(ctx, 4, 6, 4, "#2f7d46");
    bola(ctx, 9, 5, 4, "#3b9150");
    bola(ctx, 7, 7, 3, "#2a6b40");
    [[3, 4], [9, 3], [11, 6]].forEach(([x, y]) => retangulo(ctx, x, y, 1, 1, "#e63946"));
  }, "#14301c"),
  cogumelo: () => desenhar(8, 8, (ctx) => {
    retangulo(ctx, 3, 4, 2, 4, "#f2ebdc");
    retangulo(ctx, 0, 1, 8, 3, "#d64534");
    retangulo(ctx, 1, 0, 6, 1, "#d64534");
    retangulo(ctx, 2, 1, 1, 1, "#ffffff");
    retangulo(ctx, 5, 2, 1, 1, "#ffffff");
  }),
  junco: () => desenhar(10, 12, (ctx) => {
    [[1, 3], [4, 0], [7, 2]].forEach(([x, y]) => {
      retangulo(ctx, x, y + 2, 1, 12 - y - 2, "#6b8a3a");
      retangulo(ctx, x, y, 1, 3, "#5c3418");
    });
  }, null),
  osso: () => desenhar(12, 6, (ctx) => {
    retangulo(ctx, 2, 2, 8, 2, "#f2ebdc");
    [[0, 1], [0, 3], [10, 1], [10, 3]].forEach(([x, y]) => retangulo(ctx, x, y, 2, 2, "#f2ebdc"));
  }),
  rocha: () => desenhar(14, 10, (ctx) => {
    bola(ctx, 6, 6, 4, "#8a8b99");
    bola(ctx, 9, 7, 3, "#7a7b88");
    retangulo(ctx, 4, 3, 3, 1, "#c9cbe0");
  }),
  rochaNeve: () => desenhar(14, 10, (ctx) => {
    bola(ctx, 6, 6, 4, "#8a8b99");
    bola(ctx, 9, 7, 3, "#7a7b88");
    retangulo(ctx, 3, 2, 6, 2, "#ffffff");
  }),
};
// o que só enfeita (dá para passar por cima)
const DECORACAO_SEM_COLISAO = new Set(["arbusto", "cogumelo", "junco", "osso"]);

function telhado(ctx, x, y, w, alturaTelhado, cor) {
  for (let i = 0; i < alturaTelhado; i++) retangulo(ctx, x + i, y - i, w - i * 2, 1, i % 3 === 0 ? tom(cor, 0.7) : cor);
}

const SPRITES_CONSTRUCAO = {
  casa: (cor) => desenhar(48, 44, (ctx) => {
    retangulo(ctx, 4, 20, 40, 24, "#e9d6a8");
    for (let x = 4; x < 44; x += 13) retangulo(ctx, x, 20, 2, 24, "#5c3418");
    retangulo(ctx, 4, 30, 40, 2, "#5c3418");
    telhado(ctx, 0, 20, 48, 16, cor);
    retangulo(ctx, 32, 2, 5, 10, "#6d6d7a");
    retangulo(ctx, 20, 32, 8, 12, "#5c3418");
    retangulo(ctx, 26, 37, 1, 2, "#f5c451");
    [[8, 23], [35, 23]].forEach(([x, y]) => {
      retangulo(ctx, x, y, 6, 6, "#ffd96b");
      retangulo(ctx, x + 2, y, 1, 6, "#5c3418");
      retangulo(ctx, x, y + 2, 6, 1, "#5c3418");
    });
    retangulo(ctx, 6, 40, 10, 4, "#2f7d46");
    [[8, 40], [12, 41]].forEach(([x, y]) => retangulo(ctx, x, y, 1, 1, "#ff7ad9"));
  }),
  ferraria: () => desenhar(48, 40, (ctx) => {
    retangulo(ctx, 2, 14, 44, 26, "#7a7266");
    for (let y = 16; y < 40; y += 5) retangulo(ctx, 2, y, 44, 1, "#5f584e");
    telhado(ctx, 0, 14, 48, 10, "#4a4a55");
    retangulo(ctx, 36, 0, 7, 12, "#5f584e");
    retangulo(ctx, 10, 24, 22, 16, "#2b1d14");
    retangulo(ctx, 13, 30, 8, 3, "#6d6d7a");
    retangulo(ctx, 15, 33, 4, 4, "#4a4a55");
    retangulo(ctx, 24, 32, 6, 8, "#ff7a1a");
    retangulo(ctx, 25, 34, 4, 4, "#ffd166");
  }),
  poco: () => desenhar(20, 26, (ctx) => {
    retangulo(ctx, 2, 4, 2, 14, "#5c3418");
    retangulo(ctx, 16, 4, 2, 14, "#5c3418");
    telhado(ctx, 0, 6, 20, 6, "#a8323e");
    retangulo(ctx, 1, 16, 18, 10, "#8a8b99");
    retangulo(ctx, 1, 16, 18, 2, "#c9cbe0");
    retangulo(ctx, 4, 18, 12, 3, "#2f7fbf");
    retangulo(ctx, 9, 8, 2, 8, "#a3a6c2");
  }),
  estatua: () => spriteEstatuaArquimago(),
  moinho: () => desenhar(40, 46, (ctx) => {
    for (let y = 10; y < 46; y++) {
      const meia = 8 + Math.round((y - 10) * 0.25);
      retangulo(ctx, 20 - meia, y, meia * 2, 1, y % 6 === 0 ? "#c9b98a" : "#e9d6a8");
    }
    telhado(ctx, 10, 12, 20, 8, "#8b5a2b");
    retangulo(ctx, 16, 34, 8, 12, "#5c3418");
    retangulo(ctx, 18, 20, 4, 4, "#ffd96b");
  }),
  torre: () => desenhar(32, 52, (ctx) => {
    retangulo(ctx, 4, 10, 24, 42, "#8a8b99");
    for (let y = 12; y < 52; y += 6) retangulo(ctx, 4, y, 24, 1, "#6b6c7a");
    [[4, 4, 5, 6], [12, 7, 4, 3], [20, 2, 5, 8]].forEach(([x, y, w, h]) => retangulo(ctx, x, y, w, h, "#8a8b99"));
    retangulo(ctx, 12, 38, 8, 14, "#1b1533");
    retangulo(ctx, 13, 18, 5, 7, "#1b1533");
    [[5, 20], [6, 24], [24, 30], [25, 34], [7, 40]].forEach(([x, y]) => retangulo(ctx, x, y, 2, 3, "#2f7d46"));
  }),
  cabana: (cor) => desenhar(44, 36, (ctx) => {
    retangulo(ctx, 4, 16, 36, 20, cor);
    for (let y = 18; y < 36; y += 4) retangulo(ctx, 4, y, 36, 1, tom(cor, 0.6));
    telhado(ctx, 0, 16, 44, 14, "#4a3a2a");
    retangulo(ctx, 18, 24, 8, 12, "#3a2412");
    retangulo(ctx, 8, 21, 6, 5, "#ffd96b");
    retangulo(ctx, 32, 28, 6, 8, "#8b5a2b");
    retangulo(ctx, 33, 27, 4, 1, "#a8703a");
  }),
  cabanaBruxa: () => desenhar(44, 46, (ctx) => {
    [[8], [34]].forEach(([x]) => retangulo(ctx, x, 30, 3, 16, "#3a2d20"));
    retangulo(ctx, 4, 16, 36, 16, "#4a3a2a");
    for (let i = 0; i < 16; i++) retangulo(ctx, 2 + i + (i > 10 ? 2 : 0), 16 - i, 40 - i * 2, 1, i % 3 ? "#4a2f6b" : "#2b2540");
    retangulo(ctx, 20, 0, 4, 4, "#4a2f6b");
    retangulo(ctx, 10, 20, 6, 5, "#7dff9a");
    retangulo(ctx, 26, 22, 8, 10, "#2b1d14");
  }),
  piramide: () => desenhar(84, 50, (ctx) => {
    for (let i = 0; i < 12; i++) retangulo(ctx, i * 3.5, 50 - (i + 1) * 4, 84 - i * 7, 4, i % 2 ? "#d9b56a" : "#e2c27a");
    for (let i = 0; i < 12; i++) retangulo(ctx, i * 3.5, 50 - (i + 1) * 4, 84 - i * 7, 1, "#f5e0a8");
    retangulo(ctx, 36, 34, 12, 16, "#3a2412");
    retangulo(ctx, 38, 32, 8, 2, "#3a2412");
    retangulo(ctx, 40, 8, 4, 4, "#6ef0ff");
  }),
  coluna: () => desenhar(12, 34, (ctx) => {
    retangulo(ctx, 2, 4, 8, 26, "#e2c27a");
    retangulo(ctx, 3, 4, 2, 26, "#f5e0a8");
    retangulo(ctx, 0, 30, 12, 4, "#cfa95e");
    retangulo(ctx, 0, 2, 12, 3, "#cfa95e");
    retangulo(ctx, 7, 0, 3, 2, "#cfa95e");
  }),
  fortaleza: () => desenhar(84, 60, (ctx) => {
    retangulo(ctx, 10, 22, 64, 38, "#8a93a8");
    for (let y = 24; y < 60; y += 6) retangulo(ctx, 10, y, 64, 1, "#6d7590");
    [[2, 8], [66, 4], [34, 14]].forEach(([x, y]) => {
      retangulo(ctx, x, y, 16, 60 - y, "#9aa3b8");
      for (let i = 0; i < 4; i++) retangulo(ctx, x + i * 4, y - 3, 2, 3, "#9aa3b8");
      retangulo(ctx, x, y - 3, 16, 2, "#ffffff");
      retangulo(ctx, x + 6, y + 8, 4, 6, "#1b1533");
    });
    retangulo(ctx, 36, 42, 12, 18, "#1b1533");
    retangulo(ctx, 10, 20, 64, 3, "#ffffff");
    [[20, 34], [56, 30]].forEach(([x, y]) => retangulo(ctx, x, y, 6, 10, "#6ef0ff"));
  }),
  ninho: () => desenhar(50, 18, (ctx) => {
    for (let y = 4; y < 18; y++) {
      const meia = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 11) / 7.5) ** 2)) * 24);
      retangulo(ctx, 25 - meia, y, meia * 2, 1, y % 2 ? "#6b4423" : "#8b5a2b");
    }
    retangulo(ctx, 12, 8, 26, 4, "#3a2412");
    [[16, 3, "#d64534"], [24, 2, "#ffd166"], [32, 3, "#4fa8ff"]].forEach(([x, y, cor]) => {
      bola(ctx, x, y + 3, 3, cor);
      retangulo(ctx, x - 1, y + 1, 1, 1, "#ffffff");
    });
  }),
  // ---- as peças das cidades ----
  // trecho da muralha visto de frente (2 tiles de largura no mundo), com ameias em cima
  muralha: () => desenhar(16, 24, (ctx) => {
    retangulo(ctx, 0, 6, 16, 18, "#8a8b99");
    for (let y = 8; y < 24; y += 4) {
      retangulo(ctx, 0, y, 16, 1, "#6b6c7a");
      for (let x = (y / 4) % 2 ? 0 : 4; x < 16; x += 8) retangulo(ctx, x, y - 3, 1, 3, "#6b6c7a");
    }
    retangulo(ctx, 0, 6, 16, 2, "#b8bccb");
    [0, 6, 12].forEach((x) => {
      retangulo(ctx, x, 1, 4, 5, "#8a8b99");
      retangulo(ctx, x, 1, 4, 1, "#c9cbe0");
    });
    retangulo(ctx, 0, 22, 16, 2, "#5a5b68");
  }),
  // a muralha de lado (as paredes do leste e do oeste): uma fileira estreita, empilhada tile a tile
  muralhaLado: () => desenhar(8, 24, (ctx) => {
    retangulo(ctx, 0, 4, 8, 20, "#7d7e8c");
    retangulo(ctx, 0, 4, 8, 2, "#b8bccb");
    retangulo(ctx, 6, 4, 2, 20, "#6b6c7a");
    for (let y = 9; y < 24; y += 5) retangulo(ctx, 0, y, 8, 1, "#6b6c7a");
    retangulo(ctx, 2, 0, 4, 4, "#8a8b99");
    retangulo(ctx, 2, 0, 4, 1, "#c9cbe0");
  }),
  torreMuralha: (cor = "#a8323e") => desenhar(24, 46, (ctx) => {
    retangulo(ctx, 2, 14, 20, 32, "#8a8b99");
    for (let y = 18; y < 46; y += 5) retangulo(ctx, 2, y, 20, 1, "#6b6c7a");
    retangulo(ctx, 2, 14, 3, 32, "#a3a6b5");
    retangulo(ctx, 0, 8, 24, 7, "#9aa0b3");
    [0, 7, 14, 20].forEach((x) => retangulo(ctx, x, 4, 4, 5, "#9aa0b3"));
    retangulo(ctx, 0, 8, 24, 1, "#d4d7e6");
    retangulo(ctx, 9, 22, 6, 9, "#1b1533");
    retangulo(ctx, 10, 23, 4, 7, "#ffd96b");
    retangulo(ctx, 11, 0, 1, 6, "#3a2412");
    retangulo(ctx, 12, 0, 6, 3, cor);
  }),
  cerca: () => desenhar(16, 12, (ctx) => {
    [1, 8, 14].forEach((x) => {
      retangulo(ctx, x, 1, 2, 11, "#7a4f28");
      retangulo(ctx, x, 1, 2, 1, "#a8703a");
    });
    retangulo(ctx, 0, 4, 16, 2, "#8b5a2b");
    retangulo(ctx, 0, 8, 16, 2, "#8b5a2b");
    retangulo(ctx, 0, 4, 16, 1, "#b98048");
  }),
  cercaLado: () => desenhar(4, 14, (ctx) => {
    retangulo(ctx, 1, 0, 2, 14, "#7a4f28");
    retangulo(ctx, 1, 0, 2, 1, "#a8703a");
    retangulo(ctx, 0, 5, 4, 2, "#8b5a2b");
  }),
  lampiao: (cor = "#ffd96b") => desenhar(8, 26, (ctx) => {
    retangulo(ctx, 3, 8, 2, 16, "#2b2540");
    retangulo(ctx, 1, 24, 6, 2, "#2b2540");
    retangulo(ctx, 1, 1, 6, 8, "#2b2540");
    retangulo(ctx, 2, 2, 4, 5, cor);
    retangulo(ctx, 2, 2, 1, 5, "#ffffff");
    retangulo(ctx, 0, 0, 8, 2, "#3d3555");
  }),
  // banca de feira: toldo listrado na cor da banca e a mercadoria na mesa
  banca: (cor = "#a8323e") => desenhar(28, 26, (ctx) => {
    [1, 25].forEach((x) => retangulo(ctx, x, 6, 2, 20, "#6b4423"));
    for (let x = 0; x < 28; x += 4) retangulo(ctx, x, 2, 4, 6, x % 8 ? "#f2ebdc" : cor);
    for (let x = 0; x < 28; x += 4) retangulo(ctx, x + 1, 8, 2, 2, x % 8 ? "#f2ebdc" : cor);
    retangulo(ctx, 0, 1, 28, 1, tom(cor, 0.7));
    retangulo(ctx, 2, 16, 24, 4, "#8b5a2b");
    retangulo(ctx, 2, 16, 24, 1, "#b98048");
    retangulo(ctx, 3, 20, 22, 6, "#6b4423");
    [[4, "#ff6b6b"], [8, "#ffd166"], [12, "#7dff9a"], [17, "#ff9a3c"], [21, "#b06cff"]].forEach(([x, c]) => {
      retangulo(ctx, x, 13, 3, 3, c);
      retangulo(ctx, x, 13, 1, 1, "#ffffff");
    });
  }),
  fonte: () => desenhar(32, 24, (ctx) => {
    for (let y = 10; y < 24; y++) {
      const meia = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 17) / 7) ** 2)) * 15);
      retangulo(ctx, 16 - meia, y, meia * 2, 1, y < 13 ? "#c9cbe0" : "#8a8b99");
    }
    for (let y = 12; y < 17; y++) {
      const meia = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 14) / 3) ** 2)) * 12);
      retangulo(ctx, 16 - meia, y, meia * 2, 1, "#4fa8ff");
    }
    retangulo(ctx, 14, 2, 4, 12, "#a3a6b5");
    retangulo(ctx, 12, 2, 8, 2, "#c9cbe0");
    retangulo(ctx, 15, 0, 2, 2, "#8fd3ff");
    [[11, 6], [20, 6], [10, 9], [21, 9]].forEach(([x, y]) => retangulo(ctx, x, y, 1, 2, "#8fd3ff"));
  }),
  // casa de palafita do pântano: a casa em cima de estacas, com escadinha
  palafita: (cor = "#5a7a4a") => desenhar(40, 46, (ctx) => {
    [5, 17, 33].forEach((x) => retangulo(ctx, x, 30, 3, 16, "#4a3420"));
    retangulo(ctx, 2, 28, 36, 3, "#6b4423");
    retangulo(ctx, 4, 12, 32, 17, "#7a5a3a");
    for (let y = 14; y < 29; y += 4) retangulo(ctx, 4, y, 32, 1, "#5a4028");
    telhado(ctx, 0, 12, 40, 12, cor);
    retangulo(ctx, 16, 18, 8, 11, "#2b1d14");
    retangulo(ctx, 7, 16, 5, 5, "#c8f59a");
    retangulo(ctx, 28, 16, 5, 5, "#c8f59a");
    for (let i = 0; i < 4; i++) retangulo(ctx, 18 + i, 31 + i * 4, 6, 1, "#8b5a2b");
  }),
  // casa de adobe do deserto: telhado reto, cúpula pequena e um pano colorido na porta
  casaAdobe: (cor = "#2e8b9a") => desenhar(40, 36, (ctx) => {
    retangulo(ctx, 2, 12, 36, 24, "#d9b27a");
    for (let y = 16; y < 36; y += 6) retangulo(ctx, 2, y, 36, 1, "#c49a62");
    retangulo(ctx, 0, 10, 40, 3, "#e8c890");
    [2, 10, 18, 26, 34].forEach((x) => retangulo(ctx, x, 8, 4, 2, "#e8c890"));
    for (let y = 0; y < 8; y++) {
      const meia = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 8) / 8) ** 2)) * 6);
      retangulo(ctx, 28 - meia, y + 2, meia * 2, 1, cor);
    }
    retangulo(ctx, 15, 22, 10, 14, "#5a3a20");
    retangulo(ctx, 15, 22, 10, 5, cor);
    retangulo(ctx, 5, 18, 5, 5, "#3a2412");
    retangulo(ctx, 30, 18, 5, 5, "#3a2412");
  }),
  // casa de pedra da montanha, com neve no telhado
  casaNeve: (cor = "#5a6a8a") => desenhar(48, 44, (ctx) => {
    retangulo(ctx, 4, 20, 40, 24, "#8a8b99");
    for (let y = 24; y < 44; y += 5) for (let x = (y % 2) * 4; x < 40; x += 9) retangulo(ctx, 4 + x, y, 1, 4, "#6b6c7a");
    for (let y = 24; y < 44; y += 5) retangulo(ctx, 4, y, 40, 1, "#6b6c7a");
    telhado(ctx, 0, 20, 48, 16, cor);
    for (let i = 0; i < 16; i += 2) retangulo(ctx, i, 20 - i, 48 - i * 2, 2, i < 6 ? cor : "#f4f8ff");
    retangulo(ctx, 34, 2, 5, 10, "#6b6c7a");
    retangulo(ctx, 34, 2, 5, 2, "#f4f8ff");
    retangulo(ctx, 20, 32, 8, 12, "#3a2412");
    [[8, 26], [36, 26]].forEach(([x, y]) => retangulo(ctx, x, y, 6, 5, "#ffd96b"));
    retangulo(ctx, 4, 42, 40, 2, "#f4f8ff");
  }),
  farol: () => desenhar(24, 66, (ctx) => {
    for (let y = 16; y < 62; y++) {
      const meia = 6 + Math.round((y - 16) * 0.09);
      retangulo(ctx, 12 - meia, y, meia * 2, 1, Math.floor((y - 16) / 8) % 2 ? "#f2ebdc" : "#c0283c");
    }
    retangulo(ctx, 2, 60, 20, 6, "#8a8b99");
    retangulo(ctx, 5, 6, 14, 10, "#2b2540");
    retangulo(ctx, 7, 7, 10, 8, "#ffe08a");
    retangulo(ctx, 8, 8, 3, 6, "#ffffff");
    telhado(ctx, 3, 6, 18, 6, "#2b2540");
    retangulo(ctx, 10, 30, 4, 6, "#2b2540");
    retangulo(ctx, 10, 52, 4, 8, "#3a2412");
  }),
  posto: () => desenhar(34, 54, (ctx) => {
    [[4], [26]].forEach(([x]) => retangulo(ctx, x, 20, 4, 34, "#5c3418"));
    for (let y = 24; y < 52; y += 8) for (let i = 0; i < 22; i++) retangulo(ctx, 6 + i, y + Math.round(i * 0.3), 1, 1, "#4a2a12");
    retangulo(ctx, 0, 14, 34, 8, "#8b5a2b");
    retangulo(ctx, 0, 14, 34, 2, "#a8703a");
    telhado(ctx, 0, 10, 34, 9, "#a8323e");
    retangulo(ctx, 16, 0, 2, 4, "#5c3418");
  }),
};

const SPRITES_PONTOS = {
  placa: () => desenhar(18, 22, (ctx) => {
    retangulo(ctx, 8, 8, 3, 14, "#5c3418");
    retangulo(ctx, 0, 2, 18, 8, "#a8703a");
    retangulo(ctx, 0, 2, 18, 1, "#c98d63");
    retangulo(ctx, 3, 5, 12, 1, "#4a2a12");
    retangulo(ctx, 14, 3, 3, 6, "#a8703a");
  }),
  runa: (resolvido) => desenhar(16, 26, (ctx) => {
    for (let y = 2; y < 26; y++) {
      const meia = y < 6 ? 3 + y : 7;
      retangulo(ctx, 8 - meia, y, meia * 2, 1, y % 5 === 0 ? "#6b6c7a" : "#8a8b99");
    }
    retangulo(ctx, 2, 22, 12, 4, "#6b6c7a");
    const cor = resolvido ? "#4a4a55" : "#6ef0ff";
    [[7, 8, 2, 8], [5, 10, 6, 1], [5, 14, 2, 1], [9, 13, 2, 1]].forEach(([x, y, w, h]) => retangulo(ctx, x, y, w, h, cor));
  }),
  bau: (resolvido) => desenhar(18, 16, (ctx) => {
    if (resolvido) {
      retangulo(ctx, 1, 0, 16, 5, "#6b4423");
      retangulo(ctx, 1, 0, 16, 1, "#a8703a");
    } else {
      for (let y = 0; y < 6; y++) retangulo(ctx, 1 + (y < 2 ? 2 - y : 0), y, 16 - (y < 2 ? (2 - y) * 2 : 0), 1, "#a8703a");
    }
    retangulo(ctx, 1, 6, 16, 10, "#8b5a2b");
    retangulo(ctx, 1, 6, 16, 2, "#c9a227");
    retangulo(ctx, 1, 13, 16, 1, "#5c3418");
    retangulo(ctx, 7, 8, 4, 4, resolvido ? "#6d6d7a" : "#f5c451");
    if (resolvido) retangulo(ctx, 3, 3, 12, 3, "#2b1d14");
  }),
};

const PINTORES_LUGAR = {
  // a Fenda: um arco de pedra negra rachado, com runas vermelhas e o rasgo roxo no meio
  fenda(ctx) {
    retangulo(ctx, 0, 42, 36, 4, "#2b2540");
    retangulo(ctx, 2, 10, 7, 33, "#3d3550");
    retangulo(ctx, 27, 10, 7, 33, "#3d3550");
    retangulo(ctx, 7, 10, 2, 33, "#2b2540");
    retangulo(ctx, 27, 10, 2, 33, "#2b2540");
    for (let i = 0; i < 8; i++) retangulo(ctx, 2 + i, 10 - i, 32 - i * 2, 1, i % 2 ? "#4a4160" : "#3d3550");
    retangulo(ctx, 15, 0, 6, 4, "#ff4d6d");
    [[4, 16], [4, 26], [4, 36], [29, 20], [29, 30]].forEach(([x, y]) => retangulo(ctx, x, y, 2, 3, "#ff4d6d"));
    retangulo(ctx, 9, 11, 18, 32, "#140a22");
    for (let y = 12; y < 42; y++) {
      const meio = 18 + Math.round(Math.sin(y * 0.5) * 2);
      const largura = Math.max(1, Math.round(5 - Math.abs(y - 27) * 0.25));
      retangulo(ctx, meio - largura, y, largura * 2, 1, y % 3 ? "#6a2fa8" : "#a98bff");
    }
    // as rachaduras na pedra
    [[3, 22], [5, 23], [30, 14], [31, 15], [28, 35]].forEach(([x, y]) => retangulo(ctx, x, y, 1, 1, "#140a22"));
  },
  portal(ctx) {
    retangulo(ctx, 2, 8, 6, 34, "#8a8b99");
    retangulo(ctx, 24, 8, 6, 34, "#8a8b99");
    retangulo(ctx, 6, 8, 2, 34, "#6b6c7a");
    retangulo(ctx, 28, 8, 2, 34, "#6b6c7a");
    for (let i = 0; i < 6; i++) retangulo(ctx, 2 + i * 0.5, 8 - i, 28 - i, 1, "#a3a6c2");
    retangulo(ctx, 1, 1, 30, 4, "#8a8b99");
    retangulo(ctx, 13, 0, 6, 4, "#6ef0ff");
    retangulo(ctx, 8, 9, 16, 33, "#2b1d5c");
    retangulo(ctx, 0, 40, 32, 4, "#6b6c7a");
  },
  // uma casinha de loja: telhado, vitrine com poções, toldo listrado sobre a porta e a placa da moeda
  mercado(ctx) {
    retangulo(ctx, 4, 20, 40, 26, "#f2e2c0");
    for (let x = 4; x < 44; x += 13) retangulo(ctx, x, 20, 2, 26, "#7a4d24");
    telhado(ctx, 0, 20, 48, 16, "#2e8b57");
    retangulo(ctx, 8, 2, 5, 10, "#6d6d7a");
    // vitrine grande à esquerda, com poções nas prateleiras
    retangulo(ctx, 5, 25, 13, 13, "#5c3418");
    retangulo(ctx, 6, 26, 11, 11, "#a7dcff");
    retangulo(ctx, 6, 31, 11, 1, "#5c3418");
    [["#ff6b7a", 7], ["#7dff9a", 10], ["#ffd166", 13]].forEach(([cor, x]) => {
      retangulo(ctx, x, 27, 2, 4, cor);
      retangulo(ctx, x, 32, 2, 4, cor === "#ffd166" ? "#a98bff" : "#6ef0ff");
    });
    retangulo(ctx, 31, 25, 9, 9, "#5c3418");
    retangulo(ctx, 32, 26, 7, 7, "#ffd96b");
    retangulo(ctx, 35, 26, 1, 7, "#5c3418");
    // porta no meio, com toldo listrado
    retangulo(ctx, 19, 32, 10, 14, "#5c3418");
    retangulo(ctx, 27, 38, 1, 2, "#f5c451");
    for (let i = 0; i < 4; i++) retangulo(ctx, 16 + i * 4, 27, 4, 4, i % 2 ? "#fdf2e9" : "#e74c3c");
    for (let i = 0; i < 4; i++) retangulo(ctx, 16 + i * 4, 31, 4, 1, i % 2 ? "#e9e0d6" : "#c0392b");
    // placa pendurada com a moeda
    retangulo(ctx, 44, 22, 4, 1, "#5c3418");
    retangulo(ctx, 42, 23, 6, 7, "#8b5a2b");
    retangulo(ctx, 43, 25, 4, 3, "#f5c451");
    // caixotes na frente
    retangulo(ctx, 2, 40, 6, 6, "#a8703a");
    retangulo(ctx, 2, 40, 6, 1, "#c98d63");
  },
  estalagem(ctx) {
    retangulo(ctx, 4, 18, 40, 26, "#e9d6a8");
    for (let x = 4; x < 44; x += 10) retangulo(ctx, x, 18, 2, 26, "#5c3418");
    retangulo(ctx, 4, 28, 40, 2, "#5c3418");
    for (let i = 0; i < 14; i++) retangulo(ctx, 2 + i, 18 - i, 44 - i * 2, 1, i % 3 === 0 ? "#7b241c" : "#a8323e");
    retangulo(ctx, 34, 2, 5, 10, "#6d6d7a");
    retangulo(ctx, 20, 32, 8, 12, "#5c3418");
    retangulo(ctx, 26, 37, 1, 2, "#f5c451");
    [[8, 20], [36, 20], [8, 32], [36, 32]].forEach(([x, y]) => {
      retangulo(ctx, x, y, 5, 5, "#ffd96b");
      retangulo(ctx, x + 2, y, 1, 5, "#5c3418");
    });
    retangulo(ctx, 44, 24, 4, 1, "#5c3418");
    retangulo(ctx, 42, 25, 6, 6, "#8b5a2b");
    retangulo(ctx, 44, 26, 2, 3, "#f5c451");
  },
  // a Casa da Forja: pedra escura, telhado de ardósia, a chaminé larga, a boca da fornalha acesa na frente,
  // a bigorna do lado de fora, as armas penduradas e a placa do martelo
  forja(ctx) {
    retangulo(ctx, 3, 20, 42, 28, "#6b6460");
    for (let y = 21; y < 48; y += 4) for (let x = (y % 8 === 1 ? 3 : 7); x < 45; x += 8) retangulo(ctx, x, y, 7, 3, y % 8 === 1 ? "#7d7570" : "#5e5753");
    telhado(ctx, 0, 20, 48, 15, "#3a3f4b");
    // a chaminé de pedra com a boca vermelha
    retangulo(ctx, 31, 0, 10, 14, "#5e5753");
    retangulo(ctx, 30, 0, 12, 2, "#7d7570");
    retangulo(ctx, 33, 1, 6, 1, "#ff7a1a");
    // a fornalha aberta: arco de pedra, brasas e o brilho
    retangulo(ctx, 5, 28, 16, 20, "#3a3330");
    retangulo(ctx, 6, 27, 14, 1, "#3a3330");
    retangulo(ctx, 7, 30, 12, 18, "#1a0e08");
    retangulo(ctx, 7, 41, 12, 7, "#c0392b");
    retangulo(ctx, 8, 42, 10, 3, "#ff7a1a");
    retangulo(ctx, 10, 43, 5, 1, "#ffd166");
    // a porta de madeira com ferragens
    retangulo(ctx, 25, 33, 10, 15, "#5c3418");
    retangulo(ctx, 25, 33, 10, 1, "#3d220e");
    [36, 41, 46].forEach((y) => retangulo(ctx, 25, y, 10, 1, "#4a4a55"));
    retangulo(ctx, 33, 40, 1, 2, "#f5c451");
    // as armas penduradas na parede (espada, machado e arco)
    retangulo(ctx, 38, 24, 1, 10, "#c9cbe0");
    retangulo(ctx, 37, 31, 3, 1, "#c9952a");
    retangulo(ctx, 42, 24, 1, 9, "#8b5a2b");
    retangulo(ctx, 40, 24, 3, 3, "#a3a6c2");
    // a placa do martelo, pendurada no canto
    retangulo(ctx, 21, 22, 6, 1, "#3d220e");
    retangulo(ctx, 20, 23, 8, 7, "#8b5a2b");
    retangulo(ctx, 22, 24, 4, 2, "#c9cbe0");
    retangulo(ctx, 23, 26, 2, 3, "#5c3418");
    // a bigorna do lado de fora e um balde de água
    retangulo(ctx, 36, 43, 9, 2, "#4a4a55");
    retangulo(ctx, 38, 45, 5, 3, "#2b2b35");
    retangulo(ctx, 35, 43, 2, 1, "#4a4a55");
    retangulo(ctx, 37, 42, 7, 1, "#8a8b99");
    retangulo(ctx, 0, 42, 4, 6, "#5c3418");
    retangulo(ctx, 0, 42, 4, 1, "#4fa8ff");
  },
  cripta(ctx) {
    retangulo(ctx, 6, 16, 28, 24, "#7d7f99");
    retangulo(ctx, 28, 16, 6, 24, "#5f6180");
    for (let i = 0; i < 12; i++) retangulo(ctx, 4 + i * 1.1, 16 - i, 32 - i * 2.2, 1, i % 2 ? "#5f6180" : "#6b6d8c");
    retangulo(ctx, 15, 24, 10, 16, "#150f22");
    retangulo(ctx, 16, 23, 8, 1, "#150f22");
    retangulo(ctx, 18, 30, 4, 4, "#a98bff");
    retangulo(ctx, 18, 8, 4, 4, "#e8e4f2");
    retangulo(ctx, 19, 10, 1, 1, "#1b1533");
    retangulo(ctx, 21, 10, 1, 1, "#1b1533");
    [[0, 30], [36, 32]].forEach(([x, y]) => {
      retangulo(ctx, x, y, 4, 10, "#a3a6c2");
      retangulo(ctx, x, y, 4, 1, "#c9cbe0");
    });
  },
  bugs(ctx) {
    for (let y = 4; y < 36; y++) {
      const meia = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 36) / 32) ** 2)) * 23);
      retangulo(ctx, 24 - meia, y, meia * 2, 1, y < 12 ? "#8a7a68" : "#6b5a4a");
    }
    for (let i = 0; i < 20; i++) retangulo(ctx, 8 + ((i * 13) % 32), 8 + ((i * 7) % 24), 2, 1, "#5a4a3a");
    for (let y = 18; y < 36; y++) {
      const meia = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 36) / 18) ** 2)) * 10);
      retangulo(ctx, 24 - meia, y, meia * 2, 1, "#120d08");
    }
  },
  cofre(ctx) {
    for (let y = 2; y < 40; y++) {
      const meia = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 40) / 38) ** 2)) * 24);
      retangulo(ctx, 24 - meia, y, meia * 2, 1, y < 10 ? "#6d6385" : "#5d5470");
    }
    for (let y = -11; y <= 11; y++) {
      const meia = Math.round(Math.sqrt(121 - y * y));
      retangulo(ctx, 24 - meia, 26 + y, meia * 2 + 1, 1, Math.abs(y) > 8 ? "#8a93a8" : "#c4cbd8");
    }
    retangulo(ctx, 23, 16, 2, 20, "#8a93a8");
    retangulo(ctx, 14, 25, 20, 2, "#8a93a8");
    retangulo(ctx, 22, 24, 4, 4, "#e63946");
    retangulo(ctx, 8, 12, 2, 6, "#f5c451");
    retangulo(ctx, 38, 14, 2, 6, "#f5c451");
  },
};

function spriteLugar(id) {
  const [w, h] = TAMANHO_LUGARES[id];
  const { canvas, ctx } = criarTela(w + 2, h + 2);
  ctx.translate(1, 1);
  PINTORES_LUGAR[id](ctx);
  return contornar(canvas);
}

// ---------- monstros ----------

// Os monstros têm 3 tons por material, olhos com brilho e contorno colorido, no tamanho do herói (32 x 48).
function spriteSlime(cor) {
  return desenhar(22, 17, (ctx) => desenharTexto(ctx, [
    "..........LS..........",
    ".........SSSS.........",
    ".......SSSSSSSS.......",
    ".....SSLLSSSSSSSS.....",
    "....SLLWLSSSSSSSSs....",
    "...SSLLLSSSSSSOSSSs...",
    "..SSSSLSSSSSSOOSSSSs..",
    "..SSSSSSSSSSSSSSSSSs..",
    ".SSSSKKSSSSSSSSKKSSss.",
    ".SSSSWKSSSSSSSSWKSSss.",
    ".SSSSKKSSSSSSSSKKSSss.",
    ".SPPSSSSSDDDDSSSSPPss.",
    ".SSSSSSSSDTTDSSSSSsss.",
    ".sSSSSSSSSDDSSSSSssss.",
    "..ssSSSSSSSSSSSSsssd..",
    "...ddsssssssssssssdd..",
    ".....dddddddddddd.....",
  ], { S: cor, s: tom(cor, 0.72), d: tom(cor, 0.52), L: tom(cor, 1.5), O: tom(cor, 1.22), W: "#ffffff", K: "#1b1533", D: tom(cor, 0.35), T: "#ff6b8a", P: "#ff9fb2" }));
}

// o lobo parado (o primeiro quadro do trote); os quadros andando vêm de quadrosLobo
function spriteLobo(cor, olho = "#ffd166") {
  return quadrosLobo(cor, olho)[1];
}

function spriteSapo(pele = "#4c9a2a", barriga = "#c8f59a") {
  return desenhar(22, 15, (ctx) => desenharTexto(ctx, [
    "....EEE......EEE......",
    "...EWKKE....EWKKE.....",
    "...EKKKE....EKKKE.....",
    "...gEEEg....gEEEg.....",
    "..gGGGGGGGGGGGGGGg....",
    ".gGGSGGGGGGGGGSGGGg...",
    ".GGGGGGGGGGGGGGGGGGg..",
    "gGPGRRRRRRRRRRRRGPGGg.",
    "gGGGGRRRRRRRRRRGGGGGg.",
    "gGGGLLLLLLLLLLLLGGGGg.",
    "gGGLLLLLLLLLLLLLLGGgg.",
    ".gGGLLLLLLLLLLLLGGgg..",
    "GGg..ggggggggggg..gGG.",
    "GgG..............GgG..",
    "G.G..............G.G..",
  ], { E: "#fffbe0", W: "#ffffff", K: "#1b1533", G: pele, g: tom(pele, 0.62), S: tom(pele, 0.62), L: barriga, R: "#a8323e", P: "#ff9fb2" }));
}

// ---------- a estátua da praça: Erickson, o Arquimago de Elyndor ----------
// Cabelo cacheado (grisalho nos lados), barba, sorriso largo, brinco de ouro e os braços cruzados,
// de manto preto com acabamento dourado, ombreiras com gema e capa forrada de roxo, sobre um pedestal
// de mármore. O cajado de cristal e o grimório flutuam ao lado (animarEstatua).
const CORES_ARQUIMAGO = {
  pele: "#e2b08e", peleSombra: "#c08a68", peleLuz: "#f3caa8", cabelo: "#0d0b10", cabeloLuz: "#2a2733", grisalho: "#1c1a22",
  barba: "#0d0b10", barbaLuz: "#24212b", boca: "#5a1f2a", dente: "#ffffff", olho: "#1b1533",
  manto: "#17141f", mantoLuz: "#2d2840", mantoSombra: "#0b0910", roxo: "#6b3fd1", roxoLuz: "#a98bff",
  ouro: "#f5c451", ouroSombra: "#b8862a", marmore: "#dcdeea", marmoreSombra: "#a3a6c2", marmoreEscuro: "#74778f",
};

function spriteEstatuaArquimago() {
  const C = CORES_ARQUIMAGO;
  return desenhar(48, 80, (ctx) => {
    const r = (x, y, w, h, cor) => retangulo(ctx, x, y, w, h, cor);
    const bola = (cx, cy, raio, cor) => {
      for (let dy = -raio; dy <= raio; dy++) {
        const meia = Math.floor(Math.sqrt(raio * raio - dy * dy));
        r(cx - meia, cy + dy, meia * 2 + 1, 1, cor);
      }
    };

    // ---- pedestal de mármore com a placa dourada e runas ----
    r(4, 76, 40, 4, C.marmoreSombra);
    r(4, 79, 40, 1, C.marmoreEscuro);
    r(9, 67, 30, 9, C.marmore);
    r(34, 67, 5, 9, C.marmoreSombra);
    r(16, 69, 16, 5, C.ouroSombra);
    r(17, 70, 14, 3, C.ouro);
    [19, 21, 22, 24, 26, 27, 29].forEach((x) => r(x, 71, 1, 1, C.ouroSombra)); // as letras da placa
    [[11, 69], [12, 72], [36, 70], [35, 73]].forEach(([x, y]) => r(x, y, 1, 2, C.roxoLuz));
    r(6, 64, 36, 3, C.marmore);
    r(6, 64, 36, 1, "#ffffff");
    r(6, 66, 36, 1, C.marmoreSombra);

    // ---- capa atrás, alargando dos ombros até o chão, forrada de roxo ----
    for (let y = 27; y < 64; y++) {
      const meia = Math.round(13 + ((y - 27) / 36) * 6);
      r(24 - meia, y, meia * 2, 1, C.mantoSombra);
      r(24 - meia, y, 2, 1, C.roxo);
      r(24 + meia - 2, y, 2, 1, C.roxo);
    }
    r(5, 62, 38, 2, C.roxo);

    // ---- túnica: luz do lado esquerdo, sombra do direito, faixa dourada no meio e barra com runas ----
    for (let y = 27; y < 64; y++) {
      const meia = y < 44 ? 11 : Math.round(11 + (y - 44) * 0.15);
      r(24 - meia, y, meia * 2, 1, C.manto);
      r(24 - meia, y, 2, 1, C.mantoLuz);
      r(24 + meia - 3, y, 3, 1, C.mantoSombra);
    }
    r(23, 42, 2, 20, C.ouro);
    r(24, 42, 1, 20, C.ouroSombra);
    r(13, 60, 22, 2, C.ouro);
    [15, 19, 28, 32].forEach((x) => r(x, 58, 2, 1, C.roxoLuz));
    // botões da camisa por cima do peito
    [29, 32].forEach((y) => r(24, y, 1, 1, C.ouro));

    // ---- ombreiras douradas com gema roxa ----
    r(9, 26, 8, 4, C.ouro);
    r(9, 29, 8, 1, C.ouroSombra);
    r(12, 27, 2, 2, C.roxo);
    r(31, 26, 8, 4, C.ouro);
    r(31, 29, 8, 1, C.ouroSombra);
    r(34, 27, 2, 2, C.roxo);
    // braços descendo até o cruzamento
    r(10, 30, 5, 5, C.manto);
    r(10, 30, 1, 5, C.mantoLuz);
    r(33, 30, 5, 5, C.manto);
    r(37, 30, 1, 5, C.mantoSombra);

    // ---- braços cruzados (como na foto): o antebraço direito por cima do esquerdo ----
    r(10, 34, 28, 8, C.manto);
    r(10, 34, 28, 1, C.mantoLuz);
    r(10, 41, 28, 1, C.mantoSombra);
    for (let i = 0; i < 6; i++) r(15 + i * 3, 40 - i, 3, 1, C.mantoSombra); // a dobra da manga de cima
    r(12, 35, 4, 4, C.pele); // a mão que fica embaixo, aparecendo no braço esquerdo
    r(12, 38, 4, 1, C.peleSombra);
    r(16, 35, 2, 4, C.ouro); // punho dourado
    r(31, 37, 5, 4, C.pele); // a mão de cima, apoiada no braço direito
    r(31, 37, 5, 1, C.peleLuz);
    r(32, 40, 4, 1, C.peleSombra);
    r(29, 37, 2, 4, C.ouro);

    // ---- gola alta de mago, roxa, atrás do pescoço ----
    r(14, 20, 4, 8, C.roxo);
    r(14, 20, 1, 8, C.roxoLuz);
    r(30, 20, 4, 8, C.roxo);
    r(33, 20, 1, 8, C.mantoSombra);
    // pescoço e a gola da camisa
    r(20, 24, 8, 4, C.peleSombra);
    r(18, 26, 4, 2, C.manto);
    r(26, 26, 4, 2, C.manto);

    // ---- cabeça ----
    r(17, 8, 15, 17, C.pele);
    r(16, 10, 1, 13, C.pele);
    r(32, 10, 1, 13, C.pele);
    r(30, 9, 2, 16, C.peleSombra); // sombra do lado direito do rosto
    r(14, 14, 2, 5, C.pele); // orelhas
    r(33, 14, 2, 5, C.peleSombra);
    r(14, 19, 1, 2, C.ouro); // brinco de argola
    r(13, 20, 1, 1, C.ouroSombra);

    // ---- cabelo cacheado, volumoso, com fios grisalhos nos lados ----
    [[15, 9, 3], [17, 5, 4], [21, 3, 4], [26, 3, 4], [30, 5, 4], [33, 9, 3], [14, 13, 2], [34, 13, 2], [23, 6, 3], [28, 7, 3], [19, 8, 2]]
      .forEach(([cx, cy, raio]) => bola(cx, cy, raio, C.cabelo));
    [[16, 3], [20, 1], [25, 1], [29, 3], [32, 6], [18, 6], [24, 4]].forEach(([x, y]) => r(x, y, 2, 1, C.cabeloLuz)); // brilho dos cachos
    [[13, 11], [14, 14], [15, 12], [34, 11], [35, 14], [33, 12], [14, 9]].forEach(([x, y]) => r(x, y, 1, 1, C.grisalho));
    [[20, 10], [26, 9], [23, 10]].forEach(([x, y]) => r(x, y, 2, 1, C.cabelo)); // cachinhos caindo na testa

    // ---- sobrancelhas grossas e olhos sorrindo ----
    r(18, 12, 5, 2, C.cabelo);
    r(26, 12, 5, 2, C.cabelo);
    r(19, 15, 3, 2, C.olho);
    r(27, 15, 3, 2, C.olho);
    r(20, 15, 1, 1, "#ffffff");
    r(28, 15, 1, 1, "#ffffff");
    r(18, 17, 4, 1, C.peleLuz); // bochechas levantadas pelo sorriso
    r(27, 17, 3, 1, C.peleLuz);
    // nariz
    r(24, 15, 1, 4, C.peleSombra);
    r(23, 18, 3, 1, C.peleSombra);

    // ---- barba cheia, bigode e o sorriso aberto ----
    r(16, 15, 2, 9, C.barba); // costeletas
    r(31, 15, 2, 9, C.barba);
    r(17, 21, 3, 4, C.barba);
    r(29, 21, 3, 4, C.barba);
    r(18, 23, 13, 3, C.barba);
    r(20, 19, 9, 1, C.barba); // bigode
    r(19, 20, 2, 1, C.barba);
    r(28, 20, 2, 1, C.barba);
    r(21, 20, 7, 3, C.boca);
    r(21, 20, 7, 1, C.dente);
    r(22, 21, 5, 1, C.dente);
    [[18, 22], [29, 21], [22, 24], [26, 25], [17, 18]].forEach(([x, y]) => r(x, y, 1, 1, C.barbaLuz));
  });
}

// O que flutua em volta da estátua: o cajado de cristal à direita, o grimório aberto à esquerda e
// runas girando em volta da cintura. x e y são o canto de cima da estátua.
function animarEstatua(ctx, x, y, t) {
  const C = CORES_ARQUIMAGO;
  const sobe = Math.round(Math.sin(t * 1.6) * 2);
  // cajado de obsidiana com anéis de ouro e o cristal brilhando no topo
  const cx = x + 43;
  const cy = y + 6 + sobe;
  brilhoRedondo(ctx, cx + 1, cy + 3, 9 + Math.round(Math.sin(t * 3) * 2), "169, 139, 255", 0.18);
  retangulo(ctx, cx, cy + 8, 2, 52, "#2b2540");
  retangulo(ctx, cx, cy + 8, 1, 52, "#4a4266");
  [14, 30, 46].forEach((dy) => retangulo(ctx, cx - 1, cy + dy, 4, 2, C.ouro));
  retangulo(ctx, cx - 2, cy + 6, 6, 2, C.ouro);
  retangulo(ctx, cx - 1, cy, 4, 6, C.roxo);
  retangulo(ctx, cx, cy - 2, 2, 10, C.roxo);
  retangulo(ctx, cx, cy + 1, 1, 3, "#ffffff");
  retangulo(ctx, cx + 1, cy - 1, 1, 2, C.roxoLuz);
  // grimório aberto flutuando do outro lado, com páginas brilhando
  const gy = y + 30 - sobe;
  brilhoRedondo(ctx, x + 4, gy + 3, 8, "110, 240, 255", 0.12);
  retangulo(ctx, x - 1, gy, 11, 7, "#5a1f2a");
  retangulo(ctx, x, gy - 1, 4, 6, "#fff8e6");
  retangulo(ctx, x + 5, gy - 1, 4, 6, "#fff8e6");
  retangulo(ctx, x + 4, gy - 1, 1, 7, "#8a6d12");
  [[1, 1], [6, 2], [1, 3], [6, 0]].forEach(([dx, dy]) => retangulo(ctx, x + dx, gy + dy, 2, 1, "#6ef0ff"));
  // faíscas subindo do livro
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.6 + i / 3) % 1;
    ctx.globalAlpha = 1 - p;
    retangulo(ctx, x + 2 + i * 3, Math.round(gy - 3 - p * 14), 1, 1, i % 2 ? "#6ef0ff" : "#ffffff");
  }
  ctx.globalAlpha = 1;
  // runas girando em volta da estátua
  for (let i = 0; i < 4; i++) {
    const a = t * 1.2 + (i * Math.PI) / 2;
    const rx = Math.round(x + 24 + Math.cos(a) * 21);
    const ry = Math.round(y + 47 + Math.sin(a) * 5);
    if (Math.sin(a) < 0) ctx.globalAlpha = 0.45; // atrás da estátua fica mais apagada
    retangulo(ctx, rx, ry, 2, 2, i % 2 ? C.roxoLuz : "#6ef0ff");
    ctx.globalAlpha = 1;
  }
}

// ---------- as criaturas da noite ----------

function spriteMorcego() {
  return desenhar(22, 11, (ctx) => desenharTexto(ctx, [
    ".KK................KK.",
    "KMMK.....K..K.....KMMK",
    "KMMMK....KKKK....KMMMK",
    "KMmMMK..KMMMMK..KMMmMK",
    ".KMmMMKKMEMMEMKKMMmMK.",
    "..KMmMMMMMMMMMMMMmMK..",
    "...KMMKMMMMMMMMKMMK...",
    "....KK.KMMWWMMK.KK....",
    "........KMMMMK........",
    ".........KMMK.........",
    "..........KK..........",
  ], { K: "#120d1f", M: "#3d2c5c", m: "#5b4485", E: "#ff3b5c", W: "#ffffff" }));
}

function spriteAssombracao() {
  return desenhar(18, 20, (ctx) => desenharTexto(ctx, [
    "......GGGGGG......",
    "....GGGGGGGGGG....",
    "...GGGGGGGGGGGG...",
    "..GGGGGGGGGGGGGG..",
    "..GGKKGGGGGGKKGG..",
    ".GGGKEKGGGGKEKGGG.",
    ".GGGKKGGGGGGKKGGG.",
    ".GGGGGGGGGGGGGGGG.",
    ".GGGGGGGKKGGGGGGG.",
    ".GGGGGGKKKKGGGGGG.",
    ".GGGGGGGKKGGGGGGg.",
    ".gGGGGGGGGGGGGGGg.",
    ".gGGGGGGGGGGGGGgg.",
    ".ggGGGGGGGGGGGGgg.",
    ".ggGGGGgGGGGgGGgg.",
    ".gg.gGGg.gGGg.ggg.",
    "..g..gg...gg...g..",
    "..................",
    "..................",
    "..................",
  ], { G: "#dfe9ff", g: "#9fb2d9", K: "#1b1533", E: "#7fd4ff" }));
}

function spriteFogoFatuo() {
  return desenhar(14, 16, (ctx) => desenharTexto(ctx, [
    "......F.......",
    ".....FF.......",
    ".....FYF......",
    "....FYYF..F...",
    "...FYYYYF.F...",
    "..FYYWWYYF....",
    "..FYWWWWYF....",
    ".FYYWKWKWYF...",
    ".FYYWWWWWYF...",
    ".FYYWWKWWYF...",
    ".FFYYWWWYYF...",
    "..FFYYYYYFF...",
    "...FFFFFFF....",
    "....F.F.F.....",
    "...F.....F....",
    "..............",
  ], { F: "#2fd6e8", Y: "#9ff7ff", W: "#ffffff", K: "#16405a" }));
}

function spriteEscorpiao(corpo = "#b5651d", cauda = "#8b4513", pinca = "#d2691e") {
  return desenhar(30, 15, (ctx) => desenharTexto(ctx, [
    ".....tTTTt....................",
    "....tT...TTR..................",
    "...tT.....RR..................",
    "...tT.......R.................",
    "...tTT........................",
    "....tTT..................PP...",
    ".....tTT................PlPP..",
    "......tbbbbbbbbbb.....ppP..PP.",
    ".....bBBlBBlBBlBBBb..pP.......",
    "....bBBBBBBBBBBBBBBBbpp.......",
    "....bBBBBBBBBBBBBBBBBEbpP.....",
    ".....bBBBBBBBBBBBBBBBbbppPP...",
    "......bbbbbbbbbbbbbbb...pPPP..",
    ".....L.L..L.L..L.L..L.L.......",
    "....L..L.L..L.L..L.L..L.L.....",
  ], { B: corpo, b: tom(corpo, 0.65), l: tom(corpo, 1.35), T: cauda, t: tom(cauda, 0.65), P: pinca, p: tom(pinca, 0.65), L: "#5c3418", R: "#ff4d4d", E: "#ff4d4d" }));
}

// o esqueleto: crânio com olhos verdes, costelas e uma espada enferrujada
function spriteEsqueleto() {
  return desenhar(26, 34, (ctx) => {
    desenharTexto(ctx, [
      "........ZZZZZZZZ........",
      "......ZZZZZZZZZZZZ......",
      ".....ZZZZZZZZZZZZZz.....",
      ".....ZZZZZZZZZZZZZz.....",
      ".....ZKKKZZZZZZKKKz.....",
      ".....ZKEKZZZZZZKEKz.....",
      ".....ZKKKZZZZZZKKKz.....",
      "......ZZZZZKKZZZZZz.....",
      "......zZZZZZZZZZZz......",
      ".......ZKZKZKZKZKz......",
      "........zZZZZZZz........",
      "..........zZZz..........",
      "......ZZZZZZZZZZZZ......",
      ".....ZZ.ZZZZZZZZ.ZZ.....",
      ".....ZZ..ZZzzZZ..ZZ.....",
      ".....ZZ.ZZZzzZZZ.ZZ.....",
      "....ZZ...Z.zz.Z...ZZ....",
      "....ZZ..ZZZzzZZZ..ZZ....",
      "....Zz.....zz.....zZ....",
      "...ZZz.....zz.....zZZ...",
      "...ZZ.....ZzzZ.....ZZ...",
      "........ZZZZZZZZ........",
      ".......ZZz.zz.zZZ.......",
      "........ZZ....ZZ........",
      "........Zz....zZ........",
      "........Zz....zZ........",
      "........Zz....zZ........",
      ".......zZZz..zZZz.......",
      "........Zz....zZ........",
      "........Zz....zZ........",
      "........Zz....zZ........",
      ".......ZZZz..zZZZ.......",
      "......ZZZZz..zZZZZ......",
    ], { Z: "#e8e4dc", z: "#b0a99c", K: "#1b1533", E: "#7dff9a" }, 0, 1);
    // espada enferrujada na mão direita e um trapo na cintura
    for (let y = 6; y <= 18; y++) desenharTexto(ctx, ["Aa"], { A: y % 4 === 0 ? "#c9874a" : "#cfd6e6", a: "#8a93a8" }, 21, y);
    desenharTexto(ctx, ["BBBBB", "..b..", "..b.."], { B: "#8b5a2b", b: "#5c3418" }, 19, 19);
    desenharTexto(ctx, ["VVVVVVVV", ".VvVVvV.", "..V..V.."], { V: "#4a4555", v: "#2b2838" }, 8, 23);
  });
}

// amplia um sprite sem suavizar (pixel continua pixel): é assim que os chefões ficam enormes
function ampliarSprite(base, fator) {
  const { canvas, ctx } = criarTela(Math.round(base.width * fator), Math.round(base.height * fator));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// coroa dourada em cima do sprite (xCentro = onde fica a cabeça; encaixe = quanto a coroa desce sobre ela).
// Com "topo" (a linha do alto da cabeça), a coroa vai direto na cabeça: para quem tem a cabeça mais baixa que o resto.
function comCoroa(base, xCentro = base.width / 2, encaixe = 2, topo = null) {
  const sobra = topo === null ? 6 - encaixe : Math.max(0, 6 - topo);
  const { canvas, ctx } = criarTela(base.width, base.height + sobra);
  ctx.drawImage(base, 0, sobra);
  const x = Math.round(xCentro) - 4;
  const y = topo === null ? 1 : topo + sobra - 5;
  desenharTexto(ctx, [
    ".K.K.K.",
    "KYKRKYK",
    "KYYYYYK",
    "KGYGYGK",
    "KKKKKKK",
  ], { K: "#5c3418", Y: "#f5c451", G: "#ffe9a8", R: "#e63946" }, x, y);
  return canvas;
}

function spriteDragao(cor) {
  return desenhar(40, 19, (ctx) => desenharTexto(ctx, [
    "...........w............................",
    "..........wWw...........................",
    ".........wWWWw..........................",
    "........wWWWWWw...................HH....",
    ".......wWWwWWWWw....................H...",
    "......wWWw.wWWWWw..................cCC..",
    ".....wWWw..wWWWWWw................cCCCCC",
    "....wWw....wWWWWWWw............cCCCECCCK",
    "..........wwwwwwwwcC..........cCCCCcVVV.",
    "T..........cCCCCCCCCC.......cCCCCCttt...",
    "TT........cCCCCCCCCCCCC....cCCCCC.......",
    ".TT......cCCCCCCCCCCCCCCcccCCCCC........",
    "..TTc...cCCCCCCCCBBBBBBCCCCCC...........",
    "...TTCccCCCCCCCCBbBbBbBbCCCC............",
    ".....cCCCCCCCCCCBBBBBBBBCCc.............",
    "......cCCCCCCCCCbBbBbBbBCc..............",
    ".......ccCCc..ccCCc..cCCc..cCCc.........",
    "........cCC....cCC....cCC...cCC.........",
    ".......KcCK...KcCK...KcCK..KcCK.........",
  ], { C: cor, c: tom(cor, 0.68), W: tom(cor, 0.82), w: tom(cor, 0.45), B: "#ffd166", b: "#d9a441", T: tom(cor, 0.8), t: "#ffffff", H: "#e8e4dc", E: "#ffd166", K: "#1b1533", V: "#5a1f2a" }));
}

// ---------- monstros com quadros de verdade ----------
// Em vez de esticar o desenho parado, estes têm cada quadro desenhado: o lobo mexe as quatro patas e
// abana a cauda; o dragão bate as asas de cima a baixo, ondula a cauda e o pescoço sobe e desce.

// Desenho em curvas que vira pixel art: corta o meio-transparente das bordas (cada pixel fica cheio ou
// vazio) para o contorno sair limpo, como se tivesse sido pintado pixel a pixel.
function pixelizar(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < imagem.data.length; i += 4) imagem.data[i] = imagem.data[i] > 110 ? 255 : 0;
  ctx.putImageData(imagem, 0, 0);
  return canvas;
}

// O lobo em 4 quadros de trote: as patas de frente e de trás se cruzam (as de longe mais escuras), o
// corpo sobe um pixel no meio do passo e a cauda balança. O pelo tem a faixa escura do dorso e o peito claro.
function quadrosLobo(cor, olho = "#ffd166") {
  const paleta = { X: cor, x: tom(cor, 0.7), D: tom(cor, 0.55), L: tom(cor, 1.35), N: "#c98a7a", E: olho, K: "#1b1533", V: "#5a1f2a", W: "#ffffff" };
  const corpo = [
    "......................X..X......",
    ".....................XNX.XNX....",
    ".....................XXXXXXX....",
    "....................xXXXXXXXX...",
    "...................xXXXXXEKXXXX.",
    "..........DDDDDDDxXXXXXXXXXXXXXK",
    "........DDDDDDDDDDXXXXXXLLVVWW..",
    ".......xXXXXXXXXXXXXXXXXLLL.....",
    "......xXXXXXXXXXXXXXXXXLLLL.....",
    "......XXXXXXXXXXXXXXXXXXLLL.....",
    "......xXXXXXXXXXXXXXXXXLLL......",
    "......xXXXLLLLLLLLLLXXXXL.......",
    ".......xXX.........xXXX.........",
  ];
  // o balanço de cada pata em cada quadro: [trás perto, trás longe, frente perto, frente longe]
  const passos = [[2, -2, -2, 2], [0, 0, 0, 0], [-2, 2, 2, -2], [0, 0, 0, 0]];
  const caudas = [-1, 0, 1, 0];
  return passos.map((balanco, q) => desenhar(32, 19, (ctx) => {
    const sobe = q % 2;
    // patas de longe primeiro (ficam atrás do corpo)
    [[1, 9, true], [3, 21, true], [0, 7, false], [2, 19, false]].forEach(([i, topo, longe]) => {
      for (let r = 0; r < 6; r++) {
        const x = topo + Math.round((balanco[i] * r) / 5);
        const y = 12 + r - sobe;
        if (r === 5) {
          ctx.fillStyle = paleta.K;
          ctx.fillRect(x, y, 3, 1);
        } else {
          ctx.fillStyle = longe ? paleta.D : paleta.x;
          ctx.fillRect(x, y, 1, 1);
          ctx.fillStyle = longe ? paleta.x : paleta.X;
          ctx.fillRect(x + 1, y, 1, 1);
        }
      }
    });
    desenharTexto(ctx, corpo, paleta, 0, -sobe);
    // a cauda peluda, saindo do quadril e balançando
    for (let i = 0; i < 7; i++) {
      const x = 7 - i;
      const y = Math.round(6 - i * 0.7 + caudas[q] * (i / 6) * 2) - sobe;
      ctx.fillStyle = i > 4 ? paleta.L : i % 2 ? paleta.x : paleta.X;
      ctx.fillRect(x, y, 1, i < 3 ? 3 : 2);
    }
  }));
}

// O dragão de lado, voando para a direita, em 6 quadros de asa (do alto até embaixo e de volta).
// escala: tamanho (1 = 64 x 56); barriga: a cor das placas da barriga; coroa: o rei dos dragões.
function quadrosDragao(cor, { escala = 1, barriga = "#f0c27b", coroa = false } = {}) {
  const escuro = tom(cor, 0.55);
  const membrana = tom(cor, 0.78);
  const veio = tom(cor, 1.35);
  const W = Math.round(64 * escala);
  const H = Math.round(56 * escala);
  return [1, 0.55, -0.15, -0.8, -0.4, 0.35].map((bate, q) => {
    const { canvas, ctx } = criarTela(W + 2, H + 2);
    ctx.translate(1 + 32 * escala, 1 + 34 * escala);
    ctx.scale(escala, escala);
    const pescoco = -bate * 1.2; // o corpo sobe quando a asa desce
    ctx.translate(0, pescoco);
    const asa = (atraso, fundo, frente) => {
      const b = Math.max(-1, Math.min(1, bate - atraso));
      const pontos = [[6, -3], [1, -6 - b * 14], [-14, -5 - b * 26], [-9, -3 - b * 16], [-15, -2 - b * 14], [-8, -1 - b * 7], [-12, 0 - b * 5], [-4, 0]];
      ctx.fillStyle = fundo;
      ctx.beginPath();
      pontos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
      // os "dedos" da asa, mais claros
      ctx.strokeStyle = frente;
      ctx.lineWidth = 1.2;
      [[2], [3], [5]].forEach(([i]) => {
        ctx.beginPath();
        ctx.moveTo(1, -6 - b * 14);
        ctx.lineTo(pontos[i][0], pontos[i][1]);
        ctx.stroke();
      });
    };
    asa(0.35, escuro, membrana);
    // a cauda ondulando, com a ponta em lança
    ctx.strokeStyle = cor;
    ctx.lineCap = "round";
    let ax = -9;
    let ay = 1;
    for (let i = 1; i <= 8; i++) {
      const nx = -9 - i * 2.6;
      const ny = 1 + Math.sin(q * 1.05 - i * 0.75) * i * 0.35 + i * 0.25;
      ctx.lineWidth = Math.max(1.2, 4.2 - i * 0.4);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      ax = nx;
      ay = ny;
    }
    ctx.fillStyle = escuro;
    ctx.beginPath();
    ctx.moveTo(ax - 4, ay);
    ctx.lineTo(ax + 1, ay - 3);
    ctx.lineTo(ax + 1, ay + 3);
    ctx.closePath();
    ctx.fill();
    // o corpo, a barriga em placas e as patas recolhidas
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 5.5, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = barriga;
    ctx.beginPath();
    ctx.ellipse(1, 2.6, 8.5, 2.6, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tom(barriga, 0.75);
    for (let x = -6; x <= 7; x += 3) ctx.fillRect(x, 1.5, 0.8, 3);
    ctx.fillStyle = escuro;
    [[-5, 4], [4, 4]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.ellipse(x, y + 1, 2, 1.6, 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
    // os espinhos do dorso
    ctx.fillStyle = escuro;
    for (let x = -9; x <= 6; x += 3) {
      ctx.beginPath();
      ctx.moveTo(x - 1.2, -4.6 + Math.abs(x) * 0.05);
      ctx.lineTo(x + 0.3, -7.5);
      ctx.lineTo(x + 1.4, -4.6);
      ctx.fill();
    }
    // o pescoço e a cabeça, que levanta um pouco quando a asa sobe
    const cabeca = bate * 1.2;
    ctx.strokeStyle = cor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(8, -1.5);
    ctx.quadraticCurveTo(14, -3, 17, -9 - cabeca);
    ctx.stroke();
    ctx.strokeStyle = barriga;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(10, 0.8);
    ctx.quadraticCurveTo(16, -1, 18.5, -7 - cabeca);
    ctx.stroke();
    ctx.save();
    ctx.translate(0, -cabeca);
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.moveTo(15, -12);
    ctx.lineTo(21, -12.5);
    ctx.lineTo(28.5, -9.5);
    ctx.lineTo(28.5, -8);
    ctx.lineTo(22, -7);
    ctx.lineTo(27, -5.5);
    ctx.lineTo(21, -4.5);
    ctx.lineTo(16, -6.5);
    ctx.closePath();
    ctx.fill();
    // chifres em osso
    ctx.strokeStyle = "#e8e4dc";
    ctx.lineWidth = 1.5;
    [[17, -12, 11, -17], [19.5, -12.3, 15, -18]].forEach(([x0, y0, x1, y1]) => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 - 3, y0 - 2, x1, y1);
      ctx.stroke();
    });
    if (coroa) {
      ctx.fillStyle = "#f5c451";
      ctx.beginPath();
      ctx.moveTo(16, -13);
      [[17, -17], [18.5, -14], [20, -18], [21.5, -14], [23, -17], [24, -12.5]].forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    asa(0, cor, veio);
    pixelizar(canvas);
    // o olho aceso e a narina (pixels cheios, depois de pixelizar)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const ox = Math.round(1 + (32 + 23) * escala);
    const oy = Math.round(1 + (34 - 10 - bate * 1.2 + pescoco) * escala);
    const t = Math.max(1, Math.round(escala * 1.2));
    ctx.fillStyle = "#1b1533";
    ctx.fillRect(ox - 1, oy - 1, t + 1, t + 1);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(ox, oy - 1, t, t);
    return contornar(canvas, "auto");
  });
}


// Como cada monstro aparece e anda no mapa. Os números de combate (nome, força, vida, dano, prêmio)
// vêm do servidor (conteudo/monstros.json): é lá que se decide quem vence.
// "noite": em quem o monstro se transforma quando escurece (de manhã ele volta ao normal).
// "translucido" desenha meio transparente; "brilho" acende uma luz em volta dele à noite.
const TIPOS_MONSTRO = {
  slimeVerde: { sprite: () => spriteSlime("#5fd35f"), noite: "slimeFantasma" },
  slimeAzul: { sprite: () => spriteSlime("#4fa8ff"), noite: "slimeFantasma" },
  slimeRoxo: { sprite: () => spriteSlime("#b06cff"), noite: "slimeFantasma" },
  slimeGigante: { sprite: () => ampliarSprite(spriteSlime("#2f9e5a"), 1.5) },
  lobo: { agressivo: true, velocidade: 34, sprite: () => spriteLobo("#7a7266"), quadros: () => quadrosLobo("#7a7266"), noite: "loboSombrio" },
  // os monstros da noite
  slimeFantasma: { velocidade: 26, translucido: true, sprite: () => spriteSlime("#9fb8ff") },
  loboSombrio: { agressivo: true, velocidade: 44, sprite: () => spriteLobo("#2b2540", "#ff4d6d"), quadros: () => quadrosLobo("#2b2540", "#ff4d6d") },
  sapoLuminoso: { velocidade: 22, brilho: "150, 255, 120", sprite: () => spriteSapo("#3fd16a", "#eaffa0") },
  loboEspectral: { agressivo: true, velocidade: 46, translucido: true, sprite: () => spriteLobo("#a8e6ff", "#ffffff"), quadros: () => quadrosLobo("#a8e6ff", "#ffffff") },
  // os que só saem quando escurece (POPULACAO_NOITE)
  morcego: { agressivo: true, velocidade: 50, voa: true, sprite: spriteMorcego },
  assombracao: { velocidade: 20, voa: true, translucido: true, sprite: spriteAssombracao },
  fogoFatuo: { velocidade: 30, voa: true, brilho: "80, 230, 255", sprite: spriteFogoFatuo },
  loboAlfa: { agressivo: true, velocidade: 38, sprite: () => ampliarSprite(spriteLobo("#3d3a4a"), 1.25), quadros: () => quadrosLobo("#3d3a4a").map((q) => ampliarSprite(q, 1.25)) },
  sapo: { sprite: spriteSapo, noite: "sapoLuminoso" },
  slimeToxico: { sprite: () => spriteSlime("#9acd32") },
  escorpiao: { agressivo: true, velocidade: 30, sprite: () => spriteEscorpiao(), noite: "esqueleto" },
  esqueleto: { sprite: spriteEsqueleto },
  loboNeve: { agressivo: true, velocidade: 40, sprite: () => spriteLobo("#e8eef5"), quadros: () => quadrosLobo("#e8eef5"), noite: "loboEspectral" },
  dragao: { agressivo: true, velocidade: 26, voa: true, sprite: () => quadrosDragao("#c0392b", { escala: 0.8 })[0], quadros: () => quadrosDragao("#c0392b", { escala: 0.8 }) },
  dragaoGelo: { voa: true, sprite: () => quadrosDragao("#4fa8ff", { escala: 0.8, barriga: "#e8f6ff" })[0], quadros: () => quadrosDragao("#4fa8ff", { escala: 0.8, barriga: "#e8f6ff" }) },

  // os chefões: um por bioma, enormes, parados guardando o território
  reiSlime: { sprite: () => ampliarSprite(comCoroa(spriteSlime("#5fd35f"), 12, 3), 3.5) },
  fenrir: { sprite: () => ampliarSprite(comCoroa(spriteLobo("#2b2540"), 25), 3) },
  sapoRei: { sprite: () => ampliarSprite(comCoroa(spriteSapo(), 11, 3), 3.75) },
  escorpiaoImperador: { sprite: () => ampliarSprite(comCoroa(spriteEscorpiao("#5a2a8a", "#3d1d63", "#f5c451"), 21, 0, 10), 3.25) },
  // Ignis, o Rei Dragão, não espera parado: voa alto em oito sobre o covil e mergulha em quem chega perto
  ignis: { voa: true, voaAlto: true, sprite: () => quadrosDragao("#8a1010", { escala: 2.4, coroa: true })[0], quadros: () => quadrosDragao("#8a1010", { escala: 2.4, coroa: true }) },
};
// Os monstros do bestiário (bestiario.js): desenhados com volume e em quadros de animação próprios (o slime
// borbulha, o sapo infla o papo, o morcego bate as asas...), que tocam até parados ("vivo"). Os chefões são
// desenhados grandes de verdade, com a coroa, em vez de só ampliados.
const ARTE_DOS_MONSTROS = {
  slimeVerde: () => slimeArte("#5fd35f"), slimeAzul: () => slimeArte("#4fa8ff"), slimeRoxo: () => slimeArte("#b06cff"),
  slimeGigante: () => slimeArte("#2f9e5a", { escala: 1.25 }), slimeFantasma: () => slimeArte("#9fb8ff"), slimeToxico: () => slimeArte("#9acd32"),
  sapo: () => sapoArte(), sapoLuminoso: () => sapoArte("#3fd16a", "#eaffa0"),
  morcego: () => morcegoArte(), assombracao: () => assombracaoArte(), fogoFatuo: () => fogoFatuoArte(),
  escorpiao: () => escorpiaoArte(), esqueleto: () => esqueletoArte(),
  reiSlime: () => slimeArte("#5fd35f", { escala: 2.6, coroa: true }),
  sapoRei: () => sapoArte("#4c9a2a", "#c8f59a", { escala: 2.5, coroa: true }),
  escorpiaoImperador: () => escorpiaoArte("#5a2a8a", "#3d1d63", "#f5c451", { escala: 2.3, coroa: true }),
};
Object.entries(ARTE_DOS_MONSTROS).forEach(([id, arte]) => Object.assign(TIPOS_MONSTRO[id], { sprite: () => arte()[0], quadros: arte, vivo: true }));// onde cada chefão espera o herói (o mapa abre uma clareira e uma trilha até ele)
const CHEFES = [
  { tipoId: "reiSlime", tx: 208, ty: 128 }, { tipoId: "fenrir", tx: 36, ty: 88 }, { tipoId: "sapoRei", tx: 80, ty: 184 },
  { tipoId: "escorpiaoImperador", tx: 292, ty: 88 }, { tipoId: "ignis", tx: 176, ty: 38 },
];
const POPULACAO = {
  vale: [],
  campos: [["slimeVerde", 7], ["slimeAzul", 6], ["slimeRoxo", 5], ["slimeGigante", 2]],
  floresta: [["lobo", 9], ["loboAlfa", 2], ["slimeVerde", 2]],
  pantano: [["sapo", 6], ["slimeToxico", 6]],
  deserto: [["escorpiao", 8], ["esqueleto", 6]],
  montanhas: [["loboNeve", 5], ["dragao", 3], ["dragaoGelo", 3]],
};
// criaturas que só existem à noite: de dia elas somem (dormem em algum canto escuro)
const POPULACAO_NOITE = {
  campos: [["morcego", 6]],
  floresta: [["morcego", 3], ["assombracao", 5]],
  pantano: [["fogoFatuo", 6]],
};

// ---------- o Reino como cenário do motor de mundos (mundo.js) ----------

let mundoGerado = null;

function prepararMundo() {
  if (mundoGerado) return mundoGerado;
  const mundo = gerarMundo();
  // o chão em 32 × 32: cada tile é montado com pedaços do tileset (imagem salva ou gerada pelo código),
  // desenhando só o que aparece na tela
  const tileset = tilesetHD();
  const indice = Object.fromEntries(tileset.nomes.map((nome, i) => [nome, i]));
  const desenharChao = criarDesenhoDoChao(tileset, camadasDoChao(mundo.mapa, indice));
  // árvores, pedras e plantas em alta resolução (o tamanho no mundo vem do "res" de cada desenho)
  const sprites = Object.fromEntries(Object.keys(SPRITES_DECORACAO).map((tipo) => [tipo, spriteHD(`decoracao-${tipo}`, () => decoracaoHD(tipo))]));
  // as árvores pintadas (arvores_arte.js): 3 variações de cada, sorteadas pela posição
  const pintada = (a) => (typeof arvorePintada === "function" && ARVORES_PINTADAS.has(a.tipo) ? arvorePintada(a.tipo, Math.floor(hashTile(a.x, a.y, 9) * 3)) : null);
  const props = mundo.decoracao.map((a) => ({
    x: a.x * TILE + 8, y: a.y * TILE + 16, sprite: pintada(a) || sprites[a.tipo], folhas: a.tipo === "morta" || a.tipo === "cacto" ? false : undefined, balanco: !DECORACAO_SEM_COLISAO.has(a.tipo) && a.tipo !== "rocha",
    tilesBloqueados: DECORACAO_SEM_COLISAO.has(a.tipo) ? [] : [`${a.x},${a.y}`],
    // árvores grandes ficam transparentes quando o herói passa por trás delas
    vazado: !DECORACAO_SEM_COLISAO.has(a.tipo) && !a.tipo.startsWith("rocha"),
  }));
  CONSTRUCOES.forEach(([tipo, cx, cy, w, h, extra]) => {
    const nome = nomeConstrucaoHD(tipo, extra);
    const sprite = spriteHD(nome, () => construcaoHD(SPRITES_CONSTRUCAO[tipo](extra), nome.length * 13));
    const centro = centroConstrucao(cx, w);
    const prop = { x: centro, y: (cy + 1) * TILE, sprite, tilesBloqueados: tilesDaBase(centro, cy, w * TILE, h * ESCALA_CENARIO), vazado: true };
    const animacao = {
      moinho: (c, x, y, t) => animarMoinho(c, x + 20, y + 14, t),
      ferraria: (c, x, y, t) => animarFumaca(c, x + 40, y + 1, t, "#8a8b99"),
      casa: (c, x, y, t) => animarFumaca(c, x + 35, y + 2, t, "#dcdce6"),
      cabanaBruxa: (c, x, y, t) => animarFumaca(c, x + 22, y + 1, t, "#7dff9a"),
      posto: (c, x, y, t) => animarBandeira(c, x + 19, y + 1, t),
      casaNeve: (c, x, y, t) => animarFumaca(c, x + 36, y + 2, t, "#e8eef5"),
      palafita: (c, x, y, t) => animarFumaca(c, x + 30, y + 4, t, "#9fb89a"),
      torreMuralha: (c, x, y, t) => animarBandeira(c, x + 12, y + 0, t),
      // a chama do lampião tremula e o farol pisca devagar
      lampiao: (c, x, y, t) => {
        c.fillStyle = `rgba(255, 245, 200, ${0.25 + Math.sin(t * 9 + cx) * 0.15})`;
        c.fillRect(x + 2, y + 2, 4, 5);
      },
      farol: (c, x, y, t) => {
        c.fillStyle = `rgba(255, 250, 210, ${0.3 + Math.sin(t * 2) * 0.3})`;
        c.fillRect(x + 6, y + 6, 12, 10);
      },
      fonte: (c, x, y, t) => {
        c.fillStyle = "#cfefff";
        [[11, 6], [20, 6], [10, 9], [21, 9]].forEach(([dx, dy], i) => c.fillRect(x + dx, y + dy + ((Math.floor(t * 6) + i) % 3), 1, 1));
      },
    }[tipo];
    if (animacao) prop.animar = animarAmpliado(animacao);
    // a fonte e o poste pintados (arvores_arte.js), com a água e a chama animadas por cima
    if (typeof fontePintada === "function" && tipo === "fonte") {
      prop.sprite = fontePintada(128, 96);
      prop.animar = (c, x, y, t) => animarFontePintada(c, x, y, t, prop.sprite);
    }
    if (typeof postePintado === "function" && tipo === "lampiao") {
      prop.sprite = postePintado(32, 104, extra || "#ffd96b");
      prop.animar = (c, x, y, t) => animarPostePintado(c, x, y, t, prop.sprite, cx + cy);
    }
    props.push(prop);
  });
  // a região de cada tile, calculada uma vez (a barreira e o minimapa consultam muito)
  const regioes = Array.from({ length: LINHAS }, (_, y) => Array.from({ length: COLUNAS }, (_, x) => regiaoDe(x, y)));
  mundoGerado = { ...mundo, desenharChao, props, regioes };
  return mundoGerado;
}

// Mapa pequeno do Reino (1 pixel por tile) para o minimapa do HUD.
function miniMapaReino() {
  return spriteReino("minimapa", () => {
    const { mapa } = prepararMundo();
    const { canvas, ctx } = criarTela(COLUNAS, LINHAS);
    for (let y = 0; y < LINHAS; y++) for (let x = 0; x < COLUNAS; x++) {
      let cor = CORES_TILE[mapa[y][x]];
      if (mapa[y][x] === T.AGUA && regiaoDe(x, y) === "pantano") cor = "#3d6b5a";
      if (mapa[y][x] === T.ROCHA && regiaoDe(x, y) !== "montanhas") cor = "#a0703f";
      retangulo(ctx, x, y, 1, 1, cor);
    }
    prepararMundo().decoracao.forEach((d) => {
      if (!DECORACAO_SEM_COLISAO.has(d.tipo)) retangulo(ctx, d.x, d.y, 1, 1, d.tipo === "cacto" ? "#3f8f4a" : "#1d5a31");
    });
    // as cidades aparecem com o chão arrumado; muralhas e cercas em cinza e marrom, casas em creme
    CONSTRUCOES.forEach(([tipo, cx, cy, w, h]) => {
      if (tipo === "lampiao") return;
      const cor = tipo.startsWith("muralha") || tipo === "torreMuralha" ? "#5a5b68" : tipo.startsWith("cerca") ? "#7a4f28" : "#e9d6a8";
      retangulo(ctx, cx - Math.floor(w / 2), cy - Math.ceil(h) + 1, Math.max(1, Math.round(w)), Math.max(1, Math.ceil(h)), cor);
    });
    return canvas;
  });
}

// puzzles: [{ id, nome, movel, resolvido }], combate: { tipoId: { nome, forca, vida... } } e
// regioesServidor: { regiaoId: { nivelMinimo... } }, vindos do servidor; nivelHeroi abre as barreiras
function cenarioReino(dadosLugares, puzzles = [], combate = {}, regioesServidor = {}, nivelHeroi = 1) {
  const { mapa, desenharChao, props, regioes } = prepararMundo();
  // as regiões de Umbraterra também vêm do servidor, mas são de outro mapa (umbra.js)
  Object.entries(regioesServidor).forEach(([id, r]) => REGIOES[id] && Object.assign(REGIOES[id], r));
  const trancada = (tx, ty) => {
    const id = regioes[ty]?.[tx];
    return id && !regiaoLiberada(id, nivelHeroi) ? REGIOES[id] : null;
  };

  const lugares = dadosLugares.map((l) => {
    const [cx, cy] = POSICAO_LUGARES[l.id];
    const [w] = TAMANHO_LUGARES[l.id];
    // o desenho original fica guardado: as animações são feitas nele e ampliadas junto
    const base = spriteReino(`lugar-${l.id}`, () => spriteLugar(l.id));
    const lugar = {
      ...l, sprite: spriteHD(`lugar-${l.id}`, () => construcaoHD(base, l.id.length * 31, 0.05)),
      px: cx * TILE + 8, py: (cy + 1) * TILE,
      entrada: { x: cx * TILE + 8, y: (cy + 1) * TILE + 8 }, tilesBloqueados: tilesDaBase(cx * TILE + 8, cy, w, 3),
      sobrepoe: l.tipo === "dungeon" || l.tipo === "fenda", // a fenda decide sozinha (trancada só avisa)
      semTransicao: l.tipo === "portal", // o portal já tem a transição "Rumo à Academia"
    };
    lugar.animar = animarAmpliado((ctx, x, y, t) => animarLugarReino(ctx, { ...lugar, sprite: base }, x, y, t));
    return lugar;
  });
  puzzles.forEach((p) => {
    const [cx, cy] = POSICAO_PUZZLES[p.id] || [];
    if (cx === undefined) return;
    const movel = p.movel === "bau" ? "bau" : "runa";
    const nomeHD = `${movel}-${movel === "bau" ? (p.resolvido ? "aberto" : "fechado") : (p.resolvido ? "apagada" : "acesa")}`;
    const sprite = spriteHD(nomeHD, () => dobradoHD(SPRITES_PONTOS[movel](p.resolvido), 7));
    lugares.push({
      id: p.id, puzzle: p, nome: p.nome, icone: p.resolvido ? "✓" : p.movel === "bau" ? "🗝️" : "🔮", acao: p.resolvido ? "Ver" : "Resolver",
      sprite, px: cx * TILE + 8, py: (cy + 1) * TILE, sobrepoe: true, semRotulo: true, vencida: p.resolvido,
      entrada: { x: cx * TILE + 8, y: (cy + 1) * TILE + 8 }, tilesBloqueados: [`${cx},${cy}`],
      animar: p.resolvido ? null : (ctx, x, y, t) => animarEnigma(ctx, x, y, t, sprite.width / sprite.res),
    });
  });
  // quem faz parte da história principal (dá quest ou é procurado por ela) nunca vai dormir: fica na rua
  // também à noite, para a história nunca travar esperando amanhecer
  const historia = (typeof JORNADA !== "undefined" && JORNADA.historia?.principais) || [];
  const daHistoria = new Set(historia.flatMap((q) => [q.npc, ...q.objetivos.filter((o) => o.evento === "falar").map((o) => o.filtro?.npc)]));
  HABITANTES.forEach((h) => {
    const sprite = heroiParado(h.visual);
    lugares.push({
      id: `npc-${h.id}`, habitante: h, nome: h.nome, icone: "💬", acao: "Falar", sprite, sobrepoe: true, semRotulo: true,
      visual: h.visual, passeia: 26, casaNoite: daHistoria.has(h.id) ? null : portaMaisPerto(h.tx, h.ty),
      px: h.tx * TILE + 8, py: (h.ty + 1) * TILE, entrada: { x: h.tx * TILE + 8, y: (h.ty + 1) * TILE + 8 }, tilesBloqueados: [`${h.tx},${h.ty}`],
      // quem tem quest para o herói mostra o "!" (ou o "?" para entregar); os outros, o balãozinho de fala
      animar: (ctx, x, y, t) => {
        const quest = typeof estadoQuestNpc === "function" ? estadoQuestNpc(h.id) : null;
        if (quest) desenharMarcadorQuest(ctx, x + sprite.width / RESOLUCAO_REINO / 2, y - 4, t, quest);
        else animarBalaoFala(ctx, x, y, t, sprite.width / RESOLUCAO_REINO);
      },
    });
  });
  // a estátua do Arquimago no meio da praça: dá para chegar perto e ler a placa
  const [ex, ey] = ESTATUA_PRACA;
  lugares.push({
    id: "estatua-arquimago", placa: { texto: TEXTO_ESTATUA }, nome: "Estátua do Arquimago", icone: "🧙", acao: "Ler",
    sprite: spriteHD("estatua-arquimago", () => dobradoHD(spriteEstatuaArquimago(), 5, 0.03)), sobrepoe: true, semRotulo: true,
    px: ex * TILE + 8, py: (ey + 1) * TILE, entrada: { x: ex * TILE + 8, y: (ey + 1) * TILE + 8 }, tilesBloqueados: [`${ex},${ey}`],
    animar: animarEstatua,
  });
  PLACAS.forEach((p) => {
    const sprite = spriteHD("placa", () => dobradoHD(SPRITES_PONTOS.placa(), 11));
    // a placa de entrada de cada cidade mostra o nome da cidade flutuando em cima (clicar leva até ela)
    lugares.push({
      id: p.id, placa: p, nome: p.cidade ? p.nome : "Placa", icone: p.cidade ? p.icone : "🪧", acao: "Ler", sprite, sobrepoe: true,
      semRotulo: !p.cidade, destaque: Boolean(p.cidade),
      px: p.tx * TILE + 8, py: (p.ty + 1) * TILE, entrada: { x: p.tx * TILE + 8, y: (p.ty + 1) * TILE + 8 }, tilesBloqueados: [`${p.tx},${p.ty}`],
    });
  });

  // monstros: cada região tem os seus, e eles continuam existindo entre uma visita e outra
  const andavelBase = (tx, ty) => {
    const t = mapa[ty]?.[tx];
    return t !== undefined && t !== T.AGUA && t !== T.ROCHA;
  };
  // a "forma" de um tipo de monstro: desenho e números de combate; quem tem versão noturna guarda as duas
  const forma = (tipoId) => {
    const { noite, sprite: criar, quadros, ...resto } = TIPOS_MONSTRO[tipoId];
    // os padrões apagam o que a outra forma tinha (o slime fantasma é translúcido, o de dia não)
    const padrao = { agressivo: false, velocidade: undefined, voa: false, translucido: false, brilho: null };
    return {
      tipoId, ...padrao, ...resto, ...combate[tipoId], sprite: spriteReino(`monstro-${tipoId}`, criar),
      quadros: quadros ? spriteReino(`quadros-${tipoId}`, quadros) : null,
    };
  };
  if (!estadoMundo.monstros) {
    estadoMundo.monstros = [];
    let n = 0;
    const populacao = [
      ...Object.entries(POPULACAO).flatMap(([regiao, lista]) => lista.map(([tipoId, quantos]) => [regiao, tipoId, quantos, false])),
      ...Object.entries(POPULACAO_NOITE).flatMap(([regiao, lista]) => lista.map(([tipoId, quantos]) => [regiao, tipoId, quantos, true])),
    ];
    populacao.forEach(([regiao, tipoId, quantos, soNoite]) => {
      if (!combate[tipoId]) return; // o servidor ainda não conhece esse monstro
      const dia = forma(tipoId);
      const noite = TIPOS_MONSTRO[tipoId].noite && combate[TIPOS_MONSTRO[tipoId].noite] ? forma(TIPOS_MONSTRO[tipoId].noite) : null;
      let colocados = 0;
      // o Reino tem 4× a área do primeiro mapa: o triplo de monstros (as cidades ficam vazias deles)
      const total = quantos * 3;
      for (let tentativa = 0; colocados < total && tentativa < 6000; tentativa++) {
        const tx = 3 + Math.floor(hashTile(tentativa, n, 9) * (COLUNAS - 6));
        const ty = 3 + Math.floor(hashTile(n, tentativa, 5) * (LINHAS - 6));
        if (regiaoDe(tx, ty) !== regiao || !andavelBase(tx, ty) || [T.CAMINHO, T.PONTE, T.PEDRA].includes(mapa[ty][tx])) continue;
        if (dentroDeCidade(tx, ty, 10) || Math.hypot(tx - VILA[0], ty - VILA[1]) < 44) continue;
        const id = `${tipoId}-${n}`;
        estadoMundo.monstros.push({
          id, ...dia, dia, noturno: noite, regiao, casa: [tx, ty], x: tx * TILE + 8, y: ty * TILE + 12, alvo: null, espera: 0,
          // as criaturas da noite somem de dia, como se tivessem sido derrotadas
          derrotado: () => {
            if (soNoite && !PERIODO.noite) return true;
            const quando = estadoMundo.derrotados[id];
            if (quando && Date.now() - quando > 120000) delete estadoMundo.derrotados[id];
            return Boolean(estadoMundo.derrotados[id]);
          },
        });
        colocados++;
        n++;
      }
    });
    // os chefões ficam parados no covil e, vencidos, não voltam mais
    CHEFES.forEach(({ tipoId, tx, ty }) => {
      const tipo = { ...TIPOS_MONSTRO[tipoId], ...combate[tipoId] };
      const id = `chefe-${tipoId}`;
      estadoMundo.monstros.push({
        id, tipoId, ...tipo, regiao: regiaoDe(tx, ty), sprite: spriteReino(`monstro-${tipoId}`, tipo.sprite),
        quadros: tipo.quadros ? spriteReino(`quadros-${tipoId}`, tipo.quadros) : null, parado: !tipo.voaAlto,
        casa: [tx, ty], x: tx * TILE + 8, y: ty * TILE + 12, alvo: null, espera: 0,
        derrotado: () => (progresso.chefesDerrotados || []).includes(id),
      });
    });
  }

  // monstros de região trancada ficam do lado de lá da barreira e não atacam
  estadoMundo.monstros.forEach((m) => { m.trancado = !regiaoLiberada(m.regiao, nivelHeroi); });

  // quando escurece, os monstros que têm forma noturna se transformam (e voltam ao amanhecer)
  let eraNoite = null;
  const conferirPeriodo = () => {
    const { noite } = momentoDoDia();
    PERIODO.noite = noite;
    if (noite === eraNoite) return;
    const primeiraVez = eraNoite === null;
    eraNoite = noite;
    estadoMundo.monstros.forEach((m) => {
      if (m.noturno) Object.assign(m, noite ? m.noturno : m.dia, { regiao: m.regiao });
    });
    if (!primeiraVez && typeof Som !== "undefined") Som.efeito(noite ? "uivo" : "acerto");
  };
  conferirPeriodo();

  // a barreira mágica nas bordas das regiões trancadas que aparecem
  function desenharBarreiras(ctx, camera, w, h, t) {
    const x0 = Math.floor(camera.x / TILE);
    const y0 = Math.floor(camera.y / TILE);
    for (let ty = Math.max(0, y0); ty <= y0 + Math.ceil(h / TILE); ty++) {
      for (let tx = Math.max(0, x0); tx <= x0 + Math.ceil(w / TILE); tx++) {
        if (trancada(tx, ty) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => regioes[ty + dy]?.[tx + dx] && !trancada(tx + dx, ty + dy))) {
          desenharBarreira(ctx, tx * TILE - camera.x, ty * TILE - camera.y, t, hashTile(tx, ty));
        }
      }
    }
  }

  const [px, py] = POSICAO_LUGARES.portal;
  return {
    colunas: COLUNAS, linhas: LINHAS, desenharChao, props, lugares, monstros: estadoMundo.monstros, corFundo: "#2f7fbf",
    resolucao: RESOLUCAO_REINO, // 32 pixels por tile: o Reino é desenhado no dobro da resolução
    andavel: andavelBase,
    barreira: trancada,
    spawn: { x: px * TILE + 8, y: (py + 2) * TILE + 8 },
    teleporte: { x: px * TILE + 8, y: (py + 2) * TILE + 8 }, // a habilidade Teleporte traz de volta para o portal
    noite: () => momentoDoDia().noite,
    // o som do lugar: à noite, grilos e corujas; de dia, o de cada região (o vale soa como os campos)
    ambiente: (x, y) => {
      const regiao = regioes[Math.floor(y / TILE)]?.[Math.floor(x / TILE)];
      if (estaChovendo() && ["campos", "vale", "floresta"].includes(regiao)) return "chuva";
      if (PERIODO.noite) return "noite";
      return regiao === "vale" ? "campos" : regiao;
    },
    chaoDoPasso: (tx, ty) => CHAO_DO_PASSO[mapa[ty]?.[tx]] || "grama",
    // a barreira mágica nas fronteiras das regiões trancadas, por cima das árvores; depois, a noite
    animarPorCima(ctx, camera, w, h, t, heroi) {
      conferirPeriodo();
      desenharBarreiras(ctx, camera, w, h, t);
      if (heroi) {
        const regiao = regioes[Math.floor(heroi.y / TILE)]?.[Math.floor(heroi.x / TILE)];
        // a atmosfera do dia (nuvens, luz, folhas, pólen) fica embaixo da noite
        desenharAtmosfera(ctx, camera, w, h, t, regiao);
        // a noite primeiro: vagalumes, chuva e neve brilham por cima do escuro
        desenharNoite(ctx, camera, w, h, t, heroi);
        desenharClima(ctx, camera, w, h, t, regiao, PERIODO.noite);
      }
    },
    // brilho da água se mexendo
    animarChao(ctx, camera, w, h, t) {
      const x0 = Math.floor(camera.x / TILE);
      const y0 = Math.floor(camera.y / TILE);
      for (let ty = Math.max(0, y0); ty <= y0 + Math.ceil(h / TILE); ty++) {
        for (let tx = Math.max(0, x0); tx <= x0 + Math.ceil(w / TILE); tx++) {
          if (mapa[ty]?.[tx] !== T.AGUA) continue;
          const fase = Math.floor(t * 3 + hashTile(tx, ty) * 10) % 16;
          retangulo(ctx, tx * TILE + fase - camera.x, ty * TILE + 5 + (fase % 3) * 3 - camera.y, 3, 1, "#7fc3e8");
        }
      }
      // os bichos passeando (por baixo das árvores e do herói)
      desenharBichos(ctx, camera, w, h, t, mapa, regioes, PERIODO.noite);
    },
  };
}

// ---------- dia e noite ----------
// Um dia inteiro no Reino dura 24 minutos de relógio: cada minuto de verdade é uma hora do Reino (vale
// para todo mundo, mesmo trocando de tela). O dia claro vai das 5h30 às 17h30, o entardecer alaranjado até
// as 20h, a noite escura até as 4h e o amanhecer até as 5h30.
const DURACAO_DIA = 24 * 60;
const HORAS = { entardecer: 17.5, noite: 20, amanhecer: 4, dia: 5.5 };
const PERIODO = { noite: false }; // atualizado a cada quadro do Reino (as criaturas da noite olham para cá)
const ESCURIDAO_NOITE = 0.7;
const LIMIAR_NOITE = 0.55; // a partir de quanto da escuridão máxima já conta como noite (monstros mudam)
const HORA_ANOITECE = HORAS.entardecer + LIMIAR_NOITE * (HORAS.noite - HORAS.entardecer);
const HORA_AMANHECE = HORAS.amanhecer + (1 - LIMIAR_NOITE) * (HORAS.dia - HORAS.amanhecer);

// O relógio do Reino é de cada save: conta a partir de quando a aventura começou (progresso.inicioDoDia,
// às 6h da manhã). Saves antigos, sem esse marco, seguem o relógio de antes (o mesmo para todos).
function momentoDoDia(agora = Date.now()) {
  const inicio = (typeof progresso !== "undefined" && progresso?.inicioDoDia) || 0;
  const fase = (((agora - inicio) / 1000 % DURACAO_DIA) + DURACAO_DIA) % DURACAO_DIA / DURACAO_DIA;
  const hora = (fase * 24 + 6) % 24; // a fase 0 é 6h da manhã
  let escuridao = 0;
  let nome = hora < 12 ? "Manhã" : "Tarde";
  let icone = "☀️";
  let laranja = 0;
  if (hora >= HORAS.entardecer && hora < HORAS.noite) {
    const p = (hora - HORAS.entardecer) / (HORAS.noite - HORAS.entardecer);
    escuridao = ESCURIDAO_NOITE * p;
    laranja = Math.sin(p * Math.PI);
    nome = "Entardecer";
    icone = "🌇";
  } else if (hora >= HORAS.noite || hora < HORAS.amanhecer) {
    escuridao = ESCURIDAO_NOITE;
    nome = "Noite";
    icone = "🌙";
  } else if (hora < HORAS.dia) {
    const p = (hora - HORAS.amanhecer) / (HORAS.dia - HORAS.amanhecer);
    escuridao = ESCURIDAO_NOITE * (1 - p);
    laranja = Math.sin(p * Math.PI) * 0.6;
    nome = "Amanhecer";
    icone = "🌅";
  }
  const noite = escuridao > ESCURIDAO_NOITE * LIMIAR_NOITE;
  // quanto falta (em segundos de verdade) para virar: de dia, para anoitecer; de noite, para amanhecer
  const faltam = (((noite ? HORA_AMANHECE : HORA_ANOITECE) - hora + 24) % 24) * DURACAO_DIA / 24;
  return { fase, hora, escuridao, laranja, noite, nome, icone, faltam };
}

// as luzes do Reino à noite: casas e construções acesas, a estalagem, o mercado e o portal
const LUZES_NOITE = [
  ...CONSTRUCOES.filter(([tipo]) => ["casa", "ferraria", "moinho", "cabana", "cabanaBruxa", "torre", "posto", "fortaleza", "palafita", "casaAdobe", "casaNeve", "torreMuralha", "farol", "lampiao"].includes(tipo))
    .map(([tipo, cx, cy, w, , extra]) => ({
      x: centroConstrucao(cx, w), y: cy * TILE - (tipo === "lampiao" ? 34 : tipo === "farol" ? 100 : 12),
      raio: { fortaleza: 100, farol: 150, lampiao: 52, torreMuralha: 48 }[tipo] || 64,
      cor: tipo === "cabanaBruxa" || (tipo === "lampiao" && extra === "#7dff9a") ? "125, 255, 154" : "255, 190, 110",
    })),
  ...["estalagem", "mercado", "portal", "forja"].map((id) => ({ x: POSICAO_LUGARES[id][0] * TILE + 8, y: POSICAO_LUGARES[id][1] * TILE - 16, raio: 84, cor: id === "portal" ? "169, 139, 255" : "255, 190, 110" })),
  // o cristal do cajado da estátua ilumina a praça de roxo
  { x: ESTATUA_PRACA[0] * TILE + 8, y: ESTATUA_PRACA[1] * TILE - 30, raio: 50, cor: "169, 139, 255" },
];

// a porta mais perto de cada morador (é para lá que ele vai quando anoitece)
function portaMaisPerto(tx, ty) {
  let melhor = null;
  CONSTRUCOES.forEach(([tipo, cx, cy, w]) => {
    if (!["casa", "ferraria", "moinho", "cabana", "cabanaBruxa", "torre", "posto", "fortaleza", "piramide", "palafita", "casaAdobe", "casaNeve"].includes(tipo)) return;
    const d = Math.hypot(cx - tx, cy - ty);
    if (!melhor || d < melhor.d) melhor = { d, x: cx * TILE + (w % 2 ? 8 : 0), y: (cy + 1) * TILE + 2 };
  });
  return melhor && melhor.d < 30 ? { x: melhor.x, y: melhor.y } : null;
}


let telaEscuridao = null;
// A noite: um véu azul-escuro com buracos de luz no herói e nas casas, brilho quente das janelas
// e vaga-lumes pelos campos. No entardecer e no amanhecer o céu fica alaranjado.
function desenharNoite(ctx, camera, w, h, t, heroi) {
  const { escuridao, laranja } = momentoDoDia();
  if (escuridao <= 0.01 && laranja <= 0.01) return;
  if (laranja > 0) {
    ctx.fillStyle = `rgba(255, 120, 40, ${0.16 * laranja})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (escuridao <= 0.01) return;
  if (!telaEscuridao || telaEscuridao.width !== w || telaEscuridao.height !== h) telaEscuridao = criarTela(w, h);
  const c = telaEscuridao.ctx;
  c.globalCompositeOperation = "source-over";
  c.clearRect(0, 0, w, h);
  c.fillStyle = `rgba(10, 12, 42, ${escuridao})`;
  c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = "destination-out";
  const buraco = (x, y, raio, forca = 1) => {
    const g = c.createRadialGradient(x, y, 0, x, y, raio);
    g.addColorStop(0, `rgba(0, 0, 0, ${forca})`);
    g.addColorStop(0.6, `rgba(0, 0, 0, ${forca * 0.6})`);
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    c.fillStyle = g;
    c.fillRect(x - raio, y - raio, raio * 2, raio * 2);
  };
  const visivel = (x, y, r) => x > -r && y > -r && x < w + r && y < h + r;
  // a lanterna do herói, que tremula de leve (com a Luz Arcana, o círculo de luz fica bem maior)
  const luzArcana = heroi.luzAte > performance.now() / 1000;
  buraco(heroi.x - camera.x, heroi.y - 10 - camera.y, (luzArcana ? 150 : 70) + Math.sin(t * 6) * 2, 0.95);
  LUZES_NOITE.forEach((l) => {
    const x = l.x - camera.x;
    const y = l.y - camera.y;
    if (visivel(x, y, l.raio)) buraco(x, y, l.raio + Math.sin(t * 3 + l.x) * 2, 0.85);
  });
  // os fogos-fátuos e os sapos luminosos acendem a escuridão em volta deles
  const brilhantes = (estadoMundo.monstros || []).filter((m) => m.brilho && !m.derrotado());
  brilhantes.forEach((m) => {
    const x = m.x - camera.x;
    const y = m.y - 10 - camera.y;
    if (visivel(x, y, 40)) buraco(x, y, 34 + Math.sin(t * 4 + m.casa[0]) * 3, 0.7);
  });
  ctx.drawImage(telaEscuridao.canvas, 0, 0);
  // brilho quente das janelas por cima da escuridão
  ctx.globalCompositeOperation = "lighter";
  LUZES_NOITE.forEach((l) => {
    const x = l.x - camera.x;
    const y = l.y - camera.y;
    if (visivel(x, y, l.raio)) brilhoRedondo(ctx, x, y, Math.round(l.raio * 0.6), l.cor, 0.05 * (escuridao / ESCURIDAO_NOITE));
  });
  ctx.globalCompositeOperation = "source-over";
  // vaga-lumes dançando em volta do herói
  const k = escuridao / ESCURIDAO_NOITE;
  for (let i = 0; i < 14; i++) {
    const x = ((i * 97 + Math.sin(t * 0.6 + i) * 40 + t * 6) % (w + 40)) - 20;
    const y = ((i * 53 + Math.cos(t * 0.8 + i * 2) * 30) % h);
    if (Math.sin(t * 3 + i * 1.7) < 0.2) continue;
    ctx.globalAlpha = k * (0.5 + Math.sin(t * 5 + i) * 0.5);
    ctx.fillStyle = "#d4ff7a";
    ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
  ctx.globalAlpha = 1;
}

// ---------- a atmosfera do dia ----------
// O que deixa o Reino vivo de dia, por cima do chão e embaixo da noite: as sombras das nuvens passando
// devagar pelo mapa (presas ao mundo, não à tela), os raios de sol entre as copas e as folhas caindo na
// floresta, o pólen e as borboletas nos campos e uma vinheta suave nas bordas da tela. Tudo some aos poucos
// conforme escurece. As nuvens são uma tela de 512 × 512 desenhada uma vez e repetida.
let telaNuvens = null;
let telaVinheta = null;

function sombrasDeNuvem() {
  if (telaNuvens) return telaNuvens;
  const { canvas, ctx } = criarTela(512, 512);
  const sorte = (i) => hashTile(i, 3, 91);
  ctx.fillStyle = "#14203a";
  for (let n = 0; n < 6; n++) {
    const cx = sorte(n) * 512;
    const cy = sorte(n + 40) * 512;
    // cada nuvem é um cacho de bolas, desenhado nas 9 posições para emendar nas bordas da repetição
    for (let b = 0; b < 7; b++) {
      const bx = cx + (sorte(n * 10 + b) - 0.5) * 90;
      const by = cy + (sorte(n * 10 + b + 5) - 0.5) * 40;
      const r = 22 + sorte(n * 10 + b + 9) * 26;
      for (let ox = -512; ox <= 512; ox += 512) {
        for (let oy = -512; oy <= 512; oy += 512) {
          ctx.beginPath();
          ctx.ellipse(bx + ox, by + oy, r, r * 0.62, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  telaNuvens = canvas;
  return canvas;
}

function vinhetaDoReino(w, h) {
  if (telaVinheta && telaVinheta.width === w && telaVinheta.height === h) return telaVinheta;
  const { canvas, ctx } = criarTela(w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  g.addColorStop(0, "rgba(8, 6, 20, 0)");
  g.addColorStop(1, "rgba(8, 6, 20, 0.38)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  telaVinheta = canvas;
  return canvas;
}

function desenharAtmosfera(ctx, camera, w, h, t, regiao) {
  const { escuridao } = momentoDoDia();
  const dia = Math.max(0, 1 - escuridao / ESCURIDAO_NOITE);
  const chuva = estaChovendo() && ["campos", "vale", "floresta"].includes(regiao);
  if (dia > 0.05) {
    // sombras das nuvens: o vento leva para a direita e um pouco para baixo
    const nuvens = sombrasDeNuvem();
    const vx = ((camera.x - t * 7) % 512 + 512) % 512;
    const vy = ((camera.y - t * 2.5) % 512 + 512) % 512;
    ctx.globalAlpha = (chuva ? 0.05 : 0.13) * dia;
    for (let x = -vx; x < w; x += 512) for (let y = -vy; y < h; y += 512) ctx.drawImage(nuvens, Math.round(x), Math.round(y));
    ctx.globalAlpha = 1;
  }
  if (regiao === "floresta") {
    // raios de sol em diagonal, que respiram devagar
    if (dia > 0.2 && !chuva) {
      for (let i = 0; i < 4; i++) {
        const base = ((i * 173 - camera.x) % (w + 200) + w + 200) % (w + 200) - 100;
        ctx.globalAlpha = (0.05 + Math.sin(t * 0.4 + i * 1.7) * 0.025) * dia;
        ctx.fillStyle = "#fff3b0";
        for (let y = 0; y < h; y += 4) ctx.fillRect(Math.round(base + y * 0.45), y, 16 + i * 4, 4);
      }
      ctx.globalAlpha = 1;
    }
    // folhas caindo, balançando de um lado para o outro
    // (presas ao mundo: a posição desconta a câmera inteira, então ficam paradas quando o herói anda)
    for (let i = 0; i < 18; i++) {
      const queda = t * (9 + (i % 4) * 3) + i * 41;
      const x = ((i * 89 + Math.sin(t * 1.3 + i) * 14 - camera.x) % w + w) % w;
      const y = ((queda - camera.y) % (h + 20) + h + 20) % (h + 20) - 10;
      ctx.fillStyle = ["#c9952a", "#a0703f", "#8fbf4a", "#d9b04a"][i % 4];
      ctx.fillRect(Math.round(x), Math.round(y), Math.sin(t * 4 + i) > 0 ? 2 : 1, 1);
    }
  }
  if ((regiao === "campos" || regiao === "vale") && dia > 0.3 && !chuva) {
    // pólen subindo devagar
    ctx.fillStyle = "#fff6c9";
    for (let i = 0; i < 24; i++) {
      const x = ((i * 71 + Math.sin(t * 0.5 + i) * 18 - camera.x) % w + w) % w;
      const y = h - (((t * (4 + (i % 3) * 2) + i * 37 + camera.y) % (h + 10) + h + 10) % (h + 10));
      ctx.globalAlpha = (0.35 + Math.sin(t * 2 + i) * 0.25) * dia;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    // duas borboletas batendo as asas (presas ao mundo, como o pólen: quando o herói anda, elas ficam
    // para trás no ritmo do chão, em vez de acompanhar a câmera)
    for (let i = 0; i < 2; i++) {
      const x = ((i * 211 + t * 12 + Math.sin(t * 0.9 + i) * 30 - camera.x) % (w + 40) + w + 40) % (w + 40) - 20;
      const y = ((h * (0.3 + i * 0.35) + Math.sin(t * 1.6 + i * 2) * 14 - camera.y) % (h + 40) + h + 40) % (h + 40) - 20;
      const asa = Math.sin(t * 14 + i) > 0 ? 2 : 1;
      ctx.globalAlpha = dia;
      ctx.fillStyle = i ? "#ffd166" : "#ff9fe0";
      ctx.fillRect(Math.round(x - asa), Math.round(y), asa, 2);
      ctx.fillRect(Math.round(x + 1), Math.round(y), asa, 2);
      ctx.fillStyle = "#2b2540";
      ctx.fillRect(Math.round(x), Math.round(y), 1, 2);
    }
    ctx.globalAlpha = 1;
  }
  if (!chuva) desenharPassaros(ctx, camera, w, h, t, dia);
  ctx.drawImage(vinhetaDoReino(Math.ceil(w), Math.ceil(h)), 0, 0);
}

// ---------- os bichos do Reino ----------
// Animais que só enfeitam (não lutam nem bloqueiam): coelhos pulando nos campos, cervos e coelhos na
// floresta, patos nadando e peixes pulando na água, sapos no pântano, lagartos no deserto e lebres brancas
// nas montanhas. Cada um mora num tile sorteado pela posição (sem estado guardado: o mesmo bicho está sempre
// no mesmo canto), passeia em volta dele e foge do herói quando ele chega perto. De noite quase todos
// dormem; os sapos ficam. Desenhados em pixel no tamanho nativo, com contorno, como os monstros.
const DESENHOS_BICHOS = {
  coelho: [
    ["....WW...", "....WW...", "..WWWWW..", ".WWWWWKW.", "WWWWWWWW.", ".WWWWWW..", ".P..P...."],
    [".....WW..", ".....WW..", "...WWWWW.", "WWWWWWWKW", ".WWWWWWW.", "..P...P..", "........."],
  ],
  cervo: [
    [".......b.b.", "........bb.", "........BB.", ".......BBBK", "BBBBBBBBB..", "BBBBBBBB...", "BLBBBBLB...", ".B.B..B.B..", ".B.B..B.B.."],
    [".......b.b.", "........bb.", "........BB.", ".......BBBK", "BBBBBBBBB..", "BBBBBBBB...", "BLBBBBLB...", "..B.BB.B...", "..B.BB.B..."],
  ],
  pato: [["......GG.", ".....GGKO", "WWWWWWGG.", "WWWWWWW..", ".SWWWS..."]],
  peixe: [["..OO..", "OOOOOK", "O.OO.."]],
  sapo: [[".K...K.", "GGGGGGG", "GLGGGLG", "GGGGGGG", "g.g.g.g"], ["..K.K..", ".GGGGG.", "GGLGLGG", "GGGGGGG", ".g...g."]],
  lagarto: [["......GGK", "GGGGGGGG.", ".g.g.g..."], ["......GGK", "GGGGGGGG.", "g.g.g.g.."]],
};
const CORES_BICHOS = {
  coelho: [{ W: "#f2ece0", K: "#1b1533", P: "#e8c0b0" }, { W: "#b08060", K: "#1b1533", P: "#e8c0b0" }],
  lebre: [{ W: "#ffffff", K: "#1b1533", P: "#d8d8e8" }],
  cervo: [{ B: "#a0703f", b: "#e8dcc0", L: "#f2ece0", K: "#1b1533" }],
  pato: [{ G: "#2f8a4a", K: "#1b1533", O: "#ff9a3c", W: "#f4f1ea", S: "#c8c0b0" }],
  peixe: [{ O: "#ff9a3c", K: "#1b1533" }, { O: "#6ec8ff", K: "#1b1533" }],
  sapo: [{ G: "#5fbf4a", g: "#3f8a32", L: "#c8f0a0", K: "#1b1533" }],
  lagarto: [{ G: "#c9a050", g: "#8a6a30", K: "#1b1533" }],
};

// o deslocamento de cada bicho que fugiu do herói ("tx,ty" → { dx, dy, ... })
const estadoBichos = new Map();

function spriteBicho(tipo, cor, quadro) {
  const desenho = (tipo === "lebre" ? DESENHOS_BICHOS.coelho : DESENHOS_BICHOS[tipo])[quadro];
  return spriteReino(`bicho-${tipo}-${cor}-${quadro}`, () => {
    const { canvas, ctx } = criarTela(desenho[0].length + 2, desenho.length + 2);
    desenharTexto(ctx, desenho, CORES_BICHOS[tipo][cor], 1, 1);
    return contornar(canvas, "auto");
  });
}

// quem mora em cada região (e em que chão), e quantos a cada 1000 tiles
const MORADORES_SELVAGENS = {
  campos: [["coelho", "terra", 14]], vale: [["coelho", "terra", 12]],
  floresta: [["cervo", "terra", 6], ["coelho", "terra", 8]],
  pantano: [["sapo", "terra", 22]], deserto: [["lagarto", "terra", 12]], montanhas: [["lebre", "terra", 8]],
};

function desenharBichos(ctx, camera, w, h, t, mapa, regioes, noite) {
  const heroi = window.mundoAtivo?.heroi;
  const x0 = Math.max(0, Math.floor(camera.x / TILE) - 2);
  const y0 = Math.max(0, Math.floor(camera.y / TILE) - 2);
  const x1 = Math.min(COLUNAS - 1, x0 + Math.ceil(w / TILE) + 4);
  const y1 = Math.min(LINHAS - 1, y0 + Math.ceil(h / TILE) + 4);
  const RPB = RESOLUCAO_REINO;
  const desenhar = (sprite, x, y, esquerda) => {
    ctx.save();
    ctx.translate(Math.round((x - camera.x) * RPB) / RPB, Math.round((y - camera.y) * RPB) / RPB);
    ctx.scale((esquerda ? -1 : 1) / RPB, 1 / RPB);
    ctx.drawImage(sprite, -Math.round(sprite.width / 2), -sprite.height);
    ctx.restore();
  };
  // A fuga: quando o herói chega perto, o bicho se assusta, corre uns passos para longe e FICA lá (não vai
  // acompanhando o herói, o que dava a sensação de ele estar preso à câmera). Com o herói longe, volta
  // devagar para perto de casa. Guarda só o deslocamento de cada bicho (pelo tile onde ele mora).
  const fugir = (chave, x, y) => {
    let e = estadoBichos.get(chave);
    if (!e) estadoBichos.set(chave, (e = { dx: 0, dy: 0, de: [0, 0], para: [0, 0], inicio: -9, visto: t }));
    // quanto tempo desde a última vez que ele foi desenhado (fora da tela ele não é atualizado, mas o
    // tempo conta para a volta para casa)
    const passou = Math.max(0, t - e.visto);
    e.visto = t;
    const correndo = t - e.inicio < 0.7;
    if (correndo) {
      const p = 1 - (1 - (t - e.inicio) / 0.7) ** 3;
      e.dx = e.de[0] + (e.para[0] - e.de[0]) * p;
      e.dy = e.de[1] + (e.para[1] - e.de[1]) * p;
    }
    const hx = heroi ? heroi.x - (x + e.dx) : 999;
    const hy = heroi ? heroi.y - (y + e.dy) : 999;
    const d = Math.hypot(hx, hy);
    if (!correndo && d < 22 && d > 0.01) {
      // o susto: corre ~30 unidades para longe do herói (sem passar de 46 de casa)
      let px = e.dx - (hx / d) * 30;
      let py = e.dy - (hy / d) * 30;
      const longe = Math.hypot(px, py);
      if (longe > 46) { px *= 46 / longe; py *= 46 / longe; }
      Object.assign(e, { de: [e.dx, e.dy], para: [px, py], inicio: t });
    } else if (!correndo && d > 70) {
      // sem perigo: volta para casa bem devagar (some ~70% a cada 10 s)
      const fica = Math.exp(-passou * 0.12);
      e.dx *= fica;
      e.dy *= fica;
    }
    return { dx: e.dx, dy: e.dy, correndo, paraEsquerda: e.para[0] < e.de[0] };
  };
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const sorte = hashTile(tx, ty, 501);
      const chao = mapa[ty][tx];
      // o vento na grama: uma onda atravessa o campo e os tufos brilham por onde ela passa
      if (!noite && (chao === T.GRAMA || chao === T.MATA)) {
        const onda = Math.sin((tx * 0.7 + ty * 0.35) * 0.9 - t * 1.6);
        if (onda > 0.72) {
          ctx.fillStyle = `rgba(232, 255, 196, ${0.16 * (onda - 0.72) / 0.28})`;
          for (let k = 0; k < 3; k++) {
            const bx = tx * TILE + 2 + hashTile(tx, ty, 600 + k) * 12 - camera.x;
            const by = ty * TILE + 3 + hashTile(tx, ty, 610 + k) * 11 - camera.y;
            ctx.fillRect(bx, by, 2.5, 0.5);
            ctx.fillRect(bx + 1.5, by - 0.5, 1.5, 0.5);
          }
        }
      }
      // na água: brilhos de sol piscando e libélulas pairando (de dia)
      if (chao === T.AGUA && !noite) {
        if (hashTile(tx, ty, 620) < 0.22 && Math.sin(t * 2.6 + hashTile(tx, ty, 621) * 40) > 0.9) {
          const gx = tx * TILE + 3 + hashTile(tx, ty, 622) * 10 - camera.x;
          const gy = ty * TILE + 3 + hashTile(tx, ty, 623) * 10 - camera.y;
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.fillRect(gx, gy, 1, 1);
          ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
          ctx.fillRect(gx - 1, gy + 0.25, 3, 0.5);
          ctx.fillRect(gx + 0.25, gy - 1, 0.5, 3);
        }
        if (hashTile(tx, ty, 630) < 0.008) {
          const f = hashTile(tx, ty, 631) * 30;
          // voo de libélula: paira, dá um tiro curto para o lado e paira de novo
          const salto = Math.floor(t * 0.6 + f);
          const lx = tx * TILE + 8 + (hashTile(salto, tx, 632) - 0.5) * 20 + Math.sin(t * 9 + f) * 0.6 - camera.x;
          const ly = ty * TILE + 2 + (hashTile(salto, ty, 633) - 0.5) * 12 + Math.cos(t * 7 + f) * 0.6 - camera.y;
          ctx.fillStyle = "#2a8a9a";
          ctx.fillRect(lx - 1.5, ly, 3, 0.5);
          ctx.fillStyle = Math.sin(t * 40 + f) > 0 ? "rgba(220, 245, 255, 0.85)" : "rgba(220, 245, 255, 0.4)";
          ctx.fillRect(lx - 1, ly - 1, 0.8, 1);
          ctx.fillRect(lx + 0.2, ly - 1, 0.8, 1);
        }
      }
      // na água: patos (de dia) e peixes que pulam de vez em quando
      if (chao === T.AGUA) {
        if (!noite && sorte < 0.012) {
          const fase = hashTile(tx, ty, 502) * 50;
          const px = tx * TILE + 8 + Math.sin(t * 0.25 + fase) * 10;
          const py = ty * TILE + 10 + Math.cos(t * 0.18 + fase) * 4;
          const esquerda = Math.cos(t * 0.25 + fase) < 0;
          ctx.fillStyle = "rgba(220, 240, 255, 0.55)";
          ctx.fillRect(px - camera.x - 5 + (Math.floor(t * 3) % 2), py - camera.y, 3, 0.5);
          ctx.fillRect(px - camera.x + 2 - (Math.floor(t * 3) % 2), py - camera.y + 0.5, 3, 0.5);
          desenhar(spriteBicho("pato", 0, 0), px, py + Math.sin(t * 3 + fase) * 0.3, esquerda);
        } else if (sorte > 0.985) {
          const ciclo = (t * 0.3 + hashTile(tx, ty, 503) * 5) % 4;
          if (ciclo < 0.6) {
            const p = ciclo / 0.6;
            const px = tx * TILE + 4 + p * 8;
            const py = ty * TILE + 10 - Math.sin(p * Math.PI) * 7;
            desenhar(spriteBicho("peixe", Math.floor(sorte * 100) % 2, 0), px, py, false);
            if (p < 0.15 || p > 0.85) { ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; ctx.fillRect(tx * TILE + (p < 0.5 ? 4 : 12) - 1 - camera.x, ty * TILE + 10 - camera.y, 3, 0.5); }
          }
        }
        continue;
      }
      if (chao === T.PEDRA || chao === T.ROCHA || chao === T.PONTE) continue;
      const lista = MORADORES_SELVAGENS[regioes[ty]?.[tx]];
      if (!lista) continue;
      let acumulado = 0;
      for (const [tipo, , porMil] of lista) {
        const antes = acumulado;
        acumulado += porMil / 1000;
        if (sorte < antes || sorte >= acumulado) continue;
        if (noite && tipo !== "sapo") break; // de noite eles dormem
        const fase = hashTile(tx, ty, 504) * 60;
        const ritmo = tipo === "cervo" ? 0.12 : tipo === "sapo" ? 0.1 : 0.2;
        // passeia: anda um pouco, para um pouco (o seno do passeio fica parado na metade do tempo)
        const anda = Math.sin(t * 0.4 + fase) > 0;
        const ox = Math.sin(t * ritmo + fase) * 14;
        const oy = Math.cos(t * ritmo * 0.8 + fase) * 7;
        const fuga = fugir(`${tx},${ty}`, tx * TILE + 8 + ox, ty * TILE + 12 + oy);
        const assustado = fuga.correndo;
        const x = tx * TILE + 8 + ox + fuga.dx;
        const y = ty * TILE + 12 + oy + fuga.dy;
        const esquerda = assustado ? fuga.paraEsquerda : Math.cos(t * ritmo + fase) < 0;
        const pulando = (tipo === "coelho" || tipo === "lebre" || tipo === "sapo") && (anda || assustado);
        const pulo = pulando ? Math.abs(Math.sin(t * (assustado ? 12 : 6) + fase)) * (tipo === "sapo" ? 2 : 3) : 0;
        const quadro = (pulando && pulo > 1) || ((tipo === "cervo" || tipo === "lagarto") && (anda || assustado) && Math.floor(t * 6 + fase) % 2) ? 1 : 0;
        const cor = Math.floor(hashTile(tx, ty, 505) * CORES_BICHOS[tipo].length);
        ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
        ctx.fillRect(x - camera.x - 2.5, y - camera.y - 0.5, 5, 1);
        desenhar(spriteBicho(tipo, cor, Math.min(quadro, (tipo === "lebre" ? DESENHOS_BICHOS.coelho : DESENHOS_BICHOS[tipo]).length - 1)), x, y - pulo, esquerda);
        break;
      }
    }
  }
}

// o bando de pássaros que cruza o céu de dia (em V, batendo as asas), com a sombra passando no chão.
// O voo é preso ao mundo: o bando tem velocidade própria (30 px/s para a direita) e a câmera é
// descontada inteira, então andar para o lado ou para a frente não arrasta os pássaros junto.
function desenharPassaros(ctx, camera, w, h, t, dia) {
  if (dia < 0.3) return;
  // a pista do voo dá a volta a cada "pista" pixels do mundo; o bando só aparece num trecho dela
  const pista = (w + 80) * 2.2;
  const bx = ((t * 30 - camera.x) % pista + pista) % pista - 40;
  if (bx > w + 40) return;
  const altura = h + 120;
  const by = ((h * 0.25 + Math.sin(t * 0.35) * 10 - camera.y) % altura + altura) % altura - 60;
  [[0, 0], [-7, -4], [-7, 4], [-14, -8], [-14, 8]].forEach(([dx, dy], i) => {
    const asa = Math.sin(t * 10 + i) > 0 ? -1 : 1;
    const x = Math.round(bx + dx);
    const y = Math.round(by + dy);
    ctx.globalAlpha = 0.18 * dia;
    ctx.fillStyle = "#000000";
    ctx.fillRect(x - 2, y + 40, 4, 1);
    ctx.globalAlpha = dia;
    ctx.fillStyle = "#2b2540";
    ctx.fillRect(x - 2, y + asa, 1, 1);
    ctx.fillRect(x - 1, y, 1, 1);
    ctx.fillRect(x, y + 0.5, 1, 1);
    ctx.fillRect(x + 1, y, 1, 1);
    ctx.fillRect(x + 2, y + asa, 1, 1);
  });
  ctx.globalAlpha = 1;
}

// ---------- animações ----------

// Um tile da barreira mágica: véu roxo translúcido com runas subindo.
function desenharBarreira(ctx, x, y, t, semente) {
  ctx.globalAlpha = 0.32 + Math.sin(t * 2 + semente * 6) * 0.1;
  retangulo(ctx, x, y, TILE, TILE, "#8b5cf6");
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 3; i++) {
    const subida = (t * 0.6 + semente + i / 3) % 1;
    retangulo(ctx, x + Math.floor((semente * 13 + i * 7) % 14), y + TILE - Math.round(subida * TILE), 2, 2, subida < 0.5 ? "#e9d5ff" : "#c084fc");
  }
  ctx.globalAlpha = 1;
}

function animarMoinho(ctx, cx, cy, t) {
  const ang = t * 1.2;
  for (let p = 0; p < 4; p++) {
    const a = ang + (p * Math.PI) / 2;
    for (let r = 2; r < 18; r++) {
      const x = Math.round(cx + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a) * r);
      retangulo(ctx, x, y, 2, 2, "#5c3418");
      if (r > 6) retangulo(ctx, Math.round(cx + Math.cos(a + 0.18) * r), Math.round(cy + Math.sin(a + 0.18) * r), 2, 2, "#f2ebdc");
    }
  }
  retangulo(ctx, cx - 2, cy - 2, 4, 4, "#3a2412");
}

function animarFumaca(ctx, x, y, t, cor) {
  for (let i = 0; i < 3; i++) {
    const vida = (t * 0.7 + i / 3) % 1;
    ctx.globalAlpha = 1 - vida;
    retangulo(ctx, x + Math.round(Math.sin(vida * 6 + i) * 2), y - Math.round(vida * 16), 3, 3, cor);
  }
  ctx.globalAlpha = 1;
}

function animarBandeira(ctx, x, y, t) {
  for (let i = 0; i < 8; i++) retangulo(ctx, x + i, y + Math.round(Math.sin(t * 6 + i * 0.7)), 1, 5, i % 4 < 2 ? "#a8323e" : "#f5c451");
}

function animarEnigma(ctx, x, y, t, largura) {
  const sobe = Math.round(Math.sin(t * 3) * 2);
  retangulo(ctx, x + largura / 2 - 1, y - 8 + sobe, 2, 4, "#ffd166");
  retangulo(ctx, x + largura / 2 - 1, y - 2 + sobe, 2, 1, "#ffd166");
  for (let i = 0; i < 3; i++) {
    const vida = (t * 0.6 + i / 3) % 1;
    retangulo(ctx, x + 3 + ((i * 5) % (largura - 4)), y + 6 - Math.round(vida * 14), 1, 1, vida < 0.6 ? "#6ef0ff" : "#a98bff");
  }
}

// O vórtice dos portais (em meio pixel do desenho, o mais fino que aparece): braços de luz em espiral girando
// para o centro, o miolo pulsando, estrelas sendo puxadas para dentro, runas acendendo nos pilares em
// sequência, faíscas subindo e o brilho no chão. cores: [borda, meio, miolo] em "r, g, b".
function vorticeDoPortal(ctx, cx, cy, rx, ry, t, cores, { sentido = 1, runas = [], chao = null } = {}) {
  const ponto = (px, py, rgb, a, s = 0.5) => {
    if (a <= 0.03) return;
    ctx.fillStyle = `rgba(${rgb}, ${Math.min(1, a)})`;
    ctx.fillRect(Math.round(px * 2) / 2, Math.round(py * 2) / 2, s, s);
  };
  // o fundo do rasgo respirando
  const pulso = 0.5 + 0.5 * Math.sin(t * 2.2);
  // o rasgo inteiro enche de luz da cor do portal (oval, do tamanho do arco)
  for (let dy = -ry; dy <= ry; dy += 0.5) {
    const meia = rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry)));
    ctx.fillStyle = `rgba(${cores[0]}, ${0.12 + pulso * 0.06 + (1 - Math.abs(dy) / ry) * 0.1})`;
    ctx.fillRect(cx - meia, cy + dy, meia * 2, 0.5);
  }
  brilhoRedondo(ctx, cx, cy, Math.max(rx, ry) * 0.9, cores[1], 0.1 + pulso * 0.08);
  // os braços da espiral (4), do lado de fora para o centro
  for (let braco = 0; braco < 4; braco++) {
    for (let k = 0; k < 22; k++) {
      const f = k / 22;
      const a = sentido * t * 2.6 + braco * (Math.PI / 2) + f * 4.2;
      const r = 1 - f;
      const x = cx + Math.cos(a) * rx * r;
      const y = cy + Math.sin(a) * ry * r;
      ponto(x, y, f > 0.7 ? cores[2] : f > 0.35 ? cores[1] : cores[0], 0.35 + f * 0.65, f > 0.8 ? 1 : 0.5);
    }
  }
  // as estrelas sendo puxadas para dentro
  for (let i = 0; i < 10; i++) {
    const vida = (t * 0.45 + i / 10) % 1;
    const a = i * 2.39 + vida * 3 * sentido;
    const r = 1 - vida;
    ponto(cx + Math.cos(a) * rx * 1.1 * r, cy + Math.sin(a) * ry * 1.1 * r, "255, 255, 255", vida);
  }
  // o miolo
  brilhoRedondo(ctx, cx, cy, 3 + pulso * 1.5, cores[2], 0.25 + pulso * 0.15);
  ponto(cx - 0.5, cy - 0.5, "255, 255, 255", 0.9, 1);
  // as runas dos pilares acendendo uma depois da outra
  runas.forEach(([rx0, ry0], i) => {
    const aceso = Math.max(0, Math.sin(t * 2 - i * 0.8));
    ponto(rx0, ry0, cores[1], 0.25 + aceso * 0.75, 1);
    if (aceso > 0.7) brilhoRedondo(ctx, rx0 + 0.5, ry0 + 0.5, 2.5, cores[1], 0.2);
  });
  // faíscas subindo da boca do portal
  for (let i = 0; i < 5; i++) {
    const vida = (t * 0.7 + i / 5) % 1;
    ponto(cx + Math.sin(t * 3 + i * 2) * rx * 0.8, cy + ry - vida * ry * 2.6, i % 2 ? cores[1] : cores[2], 1 - vida);
  }
  // o brilho no chão em frente
  if (chao) brilhoRedondo(ctx, chao[0], chao[1], rx * 1.4, cores[1], 0.08 + pulso * 0.06);
}

function animarLugarReino(ctx, l, x, y, t) {
  if (l.id === "portal") {
    vorticeDoPortal(ctx, x + 16, y + 25.5, 7.8, 16, t, ["110, 120, 255", "169, 139, 255", "110, 240, 255"], {
      runas: [[x + 4, y + 14], [x + 27, y + 14], [x + 4, y + 24], [x + 27, y + 24], [x + 4, y + 34], [x + 27, y + 34], [x + 15.5, y + 1.5]],
      chao: [x + 16, y + 43],
    });
  }
  // a Fenda: o vórtice roxo e vermelho girando ao contrário, as runas de sangue nos pilares e raios no rasgo
  if (l.id === "fenda") {
    vorticeDoPortal(ctx, x + 18, y + 27, 8, 15, t, ["255, 77, 109", "192, 139, 255", "255, 210, 230"], {
      sentido: -1, runas: [[x + 4.5, y + 17], [x + 4.5, y + 27], [x + 4.5, y + 37], [x + 29.5, y + 21], [x + 29.5, y + 31], [x + 17.5, y + 1.5]],
      chao: [x + 18, y + 45],
    });
    if (Math.sin(t * 1.7) > 0.93) {
      let rx0 = x + 18;
      for (let k = 0; k < 12; k++) {
        ctx.fillStyle = "rgba(255, 220, 240, 0.9)";
        ctx.fillRect(rx0, y + 13 + k * 2.4, 0.5, 2.4);
        rx0 += Math.sin(t * 40 + k) > 0 ? 0.5 : -0.5;
      }
    }
  }
  if (l.id === "estalagem") animarFumaca(ctx, x + 37, y + 2, t, "#dcdce6");
  // a Forja: fumaça escura na chaminé, a fornalha respirando e as faíscas da bigorna a cada martelada
  if (l.id === "forja") {
    animarFumaca(ctx, x + 35, y, t, "#5a5560");
    animarFumaca(ctx, x + 38, y - 1, t + 0.4, "#8a8590");
    const fogo = Math.sin(t * 6) * 0.5 + 0.5;
    for (let i = 0; i < 4; i++) {
      const h = 2 + Math.round(Math.abs(Math.sin(t * 8 + i * 1.7)) * 5);
      retangulo(ctx, x + 9 + i * 3, y + 42 - h, 2, h, i % 2 ? "#ff7a1a" : "#ffd166");
    }
    brilhoRedondo(ctx, x + 13, y + 41, 12, "255, 140, 50", 0.12 + fogo * 0.08);
    const martelada = (t * 1.1) % 1;
    if (martelada < 0.35) {
      for (let i = 0; i < 5; i++) {
        const v = martelada / 0.35;
        retangulo(ctx, x + 40 + Math.round(Math.cos(i * 1.3 + 3.4) * v * 7), y + 41 - Math.round(Math.sin(i * 0.9 + 0.3) * v * 6), 1, 1, i % 2 ? "#ffd166" : "#fff3b0");
      }
    }
  }
  if (l.id === "bugs" && Math.floor(t * 2) % 5 !== 0) {
    retangulo(ctx, x + 20, y + 27, 2, 2, "#7dff9a");
    retangulo(ctx, x + 27, y + 27, 2, 2, "#7dff9a");
  }
  if (l.id === "cripta") retangulo(ctx, x + 19, y + 31, 4, 4, Math.sin(t * 3) > 0 ? "#c9b3ff" : "#a98bff");
  if (l.id === "cofre") retangulo(ctx, x + 23, y + 25, 4, 4, Math.sin(t * 4) > 0 ? "#ff6b7a" : "#e63946");
  if (l.vencida) {
    retangulo(ctx, x + l.sprite.width - 6, y - 10, 1, 12, "#5c3418");
    retangulo(ctx, x + l.sprite.width - 5, y - 10 + (Math.floor(t * 4) % 2), 6, 4, "#f5c451");
  }
  if (l.liberada === false) {
    retangulo(ctx, x + l.sprite.width / 2 - 4, y - 2, 8, 6, "#2b2540");
    retangulo(ctx, x + l.sprite.width / 2 - 2, y - 6, 4, 4, "#2b2540");
    retangulo(ctx, x + l.sprite.width / 2 - 1, y - 5, 2, 3, "#8a8799");
  }
}
