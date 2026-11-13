// Motor de mundos em pixel art: o herói anda, a câmera segue e dá para entrar em lugares e falar com pessoas.
// O Reino, o lobby da Academia e a sala do Zetsu são "cenários" que usam este mesmo motor.
//
// montarMundo(container, cenario, dados) devolve { destruir }.
//   cenario: {
//     colunas, linhas, chao (canvas do chão já pintado), corFundo,
//     andavel(tx, ty)                        terreno onde dá para pisar
//     props: [{ x, y, sprite, balanco }]     árvores, móveis... (x, y = base no chão, em pixels)
//            { x, y, porCima: true, animar }  algo que voa: sem sprite, desenhado por cima de tudo
//     lugares: [{ id, nome, icone, px, py, sprite, liberada, vencida, acao, animar(ctx, x, y, t), tilesBloqueados }]
//              com visual + passeia (raio em pixels), o morador anda devagar perto de casa e para quando
//              o herói chega perto (e não bloqueia tiles: dá para passar por ele)
//     monstros: [...] (opcional, só no Reino), spawn: { x, y }, animarChao(ctx, camera, w, h, t) (opcional)
//     animarPorCima(ctx, camera, w, h, t) (opcional): desenhado por cima de tudo (névoa, barreiras...)
//   }
//   barreira(tx, ty) (opcional): região trancada naquele tile, que o herói não atravessa
//   dados: { avatar, posicao, aoMover(pos), aoEntrar(lugar), aoEncontro(monstro), aoBarreira(regiao) }
// Depende de pixel.js, avatar.js (familiarCanvas) e heroi.js (spritesHeroi).

const TILE_MUNDO = 16;

// ---------- animação de andar dos monstros ----------
// Os quadros saem do próprio desenho do monstro: quem tem patas abre e fecha as pernas com o corpo
// subindo um pixel; slimes, fantasmas e chamas se achatam e se esticam; quem voa bate as asas.
function estiloDeAndar(m) {
  const id = m.tipoId || "";
  if (/morcego|dragao|ignis/.test(id)) return "asas";
  if (/lobo|fenrir|escorpiao|esqueleto|sapo/i.test(id)) return "patas";
  return "quique";
}

const cacheAndar = new WeakMap();
function quadrosDeAndar(sprite, estilo) {
  let porEstilo = cacheAndar.get(sprite);
  if (!porEstilo) cacheAndar.set(sprite, (porEstilo = {}));
  if (porEstilo[estilo]) return porEstilo[estilo];
  const w = sprite.width;
  const h = sprite.height;
  const quadro = (desenhar) => {
    const { canvas, ctx } = criarTela(w, h + 2);
    ctx.imageSmoothingEnabled = false;
    desenhar(ctx);
    return canvas;
  };
  let quadros;
  if (estilo === "patas") {
    // as pernas são o pedaço de baixo; cada metade (patas da frente e de trás) vai para um lado
    const corte = Math.round(h * 0.7);
    const pernas = h - corte;
    const passo = Math.max(1, Math.round(w / 30));
    quadros = [0, 1, 0, -1].map((lado, i) => quadro((c) => {
      const sobe = i % 2 ? 1 : 0;
      c.drawImage(sprite, 0, 0, w, corte, 0, 2 - sobe, w, corte);
      c.drawImage(sprite, 0, corte, w / 2, pernas, -lado * passo, corte + 2, w / 2, pernas);
      c.drawImage(sprite, w / 2, corte, w / 2, pernas, w / 2 + lado * passo, corte + 2, w / 2, pernas);
    }));
  } else if (estilo === "asas") {
    // bater de asas: o corpo encolhe e estica na vertical
    quadros = [1, 0.8, 1, 1.1].map((k) => quadro((c) => {
      const nh = Math.round(h * Math.min(k, (h + 2) / h));
      c.drawImage(sprite, 0, 0, w, h, 0, h + 2 - nh, w, nh);
    }));
  } else {
    // quique: achata (mais largo e baixo), normal, estica (mais fino e alto), normal
    quadros = [[1.1, 0.85], [1, 1], [0.92, 1.1], [1, 1]].map(([kx, ky]) => quadro((c) => {
      const nw = Math.round(w * Math.min(kx, 1));
      const nh = Math.round(h * Math.min(ky, (h + 2) / h));
      c.drawImage(sprite, 0, 0, w, h, Math.round((w - nw) / 2), h + 2 - nh, nw, nh);
    }));
  }
  porEstilo[estilo] = quadros;
  return quadros;
}

// Aura da classe em volta do herói, que cresce com o caminho da classe (aura: { rgb, degrau }).
// Atrás do sprite: o brilho no chão; na frente: faíscas subindo (degrau 3) e runas girando (degrau 4).
// (degrau 2: o brilho e o anel pontilhado no chão; 3: as estrelinhas de quatro pontas subindo; 4: as runas
// girando em volta, com o rastro, e o segundo anel)
function desenharAura(ctx, { rgb, degrau }, t, naFrente) {
  if (degrau < 2) return;
  if (!naFrente) {
    brilhoRedondo(ctx, 0, -17, 16 + degrau * 2, rgb, 0.05 + Math.sin(t * 3) * 0.02 + degrau * 0.015);
    // os anéis de energia no chão, saindo dos pés e se abrindo (em pixel, pontilhados)
    for (let anel = 0; anel < (degrau >= 4 ? 2 : 1); anel++) {
      const k = (t * 0.6 + anel * 0.5) % 1;
      const raio = 7 + k * 9;
      ctx.fillStyle = `rgba(${rgb}, ${(1 - k) * 0.85})`;
      for (let a = 0; a < 40; a++) {
        if ((a + Math.floor(t * 8)) % 3 === 0) continue;
        const ang = (a / 40) * Math.PI * 2;
        ctx.fillRect(Math.round(Math.cos(ang) * raio), Math.round(Math.sin(ang) * raio * 0.32), 1, 1);
      }
    }
    return;
  }
  if (degrau >= 3) {
    for (let i = 0; i < 5; i++) {
      const vida = (t * 0.7 + i / 5) % 1;
      const x = Math.round(Math.sin(i * 2.3 + t * 0.8) * 12);
      const y = Math.round(-4 - vida * 44);
      estrelinhaDeLuz(ctx, x, y, rgb, Math.sin(vida * Math.PI), i % 2 ? 1 : 2);
    }
  }
  if (degrau >= 4) {
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + (i * Math.PI * 2) / 3;
      // o rastro da runa: três pontos mais fracos atrás dela
      for (let r = 3; r >= 0; r--) {
        const ar = a - r * 0.18;
        const x = Math.round(Math.cos(ar) * 15);
        const y = Math.round(-20 + Math.sin(ar) * 5);
        ctx.fillStyle = `rgba(${rgb}, ${r === 0 ? 1 : 0.5 - r * 0.12})`;
        if (r === 0) {
          // a runa: um losango de 3 x 3 com o miolo branco
          ctx.fillRect(x - 1, y, 3, 1);
          ctx.fillRect(x, y - 1, 1, 3);
          ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
          ctx.fillRect(x, y, 1, 1);
        } else ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}

// As auras de visual (as que se ganham ou compram: estrelas, chamas, raios, gelo, folhas, círculo arcano e
// vazio), animadas em volta do herói. A origem é o pé do herói, em pixels do desenho dele (o corpo vai de
// x -14 a 14 e de y -44 a 0). "naFrente" separa o que passa atrás do corpo do que passa na frente: o que
// gira em volta (estrelas, cristais, folhas) troca de camada conforme o lado da órbita.
function desenharAuraVisual(ctx, tipo, t, naFrente) {
  const ponto = (x, y, rgb, a, lado = 1) => {
    if (a <= 0.03) return;
    ctx.fillStyle = `rgba(${rgb}, ${Math.min(1, a)})`;
    ctx.fillRect(Math.round(x), Math.round(y), lado, lado);
  };
  // um número "aleatório" fixo para cada partícula (o mesmo a cada quadro)
  const sorte = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const orbita = (n, velocidade, rx, ry, cy, desenhar) => {
    for (let i = 0; i < n; i++) {
      const a = t * velocidade + (i * Math.PI * 2) / n;
      const frente = Math.sin(a) > 0;
      if (frente !== naFrente) continue;
      desenhar(Math.cos(a) * rx, cy + Math.sin(a) * ry + Math.sin(t * 2 + i) * 2, i, Math.sin(a));
    }
  };
  if (tipo === "estrelas") {
    if (!naFrente) brilhoRedondo(ctx, 0, -20, 20, "255, 220, 140", 0.06 + Math.sin(t * 2) * 0.02);
    orbita(8, 1.4, 21, 6, -24, (x, y, i, prof) => estrelinhaDeLuz(ctx, Math.round(x), Math.round(y), "255, 225, 140", 0.75 + prof * 0.25 + Math.sin(t * 7 + i) * 0.15, i % 2 ? 1 : 2));
    if (naFrente) {
      for (let i = 0; i < 9; i++) {
        const k = (t * 0.45 + sorte(i)) % 1;
        ponto(-18 + sorte(i + 9) * 36 + Math.sin(t * 3 + i) * 1.5, -46 + k * 46, k < 0.5 ? "255, 255, 255" : "255, 209, 102", Math.sin(k * Math.PI));
      }
    }
    return;
  }
  if (tipo === "chamas") {
    // línguas de fogo espectral subindo dos pés: verde-água na base, ciano no meio e a ponta branca
    const cores = ["47, 214, 232", "125, 255, 208", "230, 255, 250"];
    const colunas = naFrente ? [-18, -16, -14, 14, 16, 18] : [-17, -14, -11, -8, -5, -2, 1, 4, 7, 10, 13, 16];
    if (!naFrente) brilhoRedondo(ctx, 0, -16, 22, "80, 240, 210", 0.08 + Math.sin(t * 5) * 0.03);
    colunas.forEach((x, i) => {
      const altura = (naFrente ? 12 : 22) + Math.sin(t * 7 + i * 1.9) * 6 + Math.sin(t * 13 + i) * 3;
      for (let y = 0; y < altura; y++) {
        const k = y / altura;
        const balanca = Math.round(Math.sin(t * 9 + i + y * 0.4) * k * 1.5);
        ponto(x + balanca, -y, cores[Math.min(2, Math.floor(k * 3))], (naFrente ? 0.85 : 0.75) * (1 - k * 0.5), y < altura * 0.5 ? 2 : 1);
      }
    });
    if (naFrente) {
      for (let i = 0; i < 5; i++) {
        const k = (t * 0.8 + sorte(i)) % 1;
        ponto(-10 + sorte(i + 3) * 20 + Math.sin(t * 4 + i) * 3, -6 - k * 40, "180, 255, 230", 1 - k);
      }
    }
    return;
  }
  if (tipo === "raios") {
    if (!naFrente) {
      brilhoRedondo(ctx, 0, -20, 22, "255, 230, 120", 0.05 + (Math.sin(t * 23) > 0.6 ? 0.08 : 0));
      return;
    }
    // os raios mudam de forma 9 vezes por segundo: zigue-zague saindo do corpo
    const semente = Math.floor(t * 9);
    for (let r = 0; r < 3; r++) {
      if (sorte(semente * 3 + r) < 0.2) continue;
      const lado = sorte(semente + r * 7) < 0.5 ? -1 : 1;
      let x = lado * (11 + sorte(semente + r) * 4);
      let y = -10 - sorte(semente * 5 + r) * 34;
      for (let s = 0; s < 8; s++) {
        const nx = x + lado * (1.5 + sorte(semente + s * 11 + r) * 2.5);
        const ny = y + (sorte(semente * 2 + s + r * 5) - 0.35) * 5;
        const passos = Math.ceil(Math.hypot(nx - x, ny - y));
        for (let p = 0; p <= passos; p++) {
          const px = x + ((nx - x) * p) / passos;
          const py = y + ((ny - y) * p) / passos;
          ponto(px, py - 1, "255, 220, 90", 0.7);
          ponto(px, py, "255, 255, 255", 1);
        }
        x = nx;
        y = ny;
      }
    }
    orbita(4, 3, 20, 6, -26, (x, y) => ponto(x, y, "255, 240, 150", 1, 2));
    return;
  }
  if (tipo === "gelo") {
    if (!naFrente) {
      brilhoRedondo(ctx, 0, -18, 20, "160, 215, 255", 0.07);
      // a geada no chão: um anel de cristais que brilham um de cada vez
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        const brilho = Math.max(0, Math.sin(t * 3 - i * 0.7));
        ponto(Math.cos(a) * 19, Math.sin(a) * 5.5, brilho > 0.9 ? "255, 255, 255" : "180, 225, 255", 0.35 + brilho * 0.6);
      }
    }
    // os cacos de gelo orbitando
    orbita(3, 1.1, 21, 6, -26, (x, y) => {
      ponto(x, y - 2, "230, 248, 255", 0.95);
      ponto(x - 1, y - 1, "160, 215, 255", 0.9);
      ponto(x, y - 1, "255, 255, 255", 1);
      ponto(x + 1, y - 1, "120, 180, 255", 0.9);
      ponto(x, y, "160, 215, 255", 0.9);
      ponto(x, y + 1, "120, 180, 255", 0.8);
    });
    if (naFrente) {
      // os flocos caindo devagar
      for (let i = 0; i < 11; i++) {
        const k = (t * 0.25 + sorte(i)) % 1;
        const x = -20 + sorte(i + 4) * 40 + Math.sin(t * 1.5 + i) * 3;
        const y = -50 + k * 50;
        const a = Math.sin(k * Math.PI);
        ponto(x, y, "255, 255, 255", a);
        if (i % 2) {
          ponto(x - 1, y, "200, 230, 255", a * 0.6);
          ponto(x + 1, y, "200, 230, 255", a * 0.6);
          ponto(x, y - 1, "200, 230, 255", a * 0.6);
          ponto(x, y + 1, "200, 230, 255", a * 0.6);
        }
      }
    }
    return;
  }
  if (tipo === "folhas") {
    // folhas e pétalas subindo em espiral em volta do corpo
    const cores = ["125, 230, 110", "190, 255, 140", "255, 175, 205", "90, 210, 120", "255, 214, 102"];
    for (let i = 0; i < 14; i++) {
      const k = (t * 0.35 + i / 14) % 1;
      const a = t * 2.2 + i * 2.1;
      if ((Math.sin(a) > 0) !== naFrente) continue;
      const x = Math.cos(a) * (17 + k * 6);
      const y = -2 - k * 50;
      const forca = Math.sin(k * Math.PI);
      const cor = cores[i % cores.length];
      const vira = Math.floor(t * 6 + i) % 2;
      // o contorno escuro embaixo, para a folha não sumir na grama
      ponto(x - 1, y + 2, "20, 40, 18", forca * 0.8, 3);
      ponto(x, y, cor, forca, 2);
      ponto(x + (vira ? 2 : 0), y + (vira ? 0 : 2), cor, forca * 0.8);
      ponto(x - 1, y - (vira ? 1 : 0), "220, 255, 200", forca * 0.4);
    }
    if (!naFrente) brilhoRedondo(ctx, 0, -14, 18, "120, 220, 120", 0.05);
    return;
  }
  if (tipo === "arcana") {
    if (!naFrente) {
      // o círculo arcano no chão: dois anéis, o hexagrama e as runas, achatados pela perspectiva
      const cor = "169, 139, 255";
      const pulso = 0.6 + Math.sin(t * 2.5) * 0.25;
      brilhoRedondo(ctx, 0, -2, 20, cor, 0.08 * pulso + 0.04);
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2 + t * 0.5;
        if (i % 4) ponto(Math.cos(a) * 18, Math.sin(a) * 6, cor, pulso);
        ponto(Math.cos(-a) * 14, Math.sin(-a) * 4.7, cor, i % 2 ? pulso * 0.7 : 0);
      }
      for (let tri = 0; tri < 2; tri++) {
        const v = [0, 1, 2].map((n) => {
          const a = t * 0.5 + tri * Math.PI + (n * Math.PI * 2) / 3;
          return [Math.cos(a) * 14, Math.sin(a) * 4.7];
        });
        for (let n = 0; n < 3; n++) {
          const [x0, y0] = v[n];
          const [x1, y1] = v[(n + 1) % 3];
          for (let s = 0; s <= 12; s++) ponto(x0 + ((x1 - x0) * s) / 12, y0 + ((y1 - y0) * s) / 12, cor, pulso * 0.55);
        }
      }
      for (let i = 0; i < 8; i++) {
        const a = -t * 0.8 + (i / 8) * Math.PI * 2;
        const x = Math.cos(a) * 21;
        const y = Math.sin(a) * 7;
        const brilho = 0.5 + 0.5 * Math.sin(t * 5 + i);
        ponto(x, y - 1, "255, 255, 255", brilho);
        ponto(x - 1, y, cor, brilho);
        ponto(x + 1, y, cor, brilho);
      }
      return;
    }
    // os glifos que sobem do círculo
    for (let i = 0; i < 4; i++) {
      const k = (t * 0.5 + i / 4) % 1;
      const x = Math.round(Math.cos(i * 1.7 + t * 0.3) * 13);
      const y = Math.round(-2 - k * 40);
      const a = Math.sin(k * Math.PI);
      [[0, 0], [1, 0], [0, 1], [1, 2], [0, 2]].forEach(([dx, dy]) => ponto(x + dx, y + dy, i % 2 ? "205, 185, 255" : "255, 255, 255", a));
    }
    return;
  }
  if (tipo === "vazio") {
    if (!naFrente) {
      // a fumaça escura em volta dos pés, ondulando
      for (let i = 0; i < 7; i++) {
        const a = t * 0.7 + i;
        ctx.fillStyle = `rgba(20, 8, 40, ${0.28 + Math.sin(t * 2 + i) * 0.08})`;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 12, -2 + Math.sin(a) * 2.5, 7, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      brilhoRedondo(ctx, 0, -20, 22, "120, 60, 200", 0.07);
      return;
    }
    // os pontos do vazio sendo puxados em espiral para dentro do herói
    for (let i = 0; i < 18; i++) {
      const k = (t * 0.5 + sorte(i)) % 1;
      const a = sorte(i + 5) * Math.PI * 2 + k * 5;
      const raio = 30 * (1 - k);
      const x = Math.cos(a) * raio;
      const y = -20 + Math.sin(a) * raio * 0.6;
      ponto(x, y, i % 3 ? "192, 139, 255" : "255, 255, 255", k, i % 4 ? 1 : 2);
      ponto(x + 1, y, "40, 10, 80", k * 0.7);
    }
    return;
  }
}

// A aura de visual também na batalha: dois canvases em volta do <img> do herói (um atrás, um na frente),
// do tamanho do desenho dele e esticados junto com ele, animados enquanto estiverem na página.
function auraNaBatalha(ator, avatar) {
  const tipo = avatar?.aura;
  const img = ator?.querySelector("img");
  if (!tipo || tipo === "simples" || !img) return;
  const montar = () => {
    if (!img.naturalWidth || !img.isConnected) return;
    ator.querySelectorAll(".aura-batalha").forEach((c) => c.remove());
    const escala = img.clientWidth / img.naturalWidth;
    const W = img.naturalWidth + 40;
    const H = img.naturalHeight + 24;
    const camadas = [false, true].map((naFrente) => {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      c.className = `aura-batalha ${naFrente ? "frente" : "atras"}`;
      Object.assign(c.style, {
        width: `${W * escala}px`, height: `${H * escala}px`,
        left: `${img.offsetLeft + img.clientWidth / 2 - (W / 2) * escala}px`,
        top: `${img.offsetTop + img.clientHeight - (H - 8) * escala}px`,
      });
      ator.append(c);
      return c;
    });
    const inicio = performance.now();
    let ultimo = 0;
    const quadro = (agora) => {
      if (!camadas[0].isConnected) return;
      requestAnimationFrame(quadro);
      if (agora - ultimo < 33) return;
      ultimo = agora;
      const t = (agora - inicio) / 1000;
      camadas.forEach((c, i) => {
        const g = c.getContext("2d");
        g.clearRect(0, 0, W, H);
        g.save();
        g.translate(W / 2, H - 8);
        desenharAuraVisual(g, tipo, t, i === 1);
        g.restore();
      });
    };
    requestAnimationFrame(quadro);
  };
  if (img.complete) requestAnimationFrame(montar);
  else img.addEventListener("load", montar, { once: true });
}

// uma estrelinha de quatro pontas (o brilho de pixel art): o miolo branco e as pontas na cor; "forca" de 0 a 1
function estrelinhaDeLuz(ctx, x, y, rgb, forca, tamanho = 1) {
  if (forca <= 0.05) return;
  ctx.fillStyle = `rgba(${rgb}, ${forca})`;
  for (let i = 1; i <= tamanho; i++) {
    ctx.fillRect(x - i, y, 1, 1);
    ctx.fillRect(x + i, y, 1, 1);
    ctx.fillRect(x, y - i, 1, 1);
    ctx.fillRect(x, y + i, 1, 1);
  }
  ctx.fillStyle = `rgba(255, 255, 255, ${forca})`;
  ctx.fillRect(x, y, 1, 1);
}

// os emotes dos mascotes parados (o: contorno, w: brilho, o resto na cor do emote)
const EMOTES_PIXEL = {
  coracao: { cor: "#ff5a7a", grade: [".oo.oo.", "oxwoxxo", "oxxxxxo", ".oxxxo.", "..oxo..", "...o..."] },
  nota: { cor: "#ffd166", grade: ["...oooo", "...oxxo", "...ox.o", ".oooxo.", "oxxxxo.", "oxxxo..", ".ooo..."] },
  alerta: { cor: "#ffd166", grade: [".ooo.", ".oxo.", ".oxo.", ".oxo.", ".ooo.", ".oxo.", ".ooo."] },
  estrela: { cor: "#fff3b0", grade: ["...o...", "..oxo..", "ooxwxoo", ".oxxxo.", ".oxoxo.", ".o...o."] },
  zzz: { cor: "#c9d6ff", grade: ["xxxx...", "..x....", ".x.....", "xxxx...", "....xxx", ".....x.", "....xxx"] },
};
const EMOTES_DO_MASCOTE = {
  gato: ["coracao", "zzz"], raposa: ["nota", "coracao"], coruja: ["alerta", "estrela"], golem: ["estrela", "alerta"],
  fenix: ["nota", "estrela"], slime: ["coracao", "nota"], coelho: ["coracao", "nota"], lobo: ["alerta", "coracao"],
  lume: ["estrela", "nota"], tartaruga: ["zzz", "estrela"], cristal: ["estrela", "coracao"], dragao: ["coracao", "alerta"],
};
// a magia que cada mascote solta (parado e voando)
const RASTRO_DO_MASCOTE = {
  coelho: ["#fff3b0", "#ffffff"], lume: ["#6ef0ff", "#2fd6e8", "#e6fdff"], cristal: ["#ffffff", "#9fe8ff", "#ff9ad8"],
  tartaruga: ["#6ef0ff", "#9fffe0"], fenix: ["#ffd166", "#ff7a1a"],
};

function montarMundo(container, cenario, dados) {
  const { colunas, linhas } = cenario;
  const bloqueado = new Set();
  cenario.lugares.forEach((l) => !l.passeia && (l.tilesBloqueados || []).forEach((t) => bloqueado.add(t)));
  (cenario.props || []).forEach((p) => (p.tilesBloqueados || []).forEach((t) => bloqueado.add(t)));
  const andavel = (tx, ty) => tx >= 0 && ty >= 0 && tx < colunas && ty < linhas && cenario.andavel(tx, ty) && !bloqueado.has(`${tx},${ty}`);
  const andavelPx = (x, y) => andavel(Math.floor(x / TILE_MUNDO), Math.floor(y / TILE_MUNDO));
  // barreira(tx, ty) (opcional): devolve a região trancada daquele tile; só o herói é barrado
  const barreiraPx = (x, y) => (cenario.barreira ? cenario.barreira(Math.floor(x / TILE_MUNDO), Math.floor(y / TILE_MUNDO)) : null);
  const andavelHeroi = (tx, ty) => andavel(tx, ty) && !(cenario.barreira && cenario.barreira(tx, ty));
  let ultimoAvisoBarreira = 0;
  function heroiPodePisar(x, y) {
    if (!andavelPx(x, y)) return false;
    const regiao = barreiraPx(x, y);
    if (!regiao) return true;
    if (performance.now() - ultimoAvisoBarreira > 3000) {
      ultimoAvisoBarreira = performance.now();
      dados.aoBarreira?.(regiao);
    }
    return false;
  }

  // herói e mascote
  const heroi = { x: cenario.spawn.x, y: cenario.spawn.y, direcao: "baixo", andando: false };
  if (dados.posicao && andavelPx(dados.posicao.x, dados.posicao.y) && !barreiraPx(dados.posicao.x, dados.posicao.y)) Object.assign(heroi, { x: dados.posicao.x, y: dados.posicao.y });
  const sprites = spritesHeroi(dados.avatar);
  const quadrosFamiliar = typeof familiarQuadros === "function" ? familiarQuadros(dados.avatar) : null;
  const spriteFamiliar = quadrosFamiliar?.[0] || familiarCanvas(dados.avatar);
  const corridaFamiliar = typeof familiarCorrida === "function" ? familiarCorrida(dados.avatar) : null;
  let ultimoRastroMascote = 0;
  const familiar = { x: heroi.x - 12, y: heroi.y };

  // Resolução: quantos pixels de desenho cabem em cada unidade do mundo (o tile tem 16 unidades).
  // Com 2, o tile vira 32 × 32 pixels de verdade, e herói, moradores e monstros são desenhados no
  // tamanho nativo (1 pixel do desenho = 1 pixel da tela de desenho), como num RPG de 32 px.
  // Cenários com 1 (a Academia e as salas) ficam como sempre foram.
  const R = cenario.resolucao || 1;
  // gente (herói, moradores, monstros) pode ter outra resolução: nas salas os personagens continuam no
  // tamanho de antes (o "close" de dentro dos prédios), mesmo com o cenário em alta resolução
  const RP = cenario.resolucaoPersonagens || R;
  const arred = (v) => Math.round(v * R) / R; // posição alinhada ao pixel de desenho
  // tamanho no mundo de um desenho: cenário em alta resolução traz "res" no próprio canvas/imagem
  const larg = (img, res = img.res || 1) => img.width / res;
  const alt = (img, res = img.res || 1) => img.height / res;
  // moradores (com visual) são gente: desenhados no tamanho nativo, como o herói
  cenario.lugares.forEach((l) => { l.res = l.visual || l.sprite?.personagem ? RP : (l.sprite?.res || 1); });
  // O zoom é o TAMANHO DO HERÓI na tela (pixels da tela por pixel do desenho dele), igual em todo mapa:
  // no Reino a gente é desenhada com o dobro de resolução (RP = 2) e nas salas no tamanho nativo (RP = 1),
  // então a escala da câmera (pixels da tela por unidade do mundo) é zoom × RP. Assim o herói tem o mesmo
  // tamanho no Reino, na Academia e nas lojas, e o zoom escolhido na rodinha vale para todos.
  const ZOOMS = [1, 1.5, 2, 3];
  const CHAVE_ZOOM = "academia-zetsu-zoom-heroi";
  const zoomPadrao = container.clientWidth < 700 ? 1 : container.clientWidth >= 2200 && container.clientHeight >= 1200 ? 2 : 1.5;
  let zoom = zoomPadrao;
  try { zoom = ZOOMS.includes(Number(localStorage.getItem(CHAVE_ZOOM))) ? Number(localStorage.getItem(CHAVE_ZOOM)) : zoomPadrao; } catch {}
  let escala = zoom * RP; // pixels da tela por unidade do mundo
  let escalaTela = escala / R; // pixels da tela por pixel de desenho
  const canvas = document.createElement("canvas");
  canvas.className = "pixel tela-reino";
  container.append(canvas);
  const ctx = canvas.getContext("2d");
  const camada = document.createElement("div");
  camada.className = "reino-camada";
  container.append(camada);
  function redimensionar() {
    canvas.width = Math.ceil(container.clientWidth / escalaTela);
    canvas.height = Math.ceil(container.clientHeight / escalaTela);
    ctx.imageSmoothingEnabled = false;
  }
  redimensionar();
  const observador = new ResizeObserver(redimensionar);
  observador.observe(container);
  let ultimoZoom = 0;
  container.addEventListener("wheel", (e) => {
    if (e.ctrlKey) return; // ctrl + rodinha (ou pinça no touchpad) continua sendo o zoom da página
    e.preventDefault();
    if (performance.now() - ultimoZoom < 140) return; // touchpads mandam dezenas de eventos por gesto
    const atual = ZOOMS.reduce((perto, z, i) => (Math.abs(z - zoom) < Math.abs(ZOOMS[perto] - zoom) ? i : perto), 0);
    const novo = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, atual + (e.deltaY < 0 ? 1 : -1)))];
    if (novo === zoom) return;
    ultimoZoom = performance.now();
    zoom = novo;
    escala = zoom * RP;
    escalaTela = escala / R;
    redimensionar();
    try { localStorage.setItem(CHAVE_ZOOM, String(zoom)); } catch {}
  }, { passive: false });

  // rótulos dos lugares e aviso de entrada (HTML por cima do canvas: texto nítido e clicável)
  cenario.lugares.forEach((l) => {
    if (l.semRotulo) return;
    const el = document.createElement("button");
    el.type = "button";
    el.className = `rotulo-reino ${l.liberada === false ? "bloqueado" : ""} ${l.vencida ? "vencido" : ""} ${l.destaque ? "destaque" : ""}`;
    el.innerHTML = `${l.liberada === false ? "🔒" : l.vencida ? "🏆" : l.icone || ""} ${l.nome}`;
    el.addEventListener("click", () => irAte(l, true));
    camada.append(el);
    l.rotulo = el;
  });
  // o nome e o título do herói flutuando em cima dele (o título evolui com o caminho da classe)
  const plaquinha = document.createElement("div");
  plaquinha.className = "plaquinha-heroi";
  plaquinha.innerHTML = `${dados.tituloHeroi || ""}<b>${(dados.nomeHeroi || "").replace(/[<>&]/g, "")}</b>`;
  if (dados.nomeHeroi) camada.append(plaquinha);
  const aviso = document.createElement("button");
  aviso.type = "button";
  aviso.className = "aviso-entrar";
  aviso.hidden = true;
  camada.append(aviso);

  // ---------- controles ----------
  const teclas = new Set();
  let caminho = [];
  let entrarAoChegar = null;
  let perto = null;
  let pausado = false;
  // Menu, mochila, Livro do Herói, pergaminhos e cenas por cima do mapa congelam o mundo (como num RPG):
  // ninguém anda e nenhum monstro puxa luta enquanto a janela está aberta. Ao fechar, os monstros ainda
  // esperam FOLGA_AO_VOLTAR antes de poder encostar (senão quem estava do lado atacava na hora).
  const FOLGA_AO_VOLTAR = 900;
  let voltouEm = 0;
  let estavaEmEspera = false;
  const emEspera = () => Boolean(document.querySelector("dialog[open], .inventario.aberto, .prologo"))
    || document.body.classList.contains("em-aula");
  aviso.addEventListener("click", () => perto && entrar(perto));

  const MAPA_TECLAS = { ArrowUp: "c", w: "c", W: "c", ArrowDown: "b", s: "b", S: "b", ArrowLeft: "e", a: "e", A: "e", ArrowRight: "d", d: "d", D: "d" };
  // ---------- a roda de gestos (segurar G) ----------
  // Segurando G, uma roda com 8 gestos aparece em volta do herói; escolhe com o mouse, as setas ou 1 a 8, e
  // ao soltar o G o herói faz o gesto (o ícone aparece em cima da cabeça). Andar cancela o gesto.
  const GESTOS = [
    { id: "acenar", icone: "👋", nome: "Acenar", dura: 1.8 },
    { id: "dancar", icone: "💃", nome: "Dançar", dura: 3.6 },
    { id: "pular", icone: "🦘", nome: "Pular", dura: 1.0 },
    { id: "reverencia", icone: "🙇", nome: "Reverência", dura: 1.9 },
    { id: "comemorar", icone: "🎉", nome: "Comemorar", dura: 2.2 },
    { id: "rir", icone: "😂", nome: "Rir", dura: 1.9 },
    { id: "coracao", icone: "❤️", nome: "Coração", dura: 2.4 },
    { id: "descansar", icone: "💤", nome: "Descansar", dura: 8 },
  ];
  let roda = null;
  function marcarGesto(i) {
    if (!roda) return;
    roda.marcado = (i + GESTOS.length) % GESTOS.length;
    roda.el.querySelectorAll(".gesto").forEach((b, k) => b.classList.toggle("marcado", k === roda.marcado));
    if (typeof Som !== "undefined") Som.efeito("clique");
  }
  function abrirRoda() {
    if (roda) return;
    const el = document.createElement("div");
    el.className = "roda-gestos";
    el.innerHTML = `<div class="centro-roda"><b>Gestos</b><small>solta o G</small></div>${GESTOS.map((g, i) => `
      <button type="button" class="gesto" data-i="${i}" style="--ang:${i * 45 - 90}deg"><span>${g.icone}</span><small>${g.nome}</small><kbd>${i + 1}</kbd></button>`).join("")}`;
    container.append(el);
    roda = { el, marcado: -1 };
    el.querySelectorAll(".gesto").forEach((b) => {
      b.addEventListener("pointerenter", () => marcarGesto(Number(b.dataset.i)));
      b.addEventListener("click", () => {
        marcarGesto(Number(b.dataset.i));
        fecharRoda(true);
      });
    });
  }
  function fecharRoda(fazer) {
    if (!roda) return;
    const i = roda.marcado;
    roda.el.remove();
    roda = null;
    if (fazer && i >= 0) {
      heroi.gesto = { ...GESTOS[i], inicio: null };
      dados.aoGesto?.(GESTOS[i].id); // no multijogador, os outros veem o gesto
      caminho = [];
      if (typeof Som !== "undefined") Som.efeito(GESTOS[i].id === "comemorar" ? "evolucao" : "passar");
    }
  }

  const aoTeclar = (e) => {
    if (e.target instanceof Element && e.target.closest("input, textarea, dialog")) return;
    if (document.querySelector("dialog[open]") || document.body.classList.contains("em-aula")) return;
    if (e.key === "g" || e.key === "G") {
      e.preventDefault();
      if (!e.repeat) abrirRoda();
      return;
    }
    if (roda) {
      // com a roda aberta, as teclas escolhem o gesto (e o herói não anda)
      e.preventDefault();
      if (/^[1-8]$/.test(e.key)) marcarGesto(Number(e.key) - 1);
      else if (["ArrowRight", "ArrowDown", "d", "s", "D", "S"].includes(e.key)) marcarGesto(roda.marcado + 1);
      else if (["ArrowLeft", "ArrowUp", "a", "w", "A", "W"].includes(e.key)) marcarGesto(roda.marcado < 0 ? GESTOS.length - 1 : roda.marcado - 1);
      else if (e.key === "Escape") fecharRoda(false);
      else if (e.key === "Enter") fecharRoda(true);
      return;
    }
    if (MAPA_TECLAS[e.key]) {
      teclas.add(MAPA_TECLAS[e.key]);
      caminho = [];
      entrarAoChegar = null;
      e.preventDefault();
    }
    if (["e", "E", "Enter", " "].includes(e.key) && perto) {
      e.preventDefault();
      entrar(perto);
    }
  };
  const aoSoltar = (e) => {
    if ((e.key === "g" || e.key === "G") && roda) return fecharRoda(true);
    if (MAPA_TECLAS[e.key]) teclas.delete(MAPA_TECLAS[e.key]);
  };
  window.addEventListener("keydown", aoTeclar);
  window.addEventListener("keyup", aoSoltar);

  function tileMaisProximoAndavel(tx, ty) {
    for (let r = 0; r < 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) if (andavelHeroi(tx + dx, ty + dy)) return [tx + dx, ty + dy];
      }
    }
    return null;
  }

  // busca em largura pelos tiles andáveis até o destino (arrays numéricos: o Reino tem 71 mil tiles e o
  // diário de missões pode mandar o herói atravessar o mapa inteiro)
  function caminharAte(tx, ty) {
    const destino = tileMaisProximoAndavel(tx, ty);
    if (!destino) return;
    const total = colunas * linhas;
    const veio = new Int32Array(total).fill(-2);
    const fila = new Int32Array(total);
    const k0 = Math.floor(heroi.y / TILE_MUNDO) * colunas + Math.floor(heroi.x / TILE_MUNDO);
    const kd = destino[1] * colunas + destino[0];
    veio[k0] = -1;
    let ler = 0;
    let gravar = 0;
    fila[gravar++] = k0;
    while (ler < gravar) {
      const k = fila[ler++];
      if (k === kd) break;
      const x = k % colunas;
      const y = (k - x) / colunas;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const vx = x + dx;
        const vy = y + dy;
        if (vx < 0 || vy < 0 || vx >= colunas || vy >= linhas) continue;
        const vk = vy * colunas + vx;
        if (veio[vk] !== -2 || !andavelHeroi(vx, vy)) continue;
        veio[vk] = k;
        fila[gravar++] = vk;
      }
    }
    if (veio[kd] === -2) return;
    const pontosCaminho = [];
    for (let k = kd; k !== -1; k = veio[k]) {
      const x = k % colunas;
      pontosCaminho.unshift({ x: x * TILE_MUNDO + 8, y: ((k - x) / colunas) * TILE_MUNDO + 8 });
    }
    caminho = pontosCaminho.slice(1);
  }

  function irAte(lugar, entrarDepois) {
    caminharAte(Math.floor(lugar.entrada.x / TILE_MUNDO), Math.floor(lugar.entrada.y / TILE_MUNDO));
    entrarAoChegar = entrarDepois ? lugar : null;
  }

  function entrar(lugar) {
    if (pausado) return;
    teclas.clear();
    // lugares que só abrem um pergaminho/diálogo por cima do mapa não destroem o mundo
    if (lugar.sobrepoe) {
      if (typeof Som !== "undefined") Som.efeito("passar");
      return dados.aoEntrar(lugar);
    }
    if (typeof Som !== "undefined") Som.efeito("porta");
    pausado = true;
    destruir();
    // a tela se fecha em blocos com o nome do lugar e abre do outro lado (portal e portões têm a sua própria)
    if (lugar.semTransicao || typeof transicaoPixel !== "function") return dados.aoEntrar(lugar);
    // e, coberta, mostra a tela de carregamento (a rua ao entardecer) com o nome do lugar
    // nas saídas ("Voltar ao Reino") o título fica só o destino: "Voltando para · Reino"
    const saindo = /^(voltar|sa[ií]da|sair)/i.test(lugar.nome || "");
    const titulo = saindo ? lugar.nome.replace(/^(voltar|sa[ií]da|sair)\s*(para o|para a|para|ao|à|a|do|da)?\s*/i, "") || lugar.nome : lugar.nome;
    transicaoPixel(`${lugar.icone || "🚪"} ${lugar.nome}`, "#120e2a", () => dados.aoEntrar(lugar), {
      forma: "diagonal", duracao: 300, espera: 260,
      carregar: { tema: "porta", titulo, sobretitulo: saindo ? "Voltando para" : "Entrando em", icone: lugar.icone || "🚪", avatar: dados.avatar, minimo: 1100 },
    });
  }

  let camera = { x: 0, y: 0 };
  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect();
    const wx = camera.x + ((e.clientX - r.left) / r.width) * (canvas.width / R);
    const wy = camera.y + ((e.clientY - r.top) / r.height) * (canvas.height / R);
    // clicou em outro jogador (multijogador): abre o cartão dele em vez de andar
    for (const o of outros.values()) {
      if (Math.abs(wx - o.x) < 9 && wy > o.y - PE_HEROI / RP - 2 && wy < o.y + 3) return dados.aoClicarOutro?.(o.sid);
    }
    const lugar = cenario.lugares.find((l) => {
      const w = larg(l.sprite, l.res);
      const h = alt(l.sprite, l.res);
      return wx > l.px - w / 2 && wx < l.px + w / 2 && wy > l.py - h && wy < l.py + 4;
    });
    if (lugar) return irAte(lugar, true);
    entrarAoChegar = null;
    caminharAte(Math.floor(wx / TILE_MUNDO), Math.floor(wy / TILE_MUNDO));
  });

  if (window.matchMedia("(pointer: coarse)").matches) {
    const dpad = document.createElement("div");
    dpad.className = "dpad";
    dpad.innerHTML = '<button data-d="c">▲</button><button data-d="e">◀</button><button data-d="d">▶</button><button data-d="b">▼</button>';
    dpad.querySelectorAll("button").forEach((b) => {
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); teclas.add(b.dataset.d); caminho = []; });
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, () => teclas.delete(b.dataset.d)));
    });
    container.append(dpad);
  }

  // ---------- laço ----------
  let ultimo = performance.now();
  const inicio = ultimo;
  let ultimoSalvo = 0;
  let ativo = true;
  let quadro = null;

  function mover(dt) {
    let vx = 0;
    let vy = 0;
    if (teclas.size) {
      if (teclas.has("c")) vy -= 1;
      if (teclas.has("b")) vy += 1;
      if (teclas.has("e")) vx -= 1;
      if (teclas.has("d")) vx += 1;
    } else if (caminho.length) {
      const alvo = caminho[0];
      vx = alvo.x - heroi.x;
      vy = alvo.y - heroi.y;
      if (Math.hypot(vx, vy) < 2) {
        caminho.shift();
        vx = 0;
        vy = 0;
      }
    }
    const comprimento = Math.hypot(vx, vy);
    heroi.andando = comprimento > 0;
    if (!heroi.andando) {
      if (entrarAoChegar && !caminho.length && Math.hypot(heroi.x - entrarAoChegar.entrada.x, heroi.y - entrarAoChegar.entrada.y) < 22) {
        const lugar = entrarAoChegar;
        entrarAoChegar = null;
        entrar(lugar);
      }
      return;
    }
    // olha para onde anda: o eixo com mais movimento manda
    if (Math.abs(vx) > Math.abs(vy)) heroi.direcao = vx > 0 ? "dir" : "esq";
    else heroi.direcao = vy > 0 ? "baixo" : "cima";
    // Corrida: bem mais rápido, levantando poeira
    const correndo = heroi.corridaAte > performance.now() / 1000;
    const velocidade = 72 * dt * (correndo ? 1.8 : 1);
    if (correndo && Math.random() < dt * 14) particulaMundo(heroi.x + (Math.random() - 0.5) * 8, heroi.y - 1, { vy: -6, vida: 0.45, cor: "#d8c9a3", tamanho: 2 });
    vx = (vx / comprimento) * velocidade;
    vy = (vy / comprimento) * velocidade;
    // colisão separada por eixo: dá para deslizar encostado nas paredes
    if (heroiPodePisar(heroi.x + vx + Math.sign(vx) * 4, heroi.y)) heroi.x += vx;
    if (heroiPodePisar(heroi.x, heroi.y + vy + Math.sign(vy) * 3)) heroi.y += vy;
  }

  function moverMonstros(dt, agora) {
    (cenario.monstros || []).forEach((m) => {
      if (m.derrotado && m.derrotado()) return;
      // longe da câmera o monstro fica parado (economiza processamento no mapa grande)
      if (Math.abs(m.x - heroi.x) > 600 || Math.abs(m.y - heroi.y) > 400) return;
      if (m.voaAlto) return voarAlto(m, dt, agora);
      if (m.parado) return m.trancado ? null : encostou(m, agora);
      const casaX = m.casa[0] * TILE_MUNDO + 8;
      const casaY = m.casa[1] * TILE_MUNDO + 12;
      // os agressivos correm atrás do herói quando ele chega perto, sem se afastar muito de casa
      // (os de região trancada ficam do lado de lá da barreira)
      const persegue = m.agressivo && !m.trancado && agora - inicio > 1500 && Math.hypot(heroi.x - m.x, heroi.y - m.y) < 90
        && Math.hypot(heroi.x - casaX, heroi.y - casaY) < 180;
      const podeIr = (x, y) => !m.trancado || Boolean(barreiraPx(x, y));
      m.espera -= dt;
      if (persegue) m.alvo = { x: heroi.x, y: heroi.y };
      else if (!m.alvo && m.espera <= 0) {
        const [hx, hy] = m.casa;
        const tx = hx + Math.round((Math.random() - 0.5) * 6);
        const ty = hy + Math.round((Math.random() - 0.5) * 6);
        if (andavel(tx, ty) && podeIr(tx * TILE_MUNDO + 8, ty * TILE_MUNDO + 12)) m.alvo = { x: tx * TILE_MUNDO + 8, y: ty * TILE_MUNDO + 12 };
        m.espera = 1 + Math.random() * 2;
      }
      if (m.alvo) {
        const dx = m.alvo.x - m.x;
        const dy = m.alvo.y - m.y;
        const d = Math.hypot(dx, dy);
        if (d < 1) m.alvo = null;
        else {
          const passo = (m.velocidade || 20) * (persegue ? 1.5 : 1) * dt;
          const nx = m.x + (dx / d) * passo;
          const ny = m.y + (dy / d) * passo;
          if (Math.abs(dx) > 0.5) m.virado = dx < 0;
          // quem voa passa por cima de árvores e água; os outros respeitam o terreno
          if ((m.voa || andavelPx(nx, ny)) && podeIr(nx, ny)) {
            m.x = nx;
            m.y = ny;
          } else m.alvo = null;
        }
      }
      if (!m.trancado) encostou(m, agora);
    });
  }

  // Chefão que voa alto (o Rei Dragão): faz um oito no céu em volta do covil e, quando o herói chega
  // perto, mergulha soltando fogo pela boca; só encosta (e começa a batalha) quando desce rente ao chão.
  // m.altura é a altura do voo em unidades do mundo (a sombra fica no chão, em m.x e m.y).
  function voarAlto(m, dt, agora) {
    const casaX = m.casa[0] * TILE_MUNDO + 8;
    const casaY = m.casa[1] * TILE_MUNDO + 12;
    m.angulo = (m.angulo || 0) + dt * 0.35;
    m.altura ??= 55;
    const caca = !m.trancado && agora - inicio > 1500 && Math.hypot(heroi.x - casaX, heroi.y - casaY) < 220;
    const distancia = Math.hypot(heroi.x - m.x, heroi.y - m.y);
    const [alvoX, alvoY, alturaAlvo] = caca
      ? [heroi.x, heroi.y, distancia < 70 ? 4 : 30]
      : [casaX + Math.cos(m.angulo) * 120, casaY + Math.sin(m.angulo * 2) * 50, 55];
    const dx = alvoX - m.x;
    const dy = alvoY - m.y;
    const d = Math.hypot(dx, dy);
    if (d > 1) {
      const passo = Math.min(d, (caca ? 64 : 46) * dt);
      m.x += (dx / d) * passo;
      m.y += (dy / d) * passo;
    }
    if (Math.abs(dx) > 3) m.virado = dx < 0;
    m.altura += (alturaAlvo - m.altura) * Math.min(1, dt * 1.6);
    m.mergulho = caca;
    // a baforada: faíscas de fogo saindo da boca para a frente e para baixo
    if (caca && Math.random() < dt * 14) {
      const lado = m.virado ? -1 : 1;
      const cores = ["#ffd166", "#ff7b39", "#ff4d6d", "#fff3c4"];
      particulaMundo(m.x + lado * 32, m.y - m.altura - 14, {
        vx: lado * (60 + Math.random() * 50), vy: 25 + Math.random() * 35, vida: 0.45 + Math.random() * 0.3,
        cor: cores[Math.floor(Math.random() * cores.length)], tamanho: Math.random() < 0.4 ? 3 : 2,
      });
    }
    if (!m.trancado && agora - inicio > 1500 && !pausado && m.altura < 14 && distancia < 22) {
      m.altura = 55;
      comecarEncontro(m);
    }
  }

  // Moradores que passeiam: escolhem um ponto perto de casa, andam devagar até lá e esperam um pouco.
  // Com o herói por perto, param e olham para ele (para dar tempo de conversar).
  // Todo morador com visual respira e pisca parado (cada um no seu ritmo); os que têm passeia também andam.
  // o ícone de cada gesto (emoji em pixel, guardado)
  const iconesGesto = new Map();
  function emojiDoGesto(emoji) {
    if (!iconesGesto.has(emoji)) iconesGesto.set(emoji, emojiCanvas(emoji, 14));
    return iconesGesto.get(emoji);
  }
  // ---------- os gestos (G) ----------
  // Cada gesto é uma cena curta com começo, meio e fim. O herói vira de frente para a câmera girando como
  // boneco 3D (e volta para onde olhava no fim), e o corpo é cortado na cintura: o tronco pode se curvar
  // (reverência), balançar (risada, respiração) e as pernas dobram para ele sentar. Pulos têm preparo,
  // voo e pouso com poeira; os ícones aparecem num balãozinho de pixel que estoura ao abrir.
  // Devolve: x, y, sx, sy (o corpo inteiro), angulo (para onde olha, em graus; null = o de sempre),
  // curvar e sentar (0 a 1), tronco (o tronco sobe/desce em pixels), sombra (1 = cheia), balao (ícone
  // grande em cima da cabeça), extras (ícones pequenos: [emoji, x, y, alfa]) e textos ([texto, x, y, alfa, cor, tamanho]).
  const CORES_CONFETE = ["#ff4d6d", "#ffd166", "#6ef0ff", "#7dff9a", "#a98bff", "#ff9fe0"];
  const ALTURA_CABECA = () => (PE_HEROI - 8) / RP; // do pé até o alto da cabeça, em unidades do mundo
  const suavizar = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  // o pulo de 0 a 1: preparo (agacha), voo (sobe e desce) e pouso (achata e volta)
  function curvaDoPulo(q, altura) {
    if (q < 0.18) {
      const s = suavizar(q / 0.18);
      return { y: 0, sx: 1 + s * 0.12, sy: 1 - s * 0.16, noAr: false };
    }
    if (q < 0.8) {
      const v = (q - 0.18) / 0.62;
      const y = -Math.sin(v * Math.PI) * altura;
      // estica ao sair do chão e ao chegar, fica normal no alto
      const estica = Math.abs(Math.cos(v * Math.PI)) * 0.1;
      return { y, sx: 1 - estica * 0.6, sy: 1 + estica, noAr: true };
    }
    const s = 1 - suavizar((q - 0.8) / 0.2);
    return { y: 0, sx: 1 + s * 0.14, sy: 1 - s * 0.18, noAr: false };
  }
  // quem está fazendo o gesto agora (o herói ou outro jogador, no multijogador): as partículas saem dele
  let atorG = heroi;
  function confete(quantos, forca = 1) {
    for (let i = 0; i < quantos; i++) {
      particulaMundo(atorG.x + (Math.random() - 0.5) * 6, atorG.y - ALTURA_CABECA(), {
        vx: (Math.random() - 0.5) * 80 * forca, vy: -25 - Math.random() * 45 * forca, vida: 0.8 + Math.random() * 0.6,
        cor: CORES_CONFETE[i % CORES_CONFETE.length], tamanho: Math.random() < 0.3 ? 2 : 1,
      });
    }
  }
  function poeiraDePouso() {
    for (let i = 0; i < 10; i++) {
      const lado = i % 2 ? 1 : -1;
      particulaMundo(atorG.x + lado * (2 + Math.random() * 3), atorG.y - 1, { vx: lado * (14 + Math.random() * 14), vy: -3 - Math.random() * 5, vida: 0.35 + Math.random() * 0.2, cor: "#e8dcc0", tamanho: 1 });
    }
  }
  function brilhoNoChao(cor) {
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      particulaMundo(atorG.x + Math.cos(a) * 9, atorG.y - 1 + Math.sin(a) * 3, { vy: -10 - Math.random() * 8, vida: 0.6, cor, tamanho: 1 });
    }
  }
  // uma vez só por gesto (o confete de cada pulo, a poeira de cada pouso...)
  const umaVez = (g, chave) => (g.feito ||= {})[chave] ? false : ((g.feito[chave] = true), true);

  function animacaoDoGesto(t, ator = heroi) {
    atorG = ator;
    const g = ator.gesto;
    const parado = { x: 0, y: 0, sx: 1, sy: 1, angulo: null, curvar: 0, sentar: 0, tronco: 0, sombra: 1, balao: null, extras: [], textos: [] };
    if (!g) return parado;
    if (g.inicio === null) {
      g.inicio = t;
      // todo gesto começa com um "pop" de brilho em volta do herói
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        particulaMundo(ator.x + Math.cos(a) * 5, ator.y - ALTURA_CABECA() * 0.6 + Math.sin(a) * 5, { vx: Math.cos(a) * 22, vy: Math.sin(a) * 22, vida: 0.3, cor: "#fff3b0", tamanho: 1 });
      }
    }
    const k = t - g.inicio; // segundos desde o começo
    const p = k / g.dura;
    if (ator.andando || p >= 1) {
      ator.gesto = null;
      return parado;
    }
    const r = { ...parado, extras: [], textos: [] };
    // o balão estoura ao abrir (cresce além e volta) e some no fim
    const pop = k < 0.1 ? (k / 0.1) * 1.25 : k < 0.2 ? 1.25 - ((k - 0.1) / 0.1) * 0.25 : 1;
    const some = p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1;
    const balao = (icone, extra = {}) => ({ icone, escala: pop, alfa: some, giro: 0, dy: 0, ...extra });
    // o quanto ele está "dentro" do gesto: vira para a câmera no começo e volta no fim
    const dentro = Math.min(1, k / 0.18, (g.dura - k) / 0.22);
    const deFrente = (angulo) => ({ alvo: angulo, peso: suavizar(dentro) });
    switch (g.id) {
      case "acenar": {
        // de frente, o corpo gira um pouco para um lado e para o outro no ritmo do aceno
        r.angulo = deFrente(Math.sin(k * 8) * 22);
        r.tronco = Math.sin(k * 16) > 0.6 ? -1 : 0;
        r.balao = balao(g.icone, { giro: Math.sin(k * 14) * 0.45 });
        // os risquinhos do aceno, dos dois lados do balão
        const lado = Math.sin(k * 14) > 0 ? 1 : -1;
        r.textos.push([lado > 0 ? ")" : "(", 13 * lado, -PE_HEROI - 10, some * 0.8, "#fff3cf", 10]);
        break;
      }
      case "dancar": {
        // passo de dança no ritmo (2,5 batidas por segundo), com dois giros completos no meio
        const batida = k * 2.5;
        const hop = Math.abs(Math.sin(batida * Math.PI));
        r.y = -hop * 4;
        if (hop < 0.25) {
          r.sx = 1.06;
          r.sy = 0.94;
        }
        const giro1 = suavizar((p - 0.22) / 0.2);
        const giro2 = suavizar((p - 0.6) / 0.2);
        r.angulo = deFrente((giro1 + giro2) * 360 + Math.sin(batida * Math.PI) * 28);
        r.tronco = Math.round(Math.sin(batida * Math.PI * 2));
        // notas musicais subindo dos dois lados e brilhos coloridos no chão a cada batida
        for (let i = 0; i < 3; i++) {
          const q = (k * 0.7 + i / 3) % 1;
          r.extras.push([i % 2 ? "🎵" : "🎶", (i - 1) * 13 + Math.sin(q * 6 + i) * 3, -PE_HEROI - 4 - q * 22, Math.sin(q * Math.PI) * some]);
        }
        if (umaVez(g, `b${Math.floor(batida)}`)) brilhoNoChao(CORES_CONFETE[Math.floor(batida) % CORES_CONFETE.length]);
        break;
      }
      case "pular": {
        const pulo = curvaDoPulo(Math.min(1, p / 0.85), 18);
        Object.assign(r, { y: pulo.y, sx: pulo.sx, sy: pulo.sy });
        r.sombra = 1 - Math.min(0.6, -pulo.y / 30);
        r.angulo = deFrente(0);
        if (p > 0.15 && umaVez(g, "saiu")) poeiraDePouso();
        if (p > 0.69 && umaVez(g, "pousou")) poeiraDePouso();
        break;
      }
      case "reverencia": {
        // curva o tronco devagar, segura e volta; um brilho sobe no fim
        const desce = suavizar(p / 0.3);
        const sobe = suavizar((p - 0.68) / 0.27);
        r.curvar = desce * (1 - sobe);
        r.angulo = deFrente(0);
        if (p > 0.72 && umaVez(g, "brilho")) {
          for (let i = 0; i < 5; i++) particulaMundo(ator.x + (i - 2) * 3, ator.y - ALTURA_CABECA(), { vy: -18 - i * 3, vida: 0.7, cor: "#fff3b0", tamanho: 1 });
        }
        if (r.curvar > 0.9) r.extras.push(["✨", 0, -PE_HEROI + 4 - (p - 0.3) * 12, some]);
        break;
      }
      case "comemorar": {
        // dois pulos: o segundo mais alto e com um giro completo no ar; confete a cada salto
        const q = p / 0.9;
        const qual = q < 0.42 ? 0 : 1;
        const local = qual === 0 ? q / 0.42 : Math.min(1, (q - 0.42) / 0.58);
        const pulo = curvaDoPulo(local, qual ? 20 : 12);
        Object.assign(r, { y: pulo.y, sx: pulo.sx, sy: pulo.sy });
        r.sombra = 1 - Math.min(0.6, -pulo.y / 30);
        const giroNoAr = qual ? suavizar((local - 0.2) / 0.55) * 360 : 0;
        r.angulo = deFrente(giroNoAr);
        if (pulo.noAr && umaVez(g, `salto${qual}`)) confete(qual ? 26 : 14, qual ? 1.2 : 0.8);
        if (!pulo.noAr && local > 0.8 && umaVez(g, `pouso${qual}`)) poeiraDePouso();
        r.balao = balao(g.icone, { dy: pulo.y * 0.4 });
        // estrelinhas girando em volta da cabeça
        for (let i = 0; i < 3; i++) {
          const a = k * 4 + (i / 3) * Math.PI * 2;
          r.extras.push(["⭐", Math.cos(a) * 14, -PE_HEROI + 6 + Math.sin(a) * 4, some * (Math.sin(a) > -0.3 ? 1 : 0.4)]);
        }
        break;
      }
      case "rir": {
        // o tronco sacode (a cabeça vai para trás a cada "HA"), o corpo balança devagar
        r.tronco = -Math.round(Math.abs(Math.sin(k * 15)) * 2);
        r.x = Math.sin(k * 40) * 0.6;
        r.angulo = deFrente(Math.sin(k * 3) * 14);
        r.balao = balao(g.icone, { dy: -Math.abs(Math.sin(k * 15)) * 2 });
        for (let i = 0; i < 3; i++) {
          const q = (k * 1.3 + i / 3) % 1;
          r.textos.push([i === 1 ? "HA!" : "HA", (i % 2 ? 1 : -1) * (14 + q * 4), -PE_HEROI + 10 - q * 16, Math.sin(q * Math.PI) * some, "#ffd166", 9 + Math.round(q * 2)]);
        }
        break;
      }
      case "coracao": {
        // balança de leve, o coração do balão pulsa e coraçõezinhos sobem em arco
        r.angulo = deFrente(Math.sin(k * 2.6) * 16);
        r.sy = 1 + Math.sin(k * 8) * 0.015;
        r.balao = balao(g.icone, { escala: pop * (1 + Math.max(0, Math.sin(k * 8)) * 0.15) });
        for (let i = 0; i < 4; i++) {
          const q = (k * 0.6 + i / 4) % 1;
          const lado = i % 2 ? 1 : -1;
          r.extras.push(["💗", lado * (8 + Math.sin(q * Math.PI) * 10), -PE_HEROI + 14 - q * 26, Math.sin(q * Math.PI) * some]);
        }
        if (umaVez(g, "rosa")) {
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            particulaMundo(ator.x, ator.y - ALTURA_CABECA() * 0.5, { vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, vida: 0.45, cor: i % 2 ? "#ff9fe0" : "#ff4d6d", tamanho: 1 });
          }
        }
        break;
      }
      case "descansar": {
        // senta (as pernas dobram), respira devagar e solta "z" subindo; levanta no fim
        const senta = suavizar(k / 0.45) * (1 - suavizar((k - (g.dura - 0.5)) / 0.45));
        r.sentar = senta;
        r.tronco = senta > 0.9 ? Math.round(Math.sin(k * 2) * 0.8) : 0;
        r.angulo = deFrente(0);
        for (let i = 0; i < 3; i++) {
          const q = (k * 0.4 + i / 3) % 1;
          if (senta < 0.9) continue;
          r.textos.push([i === 2 ? "Z" : "z", 8 + q * 10, -PE_HEROI + 12 - q * 20, Math.sin(q * Math.PI), "#cfe0ff", 8 + Math.round(q * 5)]);
        }
        break;
      }
      default:
        break;
    }
    return r;
  }

  // o corpo do herói com o gesto: inteiro, ou cortado na cintura para curvar, sentar ou balançar o tronco
  const CINTURA_HEROI = PE_HEROI - 15;
  function desenharCorpoComGesto(ctx, sprite, gesto) {
    if (!gesto.curvar && !gesto.sentar && !gesto.tronco) {
      ctx.drawImage(sprite, -16, -PE_HEROI);
      return;
    }
    const W = sprite.width;
    const H = sprite.height;
    const pernas = H - CINTURA_HEROI;
    // sentado, as pernas dobram (encolhem até quase a metade) e o tronco desce junto
    const altPernas = Math.round(pernas * (1 - gesto.sentar * 0.45));
    const desce = pernas - altPernas;
    ctx.drawImage(sprite, 0, CINTURA_HEROI, W, pernas, -16, -PE_HEROI + CINTURA_HEROI + desce, W, altPernas);
    // o tronco: na reverência fica mais baixo (a cabeça vem para a frente) e inclina para onde ele olha
    const altTronco = Math.round(CINTURA_HEROI * (1 - gesto.curvar * 0.2));
    const cintura = -PE_HEROI + CINTURA_HEROI + desce;
    ctx.save();
    ctx.translate(0, cintura);
    if (gesto.curvar) ctx.transform(1, 0, -gesto.curvar * 0.18, 1, 0, 0);
    ctx.drawImage(sprite, 0, 0, W, CINTURA_HEROI, -16, -altTronco + Math.round(gesto.tronco || 0) + 1, W, altTronco);
    ctx.restore();
  }

  // o balãozinho de pixel com o ícone do gesto, em cima da cabeça
  function balaoDoGesto(ctx, b, y0) {
    const icone = emojiDoGesto(b.icone);
    const lado = 18;
    const x = -lado / 2;
    const y = Math.round(y0 - lado - 4 + (b.dy || 0));
    ctx.save();
    ctx.globalAlpha = b.alfa;
    // a moldura: papel claro, borda escura de 1 pixel e o rabinho apontando para a cabeça
    ctx.translate(0, y + lado / 2);
    ctx.scale(b.escala, b.escala);
    ctx.translate(0, -(y + lado / 2));
    ctx.fillStyle = "#2a1606";
    ctx.fillRect(x + 1, y, lado - 2, lado);
    ctx.fillRect(x, y + 1, lado, lado - 2);
    ctx.fillRect(-2, y + lado, 4, 1);
    ctx.fillRect(-1, y + lado + 1, 2, 1);
    ctx.fillStyle = "#fff6dc";
    ctx.fillRect(x + 1, y + 1, lado - 2, lado - 2);
    ctx.fillRect(-1, y + lado - 1, 2, 1);
    ctx.fillStyle = "#e9d8b0";
    ctx.fillRect(x + 1, y + lado - 2, lado - 2, 1);
    ctx.translate(0, y + lado / 2);
    ctx.rotate(b.giro || 0);
    ctx.drawImage(icone, -Math.round(icone.width / 2), -Math.round(icone.height / 2));
    ctx.restore();
  }

  // os textinhos dos gestos (HA HA, zzz, os risquinhos do aceno) em pixel, com borda escura
  function textoDoGesto(ctx, [texto, x, y, alfa, cor, tamanho]) {
    if (alfa <= 0) return;
    ctx.globalAlpha = Math.min(1, alfa);
    ctx.font = `${tamanho}px 'Jersey 10', monospace`;
    ctx.textAlign = "center";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1b1205";
    ctx.strokeText(texto, Math.round(x), Math.round(y));
    ctx.fillStyle = cor;
    ctx.fillText(texto, Math.round(x), Math.round(y));
    ctx.globalAlpha = 1;
  }

  // o giro do herói em graus (0 = de frente, 90 = direita, 180 = costas, -90 = esquerda): numa virada ele
  // passa pelos ângulos do meio (3/4), como um boneco 3D girando, em vez de achatar como papel.
  // Cada pessoa desenhada com o corpo do herói (ele e, no multijogador, os outros jogadores) guarda o seu.
  const ANGULO_DA_DIRECAO = { baixo: 0, dir: 90, cima: 180, esq: -90 };
  const giroNovo = (direcao) => {
    const angulo = ANGULO_DA_DIRECAO[direcao] ?? 0;
    return { direcaoAnterior: direcao, anguloDe: angulo, anguloGiro: 0, anguloAgora: angulo, virouEm: -1, ultimaPisada: -1 };
  };
  Object.assign(heroi, {
    giro: giroNovo(heroi.direcao), sprites, avatar: dados.avatar, aura: dados.aura, familiar, fase: 0,
    mascote: { quadros: quadrosFamiliar, sprite: spriteFamiliar, corrida: corridaFamiliar, ultimoRastro: 0 },
  });
  // o mascote vem atrás de quem anda (fica do lado oposto ao que ele olha)
  function seguirMascote(a, dt) {
    const atras = a.direcao === "esq" ? 12 : a.direcao === "dir" ? -12 : 0;
    const acima = a.direcao === "baixo" ? -6 : a.direcao === "cima" ? 8 : 2;
    a.familiar.x += (a.x + atras + (atras ? 0 : -12) - a.familiar.x) * Math.min(1, dt * 4);
    a.familiar.y += (a.y + acima - a.familiar.y) * Math.min(1, dt * 4);
  }

  // ---------- os outros jogadores (multijogador) ----------
  // Cada um é desenhado como o herói (o mesmo corpo, o giro 3D, os gestos e o mascote), com a plaquinha de
  // nome e título em cima. A posição chega pela rede umas 10 vezes por segundo; aqui ela é suavizada para a
  // pessoa andar sem pulos. Quem chega longe demais (um teleporte) aparece direto no lugar novo.
  const outros = new Map();
  const limparNome = (nome) => String(nome || "").replace(/[<>&"]/g, "");
  function novoOutro(sid, p) {
    const avatar = p.avatar || {};
    const quadros = typeof familiarQuadros === "function" ? familiarQuadros(avatar) : null;
    const o = {
      sid, x: p.x, y: p.y, alvoX: p.x, alvoY: p.y, direcao: p.direcao || "baixo", direcaoRede: p.direcao || "baixo", andando: false, andandoRede: false, ultimaRede: 0,
      fila: [{ t: performance.now() - 1000, x: p.x, y: p.y }],
      gesto: null, sprites: spritesHeroi(avatar), avatar, aura: p.aura || null, fase: Math.random() * 3,
      familiar: { x: p.x - 12, y: p.y }, giro: giroNovo(p.direcao || "baixo"),
      mascote: { quadros, sprite: quadros?.[0] || familiarCanvas(avatar), corrida: typeof familiarCorrida === "function" ? familiarCorrida(avatar) : null, ultimoRastro: 0 },
    };
    o.placa = document.createElement("button");
    o.placa.type = "button";
    o.placa.className = "plaquinha-heroi plaquinha-outro";
    o.placa.addEventListener("click", () => dados.aoClicarOutro?.(sid));
    camada.append(o.placa);
    return o;
  }
  function plaquinhaDoOutro(o, p) {
    o.placa.innerHTML = `${p.tituloHtml || ""}<b>${limparNome(p.nome)}</b>${p.marca ? `<i class="marca-outro">${p.marca}</i>` : ""}`;
  }
  // Interpolação com atraso (como nos jogos online): cada posição que chega da rede vai para uma fila com a
  // hora em que chegou, e o boneco é mostrado ATRASO_DA_REDE ms no passado, deslizando entre os dois pontos
  // conhecidos daquele instante. As mensagens chegam em ritmo irregular (às vezes duas juntas, às vezes
  // nenhuma num décimo de segundo); com a fila, o movimento sai contínuo e na velocidade de verdade.
  const ATRASO_DA_REDE = 150;
  function moverOutros(dt) {
    const agora = performance.now();
    const instante = agora - ATRASO_DA_REDE;
    outros.forEach((o) => {
      const fila = o.fila;
      let alvoX = o.alvoX;
      let alvoY = o.alvoY;
      if (fila.length) {
        // os dois pontos em volta do instante mostrado (ou o último, se o instante já passou dele)
        while (fila.length > 2 && fila[1].t <= instante) fila.shift();
        const [a, b] = fila;
        if (b && instante >= a.t) {
          const k = Math.min(1, (instante - a.t) / Math.max(1, b.t - a.t));
          alvoX = a.x + (b.x - a.x) * k;
          alvoY = a.y + (b.y - a.y) * k;
        } else if (instante < a.t) {
          alvoX = a.x;
          alvoY = a.y;
        } else {
          // a fila acabou (a rede atrasou): continua na mesma velocidade por até 150 ms, em vez de congelar
          const ultimo = fila[fila.length - 1];
          const penultimo = o.anterior;
          const passou = Math.min(150, instante - ultimo.t);
          if (penultimo && o.andandoRede && ultimo.t > penultimo.t) {
            const k = passou / (ultimo.t - penultimo.t);
            alvoX = ultimo.x + (ultimo.x - penultimo.x) * Math.min(k, 1.5);
            alvoY = ultimo.y + (ultimo.y - penultimo.y) * Math.min(k, 1.5);
          } else {
            alvoX = ultimo.x;
            alvoY = ultimo.y;
          }
        }
      }
      const dx = alvoX - o.x;
      const dy = alvoY - o.y;
      const d = Math.hypot(dx, dy);
      if (d > 160) {
        // longe demais (um teleporte, a arena): aparece direto lá
        o.x = alvoX;
        o.y = alvoY;
        o.familiar.x = o.x - 12;
        o.familiar.y = o.y;
      } else {
        o.x = alvoX;
        o.y = alvoY;
      }
      // anda quando se mexeu de verdade neste quadro (ou a rede ainda diz que ele está andando)
      const velocidade = dt > 0 ? d / dt : 0;
      o.andando = velocidade > 8 || (o.andandoRede && agora - o.ultimaRede < 250 && fila.length > 1);
      // a direção acompanha o movimento mostrado (e não a da última mensagem, que está 150 ms à frente)
      if (velocidade > 8) o.direcao = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "dir" : "esq") : dy > 0 ? "baixo" : "cima";
      else if (o.direcaoRede && !o.andando) o.direcao = o.direcaoRede;
      seguirMascote(o, dt);
    });
  }
  // balão de fala em cima de alguém (o herói ou outro jogador); do palanque, o balão é dourado e maior
  function balaoDeFala(ator, texto, { palanque = false } = {}) {
    ator.balao?.el.remove();
    const el = document.createElement("div");
    el.className = `balao-ambiente balao-jogador ${palanque ? "do-palanque" : ""}`;
    el.textContent = texto;
    camada.append(el);
    ator.balao = { el, ate: performance.now() + 4500 + Math.min(5000, texto.length * 45) };
    if (typeof Som !== "undefined") Som.efeito("falar", ator === heroi ? 0.5 : Math.max(0.15, 1 - Math.hypot(heroi.x - ator.x, heroi.y - ator.y) / 220));
  }
  function posicionarBalao(ator) {
    if (!ator.balao) return;
    if (performance.now() > ator.balao.ate) {
      ator.balao.el.remove();
      ator.balao = null;
      return;
    }
    ator.balao.el.style.transform = `${naTelaCss(ator.x, ator.y, (PE_HEROI + 4) / RP)} translate(-50%, calc(-100% - 40px))`;
  }
  // a poeira dos pés do herói, na cor do chão onde ele pisa, saindo para trás de quem anda
  const COR_POEIRA = { grama: "#cfe8b0", areia: "#efe0b0", neve: "#ffffff", lama: "#7a8455", pedra: "#d8d0e0", madeira: "#c9a06a", agua: "#bfe6ff" };
  function poeiraNosPes(quantas, espalha, ator = heroi) {
    const chao = cenario.chaoDoPasso ? cenario.chaoDoPasso(Math.floor(ator.x / TILE_MUNDO), Math.floor(ator.y / TILE_MUNDO)) : "pedra";
    const cor = COR_POEIRA[chao] || "#d8d0c0";
    const [dx, dy] = { esq: [1, 0], dir: [-1, 0], cima: [0, 1], baixo: [0, -0.3] }[ator.direcao] || [0, 0];
    for (let i = 0; i < quantas; i++) {
      particulaMundo(ator.x + (Math.random() - 0.5) * espalha, ator.y - 1, {
        vx: dx * (10 + Math.random() * 8) + (Math.random() - 0.5) * 8, vy: -4 - Math.random() * 6 + dy * 4,
        vida: 0.35 + Math.random() * 0.2, cor, tamanho: 1,
      });
    }
  }
  cenario.lugares.filter((l) => l.visual).forEach((l) => Object.assign(l, {
    sprites: spritesHeroi(l.visual), direcao: "baixo", andando: false, fase: Math.random() * 3,
  }));
  const passeantes = cenario.lugares.filter((l) => l.passeia && l.visual);
  passeantes.forEach((l) => Object.assign(l, {
    casa: { x: l.px, y: l.py }, alvo: null, espera: 1 + Math.random() * 3,
    entradaDx: l.entrada.x - l.px, entradaDy: l.entrada.y - l.py,
  }));
  // rota de tile em tile (busca em largura) de um ponto a outro, para os moradores irem e voltarem de casa
  function rotaEntre(x1, y1, x2, y2) {
    const inicio = [Math.floor(x1 / TILE_MUNDO), Math.floor(y1 / TILE_MUNDO)];
    const destino = [Math.floor(x2 / TILE_MUNDO), Math.floor(y2 / TILE_MUNDO)];
    const veio = new Map([[`${inicio}`, null]]);
    const fila = [inicio];
    while (fila.length && veio.size < 5000) {
      const [x, y] = fila.shift();
      if (x === destino[0] && y === destino[1]) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const prox = [x + dx, y + dy];
        const ehDestino = prox[0] === destino[0] && prox[1] === destino[1];
        if (!veio.has(`${prox}`) && (ehDestino || andavel(...prox))) {
          veio.set(`${prox}`, [x, y]);
          fila.push(prox);
        }
      }
    }
    if (!veio.has(`${destino}`)) return [{ x: x2, y: y2 }];
    const pontos = [];
    for (let p = veio.get(`${destino}`); p; p = veio.get(`${p}`)) pontos.unshift({ x: p[0] * TILE_MUNDO + 8, y: p[1] * TILE_MUNDO + 12 });
    return [...pontos.slice(1), { x: x2, y: y2 }];
  }

  // segue a rota guardada; devolve true enquanto ainda está a caminho
  function seguirRota(l, dt) {
    if (!l.rota?.length) return false;
    const alvo = l.rota[0];
    const dx = alvo.x - l.px;
    const dy = alvo.y - l.py;
    const d = Math.hypot(dx, dy);
    if (d < 1.5) {
      l.rota.shift();
      return l.rota.length > 0;
    }
    const passo = Math.min(d, 24 * dt);
    l.px += (dx / d) * passo;
    l.py += (dy / d) * passo;
    l.andando = true;
    l.direcao = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "esq" : "dir") : dy < 0 ? "cima" : "baixo";
    l.entrada = { x: l.px + l.entradaDx, y: l.py + l.entradaDy };
    return true;
  }

  function moverMoradores(dt) {
    const noite = Boolean(cenario.noite?.());
    passeantes.forEach((l) => {
      // à noite, quem tem casa caminha até a porta e entra; de manhã sai e volta para o seu canto
      if (l.casaNoite) {
        if (noite && !l.indoParaCasa && !l.escondido) {
          l.indoParaCasa = true;
          l.alvo = null;
          l.rota = rotaEntre(l.px, l.py, l.casaNoite.x, l.casaNoite.y);
          if (Math.hypot(heroi.x - l.px, heroi.y - l.py) < 150) falarNoAr(l, sortearDe(["Boa noite!", "Hora de ir pra casa...", "Tá ficando escuro!", "Até amanhã! 🌙"]));
        }
        if (!noite && (l.escondido || l.indoParaCasa)) {
          if (l.escondido) Object.assign(l, { px: l.casaNoite.x, py: l.casaNoite.y });
          l.escondido = false;
          l.indoParaCasa = false;
          l.rota = rotaEntre(l.px, l.py, l.casa.x, l.casa.y);
        }
        if (l.escondido) return;
        if (seguirRota(l, dt)) return;
        if (l.indoParaCasa) {
          l.escondido = true; // chegou na porta: entrou em casa
          l.andando = false;
          return;
        }
      }
      const dxHeroi = heroi.x - l.px;
      const dyHeroi = heroi.y - l.py;
      if (Math.hypot(dxHeroi, dyHeroi) < 34) {
        l.andando = false;
        l.alvo = null;
        l.direcao = Math.abs(dxHeroi) > Math.abs(dyHeroi) ? (dxHeroi < 0 ? "esq" : "dir") : dyHeroi < 0 ? "cima" : "baixo";
        return;
      }
      if (!l.alvo) {
        l.andando = false;
        l.espera -= dt;
        if (l.espera > 0) return;
        const angulo = Math.random() * Math.PI * 2;
        const raio = l.passeia * (0.4 + Math.random() * 0.6);
        const alvo = { x: l.casa.x + Math.cos(angulo) * raio, y: l.casa.y + Math.sin(angulo) * raio * 0.6 };
        if (andavelPx(alvo.x, alvo.y - 2)) l.alvo = alvo;
        l.espera = 2 + Math.random() * 3;
        return;
      }
      const dx = l.alvo.x - l.px;
      const dy = l.alvo.y - l.py;
      const d = Math.hypot(dx, dy);
      if (d < 1) {
        l.alvo = null;
        return;
      }
      const passo = Math.min(d, 14 * dt);
      const nx = l.px + (dx / d) * passo;
      const ny = l.py + (dy / d) * passo;
      if (!andavelPx(nx, ny - 2)) {
        l.alvo = null;
        return;
      }
      l.px = nx;
      l.py = ny;
      l.andando = true;
      l.direcao = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "esq" : "dir") : dy < 0 ? "cima" : "baixo";
      l.entrada = { x: l.px + l.entradaDx, y: l.py + l.entradaDy };
    });
  }

  // ---------- vida no mapa: falas dos moradores e sons dos monstros ----------

  // falas soltas de quem está por perto (cada cenário pode trazer as suas em cenario.balbucios)
  const BALBUCIOS_PADRAO = [
    "Que dia bonito!", "Hmm...", "Ouviste falar do dragão das montanhas?", "Preciso estudar prompts...", "♪ ♫ ♪",
    "Cuidado com os slimes!", "Será que a IA alucinou de novo?", "Alguém viu meu grimório?", "Ufa, que correria!",
    "Já tomei três cafés hoje.", "Bom te ver por aqui!", "Dizem que o Zetsu nunca dorme...",
  ];
  const BALBUCIOS_NOITE = ["Zzz...", "*bocejo*", "Já tá tarde...", "Ouviste esse uivo?", "Hora de ir pra casa."];
  const baloes = [];
  let proximoBalbucio = 2 + Math.random() * 3;
  const cumprimentados = new Set();

  function falarNoAr(l, texto) {
    if (baloes.some((b) => b.l === l)) return;
    const el = document.createElement("div");
    el.className = "balao-ambiente";
    el.textContent = texto;
    camada.append(el);
    baloes.push({ l, el, ate: performance.now() + 2800 });
    if (typeof Som !== "undefined") {
      const distancia = Math.hypot(heroi.x - l.px, heroi.y - l.py);
      Som.efeito("falar", Math.max(0.15, 1 - distancia / 160));
    }
  }

  function vidaDosMoradores(dt) {
    const vivos = cenario.lugares.filter((l) => l.visual && !l.escondido);
    // cumprimenta quando o herói chega perto pela primeira vez
    vivos.forEach((l) => {
      const perto = Math.hypot(heroi.x - l.px, heroi.y - l.py) < 40;
      if (perto && !cumprimentados.has(l)) {
        cumprimentados.add(l);
        falarNoAr(l, sortearDe(l.cumprimentos || [`👋 Oi${dados.nomeHeroi ? `, ${dados.nomeHeroi}` : ""}!`, "👋 Olá!", "Opa! 👋", "E aí? 👋"]));
      } else if (!perto && Math.hypot(heroi.x - l.px, heroi.y - l.py) > 90) cumprimentados.delete(l);
    });
    // de tempos em tempos, alguém por perto fala sozinho
    proximoBalbucio -= dt;
    if (proximoBalbucio <= 0) {
      proximoBalbucio = 3 + Math.random() * 5;
      const perto = vivos.filter((l) => Math.hypot(heroi.x - l.px, heroi.y - l.py) < 150);
      if (perto.length) {
        const l = sortearDe(perto);
        const noite = cenario.noite?.();
        falarNoAr(l, sortearDe(noite ? BALBUCIOS_NOITE : l.balbucios || cenario.balbucios || BALBUCIOS_PADRAO));
      }
    }
  }

  // cada tipo de monstro tem seu som; quanto mais perto, mais alto
  const SONS_MONSTRO = [["slime", "slime"], ["reiSlime", "slime"], ["lobo", "rosnado"], ["fenrir", "uivo"], ["sapo", "croac"],
    ["escorpiao", "chiado"], ["esqueleto", "ossos"], ["dragao", "asas"], ["ignis", "asas"], ["morcego", "asas"], ["assombracao", "uivo"],
    ["fogoFatuo", "magia"]];
  function sonsDosMonstros(dt) {
    if (typeof Som === "undefined") return;
    (cenario.monstros || []).forEach((m) => {
      if (m.derrotado && m.derrotado()) return;
      const distancia = Math.hypot(heroi.x - m.x, heroi.y - m.y);
      if (distancia > 170 || Math.random() > dt * 0.18) return;
      const som = SONS_MONSTRO.find(([prefixo]) => m.tipoId?.startsWith(prefixo))?.[1];
      // o lobo às vezes uiva em vez de rosnar (mais ainda à noite)
      const escolhido = som === "rosnado" && Math.random() < (cenario.noite?.() ? 0.5 : 0.15) ? "uivo" : som;
      if (escolhido) Som.efeito(escolhido, Math.max(0.1, 1 - distancia / 170) * 0.8);
    });
  }

  function sortearDe(lista) {
    return lista[Math.floor(Math.random() * lista.length)];
  }

  // encostou no herói: começa o encontro (com folga ao chegar no mapa). Monstro grande alcança mais longe.
  function encostou(m, agora) {
    const alcance = Math.max(11 / RP, larg(m.sprite, RP) * 0.33);
    if (agora - inicio > 1500 && agora - voltouEm > FOLGA_AO_VOLTAR && !pausado && !emEspera()
      && Math.hypot(m.x - heroi.x, m.y - heroi.y) < alcance) comecarEncontro(m);
  }

  function comecarEncontro(m, extra = {}) {
    pausado = true;
    destruir();
    m.x = m.casa[0] * TILE_MUNDO + 8;
    m.y = m.casa[1] * TILE_MUNDO + 12;
    m.alvo = null;
    dados.aoEncontro(m, extra);
  }

  // ---------- vento nas árvores ----------
  // A copa balança em faixas de 2 pixels: o tronco (o terço de baixo) fica parado e o topo é o que mais
  // mexe. O vento tem rajadas (uma onda lenta por cima da rápida) e cada árvore está num ponto da onda.
  // De vez em quando uma folha se solta e cai rodopiando.
  function desenharFolhagem(c, p, x0, y0, t) {
    const s = p.sprite;
    const res = s.res || 1;
    const h = s.height;
    const hMundo = h / res;
    const rajada = 0.6 + 0.4 * Math.sin(t * 0.35 + p.x * 0.002);
    const fase = t * 1.7 + p.x * 0.045 + p.y * 0.03;
    if (typeof posesDoVento === "function") {
      // poses prontas (cenario_hd.js): escolhe a do deslocamento de agora e desenha uma vez só
      const poses = posesDoVento(s);
      const nivel = Math.max(-MAX_VENTO, Math.min(MAX_VENTO, Math.round(Math.sin(fase) * 2.2 * res * rajada)));
      const pose = poses[nivel + MAX_VENTO];
      c.drawImage(pose, x0 - MAX_VENTO / res, y0, pose.width / res, hMundo);
    } else {
      const tronco = h * 0.68;
      const faixa = 2; // altura de cada faixa, em pixels do desenho
      for (let sy = 0; sy < h; sy += faixa) {
        const solto = sy < tronco ? (1 - sy / tronco) : 0;
        const dx = Math.round(Math.sin(fase + sy * 0.035 / res) * 2.2 * res * rajada * solto) / res;
        c.drawImage(s, 0, sy, s.width, faixa, x0 + dx, y0 + sy / res, s.width / res, faixa / res);
      }
    }
    // as folhas que se soltam (as cores vêm da árvore: verdes, douradas, pétalas rosa, neve no pinheiro)
    const folhas = Array.isArray(p.folhas) ? p.folhas : s.folhas || (p.folhas !== false && hMundo > 30 ? ["#6fbf4a", "#a7e06b", "#e8c050"] : null);
    if (folhas?.length && hMundo > 24 && Math.random() < 0.0055 * (0.5 + rajada)) {
      const cor = folhas[Math.floor(Math.random() * folhas.length)];
      const lx = p.x + (Math.random() - 0.5) * (s.width / res) * 0.65;
      const ly = p.y - hMundo * (0.45 + Math.random() * 0.4);
      particulaMundo(lx, ly, { vx: -6 - Math.random() * 8 * rajada, vy: 9 + Math.random() * 5, vida: 6, cor, tamanho: 2, rodopio: true, folha: true, chao: p.y - 1 + Math.random() * 6 });
    }
  }

  // ---------- efeitos das habilidades da barra (partículas e o Golpe Arcano voando) ----------
  const particulas = [];
  const projeteis = [];
  function particulaMundo(x, y, { vx = 0, vy = 0, vida = 0.6, cor = "#ffffff", tamanho = 1, rodopio = false, folha = false, chao = null } = {}) {
    particulas.push({ x, y, vx, vy, vida, total: vida, cor, tamanho, rodopio, folha, chao, escura: folha ? tom(cor, 0.7) : null, semente: Math.random() * 6 });
  }
  function explosaoMundo(x, y, cor, quantas = 14, forca = 40) {
    for (let i = 0; i < quantas; i++) {
      const a = (i / quantas) * Math.PI * 2;
      particulaMundo(x, y, { vx: Math.cos(a) * forca * (0.5 + Math.random() * 0.5), vy: Math.sin(a) * forca * (0.5 + Math.random() * 0.5), vida: 0.5, cor: i % 2 ? cor : "#ffffff", tamanho: 2 });
    }
  }
  function atualizarEfeitos(dt) {
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dt;
      // a folha caindo vai de um lado para o outro, como de verdade
      p.x += (p.vx + (p.rodopio ? Math.sin(p.vida * 4 + p.semente) * 18 : 0)) * dt;
      p.y += p.vy * dt;
      // a folha chega no chão: deita e some devagar
      if (p.folha && p.chao !== null && p.y >= p.chao && !p.pousou) {
        p.pousou = true;
        p.y = p.chao;
        p.vx = p.vy = 0;
        p.rodopio = false;
        p.vida = Math.min(p.vida, 1.6);
        p.total = 1.6;
      }
      if (p.vida <= 0) particulas.splice(i, 1);
    }
    for (let i = projeteis.length - 1; i >= 0; i--) {
      const p = projeteis[i];
      p.vida -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (Math.random() < 0.8) particulaMundo(p.x, p.y, { vida: 0.3, cor: p.cor, tamanho: 1 });
      // acertou um monstro: a luta começa com ele ferido
      const alvo = (cenario.monstros || []).find((m) => !(m.derrotado && m.derrotado()) && !m.trancado
        && Math.hypot(m.x - p.x, m.y - 8 / RP - p.y) < Math.max(10 / RP + 2, larg(m.sprite, RP) * 0.35));
      if (alvo && !pausado) {
        projeteis.splice(i, 1);
        explosaoMundo(p.x, p.y, p.cor, 18, 60);
        if (typeof Som !== "undefined") Som.efeito("impacto");
        setTimeout(() => !pausado && ativo && comecarEncontro(alvo, { golpe: true }), 160);
        continue;
      }
      if (p.vida <= 0 || !andavelPx(p.x, p.y + 8)) {
        explosaoMundo(p.x, p.y, p.cor, 8, 25);
        projeteis.splice(i, 1);
      }
    }
  }
  function desenharEfeitos(t) {
    particulas.forEach((p) => {
      if (p.folha) {
        // a folha em pixels do desenho: vira de um lado para o outro enquanto cai (4 poses)
        ctx.globalAlpha = p.pousou ? Math.max(0, p.vida / p.total) : Math.min(1, (p.total - p.vida) * 3);
        const u = 1 / RP;
        const x = Math.round((p.x - camera.x) * RP) / RP;
        const y = Math.round((p.y - camera.y) * RP) / RP;
        const pose = p.pousou ? 0 : Math.floor((p.vida * 3 + p.semente) % 4);
        const forma = [[[0, 0, 1], [1, 0, 1], [1, 1, 0], [2, 1, 0]], [[0, 1, 1], [1, 1, 1], [1, 0, 0], [2, 0, 0]], [[1, 0, 1], [1, 1, 0], [1, 2, 0]], [[0, 0, 1], [1, 0, 1], [2, 0, 0]]][pose];
        forma.forEach(([dx, dy, clara]) => {
          ctx.fillStyle = clara ? p.cor : p.escura;
          ctx.fillRect(x + dx * u, y + dy * u, u, u);
        });
        return;
      }
      ctx.globalAlpha = Math.max(0, p.vida / p.total);
      ctx.fillStyle = p.cor;
      ctx.fillRect(Math.round(p.x - camera.x), Math.round(p.y - camera.y), p.tamanho, p.tamanho);
    });
    ctx.globalAlpha = 1;
    projeteis.forEach((p) => {
      const x = Math.round(p.x - camera.x);
      const y = Math.round(p.y - camera.y);
      brilhoRedondo(ctx, x, y, 7, hexParaRgb(p.cor).join(", "), 0.25);
      ctx.fillStyle = p.cor;
      ctx.fillRect(x - 2, y - 1, 5, 3);
      ctx.fillRect(x - 1, y - 2, 3, 5);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, 1, 1);
    });
    // Luz Arcana: um halo girando em volta do herói enquanto ela vale
    if (heroi.luzAte > performance.now() / 1000) {
      for (let i = 0; i < 6; i++) {
        const a = t * 1.5 + (i / 6) * Math.PI * 2;
        ctx.fillStyle = i % 2 ? "#fff3b0" : "#ffd166";
        ctx.fillRect(arred(heroi.x - camera.x + Math.cos(a) * 14 / RP), Math.round(heroi.y - 18 / RP - camera.y + Math.sin(a) * 5 / RP), 2, 2);
      }
    }
  }
  const DIRECAO_TIRO = { baixo: [0, 1], cima: [0, -1], esq: [-1, 0], dir: [1, 0] };

  // O mascote de alguém (o herói ou outro jogador): os que voam pairam, os outros respiram e correm atrás
  function desenharMascote(ator, t) {
    const m = ator.mascote;
    if (!m?.sprite) return;
    // o mascote grande: os que voam pairam (sobem e descem devagar, sombra no chão), os outros
    // respiram e dão pulinhos atrás do herói quando ele anda
    const voa = typeof MASCOTES_VOAM !== "undefined" && MASCOTES_VOAM.has(ator.avatar?.familiar);
    // correndo (o herói andando), cada mascote tem o seu jeito: ver familiarCorrida (avatar.js)
    const corre = ator.andando && m.corrida;
    const quadros = corre ? m.corrida.quadros : m.quadros || [m.sprite];
    // (os do bestiário têm 8 quadros parado: respiram, piscam e mexem o rabo um pouco mais depressa)
    const ritmo = corre ? m.corrida.ritmo : quadros.length === 4 ? 9 : quadros.length === 8 ? 5 : 2.6;
    const iq = Math.floor(t * ritmo) % quadros.length;
    const q = quadros[iq];
    const estilo = corre ? m.corrida.estilo : null;
    const lado = ator.direcao === "esq" ? -1 : 1;
    let altura = voa ? 9 + Math.round(Math.sin(t * 2.4) * 2) : ator.andando ? Math.abs(Math.round(Math.sin(t * 9) * 2)) : 0;
    let sx = 1;
    let sy = 1;
    let tremor = 0;
    // os rastros (poeira, penas, fogo, gosma) saem no máximo a cada tantos segundos
    const rastro = (intervalo) => {
      if (t - m.ultimoRastro < intervalo) return false;
      m.ultimoRastro = t;
      return true;
    };
    const atras = ator.familiar.x - lado * 3;
    if (estilo === "galope") {
      altura = 0;
      if (rastro(0.18)) particulaMundo(atras, ator.familiar.y - 1, { vx: -lado * (10 + Math.random() * 8), vy: -4 - Math.random() * 4, vida: 0.35, cor: "#e2d6b8", tamanho: 1 });
    } else if (estilo === "pisada") {
      altura = 0;
      // no pisão (quadros 1 e 3) o golem treme e a poeira sai dos dois lados
      if (iq % 2 === 1) {
        tremor = Math.sin(t * 60) > 0 ? 1 : -1;
        if (rastro(0.3)) [-1, 1].forEach((s) => particulaMundo(ator.familiar.x + s * 4, ator.familiar.y - 1, { vx: s * 14, vy: -3, vida: 0.4, cor: "#c9bfa8", tamanho: 1 }));
      }
    } else if (estilo === "asas") {
      altura = 10 + Math.round(Math.sin(t * 6) * 1.5);
      if (rastro(0.5)) particulaMundo(atras, ator.familiar.y - altura / RP - 6, { vx: -lado * 6, vy: 6, vida: 0.9, cor: "#e8d8b8", tamanho: 1 });
    } else if (estilo === "voo") {
      altura = 11 + Math.round(Math.sin(t * 7) * 1.5);
      const fogo = ator.avatar?.familiar === "fenix";
      if (rastro(fogo ? 0.06 : 0.14)) {
        const cores = fogo ? ["#ffd166", "#ff7a1a", "#ff4d3d"] : RASTRO_DO_MASCOTE[ator.avatar?.familiar] || ["#ffd166", "#fff3b0"];
        particulaMundo(atras - lado * 2, ator.familiar.y - altura / RP - 5, { vx: -lado * (8 + Math.random() * 6), vy: -4 + Math.random() * 6, vida: fogo ? 0.45 : 0.3, cor: cores[Math.floor(Math.random() * cores.length)], tamanho: 1 });
      }
    } else if (estilo === "quique") {
      // pula: achata ao tocar o chão, estica no ar, e deixa gotinhas de gosma onde caiu
      const fase = (t * 3.2) % 1;
      altura = Math.round(Math.sin(fase * Math.PI) * 8);
      const noChao = fase < 0.12 || fase > 0.88;
      sx = noChao ? 1.22 : 0.9;
      sy = noChao ? 0.78 : 1.12;
      if (noChao && rastro(0.25)) particulaMundo(ator.familiar.x, ator.familiar.y - 1, { vx: 0, vy: 0, vida: 1.2, cor: (RASTRO_DO_MASCOTE[ator.avatar?.familiar] || ["#5fd35f"])[0], tamanho: 1 });
    }
    // parado, os mascotes mágicos soltam a magia deles (brasas, faíscas, runas)
    const magia = !corre && RASTRO_DO_MASCOTE[ator.avatar?.familiar];
    if (magia && rastro(0.35)) {
      particulaMundo(ator.familiar.x + (Math.random() - 0.5) * 10, ator.familiar.y - altura / RP - 4 - Math.random() * 8,
        { vx: (Math.random() - 0.5) * 4, vy: -6 - Math.random() * 4, vida: 0.9, cor: magia[Math.floor(Math.random() * magia.length)], tamanho: 1 });
    }
    ctx.save();
    ctx.translate(arred(ator.familiar.x - camera.x), arred(ator.familiar.y - camera.y));
    ctx.scale(1 / RP, 1 / RP);
    ctx.fillStyle = `rgba(0, 0, 0, ${voa || altura > 6 ? 0.16 : 0.25})`;
    const sombra = Math.round(q.width * (voa || altura > 6 ? 0.22 : 0.3));
    ctx.fillRect(-sombra, -1, sombra * 2, 2);
    ctx.translate(tremor, -altura);
    if (lado < 0) ctx.scale(-1, 1);
    // o achatar/esticar parte dos pés (embaixo)
    ctx.scale(sx, sy);
    // galopando, o corpo inclina para a frente
    if (estilo === "galope") ctx.transform(1, 0, -0.08, 1, 0, 0);
    ctx.drawImage(q, -Math.round(q.width / 2), -q.height);
    ctx.restore();
    desenharEmoteMascote(ator, t, altura, q.height);
  }

  // Parado um tempinho, o mascote "fala": um coração, uma nota, um "!" ou o soninho (zzz), em pixel,
  // que sobe e some em cima da cabeça dele. Cada mascote tem o seu jeito (EMOTES_DO_MASCOTE).
  function desenharEmoteMascote(ator, t, altura, alturaSprite) {
    const m = ator.mascote;
    if (ator.andando || ator.familiar == null) {
      m.paradoDesde = null;
      return;
    }
    m.paradoDesde ??= t;
    const parado = t - m.paradoDesde;
    if (parado < 2.5) return;
    const ciclo = (parado - 2.5) % 7;
    if (ciclo > 1.6) return;
    const lista = parado > 20 ? ["zzz"] : EMOTES_DO_MASCOTE[ator.avatar?.familiar] || ["coracao", "nota"];
    const emote = EMOTES_PIXEL[lista[Math.floor((parado - 2.5) / 7) % lista.length]];
    const k = ciclo / 1.6;
    const sobe = Math.round(k * 5);
    const alfa = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.translate(arred(ator.familiar.x - camera.x), arred(ator.familiar.y - camera.y));
    ctx.scale(1 / RP, 1 / RP);
    // cada pixel do emote vale 2 x 2 do mascote, para ler bem
    const x0 = -emote.grade[0].length + 6;
    const y0 = -altura - alturaSprite - 4 - sobe * 2 - emote.grade.length * 2;
    emote.grade.forEach((linha, y) => [...linha].forEach((c, x) => {
      if (c === ".") return;
      ctx.fillStyle = c === "o" ? "#1b1533" : c === "w" ? "#ffffff" : emote.cor;
      ctx.fillRect(x0 + x * 2, y0 + y * 2, 2, 2);
    }));
    ctx.restore();
  }

  // Alguém com o corpo do herói: o próprio herói ou, no multijogador, outro jogador (ator.giro guarda a virada)
  function desenharPessoa(ator, t) {
    const g = ator.giro;
    // andando: os 4 quadros da caminhada; parado: respira e pisca
    const quadroAndar = ator.andando ? Math.floor(t * VELOCIDADE_ANDAR) % QUADROS_ANDAR : quadroParado(t, ator.fase);
    // A virada: o corpo gira pelos ângulos do meio (frente → 3/4 → lado → 3/4 de costas → costas),
    // com o rosto e a roupa escorregando na curva do corpo. Uma meia-volta passa pela frente (ou pelo
    // lado). 0,1 s por quarto de volta, com um pulinho e uma nuvenzinha de poeira nos pés.
    if (ator.direcao !== g.direcaoAnterior) {
      g.direcaoAnterior = ator.direcao;
      const alvo = ANGULO_DA_DIRECAO[ator.direcao] ?? 0;
      g.anguloDe = ((((g.anguloAgora + 180) % 360) + 360) % 360) - 180;
      g.anguloGiro = ((((alvo - g.anguloDe + 180) % 360) + 360) % 360) - 180;
      // Meia-volta (180°): antes ia sempre no mesmo sentido (horário), então da direita para a esquerda
      // ele passava de costas. Agora escolhe o caminho que passa mais de frente para a câmera
      // (esquerda ↔ direita sempre pela frente); empatado (frente ↔ costas), passa pelo lado do cajado
      // (a direita da tela, onde fica a mão da arma).
      if (Math.abs(Math.abs(g.anguloGiro) - 180) < 1) {
        const meio = (sentido) => g.anguloDe + sentido * 90;
        const deFrente = (a) => Math.cos((a * Math.PI) / 180);
        const doCajado = (a) => Math.sin((a * Math.PI) / 180);
        const [mais, menos] = [meio(1), meio(-1)];
        const empate = Math.abs(deFrente(mais) - deFrente(menos)) < 0.01;
        g.anguloGiro = (empate ? doCajado(mais) >= doCajado(menos) : deFrente(mais) > deFrente(menos)) ? 180 : -180;
      }
      g.virouEm = t;
      poeiraNosPes(3, 10, ator);
    }
    const duracaoGiro = Math.max(0.12, (Math.abs(g.anguloGiro) / 90) * 0.1);
    const giro = Math.min(1, (t - g.virouEm) / duracaoGiro);
    const suave = giro < 0.5 ? 2 * giro * giro : 1 - (-2 * giro + 2) ** 2 / 2;
    g.anguloAgora = giro < 1 ? g.anguloDe + g.anguloGiro * suave : ANGULO_DA_DIRECAO[ator.direcao] ?? 0;
    // o gesto da roda (G) pode virar o herói para a câmera (e girar, na dança): mistura com o ângulo de
    // sempre na entrada e na saída, para não pular
    const gesto = animacaoDoGesto(t, ator);
    // Assento (a arquibancada do coliseu, no multijogador): quem para ali vira para a arena e senta devagar.
    // Cada navegador decide pela posição, então todo mundo vê a mesma plateia sem mensagem a mais na rede.
    // Com duelo rolando (cenario.torcida), a plateia balança no ritmo e, de vez em quando, levanta vibrando.
    const assento = !ator.andando && !ator.gesto && cenario.assento ? cenario.assento(ator.x, ator.y) : null;
    if (assento) {
      ator.sentouEm ||= t;
      if (ator.direcao !== assento) ator.direcao = assento;
      gesto.sentar = suavizar((t - ator.sentouEm - 0.25) / 0.35);
      if (gesto.sentar > 0.9 && cenario.torcida?.()) {
        const fase = ator.fase || 0;
        gesto.tronco = Math.round(Math.sin(t * 8 + fase * 3));
        const vibra = Math.sin(t * 0.9 + fase * 5);
        if (vibra > 0.8) {
          gesto.sentar = 0.35;
          gesto.y = -Math.abs(Math.sin(t * 11 + fase)) * 3;
        }
      }
    } else ator.sentouEm = 0;
    let anguloExibido = g.anguloAgora;
    if (gesto.angulo) {
      const { alvo, peso } = gesto.angulo;
      const falta = ((((alvo - g.anguloAgora + 180) % 360) + 360) % 360) - 180;
      anguloExibido = peso >= 1 ? alvo : g.anguloAgora + falta * peso;
    }
    const vista = heroiNoAngulo((direcao, q) => ator.sprites[direcao][q], anguloExibido, ator.gesto ? 0 : quadroAndar);
    const lado = vista.direcao === "lado";
    const dirDesenho = lado ? (vista.espelhado ? "esq" : "dir") : vista.direcao;
    const sprite = vista.sprite;
    const pulinho = giro < 1 ? Math.round(Math.sin(giro * Math.PI) * 2) : 0;
    // a cada pisada (os quadros 2 e 6 são os do pé apoiando o peso) a poeira sobe para trás
    if (ator.andando && (quadroAndar === 2 || quadroAndar === 6) && g.ultimaPisada !== quadroAndar) poeiraNosPes(2, 6, ator);
    g.ultimaPisada = ator.andando ? quadroAndar : -1;
    // o herói é desenhado em pixels do próprio desenho (tamanho nativo), a partir dos pés
    ctx.save();
    ctx.translate(arred(ator.x - camera.x), arred(ator.y - camera.y));
    ctx.scale(1 / RP, 1 / RP);
    // a sombra encolhe quando o pé sobe (e no pulinho da virada)
    // no pulo do gesto a sombra encolhe e clareia conforme ele sobe
    const peNoAr = (ator.andando && [0, 1, 4, 5].includes(quadroAndar)) || pulinho > 0;
    const sombra = gesto.sombra ?? 1;
    ctx.fillStyle = `rgba(0, 0, 0, ${(0.25 * (0.5 + sombra / 2)).toFixed(3)})`;
    const meiaSombra = Math.round((peNoAr ? 6 : 8) * sombra);
    ctx.fillRect(-meiaSombra, -1, meiaSombra * 2, 2);
    ctx.fillRect(-meiaSombra + 2, -2, Math.max(0, meiaSombra * 2 - 4), 1);
    if (ator.aura) desenharAura(ctx, ator.aura, t, false);
    const auraVisual = ator.avatar?.aura && ator.avatar.aura !== "simples" ? ator.avatar.aura : null;
    if (auraVisual) desenharAuraVisual(ctx, auraVisual, t, false);
    ctx.save();
    ctx.translate(Math.round(gesto.x), Math.round(-pulinho + gesto.y));
    ctx.scale((dirDesenho === "esq" ? -1 : 1) * gesto.sx, gesto.sy);
    // andando de lado, o corpo inclina para a frente (a partir dos pés)
    if (ator.andando && lado && giro >= 1) ctx.transform(1, 0, -0.07, 1, 0, 0);
    desenharCorpoComGesto(ctx, sprite, gesto);
    // itens épicos e lendários brilham e soltam partículas (viram junto com o herói)
    desenharEfeitosHeroi(ctx, ator.avatar, t, -16, -PE_HEROI, lado ? "lado" : dirDesenho);
    ctx.restore();
    // o que o gesto põe em volta: ícones pequenos, textinhos e o balão em cima da cabeça
    if (ator.gesto) {
      const topo = -PE_HEROI + 8 + Math.round(gesto.y) + Math.round(gesto.sentar * 9 + gesto.curvar * 6);
      gesto.extras.forEach(([emoji, ex, ey, a]) => {
        if (a <= 0) return;
        const icone = emojiDoGesto(emoji);
        const lado2 = Math.round(icone.width * 0.6);
        ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(icone, Math.round(ex - lado2 / 2), Math.round(ey + gesto.y), lado2, lado2);
      });
      ctx.globalAlpha = 1;
      gesto.textos.forEach((texto) => textoDoGesto(ctx, texto));
      if (gesto.balao) balaoDoGesto(ctx, gesto.balao, topo);
    }
    if (ator.aura) desenharAura(ctx, ator.aura, t, true);
    if (auraVisual) desenharAuraVisual(ctx, auraVisual, t, true);
    ctx.restore();
  }

  // ---------- o que tem altura: a lista (de cima para baixo) e o desenho de cada um ----------
  // juntarCoisas(w, h): o que está perto da vista, em ordem de profundidade (quem está mais embaixo, na frente).
  // No clássico, a sombra de quem voa alto é pintada no chão aqui mesmo.
  function juntarCoisas(w, h) {
    // tudo que tem altura é desenhado de cima para baixo (quem está mais embaixo fica na frente)
    const coisas = [];
    (cenario.props || []).forEach((p) => {
      if (p.porCima) return;
      const meia = larg(p.sprite) / 2;
      if (p.x > camera.x - meia && p.x < camera.x + w + meia && p.y > camera.y - 8 && p.y < camera.y + h + alt(p.sprite)) coisas.push({ y: p.y, tipo: "prop", p });
    });
    // no mundo grande só entra na lista o que está perto da tela (a folga cobre desenhos altos e largos)
    const naTela = (x, y, folga = 160) => x > camera.x - folga && x < camera.x + w + folga && y > camera.y - 40 && y < camera.y + h + folga * 1.5;
    cenario.lugares.forEach((l) => !l.escondido && naTela(l.px, l.py) && coisas.push({ y: l.py, tipo: "lugar", l }));
    (cenario.monstros || []).forEach((m) => {
      if (!naTela(m.x, m.y, m.voaAlto ? 320 : 160) || (m.derrotado && m.derrotado())) return;
      // quem voa alto passa por cima de tudo (árvores, casas, o herói); no chão fica só a sombra dele,
      // que encolhe e clareia quanto mais alto ele está
      if (m.voaAlto) {
        const k = Math.max(0.4, 1 - m.altura / 110);
        ctx.fillStyle = `rgba(10, 4, 20, ${0.16 + 0.22 * k})`;
        ctx.beginPath();
        ctx.ellipse(m.x - camera.x, m.y - camera.y, 30 * k, 8 * k, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      coisas.push({ y: m.voaAlto ? m.y + 1e6 : m.y, tipo: "monstro", m });
    });
    coisas.push({ y: familiar.y, tipo: "familiar", ator: heroi }, { y: heroi.y, tipo: "heroi", ator: heroi });
    // os outros jogadores (multijogador) entram na mesma ordem de profundidade
    outros.forEach((o) => {
      if (!naTela(o.x, o.y)) return;
      coisas.push({ y: o.familiar.y, tipo: "familiar", ator: o }, { y: o.y, tipo: "heroi", ator: o });
    });
    coisas.sort((a, b) => a.y - b.y);
    return coisas;
  }

  function desenharCoisa(c, t) {
      if (c.tipo === "prop") {
        const p = c.p;
        // herói escondido atrás de uma árvore ou casa grande: ela fica meio transparente
        const pw = larg(p.sprite);
        const ph = alt(p.sprite);
        const atras = p.vazado && heroi.y < p.y - 2 && heroi.y > p.y - ph + 12 && Math.abs(heroi.x - p.x) < pw / 2 - 2;
        if (atras) ctx.globalAlpha = 0.5;
        const x0 = arred(p.x - pw / 2 - camera.x);
        const y0 = arred(p.y - ph - camera.y);
        if (p.balanco) desenharFolhagem(ctx, p, x0, y0, t);
        else ctx.drawImage(p.sprite, x0, y0, pw, ph);
        if (p.animar) p.animar(ctx, x0, y0, t);
        ctx.globalAlpha = 1;
      } else if (c.tipo === "lugar") {
        const l = c.l;
        // morador que passeia: o quadro da caminhada na direção em que está indo
        if (l.sprites) l.sprite = l.sprites[l.direcao === "esq" || l.direcao === "dir" ? "lado" : l.direcao][l.andando ? Math.floor(t * 14) % QUADROS_ANDAR : quadroParado(t, l.fase)];
        const lw = larg(l.sprite, l.res);
        const lh = alt(l.sprite, l.res);
        const x = arred(l.px - lw / 2 - camera.x);
        const y = arred(l.py - lh - camera.y);
        if (l.liberada === false) ctx.filter = "grayscale(0.85) brightness(0.8)";
        if (l.sprites && l.direcao === "esq") {
          ctx.save();
          ctx.translate(x + lw, y);
          ctx.scale(-1, 1);
          ctx.drawImage(l.sprite, 0, 0, lw, lh);
          ctx.restore();
        } else ctx.drawImage(l.sprite, x, y, lw, lh);
        ctx.filter = "none";
        if (l.animar) l.animar(ctx, x, y, t);
      } else if (c.tipo === "monstro") {
        const m = c.m;
        // o quadro da caminhada: anda quando tem para onde ir (quem voa bate as asas sempre); chefões
        // e quem está parado ficam no quadro de descanso, respirando com o pulinho
        // quem tem quadros desenhados (lobos, dragões) usa os dele; os outros saem do desenho parado
        const estilo = estiloDeAndar(m);
        const andando = Boolean(m.alvo) || estilo === "asas" || m.voaAlto;
        const quadros = m.quadros || (m.parado ? null : quadrosDeAndar(m.sprite, estilo));
        const ritmo = m.voaAlto ? (m.mergulho ? 11 : 7) : estilo === "asas" ? 10 : 8;
        // os do bestiário ("vivo") têm quadros de vida: tocam até parados (o slime borbulha, o sapo infla o papo)
        const quadroM = !quadros ? m.sprite
          : m.vivo ? quadros[Math.floor(t * (andando ? 10 : 7) + m.casa[0] * 3) % quadros.length]
            : quadros[andando ? Math.floor(t * ritmo + m.casa[0]) % quadros.length : 1 % quadros.length];
        // As ações próprias de quem está parado, cada um no seu ritmo (a cada 6 a 11 s, por 1,2 s): slimes e
        // fantasmas dão um pulão (achatando ao pousar), quem tem patas olha para os lados e fareja, e quem
        // voa dá um mergulho rápido e vira no ar.
        const acao = { sx: 1, sy: 1, dy: 0, virar: false };
        if (!m.alvo && !m.voaAlto && !m.mergulho) {
          const periodo = 6 + ((m.casa[0] * 7 + m.casa[1] * 3) % 6);
          const fase = (t + m.casa[1] * 1.7) % periodo;
          if (fase < 1.2) {
            const p = fase / 1.2;
            if (estilo === "quique") {
              const chao = p < 0.15 || p > 0.85;
              acao.dy = Math.sin(p * Math.PI) * 10;
              acao.sx = chao ? 1.15 : 0.9;
              acao.sy = chao ? 0.85 : 1.12;
            } else if (estilo === "patas") {
              acao.virar = p > 0.25 && p < 0.6;
              acao.sy = 1 + Math.sin(p * Math.PI * 4) * 0.04;
            } else if (estilo === "asas") {
              acao.dy = -Math.sin(p * Math.PI) * 6;
              acao.virar = p > 0.5;
            }
          }
        }
        // o "!" quando o herói chega perto de um monstro bravo
        const pertoDoHeroi = Math.hypot(heroi.x - m.x, heroi.y - m.y);
        if (m.agressivo && pertoDoHeroi < 56 && !m.alertado) m.alertado = t;
        if (pertoDoHeroi > 90) m.alertado = 0;
        const pulo = acao.dy + (m.voaAlto ? m.altura * RP + Math.sin(t * 2) * 3
          : m.voa ? 6 + Math.sin(t * 3 + m.casa[0]) * 3
            : estilo === "patas" && andando ? 0 : Math.abs(Math.sin(t * (andando ? 5 : 2) + m.casa[0])) * (andando ? 3 : 1));
        // o monstro é desenhado em pixels do próprio desenho (tamanho nativo), a partir dos pés dele
        ctx.save();
        ctx.translate(arred(m.x - camera.x), arred(m.y - camera.y));
        ctx.scale(1 / RP, 1 / RP);
        const mx = -Math.round(quadroM.width / 2);
        const my = -quadroM.height + 1 - Math.round(pulo);
        if (!m.voaAlto) {
          // a sombra no chão: oval embaixo de todo monstro (quem voa tem a sombra menor e mais clara)
          const largura = Math.max(8, Math.round(m.sprite.width * (m.voa ? 0.3 : 0.4)));
          ctx.fillStyle = m.voa ? "rgba(10, 4, 20, 0.18)" : "rgba(10, 4, 20, 0.28)";
          ctx.beginPath();
          ctx.ellipse(0, 0, largura, Math.max(2, largura / 4), 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // chefão: aura vermelha pulsando (no chão; em quem voa alto, em volta do corpo)
        if (m.chefe) brilhoRedondo(ctx, 0, m.voaAlto ? Math.round(my + quadroM.height / 2) : -4, Math.round(quadroM.width * (m.voaAlto ? 0.45 : 0.3)), "255, 60, 60", 0.04 + Math.sin(t * 3) * 0.02);
        // criaturas da noite: umas brilham, outras são meio transparentes
        if (m.brilho) brilhoRedondo(ctx, 0, Math.round(my + m.sprite.height / 2), 22, m.brilho, 0.09 + Math.sin(t * 4 + m.casa[0]) * 0.03);
        if (m.translucido) ctx.globalAlpha = 0.55 + Math.sin(t * 2 + m.casa[1]) * 0.15;
        // a ação estica ou achata o corpo a partir dos pés
        ctx.save();
        ctx.scale(acao.sx, acao.sy);
        if (acao.virar ? !m.virado : m.virado) {
          ctx.save();
          ctx.translate(mx + quadroM.width, my);
          ctx.scale(-1, 1);
          ctx.drawImage(quadroM, 0, 0);
          ctx.restore();
        } else ctx.drawImage(quadroM, mx, my);
        ctx.restore();
        ctx.globalAlpha = 1;
        if (m.alertado && t - m.alertado < 1.1) {
          const k = t - m.alertado;
          // sobe acima dos corações de quem tem mais de uma vida
          const salto = (k < 0.15 ? (k / 0.15) * 6 : 6 - Math.min(2, (k - 0.15) * 8)) + (m.vida > 1 ? 4 : 0);
          ctx.font = "bold 13px 'Jersey 10', monospace";
          ctx.textAlign = "center";
          ctx.lineWidth = 3;
          ctx.strokeStyle = "#1b1205";
          ctx.strokeText("!", 0, Math.round(my - 8 - salto));
          ctx.fillStyle = "#ffd166";
          ctx.fillText("!", 0, Math.round(my - 8 - salto));
        }
        // quem aguenta mais de uma resposta mostra os corações em cima da cabeça
        if (m.vida > 1) {
          const largura = m.vida * 4 - 1;
          const px = -Math.round(largura / 2);
          for (let i = 0; i < m.vida; i++) {
            ctx.fillStyle = "#1b1533";
            ctx.fillRect(px + i * 4 - 1, my - 6, 5, 4);
            ctx.fillStyle = m.chefe ? "#ffd166" : "#ff4d6d";
            ctx.fillRect(px + i * 4, my - 5, 3, 2);
          }
        }
        ctx.restore();
      } else if (c.tipo === "familiar") {
        desenharMascote(c.ator, t);
      } else if (c.tipo === "heroi") {
        desenharPessoa(c.ator, t);
      }
  }

  // um ponto do mundo (o pé de alguém e a altura acima dele, em unidades do mundo) em pixels da tela, para o
  // HTML por cima (rótulos, plaquinhas, balões)
  function naTelaCss(x, y, altura = 0) {
    return `translate(${(x - camera.x) * escala}px, ${(y - altura - camera.y) * escala}px)`;
  }

  function posicionarHtml(naTela) {
    // rótulos e aviso acompanham a câmera
    perto = cenario.lugares.find((l) => !l.escondido && Math.hypot(heroi.x - l.entrada.x, heroi.y - l.entrada.y) < 22) || null;
    cenario.lugares.forEach((l) => {
      if (l.rotulo) l.rotulo.style.transform = `${naTelaCss(l.px + (l.deslocarRotulo || 0), l.py, (l.alturaRotulo || alt(l.sprite, l.res)) + 4)} translate(-50%, -100%)`;
    });
    aviso.hidden = !perto;
    plaquinha.hidden = Boolean(perto);
    plaquinha.style.transform = `${naTelaCss(heroi.x, heroi.y, (PE_HEROI + 4) / RP)} translate(-50%, -100%)`;
    posicionarBalao(heroi);
    outros.forEach((o) => {
      const visivel = naTela(o.x, o.y, 30);
      o.placa.hidden = !visivel;
      if (visivel) o.placa.style.transform = `${naTelaCss(o.x, o.y, (PE_HEROI + 4) / RP)} translate(-50%, -100%)`;
      if (o.balao) o.balao.el.hidden = !visivel;
      posicionarBalao(o);
    });
    // a roda de gestos fica centrada no herói
    if (roda) roda.el.style.transform = `${naTelaCss(heroi.x, heroi.y, PE_HEROI / 2 / RP)} translate(-50%, -50%)`;
    if (perto) {
      aviso.textContent = `${perto.liberada === false ? "🔒" : "▲"} E · ${perto.acao || "Entrar"}: ${perto.nome}`;
      aviso.style.transform = `${naTelaCss(heroi.x, heroi.y, (PE_HEROI + 2) / RP)} translate(-50%, -100%)`;
    }
    // os balões de fala acompanham a cabeça de quem fala e somem sozinhos
    const agora = performance.now();
    for (let i = baloes.length - 1; i >= 0; i--) {
      const b = baloes[i];
      if (agora > b.ate || b.l.escondido) {
        b.el.remove();
        baloes.splice(i, 1);
        continue;
      }
      b.el.style.transform = `${naTelaCss(b.l.px, b.l.py, alt(b.l.sprite, b.l.res) + 2)} translate(-50%, -100%)`;
    }
  }

  function desenhar(t) {
    // w e h em unidades do mundo; o ctx desenha tudo multiplicado pela resolução
    const w = canvas.width / R;
    const h = canvas.height / R;
    ctx.setTransform(R, 0, 0, R, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const larguraMundo = colunas * TILE_MUNDO;
    const alturaMundo = linhas * TILE_MUNDO;
    // em tela cheia o HUD fica por cima do topo do mapa: a câmera pode descer essa faixa a mais
    const margem = document.body.classList.contains("modo-mundo") ? Math.ceil(70 / escala) : 0;
    // mapa menor que a tela fica centralizado; maior, a câmera segue o herói
    camera = {
      x: larguraMundo <= w ? arred((larguraMundo - w) / 2) : arred(Math.min(Math.max(heroi.x - w / 2, 0), larguraMundo - w)),
      y: alturaMundo + margem <= h ? arred((alturaMundo - margem - h) / 2) : arred(Math.min(Math.max(heroi.y - h / 2, -margem), alturaMundo - h)),
    };
    ctx.fillStyle = cenario.corFundo;
    ctx.fillRect(0, 0, w, h);
    // o chão: pintado aos pedaços a partir do tileset (só o que aparece na tela) ou uma imagem inteira pronta
    if (cenario.desenharChao) cenario.desenharChao(ctx, camera, w, h, t);
    else ctx.drawImage(cenario.chao, -camera.x, -camera.y, larg(cenario.chao), alt(cenario.chao));
    if (cenario.animarChao) cenario.animarChao(ctx, camera, w, h, t);

    const coisas = juntarCoisas(w, h);
    const naTela = (x, y, folga = 160) => x > camera.x - folga && x < camera.x + w + folga && y > camera.y - 40 && y < camera.y + h + folga * 1.5;

    coisas.forEach((c) => desenharCoisa(c, t));
    // o que voa (como o dragãozinho do lobby) é desenhado por cima de tudo; animar recebe o ponto (x, y) na tela
    (cenario.props || []).filter((p) => p.porCima).forEach((p) => p.animar(ctx, Math.round(p.x - camera.x), Math.round(p.y - camera.y), t));
    if (cenario.animarPorCima) cenario.animarPorCima(ctx, camera, w, h, t, heroi);
    // as faíscas das habilidades brilham por cima de tudo (até da escuridão da noite)
    desenharEfeitos(t);

    posicionarHtml(naTela);
  }

  // com o menu de pausa (Esc) aberto ou a aba escondida, o mundo congela: nada se mexe e nada é
  // redesenhado (o último quadro fica parado atrás do menu)
  const menuPausa = document.getElementById("menu-pausa");
  function laco(agora) {
    if (!ativo) return;
    if (!container.isConnected) return destruir();
    quadro = requestAnimationFrame(laco);
    if (menuPausa?.open || document.hidden) {
      ultimo = agora;
      return;
    }
    // Cenários pesados podem limitar os quadros (o Salão): só monitores rápidos pulam quadro, um sim e um não
    // (144 Hz vira 72, 120 vira 60); 60 e 75 Hz desenham todos. Cortar "a cada 16 ms" num monitor de 75 Hz
    // pulava metade e o movimento engasgava.
    if (cenario.quadrosPorSegundo && agora - ultimo < (1000 / cenario.quadrosPorSegundo) * 0.75) return;
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    const t = Math.max(0, (agora - inicio) / 1000); // o primeiro quadro pode chegar antes do "inicio"
    const espera = emEspera();
    if (espera) {
      teclas.clear();
      caminho = [];
    } else if (estavaEmEspera) voltouEm = agora;
    estavaEmEspera = espera;
    // os outros jogadores seguem andando mesmo com uma janela aberta por cima (eles não esperam ninguém)
    if (outros.size) {
      moverOutros(dt);
      if (espera || pausado) atualizarEfeitos(dt);
    }
    if (!pausado && !espera) {
      mover(dt);
      moverMonstros(dt, agora);
      moverMoradores(dt);
      vidaDosMoradores(dt);
      sonsDosMonstros(dt);
      atualizarEfeitos(dt);
      seguirMascote(heroi, dt);
      if (agora - ultimoSalvo > 600) {
        ultimoSalvo = agora;
        dados.aoMover({ x: Math.round(heroi.x), y: Math.round(heroi.y) });
        // o som do lugar onde o herói está (vento, pássaros, grilos à noite, lava...)
        if (typeof Som !== "undefined" && Som.ambiente) Som.ambiente(cenario.ambiente ? cenario.ambiente(heroi.x, heroi.y) : "academia");
      }
      // os passos, conforme o chão (e a poeira que o pé levanta)
      if (heroi.andando && typeof Som !== "undefined") {
        const chao = cenario.chaoDoPasso ? cenario.chaoDoPasso(Math.floor(heroi.x / TILE_MUNDO), Math.floor(heroi.y / TILE_MUNDO)) : "pedra";
        Som.passo(chao);
        if (Math.random() < dt * 5 && ["areia", "neve", "lama"].includes(chao)) {
          particulaMundo(heroi.x + (Math.random() - 0.5) * 6, heroi.y - 1, { vx: (Math.random() - 0.5) * 14, vy: -8, vida: 0.4, cor: { areia: "#e8d39a", neve: "#ffffff", lama: "#5b6340" }[chao], tamanho: 1 });
        }
      }
    }
    desenhar(t);
  }
  quadro = requestAnimationFrame(laco);

  function destruir() {
    if (!ativo) return;
    ativo = false;
    cancelAnimationFrame(quadro);
    if (typeof Som !== "undefined" && Som.ambiente) Som.ambiente(null);
    observador.disconnect();
    if (window.mundoAtivo?.heroi === heroi) window.mundoAtivo = null;
    window.removeEventListener("keydown", aoTeclar);
    window.removeEventListener("keyup", aoSoltar);
  }
  // o herói fica exposto para quem quiser acompanhar a posição dele (como o minimapa do Reino), e as
  // habilidades da barra de baixo (app.js) mandam aqui o efeito delas
  const api = {
    destruir, heroi, ativo: () => ativo,
    podeTeleportar: Boolean(cenario.teleporte),
    temMonstros: Boolean(cenario.monstros?.length),
    acelerar(segundos) {
      heroi.corridaAte = performance.now() / 1000 + segundos;
      explosaoMundo(heroi.x, heroi.y - 2, "#d8c9a3", 10, 30);
    },
    iluminar(segundos) {
      heroi.luzAte = performance.now() / 1000 + segundos;
      explosaoMundo(heroi.x, heroi.y - 18 / RP, "#ffd166", 16, 45);
    },
    brilhar(cor) {
      explosaoMundo(heroi.x, heroi.y - 18 / RP, cor, 18, 35);
      for (let i = 0; i < 12; i++) particulaMundo(heroi.x + (Math.random() - 0.5) * 16, heroi.y - Math.random() * 10, { vy: -25, vida: 0.9, cor, tamanho: 2 });
    },
    teleportar() {
      if (!cenario.teleporte) return;
      explosaoMundo(heroi.x, heroi.y - 18 / RP, "#a98bff", 22, 55);
      caminho = [];
      entrarAoChegar = null;
      heroi.x = cenario.teleporte.x;
      heroi.y = cenario.teleporte.y;
      familiar.x = heroi.x - 12;
      familiar.y = heroi.y;
      dados.aoMover?.({ x: heroi.x, y: heroi.y });
      explosaoMundo(heroi.x, heroi.y - 18 / RP, "#6ef0ff", 22, 55);
    },
    // manda o herói andar sozinho até um tile (o diário de missões usa); devolve se achou caminho
    caminharPara(tx, ty) {
      entrarAoChegar = null;
      caminharAte(tx, ty);
      return caminho.length > 0;
    },
    disparar(cor) {
      const [dx, dy] = DIRECAO_TIRO[heroi.direcao] || [0, 1];
      projeteis.push({ x: heroi.x + dx * 8, y: heroi.y - 16 / RP + dy * 6, vx: dx * 230, vy: dy * 230, vida: 0.75, cor });
    },
    // leva o herói direto para um ponto (o multijogador põe os duelistas na arena), com brilho
    posicionar(x, y, direcao) {
      caminho = [];
      entrarAoChegar = null;
      explosaoMundo(heroi.x, heroi.y - 18 / RP, "#a98bff", 16, 45);
      Object.assign(heroi, { x, y }, direcao ? { direcao } : {});
      familiar.x = x - 12;
      familiar.y = y;
      explosaoMundo(x, y - 18 / RP, "#ffd166", 22, 55);
      dados.aoMover?.({ x, y });
    },
    // a fala do próprio herói (o balão em cima dele)
    falar(texto, opcoes) {
      balaoDeFala(heroi, texto, opcoes);
    },
    // os botões de toque (celular): a roda de gestos (o G) e o "E" de entrar/falar no lugar mais perto
    abrirGestos() {
      if (roda) fecharRoda(false);
      else abrirRoda();
    },
    interagir() {
      if (perto) entrar(perto);
    },
    // os outros jogadores: p = { avatar, nome, tituloHtml, aura, marca, x, y, direcao }
    outros: {
      por(sid, p) {
        let o = outros.get(sid);
        if (!o || JSON.stringify(o.avatar) !== JSON.stringify(p.avatar || {})) {
          o?.placa.remove();
          o?.balao?.el.remove();
          o = Object.assign(novoOutro(sid, p), o ? { x: o.x, y: o.y, alvoX: o.alvoX, alvoY: o.alvoY } : {});
          outros.set(sid, o);
        }
        o.aura = p.aura || null;
        plaquinhaDoOutro(o, p);
        return o;
      },
      mover(sid, x, y, direcao, andando) {
        const o = outros.get(sid);
        if (!o) return;
        const agora = performance.now();
        o.alvoX = x;
        o.alvoY = y;
        if (direcao) o.direcaoRede = direcao;
        o.andandoRede = Boolean(andando);
        o.ultimaRede = agora;
        o.anterior = o.fila[o.fila.length - 1] || null; // para continuar na mesma velocidade se a rede atrasar
        o.fila.push({ t: agora, x, y });
        if (o.fila.length > 30) o.fila.splice(0, o.fila.length - 30);
      },
      gesto(sid, id) {
        const o = outros.get(sid);
        const g = GESTOS.find((x) => x.id === id);
        if (o && g) o.gesto = { ...g, inicio: null };
      },
      falar(sid, texto, opcoes) {
        const o = outros.get(sid);
        if (o) balaoDeFala(o, texto, opcoes);
      },
      tirar(sid) {
        const o = outros.get(sid);
        if (!o) return;
        explosaoMundo(o.x, o.y - 18 / RP, "#a98bff", 12, 40);
        o.placa.remove();
        o.balao?.el.remove();
        outros.delete(sid);
      },
      onde(sid) {
        const o = outros.get(sid);
        return o ? { x: o.x, y: o.y } : null;
      },
      quantos: () => outros.size,
    },
  };
  window.mundoAtivo = api;
  return api;
}
