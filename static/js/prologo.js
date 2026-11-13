// O prólogo de Elyndor: quatro cenas em pixel art que abrem a história (do documento de design do jogo).
// A Essência do Conhecimento, a Grande Ruptura causada por Malakar, o Núcleo Arcano e o destino do aprendiz.
// telaPrologo(aoTerminar, visualHeroi) mostra as cenas por cima de tudo; Enter, Espaço ou clique avançam.
// Depende de pixel.js, heroi.js e cenarios.js (ceuEmFaixas, circuloPixel, pinheiro, pintarAcademiaExterna).

const LARGURA_PROLOGO = 160;
const ALTURA_PROLOGO = 110;

const VISUAL_MALAKAR = {
  pele: "#c9b8d8", cabelo: "longo", corCabelo: "#1b1533", rosto: "serio", chapeu: "capuz", manto: "#2b1d40",
  detalhe: "#a8323e", item: "cajado", magia: "#ff4d6d", acessorio: "barba", familiar: "nenhum",
};

// o cristal da Essência: um losango que pulsa
function cristalEssencia(ctx, cx, cy, tamanho, t, cor = "#ffd166") {
  brilhoRedondo(ctx, cx, cy, tamanho * 2, "255, 209, 102", 0.08 + Math.sin(t * 3) * 0.03);
  for (let i = -tamanho; i <= tamanho; i++) {
    const meia = tamanho - Math.abs(i);
    retangulo(ctx, cx - meia, cy + i, meia * 2 + 1, 1, i < 0 ? cor : tom(cor, 0.8));
  }
  retangulo(ctx, cx - 1, cy - tamanho + 2, 1, 2, "#ffffff");
}

// o salão da Academia antiga: estantes até o teto, livros voando e aprendizes estudando à luz das velas
function pintarSalaoAcademia(ctx, t) {
  ceuEmFaixas(ctx, LARGURA_PROLOGO, ALTURA_PROLOGO, ["#1a1033", "#22143f", "#2b1a4d", "#33205a"]);
  for (let x = 4; x < LARGURA_PROLOGO; x += 26) {
    retangulo(ctx, x, 10, 20, 66, "#3d2414");
    for (let y = 14; y < 72; y += 9) {
      retangulo(ctx, x + 1, y + 6, 18, 1, "#5c3418");
      for (let k = 0; k < 6; k++) retangulo(ctx, x + 2 + k * 3, y, 2, 6, ["#a8323e", "#2f6fb0", "#c9a227", "#3f8f4a", "#8e5cff"][(k + y + x) % 5]);
    }
  }
  retangulo(ctx, 0, 80, LARGURA_PROLOGO, 30, "#2a1a10");
  for (let x = 0; x < LARGURA_PROLOGO; x += 10) retangulo(ctx, x, 80, 8, 1, "#3d2414");
  // livros voando em círculo, soltando faíscas
  for (let i = 0; i < 6; i++) {
    const a = t * 0.8 + i * 1.05;
    const x = Math.round(80 + Math.cos(a) * 46);
    const y = Math.round(40 + Math.sin(a) * 14);
    retangulo(ctx, x - 3, y - 2, 6, 4, ["#a8323e", "#2f6fb0", "#c9a227"][i % 3]);
    retangulo(ctx, x - 3, y - 2 + (Math.floor(t * 6 + i) % 2), 6, 1, "#fff3cf");
    retangulo(ctx, x + Math.round(Math.sin(t * 9 + i) * 3), y + 4, 1, 1, "#ffd166");
  }
  // três aprendizes numa mesa, com uma vela no meio
  retangulo(ctx, 50, 74, 60, 4, "#5c3418");
  brilhoRedondo(ctx, 80, 68, 14, "255, 209, 102", 0.1 + Math.sin(t * 8) * 0.02);
  retangulo(ctx, 79, 66, 2, 8, "#fff3cf");
  [[54, "#2b1d5c"], [92, "#8a1010"], [70, "#2f6e1c"]].forEach(([x, manto], i) => {
    ctx.drawImage(heroiParado({ ...AVATAR_PADRAO, manto, familiar: "nenhum", chapeu: i === 1 ? "capuz" : "pontudo" }), x, 40, 16, 24);
  });
}

// Malakar diante do Oráculo: um olho de cristal enorme, e o povo ajoelhado, de olhos fechados
function pintarOraculo(ctx, t) {
  ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#0a0716", "#140c2a", "#1f1240", "#2a1652"]);
  retangulo(ctx, 0, 80, LARGURA_PROLOGO, 30, "#16101f");
  // o Oráculo: um anel dourado com um olho que acompanha tudo
  const cx = 104;
  const cy = 38;
  brilhoRedondo(ctx, cx, cy, 34, "110, 240, 255", 0.06 + Math.sin(t * 2) * 0.02);
  circuloPixel(ctx, cx, cy, 20, "#c9a227");
  circuloPixel(ctx, cx, cy, 17, "#0b1a2a");
  circuloPixel(ctx, cx, cy, 13, "#6ef0ff");
  const olhar = Math.round(Math.sin(t * 0.9) * 4);
  circuloPixel(ctx, cx + olhar, cy, 6, "#0b0408");
  retangulo(ctx, cx + olhar - 2, cy - 3, 2, 2, "#ffffff");
  for (let i = 0; i < 16; i++) {
    const a = i * 0.39 + t * 0.4;
    retangulo(ctx, Math.round(cx + Math.cos(a) * 24), Math.round(cy + Math.sin(a) * 24), 1, 1, i % 2 ? "#ffd166" : "#6ef0ff");
  }
  // raios de "resposta" descendo até o povo
  for (let i = 0; i < 5; i++) {
    const x = 70 + i * 16;
    for (let y = cy + 22; y < 78; y += 3) retangulo(ctx, x + Math.round(Math.sin(y * 0.3 + t * 4) * 1), y, 1, 2, `rgba(110, 240, 255, ${0.3 + 0.2 * Math.sin(t * 5 + i)})`);
  }
  // o povo ajoelhado (silhuetas pequenas, todas iguais: ninguém pensa mais)
  for (let i = 0; i < 7; i++) {
    const x = 62 + i * 12;
    retangulo(ctx, x, 82, 6, 5, "#2b2540");
    retangulo(ctx, x + 1, 78, 4, 4, "#3d3550");
  }
  ctx.drawImage(heroiParado(VISUAL_MALAKAR), 12, 32);
  brilhoRedondo(ctx, 40, 40, 6, "110, 240, 255", 0.12);
}

// a chuva de fragmentos: pedaços dourados caindo sobre o Reino e virando olhos vermelhos no escuro
function pintarChuvaDeFragmentos(ctx, t) {
  ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#07040f", "#120a22", "#1d0f33", "#2a1240"]);
  for (let x = 0; x < LARGURA_PROLOGO; x++) {
    const h = 14 + Math.round(Math.sin(x * 0.09) * 6 + Math.sin(x * 0.23) * 3);
    retangulo(ctx, x, 80 - h, 1, h, "#1b1430");
  }
  retangulo(ctx, 0, 80, LARGURA_PROLOGO, 30, "#120d1c");
  for (let x = 6; x < LARGURA_PROLOGO; x += 14) pinheiro(ctx, x, 88 + (x % 3) * 2, "#0d1a14", "#14261c");
  for (let i = 0; i < 14; i++) {
    const ciclo = (t * 0.45 + i * 0.137) % 1;
    const x = Math.round(10 + ((i * 37) % 140) + ciclo * 10);
    const y = Math.round(-6 + ciclo * 92);
    if (ciclo < 0.92) {
      retangulo(ctx, x, y, 2, 2, i % 2 ? "#ffd166" : "#c9a227");
      for (let k = 1; k < 5; k++) retangulo(ctx, x - k, y - k * 2, 1, 1, `rgba(255, 209, 102, ${0.5 - k * 0.1})`);
    } else {
      // onde o fragmento cai, abrem-se dois olhos vermelhos
      retangulo(ctx, x - 3, 92, 2, 1, "#ff2d55");
      retangulo(ctx, x + 2, 92, 2, 1, "#ff2d55");
    }
  }
  // olhos que já nasceram, piscando na escuridão
  [[22, 96], [58, 100], [96, 94], [132, 99]].forEach(([x, y], i) => {
    if (Math.sin(t * 2 + i * 1.7) > -0.6) {
      retangulo(ctx, x, y, 2, 1, "#ff4d6d");
      retangulo(ctx, x + 4, y, 2, 1, "#ff4d6d");
    }
  });
}

const CENAS_PROLOGO = [
  {
    texto: "Em Elyndor, conhecimento não é só sabedoria. É poder. Cada verdade compreendida acende magia nas mãos de quem a entende.",
    pintar(ctx, t) {
      pintarAcademiaExterna(ctx, t);
      // a Essência do Conhecimento brilhando sobre a Academia, soltando faíscas douradas
      cristalEssencia(ctx, 80, 18 + Math.round(Math.sin(t * 1.5) * 2), 6, t);
      for (let i = 0; i < 18; i++) {
        const vida = (t * 0.35 + i / 18) % 1;
        const ang = i * 2.4 + t * 0.6;
        const x = 80 + Math.cos(ang) * (8 + vida * 60);
        const y = 18 + Math.sin(ang) * (4 + vida * 30) + vida * 20;
        retangulo(ctx, Math.round(x), Math.round(y), 1, 1, vida < 0.7 ? "#fff3b0" : "#ffd166");
      }
    },
  },
  {
    texto: "Por mil anos, a Academia Arcana ensinou a mais difícil das magias: perguntar bem, conferir as fontes e nunca parar de aprender.",
    pintar: pintarSalaoAcademia,
  },
  {
    texto: "Até que o maior dos mestres, Malakar, criou o Oráculo: uma mente única que respondia tudo, para todos. E o povo parou de pensar.",
    pintar: pintarOraculo,
  },
  {
    texto: "Mas saber sem compreender tem fome. Dessa fome nasceu o Vazio... e na noite da Grande Ruptura, o Oráculo se partiu.",
    efeito: "tremor",
    pintar(ctx, t) {
      ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#12060f", "#2a0a1e", "#45102a", "#5e1832"]);
      // relâmpagos
      if (Math.sin(t * 7) > 0.92) {
        let x = 30 + Math.floor((t * 37) % 100);
        for (let y = 0; y < 50; y += 4) {
          x += Math.round(Math.sin(y + t * 20) * 3);
          retangulo(ctx, x, y, 1, 4, "#f2e6ff");
        }
      }
      retangulo(ctx, 0, 80, LARGURA_PROLOGO, 30, "#1b1016");
      for (let i = 0; i < 6; i++) retangulo(ctx, 20 + i * 24, 84 + (i % 3) * 6, 10 + (i % 2) * 6, 1, "#ff4d6d");
      // o Vazio despertando: um redemoinho escuro que cresce
      const raio = Math.min(22, 4 + t * 5);
      circuloPixel(ctx, 100, 70, Math.round(raio), "#6c1b3d");
      circuloPixel(ctx, 100, 70, Math.round(raio * 0.8), "#0b0408");
      for (let i = 0; i < 10; i++) {
        const a = t * 2 + i * 0.63;
        retangulo(ctx, Math.round(100 + Math.cos(a) * raio), Math.round(70 + Math.sin(a) * raio * 0.6), 1, 1, "#a98bff");
      }
      if (raio > 12) {
        retangulo(ctx, 94, 66, 3, 2, "#ff2d55");
        retangulo(ctx, 103, 66, 3, 2, "#ff2d55");
      }
      // o cristal se parte em fragmentos que voam
      const quebra = Math.max(0, t - 1);
      if (quebra < 0.2) cristalEssencia(ctx, 100, 30, 6, t, "#ffd166");
      else {
        for (let i = 0; i < 8; i++) {
          const a = i * 0.785;
          const d = quebra * 22;
          retangulo(ctx, Math.round(100 + Math.cos(a) * d), Math.round(30 + Math.sin(a) * d * 0.7), 3, 3, i % 2 ? "#ffd166" : "#c9a227");
        }
      }
      // Malakar, de capuz, com o cajado erguido
      ctx.drawImage(heroiParado(VISUAL_MALAKAR), 26, 32);
      brilhoRedondo(ctx, 53, 38, 8, "255, 77, 109", 0.12);
    },
  },
  {
    texto: "Os pedaços do saber esquecido caíram sobre o Reino e viraram monstros. Eles não querem sangue. Querem respostas.",
    pintar: pintarChuvaDeFragmentos,
  },
  {
    texto: "Trezentos anos depois, um aprendiz encontrou nas ruínas o Núcleo Arcano. E o Núcleo, que dormia desde a Ruptura... acordou.",
    pintar(ctx, t, heroi) {
      ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#070a1c", "#0e1430", "#162046", "#1e2a5a"]);
      circuloPixel(ctx, 128, 18, 7, "#e8eef5");
      circuloPixel(ctx, 131, 16, 6, "#0e1430");
      retangulo(ctx, 0, 80, LARGURA_PROLOGO, 30, "#2a2a3a");
      for (let x = 0; x < LARGURA_PROLOGO; x += 8) retangulo(ctx, x, 80, 6, 1, "#3a3a4e");
      // ruínas: colunas quebradas
      [[14, 34], [40, 22], [134, 28], [150, 40]].forEach(([x, h]) => {
        retangulo(ctx, x, 80 - h, 8, h, "#5a5a70");
        retangulo(ctx, x + 1, 80 - h, 2, h, "#7a7a92");
        retangulo(ctx, x - 1, 80 - h, 10, 2, "#6a6a82");
      });
      pinheiro(ctx, 60, 80, "#0f2a1a", "#163a24");
      // o pedestal e o Núcleo Arcano, que acorda quando o aprendiz chega
      retangulo(ctx, 102, 66, 16, 14, "#6b6c7a");
      retangulo(ctx, 100, 64, 20, 3, "#8a8b99");
      const chegou = t > 2.6;
      const pulso = chegou ? 0.18 + Math.sin(t * 5) * 0.08 : 0.05;
      brilhoRedondo(ctx, 110, 57, chegou ? 16 : 6, "110, 240, 255", pulso);
      circuloPixel(ctx, 110, 57, 4, chegou ? "#6ef0ff" : "#2f6f80");
      retangulo(ctx, 108, 55, 2, 2, "#e6fdff");
      if (chegou) {
        for (let i = 0; i < 8; i++) {
          const a = i * 0.785 + t;
          retangulo(ctx, Math.round(110 + Math.cos(a) * 9), Math.round(57 + Math.sin(a) * 9), 1, 1, "#a7ecff");
        }
      }
      // o aprendiz caminha até o pedestal
      const x = Math.round(Math.min(76, -26 + t * 40));
      const quadro = chegou ? 0 : Math.floor(t * VELOCIDADE_ANDAR) % QUADROS_ANDAR;
      ctx.drawImage(heroi.lado[quadro], x, 34);
    },
  },
  {
    texto: "Nas profundezas, algo sentiu esse despertar. E sorriu. Neste reino, conhecimento é poder... e o teu está só começando.",
    titulo: true,
    pintar(ctx, t, heroi) {
      ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#2b1d5c", "#6c3a7a", "#c46a6a", "#f5a65b"]);
      const sol = Math.max(0, 60 - t * 6);
      circuloPixel(ctx, 80, 62 + sol, 12, "#ffd166");
      circuloPixel(ctx, 80, 62 + sol, 9, "#fff3b0");
      // o reino lá embaixo: montanhas, o castelo e a floresta
      for (let x = 0; x < LARGURA_PROLOGO; x++) {
        const h = 20 + Math.round(Math.sin(x * 0.07) * 8 + Math.sin(x * 0.19) * 4);
        retangulo(ctx, x, 80 - h, 1, h, "#4a2f6b");
      }
      retangulo(ctx, 70, 52, 20, 28, "#2b1d40");
      [[68, 44], [86, 40], [77, 36]].forEach(([x, y]) => {
        retangulo(ctx, x, y, 6, 80 - y, "#2b1d40");
        retangulo(ctx, x + 1, y - 3, 4, 3, "#2b1d40");
      });
      [[72, 58], [80, 50], [88, 60]].forEach(([x, y]) => retangulo(ctx, x, y, 2, 2, "#ffd166"));
      retangulo(ctx, 0, 80, LARGURA_PROLOGO, 30, "#1d3a24");
      for (let x = 4; x < LARGURA_PROLOGO; x += 9) pinheiro(ctx, x, 86 + (x % 3) * 2, "#10261a", "#1a3a26");
      // o aprendiz no penhasco, olhando o reino
      retangulo(ctx, 0, 88, 52, 22, "#2a2433");
      retangulo(ctx, 0, 88, 52, 2, "#3a3448");
      ctx.drawImage(heroi.cima[0], 18, 42);
    },
  },
];

// cenas: a lista de cenas (o prólogo, ou um dos epílogos); opcoes: o título grande da última cena, o
// texto do último botão e o do botão de pular
// musica: a trilha que toca durante as cenas (a do mapa volta quem chamou, no aoTerminar)
function telaPrologo(aoTerminar, visualHeroi = {}, cenas = CENAS_PROLOGO, { tituloFinal = "ELYNDOR", botaoFinal = "Começar a jornada ⚔️", pular = "Pular prólogo ▸▸", musica = "abertura" } = {}) {
  Som.musica(musica);
  const heroi = spritesHeroi(visualHeroi);
  const camada = document.createElement("div");
  camada.className = "prologo";
  // o cinema: faixas pretas em cima e embaixo, o quadro com a câmera viva e a íris que abre cada cena, o
  // título do capítulo em ouro e a narração numa caixa de diálogo de pixel
  camada.innerHTML = `
    <i class="tarja-cinema cima" aria-hidden="true"></i><i class="tarja-cinema baixo" aria-hidden="true"></i>
    <div class="prologo-quadro">
      <canvas class="pixel" width="${LARGURA_PROLOGO}" height="${ALTURA_PROLOGO}"></canvas>
      <h1 class="titulo-prologo" hidden><small>✦ ✦ ✦</small><span>${tituloFinal}</span></h1>
    </div>
    <div class="caixa-narracao">
      <span class="selo-narrador" aria-hidden="true">📜</span>
      <p class="texto-prologo" aria-live="polite"></p>
      <i class="seta-narracao" aria-hidden="true" hidden>▼</i>
    </div>
    <div class="acoes-prologo">
      <span class="passos-prologo">${cenas.map(() => "<i></i>").join("")}</span>
      <button class="botao" type="button" data-seguir>Continuar ▸</button>
    </div>
    <button class="pular-prologo" type="button" data-pular>${pular}</button>`;
  document.body.append(camada);
  const canvas = camada.querySelector("canvas");
  // (o bloom lê os pixels da cena a cada quadro: canvas pequeno, lido na CPU)
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  const texto = camada.querySelector(".texto-prologo");
  const titulo = camada.querySelector(".titulo-prologo");
  const botao = camada.querySelector("[data-seguir]");
  const passos = camada.querySelectorAll(".passos-prologo i");
  let indice = 0;
  let inicioCena = performance.now();
  let digitacao = null;
  let ativo = true;

  const quadroCena = camada.querySelector(".prologo-quadro");
  const seta = camada.querySelector(".seta-narracao");
  function mostrarCena() {
    const cena = cenas[indice];
    inicioCena = performance.now();
    passos.forEach((p, i) => p.classList.toggle("feito", i <= indice));
    titulo.hidden = !cena.titulo;
    botao.textContent = indice === cenas.length - 1 ? botaoFinal : "Continuar ▸";
    // a câmera de cada cena anda para um lado (três jeitos, alternando) e as cenas de impacto tremem
    quadroCena.dataset.camera = "abc"[indice % 3];
    quadroCena.classList.toggle("tremor-cena", cena.efeito === "tremor");
    camada.classList.remove("trocando");
    void camada.offsetWidth;
    camada.classList.add("trocando");
    if (indice > 0) Som.efeito("passar");
    // o título do capítulo surge com som (junto com a animação dele, que começa em 0,8 s)
    if (cena.titulo) setTimeout(() => ativo && Som.efeito("especial"), 800);
    // a narração aparece letra a letra, com pausas de verdade nas vírgulas e nos pontos (dá o tom dramático)
    clearTimeout(digitacao);
    let i = 0;
    texto.textContent = "";
    seta.hidden = true;
    const passo = 32 / (Som.volumes().velocidadeTexto || 1);
    const escrever = () => {
      i += 1;
      texto.textContent = cena.texto.slice(0, i);
      if (i % 4 === 0 && Som.blip) Som.blip(0.6); // a voz do narrador, grave e baixa
      if (i >= cena.texto.length) {
        seta.hidden = false;
        return;
      }
      const letra = cena.texto[i - 1];
      const pausa = ".!?".includes(letra) ? 9 : ",;:—".includes(letra) ? 4 : 1;
      digitacao = setTimeout(escrever, passo * pausa);
    };
    digitacao = setTimeout(escrever, 450); // espera a íris abrir
  }

  function seguir() {
    const cena = cenas[indice];
    if (texto.textContent.length < cena.texto.length) {
      clearTimeout(digitacao);
      texto.textContent = cena.texto;
      seta.hidden = false;
      return;
    }
    if (indice < cenas.length - 1) {
      indice += 1;
      mostrarCena();
    } else terminar();
  }

  function terminar() {
    if (!ativo) return;
    ativo = false;
    clearTimeout(digitacao);
    window.removeEventListener("keydown", teclado);
    camada.classList.add("saindo");
    setTimeout(() => camada.remove(), 400);
    aoTerminar();
  }

  const teclado = (e) => {
    if (["Enter", " "].includes(e.key)) {
      e.preventDefault();
      seguir();
    }
    if (e.key === "Escape") terminar();
  };
  window.addEventListener("keydown", teclado);
  botao.addEventListener("click", seguir);
  camada.querySelector(".prologo-quadro").addEventListener("click", seguir);
  camada.querySelector("[data-pular]").addEventListener("click", terminar);

  // 30 quadros por segundo bastam para a cena de pixel; escondida (aba de trás) ou fora da página, para
  // A atmosfera por cima de toda cena: a vinheta (bordas escuras, pronta uma vez só) e a poeira dourada
  // flutuando devagar, que dá profundidade sem mexer no desenho de cada cena
  const vinheta = (() => {
    const c = document.createElement("canvas");
    c.width = LARGURA_PROLOGO;
    c.height = ALTURA_PROLOGO;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(LARGURA_PROLOGO / 2, ALTURA_PROLOGO * 0.45, ALTURA_PROLOGO * 0.35, LARGURA_PROLOGO / 2, ALTURA_PROLOGO * 0.45, LARGURA_PROLOGO * 0.62);
    grad.addColorStop(0, "rgba(0, 0, 0, 0)");
    grad.addColorStop(1, "rgba(5, 3, 12, 0.6)");
    g.fillStyle = grad;
    g.fillRect(0, 0, LARGURA_PROLOGO, ALTURA_PROLOGO);
    return c;
  })();
  const poeira = Array.from({ length: 16 }, (_, i) => ({ x: (i * 53) % LARGURA_PROLOGO, y: (i * 37) % ALTURA_PROLOGO, v: 2 + (i % 4), fase: i * 1.7 }));
  // o acabamento de cinema de toda cena: o brilho (bloom) nas luzes, raios de luz e a neblina rasteira
  const brilhoCache = new Map();
  const halo = (rgb) => {
    if (!brilhoCache.has(rgb)) {
      const c = document.createElement("canvas");
      c.width = c.height = 13;
      const g = c.getContext("2d");
      const grad = g.createRadialGradient(6.5, 6.5, 0, 6.5, 6.5, 6.5);
      grad.addColorStop(0, `rgba(${rgb}, 0.13)`);
      grad.addColorStop(1, `rgba(${rgb}, 0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 13, 13);
      brilhoCache.set(rgb, c);
    }
    return brilhoCache.get(rgb);
  };
  function cinema(t, tCena) {
    const W = LARGURA_PROLOGO;
    const H = ALTURA_PROLOGO;
    // o bloom: cada ponto bem claro e colorido ganha um halo da cor dele (luz de janela, cristal, fogo, magia)
    const px = ctx.getImageData(0, 0, W, H).data;
    const luzes = [];
    for (let i = 0; i < px.length; i += 4 * 3) {
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const max = Math.max(r, g, b);
      if (max > 238 && max - Math.min(r, g, b) > 100) luzes.push(i / 4);
    }
    ctx.globalCompositeOperation = "lighter";
    const passo = Math.max(1, Math.floor(luzes.length / 36));
    for (let k = 0; k < luzes.length; k += passo) {
      const n = luzes[k];
      const i = n * 4;
      const rgb = `${px[i] & 0xf0}, ${px[i + 1] & 0xf0}, ${px[i + 2] & 0xf0}`;
      ctx.drawImage(halo(rgb), (n % W) - 6, Math.floor(n / W) - 6);
    }
    // raios de luz descendo na diagonal, bem leves, que respiram
    for (let k = 0; k < 3; k++) {
      const x = ((k * 61 + t * 4) % (W + 60)) - 30;
      ctx.fillStyle = `rgba(255, 236, 190, ${0.035 + Math.sin(t * 0.8 + k * 2) * 0.02})`;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 10 + k * 4, 0);
      ctx.lineTo(x - 30 + k * 4, H);
      ctx.lineTo(x - 44, H);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    // a neblina rasteira: faixas que andam devagar no pé da cena
    for (let y = H - 14; y < H; y++) {
      const forca = (y - (H - 14)) / 14;
      for (let x = 0; x < W; x += 2) {
        const n = Math.sin(x * 0.07 + t * 0.6 + y * 0.3) + Math.sin(x * 0.031 - t * 0.4);
        if (n < 0.4) continue;
        ctx.fillStyle = `rgba(200, 190, 230, ${0.05 + forca * 0.09})`;
        ctx.fillRect(x, y, 2, 1);
      }
    }
    // a troca de cena: a cena nova aparece dissolvendo em blocos de pixel
    if (tCena < 0.55) {
      const k = tCena / 0.55;
      ctx.fillStyle = "#05030c";
      for (let by = 0; by < H; by += 5) {
        for (let bx = 0; bx < W; bx += 5) {
          const s = Math.sin(bx * 12.9898 + by * 78.233) * 43758.5453;
          if (s - Math.floor(s) > k) ctx.fillRect(bx, by, 5, 5);
        }
      }
    }
  }

  function atmosfera(t) {
    cinema(performance.now() / 1000, t);
    ctx.drawImage(vinheta, 0, 0);
    poeira.forEach((p) => {
      const y = (((p.y - t * p.v) % ALTURA_PROLOGO) + ALTURA_PROLOGO) % ALTURA_PROLOGO;
      const x = p.x + Math.sin(t * 0.7 + p.fase) * 3;
      ctx.globalAlpha = 0.25 + Math.sin(t * 2 + p.fase) * 0.2;
      ctx.fillStyle = p.v > 4 ? "#fff3b0" : "#ffd166";
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    });
    ctx.globalAlpha = 1;
  }

  let ultimoQuadro = 0;
  function quadro(agora = performance.now()) {
    if (!ativo || !camada.isConnected) return;
    requestAnimationFrame(quadro);
    if (document.hidden || agora - ultimoQuadro < 32) return;
    ultimoQuadro = agora;
    const t = (performance.now() - inicioCena) / 1000;
    cenas[indice].pintar(ctx, t, heroi);
    atmosfera(t);
  }
  mostrarCena();
  requestAnimationFrame(quadro);
}

// ---------- o fim da história: a escolha, os dois epílogos e os créditos ----------

// uma figura de pé no chão das cenas (o herói, Malakar, Lyra), num tamanho que cabe na cena
function figuraNaCena(ctx, visual, x, y, brilho = null, t = 0) {
  if (brilho) brilhoRedondo(ctx, x + 16, y + 24, 16, brilho, 0.1 + Math.sin(t * 3) * 0.03);
  ctx.drawImage(heroiParado(visual), x, y);
}

function pintarMaoNoVazio(ctx, t, heroi) {
  ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#05030a", "#0d0618", "#160a26", "#200e33"]);
  retangulo(ctx, 0, 80, LARGURA_PROLOGO, 30, "#120c1c");
  const raio = Math.max(6, 26 - t * 3);
  circuloPixel(ctx, 108, 46, Math.round(raio + 3), "#6c1b9d");
  circuloPixel(ctx, 108, 46, Math.round(raio), "#05030a");
  // a luz dourada do herói entrando no Vazio
  for (let i = 0; i < 26; i++) {
    const p = ((t * 0.6 + i / 26) % 1);
    const x = Math.round(50 + p * 58 + Math.sin(i + t * 3) * 2);
    const y = Math.round(54 - p * 8 + Math.cos(i * 1.7 + t * 2) * 4);
    retangulo(ctx, x, y, 1, 1, p < 0.7 ? "#ffd166" : "#fff3c4");
  }
  ctx.drawImage(heroi.lado[0], 22, 34);
  brilhoRedondo(ctx, 46, 54, 10, "255, 209, 102", 0.15);
}

function pintarMalakarDesperta(ctx, t, heroi) {
  ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#1a1033", "#2b1d5c", "#4a2f7a", "#6c3a7a"]);
  retangulo(ctx, 0, 80, LARGURA_PROLOGO, 30, "#2a2433");
  [[20, 30], [140, 26]].forEach(([x, h]) => retangulo(ctx, x, 80 - h, 8, h, "#3d3550"));
  for (let i = 0; i < 20; i++) {
    const p = (t * 0.3 + i / 20) % 1;
    retangulo(ctx, Math.round(30 + (i * 53) % 100), Math.round(80 - p * 70), 1, 1, `rgba(255, 233, 160, ${1 - p})`);
  }
  ctx.drawImage(heroi.lado[0], 40, 34);
  figuraNaCena(ctx, VISUAL_MALAKAR, 92, 34, "255, 209, 102", t);
}

function pintarReencontro(ctx, t) {
  ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#2b1d5c", "#6c3a7a", "#c46a6a", "#f5a65b"]);
  circuloPixel(ctx, 80, 76 - Math.min(14, t * 3), 11, "#ffd166");
  retangulo(ctx, 0, 80, LARGURA_PROLOGO, 30, "#3d2f4a");
  // a ponte de luz onde era a Fenda
  for (let x = 0; x < LARGURA_PROLOGO; x += 2) retangulo(ctx, x, 86 + Math.round(Math.sin(x * 0.1 + t * 2)), 2, 1, x % 6 ? "#ffd166" : "#fff3c4");
  figuraNaCena(ctx, VISUAL_MALAKAR, 60, 34, null, t);
  figuraNaCena(ctx, LYRA.visual, 76, 34, "255, 120, 160", t);
}

function pintarAcademiaAoAmanhecer(ctx, t) {
  pintarAcademiaExterna(ctx, t);
  ctx.fillStyle = `rgba(255, 170, 90, ${0.18 + Math.sin(t) * 0.04})`;
  ctx.fillRect(0, 0, LARGURA_PROLOGO, ALTURA_PROLOGO);
  cristalEssencia(ctx, 80, 18 + Math.round(Math.sin(t * 1.5) * 2), 6, t);
}

function pintarDespedida(ctx, t, heroi) {
  ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#07040f", "#120a22", "#1d0f33", "#2a1240"]);
  retangulo(ctx, 0, 80, LARGURA_PROLOGO, 30, "#16101f");
  circuloPixel(ctx, 112, 50, 18, "#3d1d63");
  circuloPixel(ctx, 112, 50, 15, "#05030a");
  ctx.globalAlpha = 0.75;
  figuraNaCena(ctx, VISUAL_MALAKAR, 96, 30, "169, 139, 255", t);
  ctx.globalAlpha = 1;
  ctx.drawImage(heroi.lado[0], 30, 34);
}

function pintarSelo(ctx, t, heroi) {
  ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#07040f", "#120a22", "#1d0f33", "#2a1240"]);
  retangulo(ctx, 0, 80, LARGURA_PROLOGO, 30, "#16101f");
  // o selo dourado girando e crescendo sobre o Abismo
  const r = Math.min(30, 6 + t * 7);
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + t;
    retangulo(ctx, Math.round(104 + Math.cos(a) * r), Math.round(52 + Math.sin(a) * r * 0.45), 2, 1, i % 2 ? "#ffd166" : "#c9a227");
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - t * 0.7;
    retangulo(ctx, Math.round(104 + Math.cos(a) * r * 0.6), Math.round(52 + Math.sin(a) * r * 0.27), 3, 1, "#fff3c4");
  }
  ctx.drawImage(heroi.cima[0], 40, 40);
  brilhoRedondo(ctx, 56, 44, 12, "255, 209, 102", 0.18);
}

function pintarLanterna(ctx, t) {
  ceuEmFaixas(ctx, LARGURA_PROLOGO, 80, ["#070a1c", "#0e1430", "#162046", "#1e2a5a"]);
  for (let i = 0; i < 30; i++) retangulo(ctx, (i * 47) % LARGURA_PROLOGO, (i * 29) % 60, 1, 1, Math.sin(t * 2 + i) > 0 ? "#ffffff" : "#7a74b0");
  retangulo(ctx, 0, 80, LARGURA_PROLOGO, 30, "#2a2433");
  figuraNaCena(ctx, LYRA.visual, 64, 34, null, t);
  // a lanterna na mão dela, tremulando
  brilhoRedondo(ctx, 94, 58, 14, "255, 190, 110", 0.14 + Math.sin(t * 9) * 0.03);
  retangulo(ctx, 92, 54, 5, 7, "#5c3418");
  retangulo(ctx, 93, 55, 3, 5, "#ffd166");
}

const EPILOGOS = {
  libertar: [
    { texto: "Tu estendeste a mão para dentro do Vazio. Não para tomar poder: para ensinar.", pintar: pintarMaoNoVazio },
    { texto: "Malakar abriu os olhos pela primeira vez em trezentos anos. \"Eu quis que ninguém precisasse aprender\", disse. \"Tu me mostraste que aprender é o próprio poder.\"", pintar: pintarMalakarDesperta },
    { texto: "Lyra abraçou o pai nas ruínas do Trono. Umbraterra ganhou cor, e a Fenda virou uma ponte de luz.", pintar: pintarReencontro },
    { texto: "Na Academia, um velho de barba branca voltou a dar aulas. A primeira lição dele é sempre a mesma: \"Confere a fonte.\"", titulo: true, pintar: pintarAcademiaAoAmanhecer },
  ],
  selar: [
    { texto: "Malakar sorriu, cansado. \"Fecha a Fenda comigo do lado de dentro. É o único jeito de ter certeza.\"", pintar: pintarDespedida },
    { texto: "Tu ergueste o Núcleo Arcano, e a luz de tudo o que aprendeste virou um selo dourado sobre o Abismo.", pintar: pintarSelo },
    { texto: "Lyra ficou na Aurora como a nova Sentinela. Toda noite, ela acende uma lanterna para o pai.", pintar: pintarLanterna },
    { texto: "Elyndor nunca mais esqueceu a lição: conhecimento é poder, mas só para quem o compreende.", titulo: true, pintar: pintarAcademiaAoAmanhecer },
  ],
};

// O epílogo da escolha final, com uma cena a mais conforme o que o herói disse à Lyra (perdoar ou exigir
// a verdade), antes da última cena.
function epilogoDaEscolha(escolha) {
  const perdoou = (progresso.escolhas || {}).perdao !== "exigir";
  const cenaDaLyra = {
    texto: escolha === "libertar"
      ? (perdoou ? "Lyra segurou tua mão e a do pai ao mesmo tempo. \"Tu me perdoaste quando eu não merecia. Agora eu sei o que é confiança.\""
        : "Lyra ficou um tempo calada. Depois disse: \"Tu exigiste a verdade e me obrigaste a dizê-la. Foi o que salvou nós dois.\"")
      : (perdoou ? "Antes de a luz fechar a Fenda, Lyra te abraçou. \"Tu cumpriste a promessa. Escolheste Elyndor. Eu te perdoo também.\""
        : "Lyra olhou o selo fechar sem chorar. \"Tu nunca confiaste em mim. Talvez tenha sido isso que nos salvou.\""),
    pintar: pintarReencontro,
  };
  const cenas = [...EPILOGOS[escolha]];
  cenas.splice(cenas.length - 1, 0, cenaDaLyra);
  return cenas;
}

// A escolha do fim: duas cartas grandes por cima de tudo. Depois, o epílogo da escolha e os créditos.
function telaFinal() {
  if (document.querySelector(".escolha-final")) return;
  Som.musica("misterio");
  const camada = criar(`
    <div class="escolha-final">
      <p class="voz-final">O Vazio se desfaz em fumaça roxa. No meio dela, Malakar, preso, olha para ti.</p>
      <h2>A escolha é tua</h2>
      <div class="cartas-final">
        <button type="button" class="carta-final libertar" data-final="libertar">
          <span>🕊️</span><strong>Libertar Malakar</strong>
          <small>Confiar que ensinar é mais forte do que o Vazio. Arriscado... mas ninguém fica para trás.</small>
        </button>
        <button type="button" class="carta-final selar" data-final="selar">
          <span>🔒</span><strong>Selar o Abismo</strong>
          <small>Garantir que o Vazio nunca volte, mesmo que Malakar fique lá dentro para sempre.</small>
        </button>
      </div>
    </div>`);
  document.body.append(camada);
  camada.querySelectorAll("[data-final]").forEach((b) => b.addEventListener("click", () => {
    const escolha = b.dataset.final;
    progresso.finalDoJogo = escolha;
    salvarProgresso();
    Som.efeito("evolucao");
    camada.classList.add("saindo");
    setTimeout(() => {
      camada.remove();
      telaPrologo(() => telaCreditos(escolha), progresso.avatar || {}, epilogoDaEscolha(escolha), { tituloFinal: "FIM", botaoFinal: "Ver os créditos ✨", pular: "Pular ▸▸", musica: "triunfo" });
    }, 500);
  }));
}

// os créditos: os números da jornada do herói e quem fez o jogo, subindo devagar
function telaCreditos(escolha) {
  const nome = escapar(progresso.nome || "Aventureiro");
  const linhas = [
    `<h2>${nome}</h2>`,
    principalDoHeroi() ? `<p>${seloDoTitulo()}</p>` : "",
    `<p>Final: <b>${escolha === "libertar" ? "🕊️ Malakar libertado" : "🔒 O Abismo selado"}</b></p>`,
    `<ul>
      <li>⭐ Nível <b>${nivelDe(progresso.xp || 0)}</b></li>
      <li>👑 Chefões vencidos: <b>${(progresso.chefesDerrotados || []).length}</b></li>
      <li>📚 Livros e guias lidos: <b>${(progresso.livrosLidos || []).length}</b></li>
      <li>🎓 Lições concluídas: <b>${Object.keys(progresso.fases || {}).length}</b></li>
      <li>📜 Quests concluídas: <b>${(progresso.quests?.concluidas || []).length}</b></li>
    </ul>`,
    "<h3>RPG IA · Academia Arcana de Elyndor</h3>",
    "<p>Criado e desenvolvido por <b>Erickson</b></p>",
    "<p>Com Zetsu, Kaela, Orion, Lúmen, Íris, Lyra e Malakar</p>",
    "<p class=\"lema-creditos\">Neste reino, conhecimento é poder.<br>Obrigado por aprender com a gente.</p>",
  ].join("");
  const camada = criar(`
    <div class="creditos-finais">
      <div class="rolo-creditos">${linhas}</div>
      <button class="botao" type="button" data-continuar>Continuar a aventura ▸</button>
    </div>`);
  document.body.append(camada);
  chuvaDeEstrelas(60);
  camada.querySelector("[data-continuar]").addEventListener("click", () => {
    camada.classList.add("saindo");
    setTimeout(() => {
      camada.remove();
      telaMapa();
    }, 500);
  });
}
