// O Reino em alta resolução: tiles de 32 × 32 pixels (o dobro do mundo de 16 unidades), árvores
// redesenhadas com cachos de folhas, luz e sombra, e casas/lugares ampliados com um filtro de pixel art.
//
// Tudo isso é gerado por código (este arquivo é a "fonte"), mas o jogo usa as IMAGENS salvas em
// static/img/cenario/ (manifesto.json + PNGs): carregar imagem pronta é bem mais rápido que desenhar.
// Para regerar as imagens depois de mudar algum desenho: abra o jogo com o servidor em modo debug e
// rode exportarCenarioHD() no console do navegador.
//
// Depende de pixel.js (criarTela, retangulo, tom, contornar) e, na hora de usar, de reino.js
// (T, TILE, COLUNAS, LINHAS, regiaoDe, hashTile, SPRITES_DECORACAO...).

const RESOLUCAO_REINO = 2; // pixels de desenho por unidade do mundo no Reino
const TILE_HD = 32;
const VARIANTES_TILE = 4;

// ---------- utilidades de pixel ----------

// gerador de números aleatórios com semente (o mesmo desenho sempre sai igual)
function sorteador(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Scale2x (EPX): dobra a resolução de um pixel art arredondando as diagonais, sem borrar
function escala2x(origem) {
  const w = origem.width;
  const h = origem.height;
  const leitor = origem.getContext ? origem : (() => { const { canvas, ctx } = criarTela(w, h); ctx.drawImage(origem, 0, 0); return canvas; })();
  const px = new Uint32Array(leitor.getContext("2d").getImageData(0, 0, w, h).data.buffer);
  const { canvas, ctx } = criarTela(w * 2, h * 2);
  const saida = ctx.createImageData(w * 2, h * 2);
  const out = new Uint32Array(saida.data.buffer);
  const em = (x, y) => px[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = em(x, y);
      const a = em(x, y - 1);
      const b = em(x + 1, y);
      const c = em(x - 1, y);
      const d = em(x, y + 1);
      const i = (y * 2) * (w * 2) + x * 2;
      out[i] = c === a && c !== d && a !== b ? a : p;
      out[i + 1] = a === b && a !== c && b !== d ? b : p;
      out[i + w * 2] = d === c && d !== b && c !== a ? c : p;
      out[i + w * 2 + 1] = b === d && b !== a && d !== c ? d : p;
    }
  }
  ctx.putImageData(saida, 0, 0);
  return canvas;
}

// Textura: cada pixel opaco ganha uma variação leve de brilho (granulado de madeira, pedra, telhado),
// em blocos de 2 pixels para continuar parecendo pixel art. Não mexe no contorno escuro.
function texturizar(canvas, forca = 0.07, semente = 1) {
  const ctx = canvas.getContext("2d");
  const imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imagem.data;
  const sorte = sorteador(semente);
  const blocos = new Float32Array(Math.ceil(canvas.width / 2) * Math.ceil(canvas.height / 2)).map(() => (sorte() - 0.5) * 2);
  const largBloco = Math.ceil(canvas.width / 2);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      if (d[i + 3] < 200 || d[i] + d[i + 1] + d[i + 2] < 120) continue;
      const k = 1 + blocos[(y >> 1) * largBloco + (x >> 1)] * forca;
      d[i] = Math.min(255, d[i] * k);
      d[i + 1] = Math.min(255, d[i + 1] * k);
      d[i + 2] = Math.min(255, d[i + 2] * k);
    }
  }
  ctx.putImageData(imagem, 0, 0);
  return canvas;
}

function emAltaResolucao(canvas) {
  canvas.res = RESOLUCAO_REINO;
  return canvas;
}

// sombra macia no chão, embaixo de árvores (desenhada depois do contorno)
function sombraNoChao(ctx, cx, cy, rx, ry) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  for (let dy = -ry; dy <= ry; dy++) {
    const meia = Math.round(rx * Math.sqrt(1 - (dy * dy) / (ry * ry)));
    ctx.fillRect(cx - meia, cy + dy, meia * 2, 1);
  }
}

function disco(ctx, cx, cy, r, cor) {
  ctx.fillStyle = cor;
  for (let dy = -r; dy <= r; dy++) {
    const meia = Math.round(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(Math.round(cx - meia), Math.round(cy + dy), meia * 2 + 1, 1);
  }
}

// ---------- árvores em alta resolução ----------

const PALETAS_COPA = {
  redonda: { sombra: "#1f5a33", base: "#2f7d46", luz: "#4fa35b", brilho: "#86c96a", contorno: "#10301c" },
  escura: { sombra: "#123b22", base: "#1d5030", luz: "#2f7046", brilho: "#4f9445", contorno: "#0a2213" },
};

// tronco com casca: lado claro, lado escuro, risquinhos e a raiz abrindo no chão
function troncoHD(ctx, cx, topo, base, largura, cores = { base: "#6b4423", escura: "#4a2f18", clara: "#8b5a2b" }, sorte) {
  for (let y = topo; y <= base; y++) {
    const abre = y > base - 6 ? Math.round((y - (base - 6)) * 1.2) : 0;
    const meia = Math.round(largura / 2) + abre;
    retangulo(ctx, cx - meia, y, meia * 2, 1, cores.base);
    retangulo(ctx, cx - meia, y, 2, 1, cores.clara);
    retangulo(ctx, cx + meia - 3, y, 3, 1, cores.escura);
  }
  for (let i = 0; i < largura * 2; i++) {
    const x = cx - largura / 2 + 2 + Math.floor(sorte() * (largura - 4));
    const y = topo + Math.floor(sorte() * (base - topo - 4));
    retangulo(ctx, x, y, 1, 2 + Math.floor(sorte() * 3), cores.escura);
  }
}

// copa redonda feita de cachos: cada cacho tem sombra embaixo, o meio e a luz em cima à esquerda,
// e folhinhas soltas salpicadas por cima
function copaHD(ctx, cx, cy, rx, ry, paleta, sorte, cachos = 15) {
  const lista = [];
  for (let i = 0; i < cachos; i++) {
    const a = sorte() * Math.PI * 2;
    const dist = Math.sqrt(sorte()) * 0.72;
    lista.push({ x: cx + Math.cos(a) * rx * dist, y: cy + Math.sin(a) * ry * dist, r: Math.round(Math.min(rx, ry) * (0.32 + sorte() * 0.16)) });
  }
  lista.push({ x: cx, y: cy - ry * 0.25, r: Math.round(Math.min(rx, ry) * 0.5) });
  lista.sort((p, q) => p.y - q.y);
  lista.forEach((c) => disco(ctx, c.x + 2, c.y + 3, c.r, paleta.sombra));
  lista.forEach((c) => {
    disco(ctx, c.x, c.y, c.r, paleta.base);
    disco(ctx, c.x - c.r * 0.28, c.y - c.r * 0.32, Math.max(2, Math.round(c.r * 0.55)), paleta.luz);
  });
  // folhinhas: claras no alto à esquerda, escuras embaixo
  const dados = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
  const opaco = (x, y) => dados[(Math.round(y) * ctx.canvas.width + Math.round(x)) * 4 + 3] > 0;
  for (let i = 0; i < rx * ry * 0.18; i++) {
    const x = cx + (sorte() - 0.5) * rx * 2;
    const y = cy + (sorte() - 0.5) * ry * 2;
    if (!opaco(x, y)) continue;
    const emCima = (y - cy) / ry + (x - cx) / rx * 0.5 < -0.1;
    retangulo(ctx, Math.round(x), Math.round(y), 2, 1, emCima ? paleta.brilho : paleta.sombra);
    if (sorte() < 0.5) retangulo(ctx, Math.round(x) + (emCima ? 0 : 1), Math.round(y) + 1, 1, 1, emCima ? paleta.luz : paleta.sombra);
  }
}

function arvoreRedondaHD(tipo) {
  const escura = tipo === "escura";
  const [w, h] = escura ? [104, 140] : [96, 130];
  const sorte = sorteador(escura ? 71 : 37);
  const { canvas, ctx } = criarTela(w, h);
  const cx = w / 2;
  troncoHD(ctx, cx, h * 0.52, h - 8, escura ? 14 : 12, escura ? { base: "#4a2f18", escura: "#2f1d0e", clara: "#6b4423" } : undefined, sorte);
  copaHD(ctx, cx, h * 0.36, w * 0.44, h * 0.3, PALETAS_COPA[escura ? "escura" : "redonda"], sorte, escura ? 18 : 15);
  if (!escura) [[0.32, 0.3], [0.62, 0.22], [0.55, 0.44]].forEach(([fx, fy]) => disco(ctx, w * fx, h * fy, 2, "#e63946")); // maçãs
  contornar(canvas, "auto");
  return emAltaResolucao(comSombraEmbaixo(canvas, cx, h - 6, w * 0.3));
}

// pinheiro: andares de galhos em triângulo, com a borda de baixo em serrinha e neve opcional
function pinheiroHD(comNeve) {
  const w = 76;
  const h = 132;
  const sorte = sorteador(comNeve ? 91 : 53);
  const { canvas, ctx } = criarTela(w, h);
  const cx = w / 2;
  troncoHD(ctx, cx, h - 30, h - 8, 10, undefined, sorte);
  const cores = comNeve ? { escura: "#1d5a40", base: "#2a6b4c", clara: "#3f8a5e" } : { escura: "#1d5a31", base: "#256e3c", clara: "#3f9a55" };
  const andares = 5;
  for (let a = 0; a < andares; a++) {
    const topo = 4 + a * 18;
    const altura = 30 + a * 2;
    const meiaBase = 12 + a * 6;
    for (let y = 0; y < altura; y++) {
      const meia = Math.round((y / altura) * meiaBase);
      const serra = y > altura - 4 ? ((y + a) % 2 ? 2 : 0) : 0;
      for (let x = -meia + serra; x <= meia - serra; x++) {
        const lado = x / Math.max(1, meia);
        const cor = lado < -0.35 ? cores.clara : lado > 0.4 ? cores.escura : cores.base;
        retangulo(ctx, cx + x, topo + y, 1, 1, cor);
      }
      // agulhas: risquinhos claros na diagonal
      if (y % 4 === 2) for (let x = -meia + 3; x < meia - 3; x += 6) retangulo(ctx, cx + x + (sorte() < 0.5 ? 1 : 0), topo + y, 2, 1, cores.clara);
      if (comNeve && y < 3 + (a === 0 ? 4 : 0)) for (let x = -meia; x <= meia; x++) retangulo(ctx, cx + x, topo + y, 1, 1, "#ffffff");
    }
    if (comNeve) for (let x = -meiaBase + 2; x < meiaBase - 2; x += 3) if (sorte() < 0.6) retangulo(ctx, cx + x, topo + altura - 5, 2, 2, "#f2f6ff");
  }
  contornar(canvas, "auto");
  return emAltaResolucao(comSombraEmbaixo(canvas, cx, h - 6, w * 0.32));
}

function comSombraEmbaixo(canvas, cx, cy, rx) {
  const { canvas: final, ctx } = criarTela(canvas.width, canvas.height);
  sombraNoChao(ctx, Math.round(cx), Math.round(cy), Math.round(rx), Math.max(3, Math.round(rx / 4)));
  ctx.drawImage(canvas, 0, 0);
  return final;
}

// Decorações e construções sem desenho próprio: o desenho de 16 unidades ampliado 4× com o filtro
// (2× do tamanho no mundo × 2× da resolução) e uma textura leve por cima.
function ampliadoHD(base, semente, textura = 0.06) {
  return emAltaResolucao(texturizar(escala2x(escala2x(base)), textura, semente));
}

// o que já estava no tamanho do mundo (estátua, enigmas, placas, móveis das salas): só dobra a resolução
function dobradoHD(base, semente, textura = 0.04) {
  const dobrado = escala2x(base);
  return emAltaResolucao(textura ? texturizar(dobrado, textura, semente) : dobrado);
}

function decoracaoHD(tipo) {
  if (tipo === "redonda" || tipo === "escura") return arvoreRedondaHD(tipo);
  if (tipo === "pinheiro" || tipo === "pinheiroNeve") return pinheiroHD(tipo === "pinheiroNeve");
  return ampliadoHD(SPRITES_DECORACAO[tipo](), tipo.length * 7, 0.08);
}

// ---------- as salas (Academia, biblioteca, Mercado, Estalagem...) em alta resolução ----------
// O chão, as paredes, os móveis e as portas passam pelo filtro (o dobro de resolução, bordas arredondadas
// e textura), mas mantêm o tamanho no mundo; as pessoas continuam como sempre foram, o "close" de dentro
// dos prédios. Cada desenho tem nome (os de SPRITES_ACADEMIA e o chão de cada sala), para vir das
// imagens salvas quando existirem.

const nomesDasSalas = new WeakMap(); // canvas original → nome no manifesto
const salaConvertida = new WeakMap(); // canvas original → versão em alta resolução
const DESENHOS_DAS_SALAS = new Map(); // nome → versão em alta resolução (o que a exportação salva)
let regerandoCenario = false; // na exportação, tudo sai do código (não das imagens já salvas)

function nomeDoDesenhoDaSala(canvas) {
  if (nomesDasSalas.has(canvas)) return nomesDasSalas.get(canvas);
  const achado = Object.entries(typeof SPRITES_ACADEMIA !== "undefined" ? SPRITES_ACADEMIA : {}).find(([, c]) => c === canvas);
  const nome = achado ? `sala-${achado[0].replace(/[^a-zA-Z0-9-]/g, "")}` : null;
  nomesDasSalas.set(canvas, nome);
  return nome;
}

function desenhoDaSalaHD(canvas, nome = nomeDoDesenhoDaSala(canvas), textura = 0.05) {
  if (!canvas || canvas.personagem || canvas.res) return canvas;
  if (salaConvertida.has(canvas) && !regerandoCenario) return salaConvertida.get(canvas);
  const salvo = nome && !regerandoCenario && CENARIO_SALVO.sprites[nome];
  const hd = salvo || dobradoHD(canvas, (nome || "x").length * 19, textura);
  salaConvertida.set(canvas, hd);
  if (nome) {
    nomesDasSalas.set(canvas, nome);
    DESENHOS_DAS_SALAS.set(nome, hd);
  }
  return hd;
}

// recebe o cenário de uma sala e devolve ele em alta resolução (nomeChao: o nome do chão nas imagens)
function salaEmHD(cenario, nomeChao) {
  cenario.resolucao = RESOLUCAO_REINO;
  // a gente nas salas tem a mesma escala do Reino: o herói fica do mesmo tamanho na tela e o zoom da
  // rodinha vale igual em todo lugar. As animações dos personagens (balão de fala, alaúde...) foram
  // desenhadas no tamanho nativo, então são desenhadas reduzidas junto com eles.
  cenario.resolucaoPersonagens = RESOLUCAO_REINO;
  cenario.lugares.forEach((l) => {
    if (!(l.visual || l.sprite?.personagem) || !l.animar || l.animarNaEscala) return;
    const animar = l.animar;
    l.animar = (ctx, x, y, t) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1 / RESOLUCAO_REINO, 1 / RESOLUCAO_REINO);
      animar(ctx, 0, 0, t);
      ctx.restore();
    };
    l.animarNaEscala = true;
  });
  // o chão da sala é grande: sem granulado, a imagem salva fica muito menor (o filtro já arredonda tudo)
  cenario.chao = desenhoDaSalaHD(cenario.chao, `sala-chao-${nomeChao}`, 0);
  detalharChaoDaSala(cenario);
  // a atmosfera da Academia por cima de tudo: poeira mágica flutuando e a vinheta
  if (!cenario.comAtmosfera) {
    const antes = cenario.animarPorCima;
    cenario.animarPorCima = (ctx, camera, w, h, t, heroi) => {
      antes?.(ctx, camera, w, h, t, heroi);
      atmosferaDaAcademia(ctx, camera, w, h, t);
    };
    cenario.comAtmosfera = true;
  }
  // (os móveis e enfeites ganham o acabamento do cenário; exportando as imagens, saem crus)
  const acabar = (desenho) => (regerandoCenario ? desenho : acabamentoDoCenario(desenho));
  (cenario.props || []).forEach((p) => { if (p.sprite) p.sprite = acabar(desenhoDaSalaHD(p.sprite)); });
  cenario.lugares.forEach((l) => { if (!l.visual) l.sprite = acabar(desenhoDaSalaHD(l.sprite)); });
  return cenario;
}

// ---------- o chão das salas da Academia, mais rico ----------
// Por cima do chão em alta resolução (o salvo ou o gerado), uma vez por sala: cada tile onde se anda vira
// mármore polido (chanfro claro em cima e à esquerda, escuro embaixo e à direita, um veio e um brilho) ou,
// se for tapete (vermelho), ganha trama de tecido, barra dourada nas bordas e losangos dourados; e o chão
// escurece junto das paredes. Quem diz o que é tapete é a cor do meio do tile.
// (o detalhe vai numa cópia: o chão original continua limpo para a exportação das imagens)
const chaosDetalhados = new WeakMap();
function detalharChaoDaSala(cenario) {
  const original = cenario.chao;
  if (!original?.width || !cenario.andavel) return;
  if (chaosDetalhados.has(original)) {
    cenario.chao = chaosDetalhados.get(original);
    return;
  }
  const { canvas: chao, ctx } = criarTela(original.width, original.height);
  ctx.drawImage(original, 0, 0);
  if (original.res) chao.res = original.res;
  const T = TILE * (cenario.resolucao || RESOLUCAO_REINO);
  const largura = chao.width;
  const dados = ctx.getImageData(0, 0, largura, chao.height).data;
  const anda = (tx, ty) => tx >= 0 && ty >= 0 && tx < cenario.colunas && ty < cenario.linhas && cenario.andavel(tx, ty);
  const corDoMeio = (tx, ty) => {
    const i = ((ty * T + T / 2) * largura + tx * T + T / 2) * 4;
    return [dados[i], dados[i + 1], dados[i + 2]];
  };
  const ehTapete = (tx, ty) => {
    if (!anda(tx, ty)) return false;
    const [r, g, b] = corDoMeio(tx, ty);
    return r > 90 && r > g * 1.8 && r > b * 1.35;
  };
  // mármore só em chão de pedra (cor pouco saturada); tapete de outra cor e madeira ficam como estão
  const ehPedra = (tx, ty) => {
    const c = corDoMeio(tx, ty);
    return Math.max(...c) - Math.min(...c) < 55;
  };
  for (let ty = 0; ty < cenario.linhas; ty++) {
    for (let tx = 0; tx < cenario.colunas; tx++) {
      if (!anda(tx, ty)) continue;
      const px = tx * T;
      const py = ty * T;
      if (ehTapete(tx, ty)) {
        // a trama do tecido: diagonais escuras bem leves
        ctx.fillStyle = "rgba(40, 0, 18, 0.2)";
        for (let y = 0; y < T; y++) for (let x = (y % 4); x < T; x += 4) ctx.fillRect(px + x, py + y, 1, 1);
        // a barra dourada onde o tapete acaba
        ctx.fillStyle = "#c9952a";
        if (!ehTapete(tx, ty - 1)) ctx.fillRect(px, py + 3, T, 2);
        if (!ehTapete(tx, ty + 1)) ctx.fillRect(px, py + T - 5, T, 2);
        if (!ehTapete(tx - 1, ty)) ctx.fillRect(px + 3, py, 2, T);
        if (!ehTapete(tx + 1, ty)) ctx.fillRect(px + T - 5, py, 2, T);
        // um losango dourado a cada dois tiles
        if ((tx + ty) % 2 === 0) {
          const cx = px + T / 2;
          const cy = py + T / 2;
          for (let k = 0; k < 4; k++) {
            ctx.fillStyle = k === 3 ? "#fff3b0" : "#f5c451";
            ctx.fillRect(cx - k, cy - 3 + k, k * 2 + 1, 1);
            ctx.fillRect(cx - k, cy + 3 - k, k * 2 + 1, 1);
          }
        }
      } else if (ehPedra(tx, ty)) {
        // mármore: chanfro, veio e brilho
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.fillRect(px, py, T, 1);
        ctx.fillRect(px, py, 1, T);
        ctx.fillStyle = "rgba(10, 4, 30, 0.2)";
        ctx.fillRect(px, py + T - 1, T, 1);
        ctx.fillRect(px + T - 1, py, 1, T);
        if (hashTile(tx, ty, 41) < 0.45) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
          let vy = py + 4 + Math.floor(hashTile(tx, ty, 42) * (T - 8));
          for (let x = 2; x < T - 2; x++) {
            ctx.fillRect(px + x, vy, 1, 1);
            if (hashTile(tx * 31 + x, ty, 43) < 0.3) vy += hashTile(tx, ty * 17 + x, 44) < 0.5 ? 1 : -1;
            vy = Math.max(py + 2, Math.min(py + T - 3, vy));
          }
        }
        ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
        for (let k = 0; k < 6; k++) ctx.fillRect(px + 4 + k, py + 4 + k, 3, 1);
      }
      // a sombra junto das paredes (a de cima mais forte, a parede tem altura)
      ctx.fillStyle = "#08041a";
      if (!anda(tx, ty - 1)) for (let k = 0; k < 10; k++) { ctx.globalAlpha = 0.42 * (1 - k / 10); ctx.fillRect(px, py + k, T, 1); }
      if (!anda(tx - 1, ty)) for (let k = 0; k < 6; k++) { ctx.globalAlpha = 0.3 * (1 - k / 6); ctx.fillRect(px + k, py, 1, T); }
      if (!anda(tx + 1, ty)) for (let k = 0; k < 6; k++) { ctx.globalAlpha = 0.3 * (1 - k / 6); ctx.fillRect(px + T - 1 - k, py, 1, T); }
      ctx.globalAlpha = 1;
    }
  }
  chaosDetalhados.set(original, chao);
  cenario.chao = chao;
}

// a poeira mágica das salas: pontinhos dourados e azuis subindo devagar e piscando, e a vinheta
function atmosferaDaAcademia(ctx, camera, w, h, t) {
  for (let i = 0; i < 34; i++) {
    const vida = (t * (0.03 + (i % 5) * 0.008) + i * 0.137) % 1;
    const x = ((i * 89.7 + Math.sin(t * 0.6 + i) * 12 - camera.x) % w + w) % w;
    const y = ((h - vida * (h + 10) + 5 - camera.y) % (h + 10) + h + 10) % (h + 10) - 5;
    ctx.globalAlpha = Math.sin(vida * Math.PI) * (0.45 + Math.sin(t * 3 + i) * 0.3);
    ctx.fillStyle = i % 3 ? "#ffe08a" : "#6ef0ff";
    ctx.fillRect(Math.round(x), Math.round(y), i % 7 ? 1 : 2, i % 7 ? 1 : 2);
  }
  ctx.globalAlpha = 1;
  if (typeof vinhetaDoReino === "function") ctx.drawImage(vinhetaDoReino(Math.ceil(w), Math.ceil(h)), 0, 0);
}

// ---------- o chão: tileset de 32 × 32 ----------

const CORES_CHAO = {
  grama: { base: "#5fa84a", escura: "#4f9a3e", clara: "#78c25e", folha: "#3b7d2e", ponta: "#9ad66f" },
  mata: { base: "#3f7d3a", escura: "#356b31", clara: "#4f9445", folha: "#2a5a28", ponta: "#6fae58" },
  caminho: { base: "#c9a26b", escura: "#b08a55", clara: "#dcb98a" },
  areia: { base: "#e8d39a", escura: "#d9c07f", clara: "#f5e6b8" },
  areiaDeserto: { base: "#e2c27a", escura: "#cfa95e", clara: "#f0d89a" },
  agua: { base: "#2f7fbf", escura: "#286fa8", clara: "#3d8fc9", brilho: "#a7dcff", espuma: "#d6efff" },
  aguaPantano: { base: "#3d6b5a", escura: "#335c4d", clara: "#4a7d68", brilho: "#8fb39a", espuma: "#a9c7b0" },
  rocha: { base: "#a0703f", escura: "#8a5c32", clara: "#c08a52", topo: "#d9a066", baixo: "#6e4a28" },
  rochaMontanha: { base: "#8a8b99", escura: "#6b6c7a", clara: "#a3a6c2", topo: "#f2f4ff", baixo: "#5d5e6b" },
  neve: { base: "#e8eef5", escura: "#cfd8e6", clara: "#ffffff" },
  lama: { base: "#5b6340", escura: "#4a5233", clara: "#7a8455" },
  pedra: { base: "#a39a88", escura: "#8a8170", clara: "#c2b8a3", junta: "#6f6758" },
  plantacao: { base: "#7a5230", escura: "#5c3c22", clara: "#94683f" },
};

// salpica pixels de uma cor (em blocos de 1 ou 2)
function salpicoHD(ctx, sorte, quantos, cor, tam = 1) {
  ctx.fillStyle = cor;
  for (let i = 0; i < quantos; i++) ctx.fillRect(Math.floor(sorte() * TILE_HD), Math.floor(sorte() * TILE_HD), tam, tam);
}

function tufoDeGrama(ctx, x, y, cores) {
  retangulo(ctx, x, y + 1, 1, 3, cores.folha);
  retangulo(ctx, x - 1, y + 2, 1, 2, cores.folha);
  retangulo(ctx, x + 1, y + 2, 1, 2, cores.folha);
  retangulo(ctx, x, y, 1, 1, cores.ponta);
  retangulo(ctx, x - 2, y + 2, 1, 1, cores.ponta);
  retangulo(ctx, x + 2, y + 1, 1, 1, cores.ponta);
}

function florHD(ctx, x, y, cor) {
  retangulo(ctx, x, y + 2, 1, 2, "#3b7d2e");
  retangulo(ctx, x - 1, y, 3, 1, cor);
  retangulo(ctx, x, y - 1, 1, 3, cor);
  retangulo(ctx, x, y, 1, 1, "#fff3b0");
}

const PINTORES_CHAO = {
  grama: (ctx, v, sorte) => gramaHD(ctx, v, sorte, CORES_CHAO.grama, true),
  mata: (ctx, v, sorte) => gramaHD(ctx, v, sorte, CORES_CHAO.mata, false),
  caminho: (ctx, v, sorte) => {
    const c = CORES_CHAO.caminho;
    retangulo(ctx, 0, 0, TILE_HD, TILE_HD, c.base);
    salpicoHD(ctx, sorte, 40, c.escura);
    salpicoHD(ctx, sorte, 22, c.clara);
    salpicoHD(ctx, sorte, 6, c.escura, 2);
    // pedrinhas
    for (let i = 0; i < 3 + v; i++) {
      const x = 2 + Math.floor(sorte() * 27);
      const y = 2 + Math.floor(sorte() * 27);
      retangulo(ctx, x, y, 3, 2, "#a39a88");
      retangulo(ctx, x, y, 2, 1, "#d9d0bd");
      retangulo(ctx, x, y + 2, 3, 1, "#8a7a5e");
    }
  },
  areia: (ctx, v, sorte) => areiaHD(ctx, v, sorte, CORES_CHAO.areia, false),
  areiaDeserto: (ctx, v, sorte) => areiaHD(ctx, v, sorte, CORES_CHAO.areiaDeserto, true),
  agua: (ctx, v, sorte) => aguaHD(ctx, v, sorte, CORES_CHAO.agua, false),
  aguaPantano: (ctx, v, sorte) => aguaHD(ctx, v, sorte, CORES_CHAO.aguaPantano, true),
  rocha: (ctx, v, sorte) => rochaHD(ctx, v, sorte, CORES_CHAO.rocha),
  rochaMontanha: (ctx, v, sorte) => rochaHD(ctx, v, sorte, CORES_CHAO.rochaMontanha),
  neve: (ctx, v, sorte) => {
    const c = CORES_CHAO.neve;
    retangulo(ctx, 0, 0, TILE_HD, TILE_HD, c.base);
    salpicoHD(ctx, sorte, 26, c.escura);
    salpicoHD(ctx, sorte, 6, c.escura, 2);
    salpicoHD(ctx, sorte, 10, c.clara);
    // montinhos de neve com sombra azul embaixo
    for (let i = 0; i < 2; i++) {
      const x = 4 + Math.floor(sorte() * 20);
      const y = 6 + Math.floor(sorte() * 18);
      retangulo(ctx, x, y, 7, 1, c.clara);
      retangulo(ctx, x + 1, y + 1, 6, 1, "#c3cfe2");
    }
    if (v === 3) retangulo(ctx, 14, 14, 1, 1, "#a7dcff");
  },
  lama: (ctx, v, sorte) => {
    const c = CORES_CHAO.lama;
    retangulo(ctx, 0, 0, TILE_HD, TILE_HD, c.base);
    salpicoHD(ctx, sorte, 36, c.escura);
    salpicoHD(ctx, sorte, 8, c.escura, 2);
    salpicoHD(ctx, sorte, 14, c.clara);
    if (v >= 2) {
      // poça de água parada
      const x = 6 + Math.floor(sorte() * 12);
      const y = 8 + Math.floor(sorte() * 12);
      for (let dy = 0; dy < 5; dy++) retangulo(ctx, x + Math.abs(2 - dy), y + dy, 12 - Math.abs(2 - dy) * 2, 1, "#3d6b5a");
      retangulo(ctx, x + 3, y + 1, 4, 1, "#6f9a85");
    }
  },
  pedra: (ctx, v, sorte) => {
    const c = CORES_CHAO.pedra;
    retangulo(ctx, 0, 0, TILE_HD, TILE_HD, c.junta);
    // paralelepípedos em fileiras desencontradas
    for (let linha = 0; linha < 4; linha++) {
      const desloca = linha % 2 ? -5 : 0;
      for (let x = desloca; x < TILE_HD; x += 11) {
        const larg = 10;
        const cor = [c.base, c.clara, c.escura][Math.floor(sorte() * 3)];
        retangulo(ctx, x + 1, linha * 8 + 1, larg - 1, 6, cor);
        retangulo(ctx, x + 1, linha * 8 + 1, larg - 1, 1, tom(cor, 1.18));
        retangulo(ctx, x + 1, linha * 8 + 6, larg - 1, 1, tom(cor, 0.82));
      }
    }
    salpicoHD(ctx, sorte, 10, c.escura);
  },
  plantacao: (ctx, v, sorte) => {
    const c = CORES_CHAO.plantacao;
    retangulo(ctx, 0, 0, TILE_HD, TILE_HD, c.base);
    salpicoHD(ctx, sorte, 20, c.clara);
    for (let i = 0; i < 4; i++) {
      retangulo(ctx, 0, i * 8 + 5, TILE_HD, 2, c.escura);
      for (let j = 0; j < 5; j++) {
        const x = j * 7 + 2 + (i % 2) * 3;
        retangulo(ctx, x, i * 8 + 1, 1, 4, "#4f9a3e");
        retangulo(ctx, x - 1, i * 8 + 2, 1, 1, "#78c25e");
        retangulo(ctx, x + 1, i * 8 + 1, 1, 1, "#78c25e");
        if ((i + j + v) % 4 === 0) retangulo(ctx, x, i * 8, 1, 1, "#ffd166");
      }
    }
  },
  ponteH: (ctx, v, sorte) => ponteHD(ctx, false, sorte),
  ponteV: (ctx, v, sorte) => ponteHD(ctx, true, sorte),
};

function gramaHD(ctx, v, sorte, c, flores) {
  retangulo(ctx, 0, 0, TILE_HD, TILE_HD, c.base);
  salpicoHD(ctx, sorte, 46, c.escura);
  salpicoHD(ctx, sorte, 8, c.escura, 2);
  salpicoHD(ctx, sorte, 26, c.clara);
  for (let i = 0; i < 4 + (flores ? 0 : 3); i++) tufoDeGrama(ctx, 3 + Math.floor(sorte() * 26), 2 + Math.floor(sorte() * 25), c);
  if (flores && v === 2) for (let i = 0; i < 3; i++) florHD(ctx, 5 + Math.floor(sorte() * 22), 5 + Math.floor(sorte() * 20), ["#fff6c9", "#ff7ad9", "#ffd166", "#a7dcff"][i % 4]);
  if (!flores && v === 3) {
    // folhas caídas no chão da floresta
    for (let i = 0; i < 5; i++) retangulo(ctx, Math.floor(sorte() * 30), Math.floor(sorte() * 30), 2, 1, ["#a0703f", "#c9952a"][i % 2]);
  }
}

function areiaHD(ctx, v, sorte, c, deserto) {
  retangulo(ctx, 0, 0, TILE_HD, TILE_HD, c.base);
  salpicoHD(ctx, sorte, 38, c.escura);
  salpicoHD(ctx, sorte, 18, c.clara);
  if (deserto) {
    // ondinhas que o vento desenha na duna
    const fase = sorte() * 6;
    for (let y = 6; y < TILE_HD; y += 11) {
      for (let x = 0; x < TILE_HD; x++) {
        const dy = Math.round(Math.sin(x * 0.35 + fase + y) * 1.5);
        retangulo(ctx, x, y + dy, 1, 1, c.escura);
        if (x % 3 === 0) retangulo(ctx, x, y + dy - 1, 1, 1, c.clara);
      }
    }
  } else if (v === 1) {
    // conchinha na praia
    retangulo(ctx, 18, 12, 3, 2, "#ffd1dc");
    retangulo(ctx, 19, 11, 1, 1, "#ffffff");
  }
}

function aguaHD(ctx, v, sorte, c, pantano) {
  retangulo(ctx, 0, 0, TILE_HD, TILE_HD, c.base);
  salpicoHD(ctx, sorte, 20, c.escura, 2);
  // marolas: risquinhos claros na horizontal
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(sorte() * 24);
    const y = 2 + Math.floor(sorte() * 28);
    retangulo(ctx, x, y, 4 + Math.floor(sorte() * 5), 1, c.clara);
  }
  if (v === 1) retangulo(ctx, 10 + Math.floor(sorte() * 12), 8 + Math.floor(sorte() * 14), 2, 1, c.brilho);
  if (pantano && v === 3) {
    // vitória-régia
    disco(ctx, 16, 16, 4, "#4c9a2a");
    retangulo(ctx, 16, 12, 4, 4, c.base);
    retangulo(ctx, 13, 15, 2, 1, "#78c25e");
  }
}

function rochaHD(ctx, v, sorte, c) {
  retangulo(ctx, 0, 0, TILE_HD, TILE_HD, c.base);
  salpicoHD(ctx, sorte, 30, c.escura);
  salpicoHD(ctx, sorte, 10, c.escura, 2);
  salpicoHD(ctx, sorte, 16, c.clara);
  // rachaduras
  for (let i = 0; i < 2; i++) {
    let x = Math.floor(sorte() * 28);
    let y = Math.floor(sorte() * 10);
    for (let k = 0; k < 10; k++) {
      retangulo(ctx, x, y, 1, 1, c.baixo);
      x += sorte() < 0.5 ? 1 : 0;
      y += 1;
    }
  }
  // blocos com luz em cima
  for (let i = 0; i < 2; i++) {
    const x = Math.floor(sorte() * 22);
    const y = Math.floor(sorte() * 22);
    retangulo(ctx, x, y, 8, 1, c.clara);
    retangulo(ctx, x, y + 1, 1, 4, c.clara);
  }
}

function ponteHD(ctx, vertical, sorte) {
  aguaHD(ctx, 0, sorte, CORES_CHAO.agua, false);
  for (let i = 0; i < TILE_HD; i += 6) {
    const cor = sorte() < 0.5 ? "#8b5a2b" : "#9a6a35";
    if (vertical) {
      retangulo(ctx, 2, i, TILE_HD - 4, 5, cor);
      retangulo(ctx, 2, i + 5, TILE_HD - 4, 1, "#5c3418");
      retangulo(ctx, 5, i + 2, 1, 1, "#c9cbe0");
      retangulo(ctx, TILE_HD - 6, i + 2, 1, 1, "#c9cbe0");
    } else {
      retangulo(ctx, i, 2, 5, TILE_HD - 4, cor);
      retangulo(ctx, i + 5, 2, 1, TILE_HD - 4, "#5c3418");
      retangulo(ctx, i + 2, 5, 1, 1, "#c9cbe0");
      retangulo(ctx, i + 2, TILE_HD - 6, 1, 1, "#c9cbe0");
    }
  }
  // corrimão dos dois lados
  if (vertical) {
    retangulo(ctx, 0, 0, 2, TILE_HD, "#5c3418");
    retangulo(ctx, TILE_HD - 2, 0, 2, TILE_HD, "#5c3418");
  } else {
    retangulo(ctx, 0, 0, TILE_HD, 2, "#5c3418");
    retangulo(ctx, 0, TILE_HD - 2, TILE_HD, 2, "#5c3418");
  }
}

// camadas por cima do chão base: espuma na beira da água, luz/sombra na beira da rocha e o mato
// avançando sobre a borda dos caminhos
const LADOS = { N: [0, -1], S: [0, 1], O: [-1, 0], L: [1, 0] };

function bordaIrregular(ctx, lado, espessura, cor, sorte, salto = 2) {
  for (let i = 0; i < TILE_HD; i += salto) {
    const fundo = Math.max(1, Math.round(espessura * (0.5 + sorte() * 0.8)));
    if (lado === "N") retangulo(ctx, i, 0, salto, fundo, cor);
    if (lado === "S") retangulo(ctx, i, TILE_HD - fundo, salto, fundo, cor);
    if (lado === "O") retangulo(ctx, 0, i, fundo, salto, cor);
    if (lado === "L") retangulo(ctx, TILE_HD - fundo, i, fundo, salto, cor);
  }
}

const SOBREPOSTOS_CHAO = {};
["agua", "aguaPantano"].forEach((agua) => Object.keys(LADOS).forEach((lado) => {
  SOBREPOSTOS_CHAO[`espuma-${agua}-${lado}`] = (ctx, sorte) => {
    const c = CORES_CHAO[agua];
    bordaIrregular(ctx, lado, 3, c.brilho, sorte);
    bordaIrregular(ctx, lado, 1.5, c.espuma, sorte);
  };
}));
["rocha", "rochaMontanha"].forEach((rocha) => {
  SOBREPOSTOS_CHAO[`${rocha}-topo`] = (ctx, sorte) => bordaIrregular(ctx, "N", 5, CORES_CHAO[rocha].topo, sorte, 3);
  SOBREPOSTOS_CHAO[`${rocha}-base`] = (ctx, sorte) => bordaIrregular(ctx, "S", 5, CORES_CHAO[rocha].baixo, sorte, 3);
});
["grama", "mata", "areia", "neve", "lama"].forEach((vizinho) => Object.keys(LADOS).forEach((lado) => {
  SOBREPOSTOS_CHAO[`borda-${vizinho}-${lado}`] = (ctx, sorte) => {
    const c = CORES_CHAO[vizinho];
    bordaIrregular(ctx, lado, 4, c.base, sorte);
    bordaIrregular(ctx, lado, 2, c.escura || c.base, sorte, 3);
    if (c.folha) for (let i = 0; i < 3; i++) {
      const p = 4 + Math.floor(sorte() * 24);
      const [x, y] = { N: [p, 3], S: [p, TILE_HD - 7], O: [3, p], L: [TILE_HD - 5, p] }[lado];
      tufoDeGrama(ctx, x, y, c);
    }
  };
}));

// monta o tileset: cada tipo de chão em 4 variações + as camadas por cima; devolve o canvas e o índice
function gerarTilesetChao() {
  const nomes = [];
  const pintores = [];
  Object.entries(PINTORES_CHAO).forEach(([nome, pintar]) => {
    for (let v = 0; v < VARIANTES_TILE; v++) {
      nomes.push(`${nome}#${v}`);
      pintores.push((ctx, sorte) => pintar(ctx, v, sorte));
    }
  });
  Object.entries(SOBREPOSTOS_CHAO).forEach(([nome, pintar]) => {
    nomes.push(nome);
    pintores.push(pintar);
  });
  const colunas = 16;
  const { canvas, ctx } = criarTela(colunas * TILE_HD, Math.ceil(nomes.length / colunas) * TILE_HD);
  pintores.forEach((pintar, i) => {
    ctx.save();
    ctx.translate((i % colunas) * TILE_HD, Math.floor(i / colunas) * TILE_HD);
    ctx.beginPath();
    ctx.rect(0, 0, TILE_HD, TILE_HD);
    ctx.clip();
    pintar(ctx, sorteador(1000 + i * 17));
    ctx.restore();
  });
  return { imagem: canvas, nomes, colunas };
}

// Para cada tile do mapa, a lista de pedaços do tileset (de baixo para cima), seguindo as mesmas regras
// de antes (espuma onde a água encosta na terra, borda das rochas, mato na beira do caminho).
function camadasDoChao(mapa, indice, regiaoVisual = regiaoDe) {
  const COLUNAS = mapa[0].length; // o mapa diz o tamanho (o Reino ou Umbraterra)
  const LINHAS = mapa.length;
  const MAX = 5;
  const camadas = new Int16Array(COLUNAS * LINHAS * MAX).fill(-1);
  const nomeDe = (v) => ({ [T.GRAMA]: "grama", [T.MATA]: "mata", [T.AREIA]: "areia", [T.NEVE]: "neve", [T.LAMA]: "lama" }[v]);
  // o chão de baixo de cada tile pelo nome (o passe de detalhe usa para as manchas e as bordas)
  const terreno = new Array(COLUNAS * LINHAS).fill(null);
  for (let y = 0; y < LINHAS; y++) {
    for (let x = 0; x < COLUNAS; x++) {
      const lista = [];
      const t = mapa[y][x];
      const v = Math.floor(hashTile(x, y, 77) * VARIANTES_TILE);
      const vizinho = (dx, dy) => mapa[y + dy]?.[x + dx];
      const naoAgua = (n) => n !== undefined && n !== T.AGUA && n !== T.PONTE;
      const regiao = regiaoVisual(x, y);
      const base = (nome) => {
        terreno[y * COLUNAS + x] = nome;
        lista.push(indice[`${nome}#${v}`]);
      };
      if (t === T.AGUA) {
        const agua = regiao === "pantano" ? "aguaPantano" : "agua";
        base(agua);
        Object.entries(LADOS).forEach(([lado, [dx, dy]]) => naoAgua(vizinho(dx, dy)) && lista.push(indice[`espuma-${agua}-${lado}`]));
      } else if (t === T.AREIA) base(regiao === "deserto" ? "areiaDeserto" : "areia");
      else if (t === T.ROCHA) {
        const rocha = regiao === "montanhas" ? "rochaMontanha" : "rocha";
        base(rocha);
        if (vizinho(0, -1) !== T.ROCHA) lista.push(indice[`${rocha}-topo`]);
        if (vizinho(0, 1) !== undefined && vizinho(0, 1) !== T.ROCHA) lista.push(indice[`${rocha}-base`]);
      } else if (t === T.NEVE) base("neve");
      else if (t === T.LAMA) base("lama");
      else if (t === T.PEDRA) base("pedra");
      else if (t === T.PLANTACAO) base("plantacao");
      else if (t === T.PONTE) base(naoAgua(vizinho(0, -1)) || naoAgua(vizinho(0, 1)) ? "ponteV" : "ponteH");
      else if (t === T.CAMINHO) {
        base("caminho");
        Object.entries(LADOS).forEach(([lado, [dx, dy]]) => {
          const n = nomeDe(vizinho(dx, dy));
          if (n) lista.push(indice[`borda-${n}-${lado}`]);
        });
      } else base(t === T.MATA || (t !== T.GRAMA && regiao === "floresta") ? "mata" : "grama");
      lista.slice(0, MAX).forEach((id, i) => { camadas[(y * COLUNAS + x) * MAX + i] = id ?? -1; });
    }
  }
  return { camadas, max: MAX, colunas: COLUNAS, linhas: LINHAS, terreno };
}

// ---------- o passe de detalhe por cima de cada bloco do chão ----------
// O tileset repete os mesmos 4 desenhos de cada chão. Por cima de cada bloco já montado vêm:
// (1) manchas grandes de luz e sombra que atravessam os tiles (a grama deixa de parecer carpete repetido);
// (2) bordas onduladas onde um chão encontra outro (a neve avança sobre a grama, a areia sobre o mato),
//     no lugar da linha reta do tile, com um tom mais escuro marcando a beirada;
// (3) os cantos arredondados onde dois chãos só se encostam na diagonal.
// Tudo sai da posição no mundo: continua igual de um bloco para o outro e de uma visita para a outra.
// Como cada bloco é desenhado uma vez só e guardado, isso não pesa no quadro a quadro.
const PRIORIDADE_CHAO = { neve: 6, areiaDeserto: 5, areia: 5, grama: 3, mata: 2, lama: 1, caminho: 0 };
const MANCHAS_CHAO = { grama: 1, mata: 1, neve: 0.7, areia: 0.7, areiaDeserto: 0.8, lama: 1, caminho: 0.6 };

// ruído suave no mundo (de -1 a 1), contínuo entre tiles: interpola valores sorteados numa grade
function ruidoDoMundo(x, y, semente) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const v = (a, b) => hashTile(a, b, semente) * 2 - 1;
  const cima = v(ix, iy) + (v(ix + 1, iy) - v(ix, iy)) * sx;
  const baixo = v(ix, iy + 1) + (v(ix + 1, iy + 1) - v(ix, iy + 1)) * sx;
  return cima + (baixo - cima) * sy;
}

function detalharBloco(ctx, bx, by, chao) {
  const { terreno, colunas: COLUNAS, linhas: LINHAS } = chao;
  if (!terreno) return;
  const nomeEm = (x, y) => (x < 0 || y < 0 || x >= COLUNAS || y >= LINHAS ? null : terreno[y * COLUNAS + x]);
  const acima = (nome, viz) => viz && viz in PRIORIDADE_CHAO && PRIORIDADE_CHAO[viz] > PRIORIDADE_CHAO[nome];
  for (let ty = 0; ty < TILES_POR_BLOCO; ty++) {
    for (let tx = 0; tx < TILES_POR_BLOCO; tx++) {
      const x = bx * TILES_POR_BLOCO + tx;
      const y = by * TILES_POR_BLOCO + ty;
      const nome = nomeEm(x, y);
      if (!nome) continue;
      const ox = tx * TILE_HD;
      const oy = ty * TILE_HD;
      // (1) manchas de luz e sombra, em quadradinhos de 4 pixels
      const forca = MANCHAS_CHAO[nome];
      if (forca) {
        const c = CORES_CHAO[nome];
        for (let cy = 0; cy < TILE_HD; cy += 4) {
          for (let cx = 0; cx < TILE_HD; cx += 4) {
            const wx = x * TILE_HD + cx;
            const wy = y * TILE_HD + cy;
            const n = ruidoDoMundo(wx / 110, wy / 110, 11) * 0.7 + ruidoDoMundo(wx / 30, wy / 30, 12) * 0.3;
            if (Math.abs(n) < 0.22) continue;
            ctx.globalAlpha = Math.min(0.48, (Math.abs(n) - 0.22) * 1.7) * forca;
            ctx.fillStyle = n > 0 ? c.clara : c.escura;
            ctx.fillRect(ox + cx, oy + cy, 4, 4);
          }
        }
        ctx.globalAlpha = 1;
      }
      if (!(nome in PRIORIDADE_CHAO)) continue;
      // (2) bordas onduladas: quem tem prioridade maior avança sobre este tile
      [["N", 0, -1], ["S", 0, 1], ["O", -1, 0], ["L", 1, 0]].forEach(([lado, dx, dy]) => {
        const viz = nomeEm(x + dx, y + dy);
        if (!acima(nome, viz)) return;
        const cv = CORES_CHAO[viz];
        const beirada = tom(cv.base, 0.8);
        // qual fronteira é esta, no mundo (a mesma vista dos dois lados)
        const fronteira = dx ? x + (dx > 0 ? 1 : 0) : y + (dy > 0 ? 1 : 0);
        for (let i = 0; i < TILE_HD; i += 2) {
          const ao = (dx ? y : x) * TILE_HD + i;
          const n = (ruidoDoMundo(ao / 13, fronteira * 7.3, dx ? 31 : 32) + 1) / 2;
          const fundo = 2 + Math.round(n * 8);
          let r;
          if (lado === "N") r = [ox + i, oy, 2, fundo, ox + i, oy + fundo, 2, 1];
          if (lado === "S") r = [ox + i, oy + TILE_HD - fundo, 2, fundo, ox + i, oy + TILE_HD - fundo - 1, 2, 1];
          if (lado === "O") r = [ox, oy + i, fundo, 2, ox + fundo, oy + i, 1, 2];
          if (lado === "L") r = [ox + TILE_HD - fundo, oy + i, fundo, 2, ox + TILE_HD - fundo - 1, oy + i, 1, 2];
          ctx.fillStyle = cv.base;
          ctx.fillRect(r[0], r[1], r[2], r[3]);
          ctx.fillStyle = beirada;
          ctx.fillRect(r[4], r[5], r[6], r[7]);
          // um grão de textura do chão de cima, para a borda não ficar lisa
          if (hashTile(ao, fronteira, 5) > 0.6) {
            ctx.fillStyle = hashTile(ao, fronteira, 6) > 0.5 ? cv.clara : cv.escura;
            ctx.fillRect(r[0] + (r[2] > 2 ? 1 : 0), r[1] + (r[3] > 2 ? 1 : 0), 1, 1);
          }
        }
      });
      // (3) cantos: o chão de cima só encosta na diagonal (um quarto de círculo arredonda o degrau) ou vem
      // pelos dois lados do canto (o canto de dentro é preenchido, maior, para a escadinha virar curva)
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => {
        const lado1 = nomeEm(x + dx, y);
        const lado2 = nomeEm(x, y + dy);
        let viz = nomeEm(x + dx, y + dy);
        let r = 9;
        if (acima(nome, lado1) && lado1 === lado2) {
          viz = lado1;
          r = 14;
        } else if (!acima(nome, viz) || lado1 === viz || lado2 === viz) return;
        const cv = CORES_CHAO[viz];
        const cxo = ox + (dx > 0 ? TILE_HD : 0);
        const cyo = oy + (dy > 0 ? TILE_HD : 0);
        for (let k = 0; k < r; k++) {
          const meia = Math.round(Math.sqrt(r * r - k * k));
          const yy = dy > 0 ? cyo - 1 - k : cyo + k;
          ctx.fillStyle = cv.base;
          ctx.fillRect(dx > 0 ? cxo - meia : cxo, yy, meia, 1);
          ctx.fillStyle = tom(cv.base, 0.8);
          ctx.fillRect(dx > 0 ? cxo - meia - 1 : cxo + meia, yy, 1, 1);
        }
      });
    }
  }
}

// ---------- o acabamento de RPG do terreno ----------
// Por cima do chão já montado (e uma vez só por bloco, guardado), o que faz o chão parecer pintado à mão:
// - a água ganha profundidade: clara e com o fundo de areia aparecendo na beira, escura no meio, com
//   reflexos de luz no raso;
// - o penhasco faz sombra no chão logo abaixo dele (dá altura às rochas);
// - a grama ganha tufos com a ponta acesa e campos de flores em manchas (não flor solta em todo canto);
// - a mata, folhas caídas, samambaias e um cogumelo de vez em quando;
// - a areia, ondulações do vento (mais fortes no deserto, com rachaduras);
// - a neve, brilhos de gelo e montinhos com sombra azul;
// - a lama, poças com o reflexo do céu; o caminho, pedrinhas com luz em cima; a calçada, musgo nas juntas.
// Tudo sai da posição no mundo (hashTile/ruidoDoMundo): igual sempre, sem repetir de tile em tile.
const FLORES_DO_CAMPO = [["#ffffff", "#ffd166"], ["#ffd166", "#ff9f43"], ["#ff8fb0", "#fff3b0"], ["#a98bff", "#fff3b0"], ["#6ec8ff", "#ffffff"]];
function acabamentoDoTerreno(ctx, bx, by, chao) {
  const { terreno, colunas: COLUNAS, linhas: LINHAS } = chao;
  if (!terreno) return;
  const nomeEm = (x, y) => (x < 0 || y < 0 || x >= COLUNAS || y >= LINHAS ? null : terreno[y * COLUNAS + x]);
  const ehAgua = (n) => n === "agua" || n === "aguaPantano";
  const ehRocha = (n) => n === "rocha" || n === "rochaMontanha";
  const px = (x, y, cor, a = 1) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = cor;
    ctx.fillRect(x, y, 2, 2);
  };
  for (let ty = 0; ty < TILES_POR_BLOCO; ty++) {
    for (let tx = 0; tx < TILES_POR_BLOCO; tx++) {
      const x = bx * TILES_POR_BLOCO + tx;
      const y = by * TILES_POR_BLOCO + ty;
      const nome = nomeEm(x, y);
      if (!nome) continue;
      const ox = tx * TILE_HD;
      const oy = ty * TILE_HD;
      const h = (n) => hashTile(x, y, n);

      if (ehAgua(nome)) {
        // as terras a até 3 tiles daqui: a distância de cada pedacinho da água até a margem dá a profundidade
        const margens = [];
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const n = nomeEm(x + dx, y + dy);
            if (n && !ehAgua(n) && n !== "ponteV" && n !== "ponteH") margens.push([(x + dx) * TILE_HD, (y + dy) * TILE_HD]);
          }
        }
        const pantano = nome === "aguaPantano";
        // mar aberto, sem margem por perto: o fundo escuro de uma vez
        if (!margens.length) {
          ctx.globalAlpha = 0.32;
          ctx.fillStyle = pantano ? "#1e3a30" : "#123a6a";
          ctx.fillRect(ox, oy, TILE_HD, TILE_HD);
          ctx.globalAlpha = 1;
          continue;
        }
        for (let cy = 0; cy < TILE_HD; cy += 2) {
          for (let cx = 0; cx < TILE_HD; cx += 2) {
            const wx = x * TILE_HD + cx + 1;
            const wy = y * TILE_HD + cy + 1;
            let d = 120;
            margens.forEach(([mx, my]) => {
              const ddx = Math.max(mx - wx, 0, wx - (mx + TILE_HD));
              const ddy = Math.max(my - wy, 0, wy - (my + TILE_HD));
              d = Math.min(d, Math.hypot(ddx, ddy));
            });
            d += ruidoDoMundo(wx / 9, wy / 9, 41) * 4;
            if (d < 9) {
              // o raso: o fundo de areia aparece
              ctx.globalAlpha = (1 - d / 9) * 0.45;
              ctx.fillStyle = pantano ? "#7a8a55" : "#8fd0e0";
              ctx.fillRect(ox + cx, oy + cy, 2, 2);
            } else if (d > 26) {
              // o fundo: escurece devagar
              ctx.globalAlpha = Math.min(0.32, (d - 26) / 70);
              ctx.fillStyle = pantano ? "#1e3a30" : "#123a6a";
              ctx.fillRect(ox + cx, oy + cy, 2, 2);
            }
            // reflexos de luz no raso e no meio-raso (pontinhos que formam a rede da luz no fundo)
            if (d < 22 && !pantano && ruidoDoMundo(wx / 5, wy / 5, 43) > 0.55 && hashTile(wx, wy, 44) > 0.55) px(ox + cx, oy + cy, "#d6f4ff", 0.5);
          }
        }
        ctx.globalAlpha = 1;
        continue;
      }

      // a sombra do penhasco no chão de baixo
      if (!ehRocha(nome) && ehRocha(nomeEm(x, y - 1))) {
        for (let k = 0; k < 9; k++) {
          ctx.globalAlpha = 0.3 * (1 - k / 9);
          ctx.fillStyle = "#1b1533";
          ctx.fillRect(ox, oy + k, TILE_HD, 1);
        }
        ctx.globalAlpha = 1;
      }
      if (ehRocha(nome)) continue;

      enfeitarTile(ctx, nome, x, y, ox, oy);
    }
  }
  ctx.globalAlpha = 1;
}

// Os enfeites de cada tile (tufos, flores, cogumelos, ondulações, pedrinhas...), desenhados numa grade de
// 16 x 16 com cada ponto valendo 2 x 2 pixels: o chão é mostrado pela metade da resolução, e assim nenhum
// enfeite some ou vira borrão.
function enfeitarTile(ctx, nome, x, y, ox, oy) {
  const h = (n) => hashTile(x, y, n);
  const q = (lx, ly, cor, a = 1) => {
    if (lx < 0 || ly < 0 || lx > 15 || ly > 15) return;
    ctx.globalAlpha = a;
    ctx.fillStyle = cor;
    ctx.fillRect(ox + Math.floor(lx) * 2, oy + Math.floor(ly) * 2, 2, 2);
  };
  const em = (n, minimo, faixa) => minimo + Math.floor(h(n) * faixa);
  if (nome === "grama") {
    const c = CORES_CHAO.grama;
    // tufos: 3 folhas, a do meio mais alta, a ponta acesa e a sombrinha no pé
    const tufos = 1 + Math.floor(h(51) * 3);
    for (let i = 0; i < tufos; i++) {
      const fx = em(52 + i, 1, 13);
      const fy = em(57 + i, 1, 12);
      q(fx - 1, fy + 2, c.folha, 0.45);
      q(fx + 1, fy + 2, c.folha, 0.45);
      q(fx - 1, fy + 1, c.escura);
      q(fx + 1, fy + 1, c.escura);
      q(fx, fy + 1, c.folha);
      q(fx, fy, c.ponta);
      q(fx - 1, fy, c.folha);
      q(fx + 1, fy, c.folha);
    }
    // os campos de flores: só onde o ruído diz que é campo, da mesma cor na mancha toda
    const campo = ruidoDoMundo(x / 5, y / 5, 61);
    if (campo > 0.28) {
      const qtd = 1 + Math.round((campo - 0.28) * 8);
      const [petala, miolo] = FLORES_DO_CAMPO[Math.floor(hashTile(Math.floor(x / 4), Math.floor(y / 4), 62) * FLORES_DO_CAMPO.length)];
      for (let i = 0; i < qtd; i++) {
        const fx = em(63 + i, 1, 13);
        const fy = em(70 + i, 1, 12);
        q(fx, fy + 2, c.folha);
        q(fx - 1, fy, petala);
        q(fx + 1, fy, petala);
        q(fx, fy - 1, petala);
        q(fx, fy + 1, petala);
        q(fx, fy, miolo);
      }
    }
    if (h(80) > 0.9) {
      const fx = em(81, 3, 10);
      const fy = em(82, 3, 10);
      q(fx, fy, "#c9cbe0");
      q(fx + 1, fy, "#9a9ab0");
      q(fx, fy + 1, "#5a5a70", 0.6);
      q(fx + 1, fy + 1, "#5a5a70", 0.6);
    }
  } else if (nome === "mata") {
    const c = CORES_CHAO.mata;
    // samambaias
    if (h(91) > 0.35) {
      const fx = em(92, 3, 10);
      const fy = em(93, 2, 10);
      for (let k = 0; k < 3; k++) {
        q(fx - k, fy + k, c.folha);
        q(fx + k, fy + k, c.folha);
      }
      q(fx, fy, c.ponta);
      q(fx, fy + 1, c.escura);
      q(fx, fy + 2, c.escura);
    }
    // folhas caídas
    for (let i = 0; i < 3; i++) {
      if (h(95 + i) < 0.45) continue;
      q(em(98 + i, 0, 16), em(101 + i, 0, 16), ["#b5651d", "#d0782a", "#8a6a2a"][i], 0.9);
    }
    // um cogumelo de vez em quando: chapéu vermelho de bolinha branca
    if (h(104) > 0.92) {
      const fx = em(105, 3, 9);
      const fy = em(106, 3, 9);
      q(fx - 1, fy, "#c8283c");
      q(fx, fy, "#ff6a6a");
      q(fx + 1, fy, "#a81e30");
      q(fx - 1, fy + 1, "#a81e30");
      q(fx, fy + 1, "#ffffff");
      q(fx + 1, fy + 1, "#a81e30");
      q(fx, fy + 2, "#e8e4dc");
      q(fx, fy + 3, "#1b1533", 0.3);
    }
  } else if (nome === "areia" || nome === "areiaDeserto") {
    const c = CORES_CHAO[nome];
    const deserto = nome === "areiaDeserto";
    // ondulações do vento: linhas claras com a sombra embaixo, contínuas de um tile para o outro
    const passo = deserto ? 4 : 5;
    for (let lx = 0; lx < 16; lx++) {
      const wx = x * 16 + lx;
      for (let fila = -1; fila <= 16 / passo + 1; fila++) {
        const wyFila = Math.floor(y * 16 / passo) + fila;
        const ly = wyFila * passo - y * 16 + Math.round(Math.sin(wx / 5 + wyFila * 1.7) * 1.2);
        if (ly < 0 || ly > 14) continue;
        if (ruidoDoMundo(wx / 9, wyFila / 2, 111) < -0.15) continue;
        q(lx, ly, c.clara, 0.5);
        q(lx, ly + 1, c.escura, 0.35);
      }
    }
    if (deserto && h(112) > 0.82) {
      // a rachadura do chão seco
      let fx = em(113, 3, 10);
      let fy = em(114, 2, 6);
      for (let k = 0; k < 5; k++) {
        q(fx, fy, "#a8803e", 0.6);
        fx += h(115 + k) > 0.5 ? 1 : -1;
        fy += 1;
      }
    }
    if (!deserto && h(120) > 0.86) {
      // uma concha
      const fx = em(121, 3, 10);
      const fy = em(122, 3, 10);
      q(fx, fy, "#fff3e8");
      q(fx + 1, fy, "#ffd1c4");
      q(fx + 2, fy, "#fff3e8");
      q(fx + 1, fy - 1, "#fff3e8");
      q(fx + 1, fy + 1, "#c9a08a", 0.6);
    }
  } else if (nome === "neve") {
    // montinhos de neve com a sombra azul embaixo
    if (h(131) > 0.4) {
      const fx = em(132, 3, 10);
      const fy = em(133, 3, 10);
      for (let k = -2; k <= 2; k++) {
        q(fx + k, fy + 1, "#c9d6ec", 0.8);
        if (Math.abs(k) < 2) q(fx + k, fy, "#ffffff");
      }
    }
    // brilhos de gelo
    for (let i = 0; i < 2; i++) {
      if (h(136 + i) < 0.55) continue;
      const fx = em(139 + i, 0, 16);
      const fy = em(142 + i, 0, 16);
      q(fx, fy, "#ffffff");
      q(fx + 1, fy, "#bfe6ff", 0.6);
    }
  } else if (nome === "lama") {
    if (h(151) > 0.5) {
      // a poça: escura, com o céu refletido
      const fx = em(152, 4, 7);
      const fy = em(153, 4, 7);
      for (let k = -2; k <= 2; k++) {
        q(fx + k, fy, "#3a4228", 0.75);
        if (Math.abs(k) < 2) q(fx + k, fy + 1, "#3a4228", 0.75);
        if (Math.abs(k) < 2) q(fx + k, fy - 1, "#3a4228", 0.75);
      }
      q(fx - 1, fy - 1, "#a8c0c8", 0.55);
      q(fx, fy - 1, "#a8c0c8", 0.4);
    }
  } else if (nome === "caminho") {
    // pedrinhas encravadas no caminho: luz em cima, sombra embaixo
    for (let i = 0; i < 3; i++) {
      if (h(161 + i) < 0.4) continue;
      const fx = em(165 + i, 1, 13);
      const fy = em(169 + i, 1, 13);
      q(fx, fy, "#e6d6b8");
      q(fx + 1, fy, "#d8c4a0");
      q(fx, fy + 1, "#8a6a45", 0.7);
      q(fx + 1, fy + 1, "#8a6a45", 0.7);
    }
  } else if (nome === "pedra") {
    // musgo nas juntas da calçada, em manchas
    if (ruidoDoMundo(x / 4, y / 4, 181) > 0.2) {
      for (let i = 0; i < 4; i++) q(em(182 + i, 0, 16), em(188 + i, 0, 16), i % 2 ? "#5f8a3a" : "#7aa04a", 0.75);
    }
  }
  ctx.globalAlpha = 1;
}
// O chão é montado em blocos de 16 × 16 tiles (512 × 512 pixels), cada um desenhado uma vez só quando
// aparece pela primeira vez e guardado: a tela inteira vira uns 9 desenhos por quadro, em vez de mil
// tiles. Só os blocos usados por último ficam na memória.
const TILES_POR_BLOCO = 16;
const BLOCOS_GUARDADOS = 30;
function criarDesenhoDoChao(tileset, chao) {
  const { imagem, colunas } = tileset;
  const { camadas, max, colunas: COLUNAS, linhas: LINHAS } = chao;
  const blocos = new Map(); // "bx,by" → canvas (a ordem do Map é a ordem de uso: o mais antigo sai primeiro)
  const lado = TILES_POR_BLOCO * TILE_HD;
  function bloco(bx, by) {
    const chave = `${bx},${by}`;
    let c = blocos.get(chave);
    if (c) {
      blocos.delete(chave);
      blocos.set(chave, c);
      return c;
    }
    const { canvas, ctx } = criarTela(lado, lado);
    for (let ty = 0; ty < TILES_POR_BLOCO; ty++) {
      for (let tx = 0; tx < TILES_POR_BLOCO; tx++) {
        const x = bx * TILES_POR_BLOCO + tx;
        const y = by * TILES_POR_BLOCO + ty;
        if (x >= COLUNAS || y >= LINHAS) continue;
        const k = (y * COLUNAS + x) * max;
        for (let i = 0; i < max; i++) {
          const id = camadas[k + i];
          if (id < 0) break;
          ctx.drawImage(imagem, (id % colunas) * TILE_HD, Math.floor(id / colunas) * TILE_HD, TILE_HD, TILE_HD, tx * TILE_HD, ty * TILE_HD, TILE_HD, TILE_HD);
        }
      }
    }
    detalharBloco(ctx, bx, by, chao);
    acabamentoDoTerreno(ctx, bx, by, chao);
    c = canvas;
    blocos.set(chave, c);
    if (blocos.size > BLOCOS_GUARDADOS) blocos.delete(blocos.keys().next().value);
    return c;
  }
  const blocoMundo = TILES_POR_BLOCO * TILE; // tamanho do bloco em unidades do mundo
  return (ctx, camera, w, h) => {
    const bx0 = Math.max(0, Math.floor(camera.x / blocoMundo));
    const by0 = Math.max(0, Math.floor(camera.y / blocoMundo));
    const bx1 = Math.min(Math.ceil(COLUNAS / TILES_POR_BLOCO) - 1, Math.floor((camera.x + w) / blocoMundo));
    const by1 = Math.min(Math.ceil(LINHAS / TILES_POR_BLOCO) - 1, Math.floor((camera.y + h) / blocoMundo));
    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) ctx.drawImage(bloco(bx, by), bx * blocoMundo - camera.x, by * blocoMundo - camera.y, blocoMundo, blocoMundo);
    }
  };
}

// ---------- vento nas árvores, já calculado ----------
// Cada desenho de árvore ganha suas poses de vento prontas (a copa deslocada de -4 a +4 pixels no topo,
// o tronco parado): no jogo, desenhar uma árvore balançando custa um desenho só.
const MAX_VENTO = 4;
const posesDeVento = new WeakMap();
function posesDoVento(sprite) {
  let poses = posesDeVento.get(sprite);
  if (poses) return poses;
  const h = sprite.height;
  const tronco = h * 0.68;
  poses = [];
  for (let nivel = -MAX_VENTO; nivel <= MAX_VENTO; nivel++) {
    const { canvas, ctx } = criarTela(sprite.width + MAX_VENTO * 2, h);
    for (let sy = 0; sy < h; sy++) {
      const solto = sy < tronco ? 1 - sy / tronco : 0;
      ctx.drawImage(sprite, 0, sy, sprite.width, 1, MAX_VENTO + Math.round(nivel * solto), sy, sprite.width, 1);
    }
    canvas.res = sprite.res;
    poses.push(canvas);
  }
  posesDeVento.set(sprite, poses);
  return poses;
}

// ---------- as imagens salvas ----------

const PASTA_CENARIO = "/static/img/cenario/";
const CENARIO_SALVO = { tileset: null, sprites: {} };

function carregarImagem(url) {
  return new Promise((resolver, rejeitar) => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = rejeitar;
    img.src = url;
  });
}

// Lê o manifesto e as 2 imagens prontas (o tileset do chão e a folha com todos os desenhos) e recorta
// cada desenho da folha. Se faltar alguma coisa, o jogo desenha aquilo pelo código.
async function carregarCenarioHD() {
  try {
    const manifesto = await fetch(`${PASTA_CENARIO}manifesto.json`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null));
    if (!manifesto) return;
    const versao = `?v=${manifesto.versao}`;
    const [tiles, folha] = await Promise.all([
      carregarImagem(PASTA_CENARIO + manifesto.tileset.arquivo + versao),
      carregarImagem(PASTA_CENARIO + manifesto.folha.arquivo + versao),
    ]);
    CENARIO_SALVO.tileset = { imagem: tiles, nomes: manifesto.tileset.nomes, colunas: manifesto.tileset.colunas };
    Object.entries(manifesto.folha.desenhos).forEach(([nome, [x, y, w, h]]) => {
      const { canvas, ctx } = criarTela(w, h);
      ctx.drawImage(folha, x, y, w, h, 0, 0, w, h);
      canvas.res = manifesto.resolucao || RESOLUCAO_REINO;
      CENARIO_SALVO.sprites[nome] = canvas;
    });
  } catch {
    // sem imagens salvas: tudo é desenhado pelo código mesmo
  }
}

// Junta vários desenhos numa folha só (prateleiras: enche a linha da esquerda para a direita, do mais
// alto para o mais baixo). Devolve a folha e onde ficou cada desenho.
function montarFolha(desenhos, larguraMinima = 1024, folga = 2) {
  const ordem = Object.entries(desenhos).sort((a, b) => b[1].height - a[1].height);
  const largura = Math.max(larguraMinima, ...ordem.map(([, c]) => c.width)); // cabe até o maior desenho
  const posicoes = {};
  let x = 0;
  let y = 0;
  let alturaLinha = 0;
  ordem.forEach(([nome, c]) => {
    if (x + c.width > largura) {
      x = 0;
      y += alturaLinha + folga;
      alturaLinha = 0;
    }
    posicoes[nome] = [x, y, c.width, c.height];
    x += c.width + folga;
    alturaLinha = Math.max(alturaLinha, c.height);
  });
  const { canvas, ctx } = criarTela(largura, y + alturaLinha);
  ordem.forEach(([nome, c]) => ctx.drawImage(c, posicoes[nome][0], posicoes[nome][1]));
  return { canvas, posicoes };
}

// ---------- as construções detalhadas ----------
// O desenho de cada construção é pequeno (48 x 44) e era só ampliado. Agora cada material ganha o seu
// detalhe na ampliação, reconhecido pela cor do desenho original: o telhado vira fileiras de telhas (cada
// uma com a luz em cima e a sombra embaixo), a madeira ganha veios, a pedra vira blocos com argamassa, o
// reboco ganha manchas e tijolos aparecendo, e as janelas acesas ganham caixilho e o reflexo do vidro.
function materialDaCor(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = (max + min) / 2;
  const sat = max === min ? 0 : (max - min) / (lum > 127 ? 510 - max - min : max + min);
  if (lum < 38) return null; // o contorno
  if (r > 220 && g > 185 && b < 150) return "janela";
  if (sat < 0.13) return lum > 225 ? null : "pedra";
  let hue = 0;
  if (max === r) hue = ((g - b) / (max - min)) * 60;
  else if (max === g) hue = (2 + (b - r) / (max - min)) * 60;
  else hue = (4 + (r - g) / (max - min)) * 60;
  if (hue < 0) hue += 360;
  if (hue >= 12 && hue <= 42 && lum < 120) return "madeira";
  if (hue >= 25 && hue <= 55 && lum > 160 && sat < 0.75) return "reboco";
  return "cor";
}

function detalharConstrucao(hd, base) {
  const W = hd.width;
  const H = hd.height;
  const bw = base.width;
  const bh = base.height;
  const kx = W / bw;
  const ky = H / bh;
  const pb = base.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, bw, bh).data;
  const ctx = hd.getContext("2d", { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  // o telhado é a cor saturada da metade de cima; abaixo dela, a mesma cor vira parede pintada
  const fator = (i, k) => {
    d[i] = Math.min(255, d[i] * k);
    d[i + 1] = Math.min(255, d[i + 1] * k);
    d[i + 2] = Math.min(255, d[i + 2] * k);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] < 200) continue;
      const bx = Math.min(bw - 1, Math.floor(x / kx));
      const by = Math.min(bh - 1, Math.floor(y / ky));
      const j = (by * bw + bx) * 4;
      if (pb[j + 3] < 200) continue;
      const mat = materialDaCor(pb[j], pb[j + 1], pb[j + 2]);
      if (!mat) continue;
      const sorte = hashTile(x >> 1, y >> 1, 7);
      if (mat === "cor" && by < bh * 0.6) {
        // telhas: fileiras de 6 pixels, deslocadas meia telha a cada fileira
        const fila = Math.floor(y / 6);
        const ry = y % 6;
        const col = (x + (fila % 2) * 5) % 10;
        if (ry === 5) fator(i, 0.68);
        else if (col === 0) fator(i, 0.8);
        else if (ry === 0) fator(i, 1.16);
        else if (ry === 1 && col < 4) fator(i, 1.07);
        if (sorte > 0.97) fator(i, 0.85); // uma telha manchada aqui e ali
      } else if (mat === "madeira") {
        // veios: riscos compridos na vertical, mais escuros
        const veio = hashTile(x, Math.floor(y / 9), 3);
        if (veio > 0.82) fator(i, 0.78);
        else if (veio < 0.08) fator(i, 1.12);
      } else if (mat === "pedra") {
        // blocos de pedra com argamassa: 8 de largura, 6 de altura, alternados
        const fila = Math.floor(y / 6);
        const col = (x + (fila % 2) * 4) % 8;
        if (y % 6 === 5 || col === 7) fator(i, 0.72);
        else if (y % 6 === 0 || col === 0) fator(i, 1.1);
        if (sorte > 0.93) fator(i, 0.9);
      } else if (mat === "reboco") {
        // manchas leves e, onde o reboco caiu, os tijolos aparecendo
        const caiu = ruidoDoMundo(x / 14, y / 14, 23) > 0.55;
        if (caiu) {
          const fila = Math.floor(y / 4);
          const col = (x + (fila % 2) * 4) % 8;
          d[i] = 178; d[i + 1] = 98; d[i + 2] = 72;
          if (y % 4 === 3 || col === 7) fator(i, 0.78);
        } else if (sorte > 0.9) fator(i, 0.94);
      } else if (mat === "janela") {
        // o vidro: mais claro em cima, o reflexo na diagonal
        const lx = x % Math.round(kx * 3);
        const ly = y % Math.round(ky * 3);
        if ((lx + ly) % 9 === 0) { d[i] = 255; d[i + 1] = 252; d[i + 2] = 230; }
        else if (ly < 2) fator(i, 1.06);
        else fator(i, 0.96);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return hd;
}

// a construção ampliada e detalhada (no lugar do ampliadoHD para casas, torres, lugares...)
function construcaoHD(base, semente, textura = 0.05) {
  return detalharConstrucao(ampliadoHD(base, semente, textura), base);
}

const cacheHD = {};
// os desenhos que agora saem sempre do código (as imagens salvas são de antes do detalhe)
const SEMPRE_DO_CODIGO = /^(construcao-|lugar-)/;
// um desenho do cenário em alta resolução: a imagem salva, se houver; senão, gerado pelo código (e guardado)
function spriteHD(nome, gerar) {
  const base = (!SEMPRE_DO_CODIGO.test(nome) && CENARIO_SALVO.sprites[nome]) || (cacheHD[nome] ||= gerar());
  // (exportando as imagens, sai o desenho cru: o acabamento é posto na hora de usar)
  return regerandoCenario ? base : acabamentoDoCenario(base);
}

// ---------- o acabamento do cenário (o mesmo cuidado dos monstros do bestiário) ----------
// Árvores, pedras, casas, ruínas e móveis ganham: a luz descendo do alto à esquerda em 6 tons, com o
// pontilhado de pixel na passagem de um tom para o outro (o volume da peça inteira); um fio de luz quente na
// borda iluminada (recorta a peça do chão); e a sombra de contato no pé (a peça "pisa" no chão). O contorno
// escuro fica como está. Feito uma vez por desenho (guardado), sem mexer no desenho original.
const cenarioAcabado = new WeakMap();
const TONS_CENARIO = [0.68, 0.79, 0.9, 1, 1.08, 1.16];
function acabamentoDoCenario(origem) {
  if (!origem || origem.personagem || origem.acabado) return origem;
  if (cenarioAcabado.has(origem)) return cenarioAcabado.get(origem);
  const w = origem.width;
  const h = origem.height;
  // (chão e paredes inteiras não: só as peças)
  if (!w || !h || w * h > 420 * 420) return origem;
  const { canvas, ctx } = criarTela(w, h);
  ctx.drawImage(origem, 0, 0);
  const imagem = ctx.getImageData(0, 0, w, h);
  const px = imagem.data;
  const alfa = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : px[(y * w + x) * 4 + 3]);
  let x0 = w;
  let x1 = -1;
  let y0 = h;
  let y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!px[(y * w + x) * 4 + 3]) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (x1 < 0) {
    cenarioAcabado.set(origem, origem);
    return origem;
  }
  const larg = Math.max(1, x1 - x0);
  const alt = Math.max(1, y1 - y0);
  const BAYER = [[0, 2], [3, 1]];
  const original = new Uint8ClampedArray(px);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      if (original[i + 3] < 200) continue;
      const r = original[i];
      const g = original[i + 1];
      const b = original[i + 2];
      // o contorno escuro e os brancos (vidro, neve brilhando) ficam como estão
      if (r + g + b < 90 || (r > 235 && g > 235 && b > 235)) continue;
      const nx = (x - x0) / larg;
      const ny = (y - y0) / alt;
      const v = 0.55 - nx * 0.45 - ny * 0.8;
      let fator = TONS_CENARIO[Math.max(0, Math.min(5, Math.round(3 + v * 2.3 + (BAYER[y & 1][x & 1] - 1.5) * 0.28)))];
      // a sombra de contato: as últimas linhas da peça escurecem
      if (y1 - y < 3 && alt > 10) fator *= 0.8;
      let soma = [fator > 1 ? 5 : 0, fator > 1 ? 3 : 0, fator < 1 ? 6 : 0];
      // o fio de luz: a borda de cima ou da esquerda, encostada no vazio, do lado iluminado
      if (v > -0.15 && (alfa(x, y - 1) < 100 || alfa(x - 1, y) < 100)) {
        fator = Math.max(fator, 1.1);
        soma = [16, 12, 4];
      }
      px[i] = Math.min(255, r * fator + soma[0]);
      px[i + 1] = Math.min(255, g * fator + soma[1]);
      px[i + 2] = Math.min(255, b * fator + soma[2]);
    }
  }
  ctx.putImageData(imagem, 0, 0);
  canvas.res = origem.res;
  canvas.acabado = true;
  cenarioAcabado.set(origem, canvas);
  return canvas;
}

function tilesetHD() {
  return CENARIO_SALVO.tileset || (cacheHD["#tileset"] ||= gerarTilesetChao());
}

// a lista de tudo que vira imagem: nome no manifesto → como gerar
function listaDoCenarioHD() {
  const lista = {};
  Object.keys(SPRITES_DECORACAO).forEach((tipo) => { lista[`decoracao-${tipo}`] = () => decoracaoHD(tipo); });
  const vistas = new Set();
  CONSTRUCOES.forEach(([tipo, , , , , extra]) => {
    const nome = nomeConstrucaoHD(tipo, extra);
    if (vistas.has(nome)) return;
    vistas.add(nome);
    lista[nome] = () => ampliadoHD(SPRITES_CONSTRUCAO[tipo](extra), nome.length * 13);
  });
  Object.keys(TAMANHO_LUGARES).forEach((id) => { lista[`lugar-${id}`] = () => ampliadoHD(spriteLugar(id), id.length * 31, 0.05); });
  lista["estatua-arquimago"] = () => dobradoHD(spriteEstatuaArquimago(), 5, 0.03);
  [true, false].forEach((resolvido) => {
    lista[`runa-${resolvido ? "apagada" : "acesa"}`] = () => dobradoHD(SPRITES_PONTOS.runa(resolvido), 7);
    lista[`bau-${resolvido ? "aberto" : "fechado"}`] = () => dobradoHD(SPRITES_PONTOS.bau(resolvido), 9);
  });
  lista.placa = () => dobradoHD(SPRITES_PONTOS.placa(), 11);
  // as salas: monta cada uma (com dados de mentira, só para os desenhos existirem e serem convertidos)
  montarSalasParaExportar();
  DESENHOS_DAS_SALAS.forEach((hd, nome) => { lista[nome] = () => hd; });
  return lista;
}

function montarSalasParaExportar() {
  const salas = [];
  const tentar = (montar) => {
    try {
      salas.push(montar());
    } catch (erro) {
      console.warn("Sala não exportada:", erro.message);
    }
  };
  tentar(() => cenarioLobby({ origem: "portoes", alunos: [], portas: [] }));
  (typeof PROFESSORES !== "undefined" ? Object.values(PROFESSORES) : []).forEach((professor) => tentar(() => cenarioSala({ origem: "porta", licoes: [], professor })));
  tentar(() => cenarioBiblioteca({ origem: "porta", estantes: [] }));
  tentar(() => cenarioCarreira({ origem: "porta", guias: [], mentora: { nome: "", visual: AVATAR_PADRAO } }));
  tentar(() => cenarioEstalagem({ fregueses: [], menestrel: { nome: "", visual: AVATAR_PADRAO }, estalajadeiro: { nome: "", avatar: AVATAR_PADRAO } }));
  tentar(() => cenarioMercado({ itens: [], mercadora: { nome: "", visual: AVATAR_PADRAO }, avatarAluno: AVATAR_PADRAO }));
  return salas;
}

function nomeConstrucaoHD(tipo, extra) {
  return `construcao-${tipo}${extra ? `-${String(extra).replace("#", "")}` : ""}`;
}

// Ferramenta de desenvolvimento: gera tudo pelo código e salva os PNGs + o manifesto na pasta do jogo
// (o servidor só aceita isso rodando em modo debug, no próprio computador).
async function exportarCenarioHD() {
  const enviar = async (arquivo, corpo, tipo) => {
    const r = await fetch(`/dev/cenario/${arquivo}`, { method: "POST", headers: { "Content-Type": tipo }, body: corpo });
    if (!r.ok) throw new Error(`${arquivo}: ${r.status}`);
  };
  const png = (canvas) => new Promise((r) => canvas.toBlob(r, "image/png"));
  regerandoCenario = true;
  DESENHOS_DAS_SALAS.clear();
  const tileset = gerarTilesetChao();
  await enviar("chao-tiles.png", await png(tileset.imagem), "image/png");
  // todos os desenhos numa folha só: o jogo baixa 2 imagens em vez de dezenas
  const desenhos = Object.fromEntries(Object.entries(listaDoCenarioHD()).map(([nome, gerar]) => [nome, gerar()]));
  regerandoCenario = false;
  const folha = montarFolha(desenhos);
  await enviar("cenario-desenhos.png", await png(folha.canvas), "image/png");
  const manifesto = {
    versao: Date.now(), resolucao: RESOLUCAO_REINO,
    tileset: { arquivo: "chao-tiles.png", colunas: tileset.colunas, nomes: tileset.nomes },
    folha: { arquivo: "cenario-desenhos.png", desenhos: folha.posicoes },
  };
  await enviar("manifesto.json", JSON.stringify(manifesto), "application/json");
  return `${Object.keys(desenhos).length} desenhos (folha ${folha.canvas.width}×${folha.canvas.height}) + tileset de ${tileset.nomes.length} tiles salvos em ${PASTA_CENARIO}`;
}
