// Cenários em pixel art pintados em código: a Academia, o Reino e o salão de aula.
// animarCenario(canvas, pintor) redesenha a cada quadro enquanto o canvas estiver na página.
// Depende de pixel.js.

function sorteador(semente) {
  let s = semente;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Céu em faixas com pontilhado entre elas (o "dithering" clássico de 16 bits).
function ceuEmFaixas(ctx, largura, altura, cores) {
  const faixa = altura / cores.length;
  cores.forEach((cor, i) => retangulo(ctx, 0, Math.floor(i * faixa), largura, Math.ceil(faixa), cor));
  for (let i = 1; i < cores.length; i++) {
    const y = Math.floor(i * faixa);
    ctx.fillStyle = cores[i - 1];
    for (let x = 0; x < largura; x += 2) {
      ctx.fillRect(x + (y % 2), y, 1, 1);
      ctx.fillRect(x + ((y + 1) % 2), y + 2, 1, 1);
    }
  }
}

function circuloPixel(ctx, cx, cy, r, cor) {
  ctx.fillStyle = cor;
  for (let y = -r; y <= r; y++) {
    const meia = Math.round(Math.sqrt(r * r - y * y));
    ctx.fillRect(cx - meia, cy + y, meia * 2 + 1, 1);
  }
}

function pinheiro(ctx, x, y, escuro = "#1f5c33", claro = "#2f7d46") {
  for (let i = 0; i < 7; i++) {
    const meia = Math.floor(i / 2) + 1;
    retangulo(ctx, x - meia, y - 9 + i, meia * 2 + 1, 1, i % 3 === 2 ? escuro : claro);
  }
  retangulo(ctx, x, y - 2, 1, 3, "#5c3418");
}

const estrelasAcademia = (() => {
  const r = sorteador(11);
  return Array.from({ length: 46 }, () => [Math.floor(r() * 160), Math.floor(r() * 62), r() * 6]);
})();

function pintarAcademiaExterna(ctx, t) {
  ceuEmFaixas(ctx, 160, 80, ["#0d0a24", "#1a1240", "#2b1d5c", "#3d2a7a"]);
  estrelasAcademia.forEach(([x, y, fase]) => {
    if (Math.sin(t * 2 + fase) > -0.3) retangulo(ctx, x, y, 1, 1, Math.sin(t * 3 + fase) > 0.6 ? "#ffffff" : "#b8aecd");
  });
  circuloPixel(ctx, 130, 18, 9, "#f4f1d0");
  [[127, 15], [133, 20], [129, 22]].forEach(([x, y]) => retangulo(ctx, x, y, 2, 2, "#ddd8b0"));
  // montanhas distantes
  for (let x = 0; x < 160; x++) {
    const topo = 62 + Math.round(Math.sin(x * 0.09) * 5 + Math.sin(x * 0.23) * 3);
    retangulo(ctx, x, topo, 1, 80 - topo, "#1f1745");
  }
  // colina
  for (let x = 0; x < 160; x++) {
    const topo = 76 + Math.round(Math.abs(x - 80) * 0.12);
    retangulo(ctx, x, topo, 1, 110 - topo, "#1d3b2a");
    retangulo(ctx, x, topo, 1, 1, "#2f6b45");
  }
  // castelo
  const pedra = "#3a3360";
  const sombra = "#2b2548";
  retangulo(ctx, 64, 44, 32, 36, pedra);
  retangulo(ctx, 88, 44, 8, 36, sombra);
  [[54, 32, 12], [94, 28, 12]].forEach(([x, y, w]) => {
    retangulo(ctx, x, y, w, 80 - y, pedra);
    retangulo(ctx, x + w - 3, y, 3, 80 - y, sombra);
    for (let i = 0; i < 9; i++) retangulo(ctx, x + w / 2 - Math.floor(i * 0.75) - 1, y - 9 + i, Math.floor(i * 1.5) + 2, 1, i % 2 ? "#6c48c9" : "#4a2f93");
  });
  retangulo(ctx, 75, 16, 10, 28, pedra);
  retangulo(ctx, 82, 16, 3, 28, sombra);
  for (let i = 0; i < 12; i++) retangulo(ctx, 80 - Math.floor(i * 0.6) - 1, 4 + i, Math.floor(i * 1.2) + 2, 1, i % 2 ? "#6c48c9" : "#4a2f93");
  // cristal no topo da torre central
  retangulo(ctx, 79, 0, 2, 3, Math.sin(t * 4) > 0 ? "#6ef0ff" : "#d9fbff");
  for (let x = 64; x < 96; x += 4) retangulo(ctx, x, 41, 2, 3, pedra);
  // janelas acesas que tremeluzem
  [[58, 40], [98, 38], [70, 50], [86, 50], [78, 24], [70, 62], [86, 62], [58, 56], [98, 56]].forEach(([x, y], i) => {
    retangulo(ctx, x, y, 3, 4, Math.sin(t * 3 + i * 1.7) > -0.7 ? "#ffd96b" : "#c99a2e");
  });
  retangulo(ctx, 76, 70, 8, 10, "#120d22");
  retangulo(ctx, 77, 69, 6, 1, "#120d22");
  retangulo(ctx, 78, 78, 4, 2, "#ffb347");
  // caminho
  for (let y = 80; y < 110; y++) retangulo(ctx, 77 - Math.floor((y - 80) / 3), y, 6 + Math.floor((y - 80) / 1.5), 1, y % 3 ? "#8a7350" : "#6f5b3d");
  // morcegos
  [[0, 30], [1.7, 40]].forEach(([fase, altura]) => {
    const x = ((t * 18 + fase * 60) % 200) - 20;
    const y = altura + Math.round(Math.sin(t * 3 + fase) * 4);
    const asa = Math.sin(t * 14 + fase) > 0;
    retangulo(ctx, x, y, 1, 1, "#0a0816");
    retangulo(ctx, x - 2, y - (asa ? 1 : 0), 2, 1, "#0a0816");
    retangulo(ctx, x + 1, y - (asa ? 1 : 0), 2, 1, "#0a0816");
  });
}

const arvoresReino = (() => {
  const r = sorteador(5);
  return Array.from({ length: 26 }, () => [Math.floor(r() * 160), 72 + Math.floor(r() * 36)]).sort((a, b) => a[1] - b[1]);
})();

let dragaoReino = null;
function pintarReinoExterno(ctx, t) {
  ceuEmFaixas(ctx, 160, 60, ["#5ab4f0", "#78c6f5", "#9dd8fa", "#c4ebff"]);
  circuloPixel(ctx, 24, 16, 8, "#fff3a0");
  circuloPixel(ctx, 24, 16, 6, "#fffbe0");
  // nuvens
  [[0, 12, 1], [70, 22, 0.7], [130, 8, 1.2]].forEach(([inicio, y, velocidade]) => {
    const x = ((inicio + t * 6 * velocidade) % 200) - 30;
    retangulo(ctx, x, y, 18, 4, "#ffffff");
    retangulo(ctx, x + 4, y - 3, 9, 3, "#ffffff");
    retangulo(ctx, x + 2, y + 4, 14, 1, "#dbefff");
  });
  // montanhas com neve
  for (let x = 0; x < 160; x++) {
    const topo = 40 + Math.round(Math.abs(((x * 1.3) % 40) - 20) * 0.9 + Math.sin(x * 0.2) * 2);
    retangulo(ctx, x, topo, 1, 64 - topo, x % 40 > 20 ? "#6b74a8" : "#7d86b8");
    if (topo < 46) retangulo(ctx, x, topo, 1, 3, "#f2f4ff");
  }
  // castelinho distante
  retangulo(ctx, 118, 48, 12, 10, "#b9b2a3");
  retangulo(ctx, 116, 44, 4, 14, "#a8a092");
  retangulo(ctx, 128, 44, 4, 14, "#a8a092");
  retangulo(ctx, 116, 42, 4, 2, "#2e86c1");
  retangulo(ctx, 128, 42, 4, 2, "#2e86c1");
  // colinas
  for (let x = 0; x < 160; x++) {
    const topo = 58 + Math.round(Math.sin(x * 0.05 + 1) * 5);
    retangulo(ctx, x, topo, 1, 110 - topo, "#4f9a3e");
    const frente = 70 + Math.round(Math.sin(x * 0.07) * 4);
    retangulo(ctx, x, frente, 1, 110 - frente, "#5fa84a");
    if ((x * 7) % 5 === 0) retangulo(ctx, x, frente + 3 + (x % 7), 1, 1, "#7cbf5a");
  }
  // rio correndo
  for (let y = 62; y < 110; y++) {
    const x = 92 - Math.round((y - 62) * 0.45 + Math.sin(y * 0.15) * 4);
    const largura = 3 + Math.floor((y - 62) / 8);
    retangulo(ctx, x, y, largura, 1, "#3d8fc9");
    if ((y + Math.floor(t * 10)) % 6 === 0) retangulo(ctx, x + 1, y, 1, 1, "#a7dcff");
  }
  arvoresReino.forEach(([x, y]) => pinheiro(ctx, x, y));
  // dragão cruzando o céu
  if (!dragaoReino) {
    dragaoReino = new Image();
    dragaoReino.src = emojiPixel("🐉", 16);
  }
  if (dragaoReino.complete) {
    const x = ((t * 14) % 220) - 30;
    ctx.save();
    ctx.translate(x + 16, 26 + Math.round(Math.sin(t * 2) * 3));
    ctx.scale(-1, 1);
    ctx.drawImage(dragaoReino, 0, 0);
    ctx.restore();
  }
}

const livrosEstante = (() => {
  const r = sorteador(3);
  const cores = ["#a8323e", "#2e5cb8", "#1f7a5c", "#c46a1b", "#6c48c9", "#e2b04a"];
  return Array.from({ length: 80 }, () => [cores[Math.floor(r() * cores.length)], 4 + Math.floor(r() * 3)]);
})();

let zetsuSalao = null;
function pintarSalaoAcademia(ctx, t) {
  // parede de pedra
  retangulo(ctx, 0, 0, 240, 80, "#3a3360");
  for (let y = 0; y < 80; y += 6) {
    retangulo(ctx, 0, y, 240, 1, "#2b2548");
    for (let x = (y / 6) % 2 ? 0 : 6; x < 240; x += 12) retangulo(ctx, x, y, 1, 6, "#2b2548");
  }
  // janelas em arco com o céu noturno
  [[48, 8], [176, 8]].forEach(([x, y]) => {
    retangulo(ctx, x, y + 6, 16, 34, "#6b5a8a");
    retangulo(ctx, x + 2, y + 2, 12, 4, "#6b5a8a");
    retangulo(ctx, x + 2, y + 6, 12, 32, "#1a1240");
    retangulo(ctx, x + 4, y + 4, 8, 2, "#1a1240");
    retangulo(ctx, x + 7, y + 6, 2, 32, "#6b5a8a");
    retangulo(ctx, x + 2, y + 21, 12, 2, "#6b5a8a");
    [[3, 9], [10, 14], [5, 27], [11, 31]].forEach(([dx, dy], i) => {
      if (Math.sin(t * 2 + i + x) > -0.4) retangulo(ctx, x + dx, y + dy, 1, 1, "#ffffff");
    });
  });
  circuloPixel(ctx, 186, 20, 3, "#f4f1d0");
  // estantes
  [[0, 34], [206, 34]].forEach(([x0, largura]) => {
    retangulo(ctx, x0, 6, largura, 72, "#5c3418");
    for (let prateleira = 0; prateleira < 4; prateleira++) {
      const y = 10 + prateleira * 17;
      retangulo(ctx, x0 + 2, y, largura - 4, 13, "#2b1608");
      let x = x0 + 3;
      let i = prateleira * 20 + x0;
      while (x < x0 + largura - 4) {
        const [cor, w] = livrosEstante[i++ % livrosEstante.length];
        const alturaLivro = 9 + (i % 3);
        retangulo(ctx, x, y + 13 - alturaLivro, w - 1, alturaLivro, cor);
        retangulo(ctx, x, y + 13 - alturaLivro + 2, w - 1, 1, "#f5c451");
        x += w;
      }
      retangulo(ctx, x0, y + 13, largura, 2, "#8b5a2b");
    }
  });
  // estandartes com o Z da Academia
  [[78, "#5a3aa6"], [148, "#5a3aa6"]].forEach(([x, cor]) => {
    retangulo(ctx, x, 4, 14, 30, cor);
    retangulo(ctx, x, 34, 7, 3, cor);
    retangulo(ctx, x + 7, 34, 7, 2, cor);
    retangulo(ctx, x - 1, 3, 16, 2, "#f5c451");
    desenharTexto(ctx, ["YYYYYY", "....Y.", "...Y..", "..Y...", ".Y....", "YYYYYY"], { Y: "#f5c451" }, x + 4, 14);
  });
  // tochas
  [[68, 30], [168, 30]].forEach(([x, y], i) => {
    retangulo(ctx, x, y, 3, 8, "#5c3418");
    const chama = Math.sin(t * 12 + i * 2) > 0;
    retangulo(ctx, x, y - 3, 3, 3, "#ff7a1a");
    retangulo(ctx, x + (chama ? 1 : 0), y - 5, 1, 2, "#ffd166");
    brilhoRedondo(ctx, x + 1, y - 2, 9, "255, 170, 60", 0.05);
  });
  // chão quadriculado e tapete vermelho
  retangulo(ctx, 0, 80, 240, 20, "#342a52");
  for (let y = 80; y < 100; y += 4) {
    for (let x = 0; x < 240; x += 8) retangulo(ctx, x + ((y / 4) % 2 ? 4 : 0), y, 4, 4, "#2a2340");
  }
  retangulo(ctx, 0, 80, 240, 1, "#1b1533");
  retangulo(ctx, 100, 80, 40, 20, "#8e1c3c");
  retangulo(ctx, 100, 80, 2, 20, "#f5c451");
  retangulo(ctx, 138, 80, 2, 20, "#f5c451");
  // o Zetsu e o púlpito
  if (!zetsuSalao) {
    zetsuSalao = new Image();
    zetsuSalao.src = avatarDataUrl(VISUAL_ZETSU);
  }
  if (zetsuSalao.complete) ctx.drawImage(zetsuSalao, 102, 44 + (Math.floor(t * 2) % 2));
  retangulo(ctx, 126, 70, 18, 12, "#5c3418");
  retangulo(ctx, 124, 68, 22, 3, "#8b5a2b");
  retangulo(ctx, 127, 65, 8, 3, "#e9e4d4");
  retangulo(ctx, 135, 65, 8, 3, "#d9d3c4");
  // partículas mágicas subindo
  for (let i = 0; i < 14; i++) {
    const x = (i * 37) % 240;
    const y = 80 - ((t * 10 + i * 13) % 80);
    retangulo(ctx, x, Math.floor(y), 1, 1, i % 2 ? "#6ef0ff" : "#f5c451");
  }
}

// Mantém um canvas animado enquanto ele estiver na página.
function animarCenario(canvas, pintor) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const inicio = performance.now();
  // 30 quadros por segundo bastam para as cenas de pixel; a aba escondida não desenha
  let ultimo = 0;
  const quadro = (agora) => {
    if (!canvas.isConnected) return;
    requestAnimationFrame(quadro);
    if (document.hidden || agora - ultimo < 32) return;
    ultimo = agora;
    pintor(ctx, (performance.now() - inicio) / 1000);
  };
  requestAnimationFrame(quadro);
}

// Transição épica: a tela se enche de blocos de pixel, troca o conteúdo e se esvazia.
// forma: "pixels" (blocos soltos), "diagonal" (varre de um canto ao outro, para portas e salas) ou
// "circulo" (fecha em direção ao meio, para começar uma batalha). duracao e espera em milissegundos.
// carregar: { tema, titulo, sobretitulo, icone, avatar, minimo } mostra a tela de carregamento
// (carregamento.js) enquanto a tela está coberta, até o aoCobrir terminar e passar o tempo mínimo.
function transicaoPixel(texto, cor, aoCobrir, { forma = "pixels", duracao = 520, espera = 650, carregar = null } = {}) {
  const camada = document.createElement("div");
  camada.className = "transicao-pixel";
  const tamanho = 28;
  const colunas = Math.ceil(window.innerWidth / tamanho);
  const linhas = Math.ceil(window.innerHeight / tamanho);
  const canvas = document.createElement("canvas");
  canvas.width = colunas;
  canvas.height = linhas;
  canvas.className = "pixel";
  const legenda = document.createElement("p");
  legenda.textContent = texto;
  camada.append(canvas, legenda);
  document.body.append(camada);
  const ctx = canvas.getContext("2d");
  const meioX = colunas / 2;
  const meioY = linhas / 2;
  const peso = {
    pixels: () => Math.random(),
    diagonal: (x, y) => x + y + Math.random() * 3,
    circulo: (x, y) => -Math.hypot(x - meioX, (y - meioY) * 1.4) + Math.random() * 1.5,
    batalha: (x, y) => -Math.hypot(x - meioX, (y - meioY) * 1.4) + Math.random() * 1.5,
    // o portal: os blocos entram em espiral, girando para o meio
    portal: (x, y) => {
      const raio = Math.hypot(x - meioX, (y - meioY) * 1.3);
      const angulo = (Math.atan2(y - meioY, x - meioX) + Math.PI) / (Math.PI * 2);
      return -raio + angulo * 6 + Math.random() * 0.8;
    },
  }[forma] || (() => Math.random());
  // a versão épica (efeitos.js): blocos com relevo, faíscas, círculo mágico e corte de espada
  if (typeof transicaoEpica === "function") {
    return transicaoEpica({ camada, canvas, legenda, colunas, linhas, peso, texto, cor, aoCobrir, forma, duracao, espera, carregar });
  }
  const ordem = Array.from({ length: colunas * linhas }, (_, i) => [i, peso(i % colunas, Math.floor(i / colunas))])
    .sort((a, b) => a[1] - b[1]).map(([i]) => i);
  let fase = "cobrindo";
  let inicio = performance.now();
  // segurança: se a aba ficar em segundo plano (sem quadros de animação), a camada não fica presa
  setTimeout(() => {
    // a animação não andou (aba em segundo plano): troca a tela de uma vez e encerra a transição, para
    // ela não trocar de novo quando os quadros voltarem
    if (fase === "cobrindo") {
      fase = "encerrada";
      aoCobrir();
    }
    camada.remove();
  }, carregar ? 15000 : 3000);
  // os tons da cortina: o fundo em xadrez de dois tons e a frente da onda, que brilha (claro, depois
  // quase branco) nos blocos que acabaram de entrar ou de sair, como uma onda de magia varrendo a tela
  const corEscura = tom(cor, 0.9);
  const frente = [tom(cor, 1.75), tom(cor, 1.45), tom(cor, 1.2)];
  const larguraFrente = Math.max(6, Math.round(ordem.length * 0.035));
  const passo = (agora) => {
    if (fase === "encerrada") return;
    const p = Math.min(1, (agora - inicio) / duracao);
    // a onda acelera no começo e freia no fim
    const suave = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    const total = Math.floor(ordem.length * suave);
    ctx.clearRect(0, 0, colunas, linhas);
    const cheios = fase === "cobrindo" ? ordem.slice(0, total) : ordem.slice(total);
    cheios.forEach((i) => {
      const x = i % colunas;
      const y = Math.floor(i / colunas);
      ctx.fillStyle = (x + y) % 2 ? cor : corEscura;
      ctx.fillRect(x, y, 1, 1);
    });
    if (p < 1) {
      // a frente: os blocos do limite da onda, do mais novo (mais claro) para trás
      for (let k = 0; k < larguraFrente * 3; k++) {
        const indice = fase === "cobrindo" ? total - 1 - k : total + k;
        const i = ordem[indice];
        if (i === undefined) continue;
        ctx.fillStyle = frente[Math.min(2, Math.floor(k / larguraFrente))];
        ctx.fillRect(i % colunas, Math.floor(i / colunas), 1, 1);
      }
    }
    if (p < 1) return requestAnimationFrame(passo);
    if (fase === "cobrindo" && carregar) {
      // coberta: a cena de carregamento entra; a tela nova monta por baixo e, quando estiver pronta
      // (e já tiver dado tempo de ver a cena), a barra enche e os pixels se abrem
      fase = "coberto";
      const tela = abrirCarregamento(carregar);
      // a tela nova só começa a montar depois que o carregamento foi pintado: montar o Reino pela primeira
      // vez trava o navegador por uns segundos, e antes disso ficava só a cortina colorida na frente
      const pintado = Promise.race([
        new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(resolver))),
        new Promise((resolver) => setTimeout(resolver, 150)),
      ]);
      const pronta = pintado.then(aoCobrir).catch(() => {});
      const minimo = new Promise((resolver) => setTimeout(resolver, carregar.minimo ?? 1400));
      Promise.all([pronta, minimo]).then(() => tela.concluir()).then(() => {
        fase = "revelando";
        inicio = performance.now();
        requestAnimationFrame(passo);
      });
      return;
    }
    if (fase === "cobrindo") {
      legenda.classList.add("visivel");
      fase = "coberto";
      aoCobrir();
      setTimeout(() => {
        fase = "revelando";
        legenda.classList.remove("visivel");
        inicio = performance.now();
        requestAnimationFrame(passo);
      }, espera);
      return;
    }
    camada.remove();
  };
  requestAnimationFrame(passo);
}

// A transição épica. Cada bloco da cortina é uma pedrinha de pixel com relevo (luz em cima e à esquerda,
// sombra embaixo e à direita) e, em alguns, uma runa gravada. A frente da onda brilha e solta faíscas.
// Coberta, a tela mostra um círculo mágico girando atrás do nome do lugar; ao abrir, uma onda de choque
// corre do meio. "batalha" ainda tem o clarão vermelho e dois cortes de espada cruzando a tela, e
// "portal" fecha em espiral com o círculo roxo da Fenda.
function transicaoEpica({ camada, canvas, legenda, colunas, linhas, peso, cor, aoCobrir, forma, duracao, espera, carregar }) {
  const S = 4;
  const W = colunas * S;
  const H = linhas * S;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const ordem = Array.from({ length: colunas * linhas }, (_, i) => [i, peso(i % colunas, Math.floor(i / colunas))])
    .sort((a, b) => a[1] - b[1]).map(([i]) => i);
  const posicao = new Int32Array(ordem.length);
  ordem.forEach((bloco, k) => { posicao[bloco] = k; });

  // as pedrinhas, desenhadas uma vez: as duas do xadrez, cada uma com e sem runa
  const pedra = (base, runa) => {
    const { canvas: c, ctx: g } = criarTela(S, S);
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    g.fillStyle = tom(base, 1.12);
    g.fillRect(0, 0, S - 1, 1);
    g.fillStyle = tom(base, 0.78);
    g.fillRect(0, S - 1, S, 1);
    g.fillRect(S - 1, 0, 1, S);
    if (runa) {
      g.fillStyle = tom(base, 1.45);
      g.fillRect(1, 1, 1, 2);
      g.fillRect(2, 2, 1, 1);
    }
    return c;
  };
  const pedras = [pedra(cor, false), pedra(tom(cor, 0.82), false), pedra(cor, true), pedra(tom(cor, 0.82), true)];
  const frente = [tom(cor, 2.2), tom(cor, 1.7), tom(cor, 1.3)];
  const larguraFrente = Math.max(6, Math.round(ordem.length * 0.035));
  const corMagia = forma === "portal" ? "192, 139, 255" : forma === "batalha" ? "255, 90, 90" : "255, 209, 102";
  const faiscas = [];

  let fase = "cobrindo";
  let inicio = performance.now();
  let cobertoEm = 0;
  let reveladoEm = 0;
  setTimeout(() => {
    if (fase === "cobrindo") {
      fase = "encerrada";
      aoCobrir();
    }
    camada.remove();
  }, carregar ? 15000 : 3500);

  const suavizar = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
  const blocoCheio = (i, total) => (fase === "cobrindo" ? posicao[i] < total : fase === "revelando" ? posicao[i] >= total : true);

  // o círculo mágico: dois anéis pontilhados, um hexagrama e runas girando ao contrário
  function circuloMagico(t, forca) {
    if (forca <= 0) return;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.34;
    const ponto = (x, y, a, lado = 1) => {
      ctx.fillStyle = `rgba(${corMagia}, ${a * forca})`;
      ctx.fillRect(Math.round(x), Math.round(y), lado, lado);
    };
    for (let k = 0; k < 220; k++) {
      const a = (k / 220) * Math.PI * 2 + t * 0.4;
      if (k % 3) ponto(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 0.9);
      ponto(cx + Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.82, k % 2 ? 0.6 : 0.25);
    }
    // o hexagrama (dois triângulos), girando devagar
    for (let tri = 0; tri < 2; tri++) {
      const vertices = [0, 1, 2].map((v) => {
        const a = -t * 0.25 + tri * Math.PI + (v * Math.PI * 2) / 3 - Math.PI / 2;
        return [cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78];
      });
      for (let v = 0; v < 3; v++) {
        const [x0, y0] = vertices[v];
        const [x1, y1] = vertices[(v + 1) % 3];
        const passos = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
        for (let s = 0; s <= passos; s += 1) ponto(x0 + ((x1 - x0) * s) / passos, y0 + ((y1 - y0) * s) / passos, 0.55);
      }
    }
    // as runas em volta, girando ao contrário e piscando
    for (let k = 0; k < 12; k++) {
      const a = -t * 0.6 + (k * Math.PI * 2) / 12;
      const x = cx + Math.cos(a) * R * 1.12;
      const y = cy + Math.sin(a) * R * 1.12;
      const brilho = 0.5 + 0.5 * Math.sin(t * 4 + k);
      ponto(x - 1, y - 2, brilho, 1);
      ponto(x, y - 2, brilho, 1);
      ponto(x - 1, y - 1, brilho, 1);
      ponto(x, y, brilho, 1);
      ponto(x - 1, y + 1, brilho * 0.8, 1);
      ponto(x + (k % 2), y - 1, brilho * 0.8, 1);
    }
    // o miolo pulsando
    const pulso = 0.15 + 0.1 * Math.sin(t * 3);
    const brilhoMeio = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.7);
    brilhoMeio.addColorStop(0, `rgba(${corMagia}, ${pulso * forca})`);
    brilhoMeio.addColorStop(1, `rgba(${corMagia}, 0)`);
    ctx.fillStyle = brilhoMeio;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  }

  // três cortes de garra cruzando a tela na mesma direção, um logo depois do outro, que somem
  function cortes(p) {
    if (p > 0.85) return;
    const some = p < 0.5 ? 1 : 1 - (p - 0.5) / 0.35;
    [-0.16, 0, 0.16].forEach((desvio, n) => {
      const cresce = Math.max(0, Math.min(1, (p - n * 0.06) / 0.28));
      if (!cresce) return;
      const x0 = (0.78 + desvio) * W;
      const y0 = 0.08 * H;
      const xb = (0.22 + desvio) * W;
      const yb = 0.92 * H;
      const x1 = x0 + (xb - x0) * cresce;
      const y1 = y0 + (yb - y0) * cresce;
      const passos = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
      for (let s = 0; s <= passos; s++) {
        const x = x0 + ((x1 - x0) * s) / passos;
        const y = y0 + ((y1 - y0) * s) / passos;
        ctx.fillStyle = `rgba(255, 240, 220, ${some})`;
        ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 3);
        ctx.fillStyle = `rgba(255, 70, 70, ${some * 0.7})`;
        ctx.fillRect(Math.round(x), Math.round(y) - 3, 1, 2);
        ctx.fillRect(Math.round(x), Math.round(y) + 2, 1, 2);
      }
    });
  }

  function soltarFaiscas(indices) {
    for (let n = 0; n < Math.min(26, indices.length); n++) {
      const i = indices[Math.floor(Math.random() * indices.length)];
      const a = Math.random() * Math.PI * 2;
      const v = 18 + Math.random() * 40;
      faiscas.push({
        x: (i % colunas) * S + S / 2, y: Math.floor(i / colunas) * S + S / 2,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 15, vida: 0, fim: 0.35 + Math.random() * 0.45,
        cor: Math.random() < 0.3 ? "255, 255, 255" : Math.random() < 0.5 ? corMagia : "255, 243, 176", grande: Math.random() < 0.2,
      });
    }
    if (faiscas.length > 500) faiscas.splice(0, faiscas.length - 500);
  }

  let ultimo = performance.now();
  const quadro = (agora) => {
    if (fase === "encerrada" || !camada.isConnected) return;
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    const t = agora / 1000;
    ctx.clearRect(0, 0, W, H);
    let total = ordem.length;
    let p = 1;
    if (fase === "cobrindo" || fase === "revelando") {
      p = Math.min(1, (agora - inicio) / duracao);
      total = Math.floor(ordem.length * suavizar(p));
    }
    // as pedrinhas da cortina
    for (let i = 0; i < ordem.length; i++) {
      if (!blocoCheio(i, total)) continue;
      const x = i % colunas;
      const y = Math.floor(i / colunas);
      const runa = ((x * 7 + y * 13) % 23) === 0 ? 2 : 0;
      ctx.drawImage(pedras[((x + y) & 1) + runa], x * S, y * S);
    }
    // a frente da onda, brilhando, e as faíscas que ela solta
    if ((fase === "cobrindo" || fase === "revelando") && p < 1) {
      const frenteAgora = [];
      for (let k = 0; k < larguraFrente * 3; k++) {
        const i = ordem[fase === "cobrindo" ? total - 1 - k : total + k];
        if (i === undefined) continue;
        ctx.fillStyle = frente[Math.min(2, Math.floor(k / larguraFrente))];
        ctx.fillRect((i % colunas) * S, Math.floor(i / colunas) * S, S, S);
        if (k < larguraFrente) frenteAgora.push(i);
      }
      soltarFaiscas(frenteAgora);
    }
    // o círculo mágico enquanto a tela está coberta (e sumindo quando ela abre)
    if (!carregar) {
      if (fase === "coberto") circuloMagico(t, Math.min(1, (agora - cobertoEm) / 250));
      if (fase === "revelando") circuloMagico(t, Math.max(0, 1 - p * 2.5));
    }
    // a batalha: clarão vermelho e os cortes de espada no começo
    if (forma === "batalha" && fase === "cobrindo") {
      if (p < 0.3) {
        ctx.fillStyle = `rgba(255, 220, 220, ${0.55 * (1 - p / 0.3)})`;
        ctx.fillRect(0, 0, W, H);
      }
      cortes(p);
      camada.style.transform = p < 0.5 ? `translate(${Math.round((Math.random() - 0.5) * 10)}px, ${Math.round((Math.random() - 0.5) * 8)}px)` : "";
    }
    // a onda de choque quando a tela abre
    if (fase === "revelando" && reveladoEm) {
      const k = (agora - reveladoEm) / 450;
      if (k < 1) {
        const r = k * Math.hypot(W, H) * 0.55;
        for (let n = 0; n < 160; n++) {
          const a = (n / 160) * Math.PI * 2;
          ctx.fillStyle = `rgba(${corMagia}, ${(1 - k) * 0.9})`;
          ctx.fillRect(Math.round(W / 2 + Math.cos(a) * r), Math.round(H / 2 + Math.sin(a) * r * 0.8), 2, 2);
        }
      }
    }
    // as faíscas
    for (let n = faiscas.length - 1; n >= 0; n--) {
      const f = faiscas[n];
      f.vida += dt;
      if (f.vida >= f.fim) {
        faiscas.splice(n, 1);
        continue;
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 60 * dt;
      ctx.fillStyle = `rgba(${f.cor}, ${1 - f.vida / f.fim})`;
      ctx.fillRect(Math.round(f.x), Math.round(f.y), f.grande ? 2 : 1, f.grande ? 2 : 1);
    }

    if ((fase === "cobrindo" || fase === "revelando") && p >= 1) {
      if (fase === "revelando") {
        fase = "encerrada";
        camada.remove();
        return;
      }
      camada.style.transform = "";
      cobertoEm = agora;
      if (carregar) {
        fase = "coberto";
        const tela = abrirCarregamento(carregar);
        const pintado = Promise.race([
          new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(resolver))),
          new Promise((resolver) => setTimeout(resolver, 150)),
        ]);
        const pronta = pintado.then(aoCobrir).catch(() => {});
        const minimo = new Promise((resolver) => setTimeout(resolver, carregar.minimo ?? 1400));
        Promise.all([pronta, minimo]).then(() => tela.concluir()).then(() => {
          fase = "revelando";
          inicio = performance.now();
          reveladoEm = inicio;
        });
      } else {
        legenda.classList.add("visivel");
        fase = "coberto";
        aoCobrir();
        setTimeout(() => {
          fase = "revelando";
          legenda.classList.remove("visivel");
          inicio = performance.now();
          reveladoEm = inicio;
        }, espera);
      }
    }
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);
}
