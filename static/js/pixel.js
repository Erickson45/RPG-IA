// Motor de pixel art: desenha sprites a partir de "texto-pixel" e transforma em imagens nítidas.
//
// Um sprite é uma lista de linhas; cada caractere é uma cor da paleta e "." é transparente:
//   desenharTexto(ctx, ["..KK..", ".KSSK."], paleta, x, y)

// Sprites pequenos ficam na memória do processador (willReadFrequently): o contorno lê os pixels de volta
// de cada um, e ler da placa de vídeo custava ~10 ms por sprite (o Reino levava ~15 s para abrir).
// Telas grandes (chão dos mapas, cenários) continuam na placa de vídeo.
const LIMITE_SPRITE_CPU = 256 * 256;

function criarTela(largura, altura) {
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d", { willReadFrequently: largura * altura <= LIMITE_SPRITE_CPU });
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function hexParaRgb(hex) {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbParaHex([r, g, b]) {
  return "#" + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("");
}

// Mistura a cor com preto (fator < 1) ou branco (fator > 1).
function tom(hex, fator) {
  const rgb = hexParaRgb(hex);
  return rgbParaHex(fator < 1 ? rgb.map((c) => c * fator) : rgb.map((c) => c + (255 - c) * (fator - 1)));
}

function desenharTexto(ctx, linhas, paleta, x0 = 0, y0 = 0) {
  linhas.forEach((linha, y) => {
    for (let x = 0; x < linha.length; x++) {
      const cor = paleta[linha[x]];
      if (cor) {
        ctx.fillStyle = cor;
        ctx.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
  });
}

function retangulo(ctx, x, y, w, h, cor) {
  ctx.fillStyle = cor;
  ctx.fillRect(x, y, w, h);
}

// Contorno de 1 pixel em volta de tudo que não é transparente (o "traço" da pixel art).
// Com cor "auto" o contorno é colorido ("sel-out"): cada pixel usa um tom bem escuro da cor
// que está contornando, em vez de preto. Fica muito mais limpo em roupas claras.
// Feito direto nos bytes da imagem (uma leitura, uma passada, uma escrita): antes era um fillRect com cor
// em texto por pixel, e só os moradores do Reino levavam ~10 s para ficar prontos.
const corParaRgb = new Map();
function rgbDaCor(cor) {
  if (!corParaRgb.has(cor)) {
    const { ctx } = criarTela(1, 1);
    ctx.fillStyle = cor;
    ctx.fillRect(0, 0, 1, 1);
    corParaRgb.set(cor, ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
  }
  return corParaRgb.get(cor);
}

function contornar(canvas, cor = "#1b1533") {
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext("2d");
  // quem desenhou pode ter deixado o pincel deslocado (translate); o contorno usa coordenadas reais
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const imagem = ctx.getImageData(0, 0, w, h);
  const saida = imagem.data;
  const dados = new Uint8ClampedArray(saida); // a imagem antes do contorno (os vizinhos são lidos daqui)
  const fixa = cor === "auto" ? null : rgbDaCor(cor);
  const vizinhos = [-1, 0, 1, 0, 0, -1, 0, 1];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (dados[i + 3] > 0) continue;
      // entre os vizinhos opacos (esquerda, direita, cima, baixo), o mais escuro
      let melhor = -1;
      let soma = Infinity;
      for (let k = 0; k < 8; k += 2) {
        const vx = x + vizinhos[k];
        const vy = y + vizinhos[k + 1];
        if (vx < 0 || vy < 0 || vx >= w || vy >= h) continue;
        const j = (vy * w + vx) * 4;
        if (dados[j + 3] === 0) continue;
        const s = dados[j] + dados[j + 1] + dados[j + 2];
        if (s < soma) {
          soma = s;
          melhor = j;
        }
      }
      if (melhor < 0) continue;
      if (fixa) {
        saida[i] = fixa[0];
        saida[i + 1] = fixa[1];
        saida[i + 2] = fixa[2];
      } else {
        // "auto": o vizinho mais escuro, escurecido mais um pouco e puxado para o roxo da noite do jogo
        saida[i] = Math.round(dados[melhor] * 0.32 + 14);
        saida[i + 1] = Math.round(dados[melhor + 1] * 0.3 + 10);
        saida[i + 2] = Math.round(dados[melhor + 2] * 0.34 + 26);
      }
      saida[i + 3] = 255;
    }
  }
  ctx.putImageData(imagem, 0, 0);
  return canvas;
}

// Brilho redondo em degraus de pixel (aura de chama, cristal, grimório): cada anel de dentro
// soma mais um pouco de luz. Nada de retângulo transparente em volta das coisas.
function brilhoRedondo(ctx, cx, cy, raio, rgb, alfa = 0.1) {
  ctx.fillStyle = `rgba(${rgb}, ${alfa})`;
  for (let r = raio; r > raio / 3; r -= Math.max(2, Math.round(raio / 4))) {
    for (let dy = -r; dy <= r; dy++) {
      const meia = Math.round(Math.sqrt(r * r - dy * dy));
      ctx.fillRect(Math.round(cx) - meia, Math.round(cy) + dy, meia * 2 + 1, 1);
    }
  }
}

const cacheImagens = new Map();

function imagemPixel(canvas, classe = "", rotulo = "") {
  return `<img class="pixel ${classe}" src="${canvas.toDataURL()}" alt="${rotulo}">`;
}

// Emoji desenhado pequenino e ampliado sem suavização: vira pixel art na hora.
const cacheEmojis = new Map();
function emojiCanvas(emoji, tamanho = 18) {
  const chave = `${emoji}:${tamanho}`;
  if (!cacheEmojis.has(chave)) {
    const { canvas, ctx } = criarTela(tamanho, tamanho);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${tamanho - 2}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText(emoji, tamanho / 2, tamanho / 2 + 1);
    // limpa a semitransparência das bordas para manter o visual "duro" de pixel
    const imagem = ctx.getImageData(0, 0, tamanho, tamanho);
    for (let i = 3; i < imagem.data.length; i += 4) imagem.data[i] = imagem.data[i] > 110 ? 255 : 0;
    ctx.putImageData(imagem, 0, 0);
    cacheEmojis.set(chave, contornar(canvas));
  }
  return cacheEmojis.get(chave);
}

function emojiPixel(emoji, tamanho = 18) {
  const chave = `emoji:${emoji}:${tamanho}`;
  if (!cacheImagens.has(chave)) cacheImagens.set(chave, emojiCanvas(emoji, tamanho).toDataURL());
  return cacheImagens.get(chave);
}

// Brasão da Academia: escudo roxo e dourado com coroa, o sinal de código </> e um grimório aberto.
function brasaoCanvas() {
  const { canvas, ctx } = criarTela(33, 38);
  ctx.translate(1, 1); // 1 pixel de margem para o contorno
  const cx = 15;
  const ouro = "#f5c451", ouroEscuro = "#b8862a", ouroClaro = "#fff3b0";

  // coroa
  desenharTexto(ctx, [
    "..Y...Y...Y..",
    "..G..GYG..G..",
    "..GG.GgG.GG..",
    "..GGGGGGGGG..",
    "..gGgRgBgRg..",
  ], { Y: ouroClaro, G: ouro, g: ouroEscuro, R: "#e63946", B: "#4cc9f0" }, cx - 6, 0);

  // escudo: borda dourada e campo dividido em dois tons de roxo
  const escudo = (topo, curva, ponta, meia, cor) => {
    for (let y = topo; y <= ponta; y++) {
      const t = y <= curva ? 1 : Math.sqrt(Math.max(0, 1 - ((y - curva) / (ponta - curva + 1)) ** 2));
      const w = Math.round(meia * t);
      for (let x = cx - w; x <= cx + w; x++) retangulo(ctx, x, y, 1, 1, typeof cor === "function" ? cor(x, y) : cor);
    }
  };
  escudo(5, 18, 34, 13, ouro);
  escudo(6, 18, 33, 12, ouroEscuro);
  escudo(7, 18, 32, 11, (x) => (x < cx ? "#5b3fb0" : x > cx ? "#3f2a85" : "#4a3399"));
  for (let y = 8; y < 17; y++) retangulo(ctx, cx - 10, y, 1, 1, "#7b61d1"); // brilho na borda esquerda

  // </>
  for (let i = 0; i < 7; i++) {
    const d = 3 - Math.abs(3 - i);
    retangulo(ctx, cx - 6 + 3 - d, 10 + i, 2, 1, ouro);
    retangulo(ctx, cx - 6 + 8 + d, 10 + i, 2, 1, ouro);
    retangulo(ctx, cx - 6 + 7 - Math.round(i / 3), 10 + i, 1, 1, ouroClaro);
  }
  // estrelinhas
  [[cx - 8, 9], [cx + 8, 18], [cx - 7, 19]].forEach(([x, y]) => retangulo(ctx, x, y, 1, 1, ouroClaro));

  // grimório aberto
  desenharTexto(ctx, [
    ".WWWWWgWWWWW.",
    "WWwwwWgWwwwWW",
    "WWWWWWgWWWWWW",
    "WWwwWWgWWwwWW",
    "WWWWWWgWWWWWW",
    "CCCCCCgCCCCCC",
    ".CCCCCCCCCCC.",
  ], { W: "#f2ebdc", w: "#8a7d55", g: ouroEscuro, C: "#8b5a2b" }, cx - 6, 20);

  // faixa na frente da ponta do escudo
  desenharTexto(ctx, [
    "...rRRRRRRRRRRRRRRRRRRRRRRRr...",
    "rrrRRRRRRRRRRRRRRRRRRRRRRRRRrrr",
    ".rrRRRRGRRRGRRRGRRRGRRRGRRRRrr.",
    "rrrRRRRRRRRRRRRRRRRRRRRRRRRRrrr",
    "...rrrrrrrrrrrrrrrrrrrrrrrrr...",
  ], { R: "#c0392b", r: "#7a1f1a", G: ouro }, 0, 29);

  return contornar(canvas, "auto");
}

// O ícone do RPG IA: emblema roxo com borda dourada, espada e cajado cruzados atrás e as letras "IA"
// em ouro na frente. É o logo do topo e o ícone da aba.
function iconeRpgIaCanvas() {
  const { canvas, ctx } = criarTela(34, 34);
  ctx.translate(1, 1);
  const ouro = "#f5c451", ouroEscuro = "#b8862a", ouroClaro = "#fff3b0";
  // emblema octogonal: borda dourada e fundo em faixas de roxo
  for (let y = 0; y < 32; y++) {
    const recuo = Math.max(0, 5 - y, y - 26);
    retangulo(ctx, recuo, y, 32 - recuo * 2, 1, ouro);
    if (y >= 2 && y <= 29) {
      const dentro = Math.max(0, 5 - y, y - 26) + 2;
      retangulo(ctx, dentro, y, 32 - dentro * 2, 1, y < 10 ? "#5b3fb0" : y < 20 ? "#4a3399" : "#3f2a85");
    }
  }
  retangulo(ctx, 7, 1, 18, 1, ouroClaro);
  // espada (da esquerda de baixo para a direita de cima) e cajado (cruzando ao contrário)
  for (let i = 0; i < 20; i++) {
    retangulo(ctx, 6 + i, 25 - i, 1, 1, "#d8dee9");
    retangulo(ctx, 7 + i, 25 - i, 1, 1, "#8a93a8");
    retangulo(ctx, 25 - i, 25 - i, 1, 1, "#8b5a2b");
    retangulo(ctx, 26 - i, 25 - i, 1, 1, "#5c3418");
  }
  desenharTexto(ctx, ["YYY", "YgY", "YYY"], { Y: ouro, g: ouroClaro }, 4, 23);
  desenharTexto(ctx, [".c.", "cCc", ".c."], { c: "#6ef0ff", C: "#e6fdff" }, 4, 3);
  // placa escura atrás das letras
  retangulo(ctx, 6, 9, 20, 15, "#1b1533");
  retangulo(ctx, 6, 9, 20, 1, "#2b2263");
  // "IA" em ouro, com a linha de cima clara
  const letra = { G: ouro, g: ouroEscuro, Y: ouroClaro };
  desenharTexto(ctx, ["YYYYY", "GGGGG", ".GGG.", ".GGG.", ".GGG.", ".GGG.", ".GGG.", ".GGG.", ".GGG.", "GGGGG", "ggggg"], letra, 8, 11);
  desenharTexto(ctx, ["...YYY...", "..GGGGG..", "..GG.GG..", ".GGG.GGG.", ".GG...GG.", ".GG...GG.", "GGGGGGGGG", "GGGGGGGGG", "GG.....GG", "GG.....GG", "gg.....gg"], letra, 15, 11);
  // brilhos
  [[3, 14], [28, 8], [27, 20]].forEach(([x, y]) => retangulo(ctx, x, y, 1, 1, ouroClaro));
  return contornar(canvas, "auto");
}

function iconeRpgIaDataUrl(escala = 4) {
  const chave = `icone-rpg-ia:${escala}`;
  if (!cacheImagens.has(chave)) {
    const original = iconeRpgIaCanvas();
    const { canvas, ctx } = criarTela(original.width * escala, original.height * escala);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(original, 0, 0, canvas.width, canvas.height);
    cacheImagens.set(chave, canvas.toDataURL());
  }
  return cacheImagens.get(chave);
}

// O brasão ampliado sem suavização (para o favicon e o logo ficarem nítidos).
function brasaoDataUrl(escala = 4) {
  const chave = `brasao:${escala}`;
  if (!cacheImagens.has(chave)) {
    const original = brasaoCanvas();
    const { canvas, ctx } = criarTela(original.width * escala, original.height * escala);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(original, 0, 0, canvas.width, canvas.height);
    cacheImagens.set(chave, canvas.toDataURL());
  }
  return cacheImagens.get(chave);
}

function coracaoPixel(cheio) {
  const chave = `coracao:${cheio}`;
  if (!cacheImagens.has(chave)) {
    const { canvas, ctx } = criarTela(11, 10);
    ctx.translate(1, 1);
    desenharTexto(ctx, [
      ".RR...RR.",
      "RWRR.RRRR",
      "RRRRRRRRR",
      "RRRRRRRRR",
      ".RRRRRRR.",
      "..RRRRR..",
      "...RRR...",
      "....R....",
    ], cheio ? { R: "#e63946", W: "#ffb3b8" } : { R: "#3b3163", W: "#4d4380" });
    cacheImagens.set(chave, contornar(canvas).toDataURL());
  }
  return cacheImagens.get(chave);
}
