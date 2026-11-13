// A tela inicial do RPG IA: uma cena composta à mão em pixel art (aurora no céu, estrelas cadentes, a lua,
// montanhas, a Academia num morro com a torre lançando um feixe de luz, névoa, o dragão cruzando o céu e
// três heróis num penhasco olhando para o castelo, com parallax no mouse), o logo em ouro e o menu em
// placas de pedra (setas ↑↓ e Enter, ou o mouse): Um Jogador, Multijogador (o Salão de Elyndor, salao.js),
// Sobre o jogo e Apoie o projeto (com a chave Pix para copiar).
// aoJogar() é chamado quando o jogador escolhe "Um Jogador".

const CHAVE_PIX = "20edc8ac-671c-4a72-afe8-bf99b077d744";
const VERSAO_JOGO = "0.9";

const MARCOS_DESENVOLVIMENTO = [
  ["📚", "A Academia Arcana", "Lições de prompt com o Zetsu, a biblioteca e o teste de aptidão."],
  ["🗺️", "O Reino se abre", "Mapa em pixel art, monstros que fazem perguntas e as dungeons."],
  ["⚔️", "Batalhas de verdade", "Turnos, magias, chefões em 3 fases, defesa ativa e a Sequência."],
  ["🌳", "Classes e a Árvore Arcana", "Mago, guerreiro e arqueiro, subclasses, talentos e poderes."],
  ["🏰", "O mundo gigante", "Arte em 32 px, seis cidades, dia e noite e o mapa 4× maior."],
  ["📜", "A história de Elyndor", "Quests principais, quests dos moradores e itens lendários."],
  ["🛡️", "O Salão multijogador", "Um castelo para encontrar amigos, o quadro de recados e os duelos de saber."],
];

// os companheiros do herói no penhasco
const COMPANHEIROS_TITULO = [
  { kit: "guerreiro", item: "espadaEscudo", chapeu: "elmoFerro", manto: "#8a1010", corpo: "masculino", cabelo: "curto", corCabelo: "#2b1d14", pele: "#c98d63", familiar: "nenhum" },
  { kit: "arqueiro", item: "arco", chapeu: "cacador", manto: "#2f6e1c", corpo: "feminino", cabelo: "longo", corCabelo: "#e2b04a", pele: "#f1c9a5", familiar: "nenhum" },
];

// A silhueta do dragão voando para a direita, desenhada a cada quadro: duas asas de morcego que batem
// (bate vai de -1, asas embaixo, a 1, asas no alto; a de trás vem um pouco atrasada e mais escura), o
// pescoço e a cabeça com chifre e olho aceso, e a cauda que ondula até a ponta em lança.
// cores: sem nada é a silhueta escura contra o céu; com { corpo, asaTras, barriga, chifre, membrana } é o
// dragão colorido (o da Academia), com barriga clara e os "dedos" da asa marcados
function desenharDragaoVoando(ctx, x, y, t, bate, cores = null) {
  const corpo = cores?.corpo || "#1b1030";
  const asa = (atraso, cor) => {
    const b = Math.sin(t * 5.5 - atraso);
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.moveTo(5, -2);
    ctx.lineTo(1, -4 - b * 11);
    ctx.lineTo(-11, -3 - b * 20);
    ctx.lineTo(-7, -2 - b * 12);
    ctx.lineTo(-11, -1 - b * 10);
    ctx.lineTo(-4, -1 - b * 4);
    ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.fill();
  };
  ctx.save();
  ctx.translate(x, y);
  asa(0.5, cores?.asaTras || "#120a22");
  // a cauda: segmentos que afinam e ondulam com atraso
  ctx.strokeStyle = corpo;
  ctx.lineCap = "round";
  let ax = -7;
  let ay = 0;
  for (let i = 1; i <= 7; i++) {
    const nx = -7 - i * 4;
    const ny = Math.sin(t * 4 - i * 0.7) * i * 0.55 + i * 0.3;
    ctx.lineWidth = Math.max(1, 4 - i * 0.5);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    ax = nx;
    ay = ny;
  }
  ctx.fillStyle = corpo;
  ctx.beginPath();
  ctx.moveTo(ax - 4, ay);
  ctx.lineTo(ax + 1, ay - 2.5);
  ctx.lineTo(ax + 1, ay + 2.5);
  ctx.closePath();
  ctx.fill();
  // o corpo, as patas recolhidas e o pescoço
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 3.5, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-4, 2, 2, 2);
  ctx.fillRect(3, 2, 2, 2);
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(6, -1);
  ctx.quadraticCurveTo(12, -2, 15, -6);
  ctx.stroke();
  // a cabeça com focinho, chifre e o olho que brilha
  ctx.beginPath();
  ctx.moveTo(13, -8);
  ctx.lineTo(18, -8);
  ctx.lineTo(23, -6);
  ctx.lineTo(22, -4.5);
  ctx.lineTo(16, -4);
  ctx.lineTo(13, -5);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.5;
  if (cores?.chifre) ctx.strokeStyle = cores.chifre;
  ctx.beginPath();
  ctx.moveTo(15, -8);
  ctx.lineTo(11, -11);
  ctx.stroke();
  ctx.strokeStyle = corpo;
  if (cores?.barriga) {
    // a barriga clara, do peito até o começo da cauda
    ctx.fillStyle = cores.barriga;
    ctx.beginPath();
    ctx.ellipse(1, 1.6, 6.5, 1.4, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(16, -4.6, 5, 0.8);
  }
  ctx.fillStyle = "rgba(255, 209, 102, 0.35)";
  ctx.fillRect(17, -8, 3, 3);
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(18, -7, 1, 1);
  asa(0, corpo);
  if (cores?.membrana) {
    // os "dedos" da asa da frente, por cima da membrana
    const b = Math.sin(t * 5.5);
    ctx.strokeStyle = cores.membrana;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(1, -4 - b * 11);
    ctx.lineTo(-7, -2 - b * 12);
    ctx.moveTo(1, -4 - b * 11);
    ctx.lineTo(-4, -1 - b * 4);
    ctx.stroke();
  }
  // o contorno de luar na asa da frente quando ela sobe
  if (bate > 0.3) {
    ctx.fillStyle = "rgba(169, 139, 255, 0.35)";
    ctx.fillRect(-10, Math.round(-3 - bate * 20), 3, 1);
  }
  ctx.restore();
}

// A cena: desenhada num canvas pequeno (180 px de altura) e esticada na tela inteira, pixel por pixel.
// comHerois: false tira os três heróis do penhasco (a tela de saves já mostra os aventureiros nas cartas)
function criarCenaTitulo(canvas, avatar, { comHerois = true } = {}) {
  const ctx = canvas.getContext("2d");
  const H = 180;
  const W = Math.max(240, Math.round((H * window.innerWidth) / Math.max(1, window.innerHeight)));
  canvas.width = W;
  canvas.height = H;
  const sorte = (n) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const herois = [];
  try {
    if (!comHerois) throw new Error("sem heróis");
    const meu = { ...AVATAR_PADRAO, ...(avatar || {}) };
    herois.push(spritesHeroi(COMPANHEIROS_TITULO[0]).lado, spritesHeroi(meu).lado, spritesHeroi(COMPANHEIROS_TITULO[1]).lado);
  } catch {
    // sem os desenhos do herói (não deveria acontecer): a cena fica sem eles
  }
  const mouse = { x: 0, y: 0 };
  const aoMexer = (e) => {
    mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener("mousemove", aoMexer);

  const montanha = (desloc, base, amp, cor, semente, neve = false) => {
    for (let x = 0; x < W; x++) {
      const m = x + desloc;
      const h = base + Math.sin(m * 0.018 + semente) * amp + Math.sin(m * 0.047 + semente * 2) * amp * 0.5 + Math.abs(Math.sin(m * 0.008 + semente)) * amp;
      const topo = Math.round(H - h);
      ctx.fillStyle = cor;
      ctx.fillRect(x, topo, 1, H - topo);
      if (neve && h > base + amp * 1.3) {
        ctx.fillStyle = "rgba(230, 236, 255, 0.55)";
        ctx.fillRect(x, topo, 1, 2);
      }
    }
  };

  // a Academia: muralha, torres com telhado cônico, a torre central com o cristal e o feixe de luz
  const castelo = (cx, base, t) => {
    const corPedra = "#2a2050";
    const corSombra = "#1c1538";
    const torre = (x, larg, alto, telhado) => {
      ctx.fillStyle = corPedra;
      ctx.fillRect(Math.round(x - larg / 2), base - alto, larg, alto);
      ctx.fillStyle = corSombra;
      ctx.fillRect(Math.round(x + larg / 2) - 2, base - alto, 2, alto);
      for (let i = 0; i < telhado; i++) {
        ctx.fillStyle = i % 3 ? "#4a2f7a" : "#3a2266";
        const l = Math.max(1, larg + 4 - Math.round((i / telhado) * (larg + 4)));
        ctx.fillRect(Math.round(x - l / 2), base - alto - i - 1, l, 1);
      }
      // janelas acesas que tremulam
      for (let j = 0; j < Math.floor(alto / 9); j++) {
        const acesa = Math.sin(t * 1.3 + x * 0.7 + j * 2.1) > -0.7;
        ctx.fillStyle = acesa ? "#ffd166" : "#7a5a2a";
        ctx.fillRect(Math.round(x) - 1, base - alto + 5 + j * 9, 2, 3);
      }
      // bandeira no alto
      ctx.fillStyle = "#3a2412";
      ctx.fillRect(Math.round(x), base - alto - telhado - 7, 1, 7);
      const onda = Math.round(Math.sin(t * 5 + x) * 1);
      ctx.fillStyle = "#c0283c";
      ctx.fillRect(Math.round(x) + 1, base - alto - telhado - 7 + onda * 0, 5, 2);
      ctx.fillRect(Math.round(x) + 5, base - alto - telhado - 6 + onda, 2, 2);
    };
    // muralha com ameias
    ctx.fillStyle = corPedra;
    ctx.fillRect(Math.round(cx - 46), base - 14, 92, 14);
    for (let x = cx - 46; x < cx + 46; x += 4) ctx.fillRect(Math.round(x), base - 17, 2, 3);
    ctx.fillStyle = "#120a24";
    ctx.fillRect(Math.round(cx - 4), base - 10, 8, 10);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(Math.round(cx - 2), base - 8, 4, 2);
    torre(cx - 38, 9, 34, 10);
    torre(cx + 38, 9, 30, 9);
    torre(cx - 20, 11, 48, 12);
    torre(cx + 20, 11, 44, 12);
    torre(cx, 15, 66, 16);
    // o cristal no alto da torre central, com o feixe subindo até o céu
    const pulso = 0.6 + Math.sin(t * 2) * 0.25;
    const topo = base - 66 - 16 - 10;
    const feixe = ctx.createLinearGradient(0, 0, 0, topo);
    feixe.addColorStop(0, "rgba(110, 240, 255, 0)");
    feixe.addColorStop(1, `rgba(110, 240, 255, ${0.35 * pulso})`);
    ctx.fillStyle = feixe;
    ctx.fillRect(Math.round(cx) - 2, 0, 5, topo);
    const halo = ctx.createRadialGradient(cx, topo + 4, 0, cx, topo + 4, 16);
    halo.addColorStop(0, `rgba(110, 240, 255, ${0.7 * pulso})`);
    halo.addColorStop(1, "rgba(110, 240, 255, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(cx - 16, topo - 12, 32, 32);
    ctx.fillStyle = "#e6fdff";
    ctx.fillRect(Math.round(cx) - 1, topo, 3, 6);
    ctx.fillStyle = "#6ef0ff";
    ctx.fillRect(Math.round(cx) - 2, topo + 2, 5, 2);
    // faíscas de magia subindo pelo feixe
    for (let i = 0; i < 8; i++) {
      const vida = (t * 0.35 + i / 8) % 1;
      ctx.fillStyle = `rgba(${i % 2 ? "230, 253, 255" : "110, 240, 255"}, ${1 - vida})`;
      ctx.fillRect(Math.round(cx + Math.sin(t * 3 + i * 2) * 2), Math.round(topo - vida * topo), 1, i % 3 ? 1 : 2);
    }
  };

  // nuvens em pixel, desenhadas uma vez só: um cacho de bolas roxas com a borda de cima clareada pela lua
  const nuvens = [[64, 12, 1], [90, 16, 2], [48, 10, 3]].map(([w, h, semente]) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    for (let b = 0; b < 6; b++) {
      const bx = 6 + sorte(semente * 10 + b) * (w - 12);
      const r = 3 + sorte(semente * 10 + b + 5) * (h * 0.45);
      for (let dy = -r; dy <= r; dy++) {
        const meia = Math.round(Math.sqrt(r * r - dy * dy) * 1.6);
        const y = Math.round(h - r - 1 + dy);
        g.fillStyle = dy < -r + 1.5 ? "#6a4a9a" : "#3a2466";
        g.fillRect(Math.round(bx - meia), y, meia * 2, 1);
      }
    }
    return c;
  });

  const inicio = performance.now();
  let rodando = true;
  // a aurora: cada cor vira uma faixa de degradê pronta (antes eram ~480 degradês novos por quadro)
  const faixasAurora = {};
  const faixaAurora = (cor) => {
    if (!faixasAurora[cor]) {
      const f = document.createElement("canvas");
      f.width = 1;
      f.height = 26;
      const g = f.getContext("2d");
      const grad = g.createLinearGradient(0, 0, 0, 26);
      grad.addColorStop(0, `rgba(${cor}, 0)`);
      grad.addColorStop(1, `rgba(${cor}, 1)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 1, 26);
      faixasAurora[cor] = f;
    }
    return faixasAurora[cor];
  };
  let ultimoQuadro = 0;
  const quadro = (agora) => {
    if (!canvas.isConnected) {
      window.removeEventListener("mousemove", aoMexer);
      rodando = false;
      return;
    }
    // 30 quadros por segundo (a cena é de pixel, não precisa de mais) e nada com a aba escondida
    if (document.hidden || agora - ultimoQuadro < 32) {
      requestAnimationFrame(quadro);
      return;
    }
    ultimoQuadro = agora;
    const t = Math.max(0, (agora - inicio) / 1000);
    const px = (fator) => Math.round(-mouse.x * fator);
    // céu
    const ceu = ctx.createLinearGradient(0, 0, 0, H);
    ceu.addColorStop(0, "#070418");
    ceu.addColorStop(0.45, "#1c1046");
    ceu.addColorStop(0.75, "#4a1e5e");
    ceu.addColorStop(1, "#8a3a5a");
    ctx.fillStyle = ceu;
    ctx.fillRect(0, 0, W, H);
    // a aurora: três faixas que ondulam
    [["110, 255, 170", 30, 0], ["110, 240, 255", 40, 1.7], ["169, 139, 255", 52, 3.1]].forEach(([cor, base, fase]) => {
      for (let x = 0; x < W; x += 2) {
        const y = base + Math.sin(x * 0.021 + t * 0.35 + fase) * 9 + Math.sin(x * 0.007 - t * 0.2 + fase) * 6;
        const brilho = 0.1 + Math.max(0, Math.sin(x * 0.03 + t * 0.6 + fase)) * 0.16;
        ctx.globalAlpha = brilho;
        ctx.drawImage(faixaAurora(cor), x + px(2), Math.round(y - 22), 2, 26);
      }
    });
    ctx.globalAlpha = 1;
    // estrelas que piscam
    for (let i = 0; i < 110; i++) {
      const brilha = Math.sin(t * (1 + sorte(i) * 3) + i) > 0.3;
      ctx.fillStyle = brilha ? "#ffffff" : "#7a74b0";
      ctx.fillRect(Math.floor(sorte(i + 1) * W) + px(1), Math.floor(sorte(i + 2) * H * 0.55), 1, 1);
    }
    // estrela cadente a cada 5 segundos
    const ciclo = t % 5;
    if (ciclo < 0.7) {
      const n = Math.floor(t / 5);
      const sx = sorte(n + 40) * W * 0.8 + W * 0.1 - ciclo * 90;
      const sy = sorte(n + 41) * 30 + 6 + ciclo * 40;
      for (let k = 0; k < 10; k++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(1 - k / 10) * (1 - ciclo / 0.7)})`;
        ctx.fillRect(Math.round(sx + k * 3), Math.round(sy - k * 1.3), 1, 1);
      }
    }
    // a lua
    const lx = Math.round(W * 0.16) + px(3);
    const ly = 30;
    const halo = ctx.createRadialGradient(lx, ly, 0, lx, ly, 34);
    halo.addColorStop(0, "rgba(255, 246, 216, 0.35)");
    halo.addColorStop(1, "rgba(255, 246, 216, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(lx - 34, ly - 34, 68, 68);
    ctx.fillStyle = "#fff6d8";
    ctx.beginPath();
    ctx.arc(lx, ly, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e6dcb8";
    [[-5, -3, 3], [4, 3, 2], [-1, 5, 2], [5, -5, 1]].forEach(([dx, dy, r]) => ctx.fillRect(lx + dx, ly + dy, r, r));
    // as nuvens passando devagar (algumas cruzam na frente da lua)
    nuvens.forEach((n, i) => {
      const vel = [3, 2, 4.5][i];
      const nx = ((sorte(i + 90) * W + t * vel) % (W + n.width + 40)) - n.width - 20 + px(2 + i);
      const ny = [24, 36, 14][i];
      ctx.globalAlpha = 0.85;
      ctx.drawImage(n, Math.round(nx), ny);
      ctx.globalAlpha = 1;
    });
    // o dragão cruza o céu de vez em quando, da esquerda para a direita (de cabeça para a frente), subindo e
    // descendo com as batidas de asa e a cauda ondulando atrás
    const voo = (t % 16) / 16;
    if (voo < 0.6) {
      const p = voo / 0.6;
      const bate = Math.sin(t * 5.5);
      const dxv = -50 + p * (W + 100) + px(4);
      const dyv = 46 - Math.sin(p * Math.PI) * 18 + Math.sin(p * Math.PI * 3) * 4 - bate * 1.5;
      desenharDragaoVoando(ctx, Math.round(dxv), Math.round(dyv), t, bate);
    }
    // montanhas em três camadas (as de trás mexem menos com o mouse)
    montanha(px(4) + t * 0.6, 62, 18, "#2a1a52", 1.2, true);
    montanha(px(7) + t * 1.2, 44, 12, "#22163f", 3.4, true);
    // o morro e a Academia
    const cx = Math.round(W * 0.55) + px(10);
    const base = H - 52;
    ctx.fillStyle = "#1a1232";
    ctx.beginPath();
    ctx.ellipse(cx, base + 30, 120, 36, 0, Math.PI, 0);
    ctx.fill();
    castelo(cx, base, t);
    // névoa passando embaixo do castelo
    for (let i = 0; i < 6; i++) {
      const nx = ((i * 97 + t * (6 + i)) % (W + 120)) - 60;
      const g = ctx.createRadialGradient(nx, base + 6, 0, nx, base + 6, 50);
      g.addColorStop(0, "rgba(200, 180, 255, 0.16)");
      g.addColorStop(1, "rgba(200, 180, 255, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(nx - 50, base - 30, 100, 70);
    }
    montanha(px(14) + t * 2, 24, 7, "#140c26", 5.1);
    // o penhasco na frente, à esquerda, com os três heróis olhando para o castelo
    const pe = H - 30;
    ctx.fillStyle = "#0b0716";
    ctx.beginPath();
    ctx.moveTo(-10, H);
    ctx.lineTo(-10, pe);
    for (let x = 0; x <= W * 0.52; x += 6) ctx.lineTo(x + px(18), pe + Math.round(Math.sin(x * 0.2) * 2) + (x > W * 0.46 ? (x - W * 0.46) * 0.9 : 0));
    ctx.lineTo(W * 0.6 + px(18), H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1f1438";
    for (let x = 0; x < W * 0.46; x += 3) if (sorte(x) > 0.5) ctx.fillRect(x + px(18), pe - 1 - Math.floor(sorte(x + 9) * 3), 1, 2 + Math.floor(sorte(x + 3) * 2));
    herois.forEach((quadros, i) => {
      const s = quadros[Math.floor(t * 1.4 + i) % 2 ? QUADRO_RESPIRA : 0];
      // no penhasco, à esquerda (a janela de comandos fica no meio, embaixo), olhando para o castelo
      const hx = Math.round(Math.min(W * 0.1, 8) + i * 22) + px(18);
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fillRect(hx + 6, pe, 20, 2);
      ctx.drawImage(s, hx, pe - PE_HEROI - 1 + (i === 1 ? -2 : 0));
    });
    // brasas e vaga-lumes subindo
    for (let i = 0; i < 26; i++) {
      const vida = (t * 0.18 + sorte(i + 60)) % 1;
      const fx = (sorte(i + 70) * W + Math.sin(t + i) * 10 + W) % W;
      const fy = H - vida * H * 0.8;
      ctx.fillStyle = i % 3 ? `rgba(255, 190, 110, ${1 - vida})` : `rgba(110, 240, 255, ${1 - vida})`;
      ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1);
    }
    if (rodando) requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);
}

// um prólogo ou uma introdução que ficou aberto por baixo (o herói voltou ao menu no meio) sai de vez,
// para não continuar desenhando escondido
function fecharCenasEsquecidas() {
  document.querySelectorAll("body > .prologo, body > .introducao").forEach((c) => c.remove());
}

// aoMulti() é chamado no "Multijogador" (o Salão de Elyndor); sem ele, a opção só avisa que está em obras.
// podeMulti() (opcional, assíncrono) confere antes de sair da tela: true entra, "solo" vai criar o herói no
// Um Jogador, e qualquer outra coisa fica aqui (quem chama mostra o porquê).
function telaTitulo(aoJogar, aoMulti = null, podeMulti = null) {
  window.scrollTo(0, 0);
  fecharCenasEsquecidas();
  document.body.classList.add("modo-titulo");
  let avatar = null;
  try {
    avatar = typeof carregarProgresso === "function" ? carregarProgresso().avatar : null;
  } catch {
    avatar = null;
  }
  const brasao = typeof iconeRpgIaDataUrl === "function" ? iconeRpgIaDataUrl(8) : "";
  const opcao = (id, icone, titulo, sub, extra = "") => `
    <button type="button" class="placa-titulo ${extra}" data-opcao="${id}">
      <span class="gema-placa"></span>
      <span class="icone-placa">${icone}</span>
      <span class="texto-placa"><b>${titulo}</b><small>${sub}</small></span>
      ${extra.includes("bloqueada") ? '<i class="faixa-dev">EM DESENVOLVIMENTO</i>' : extra.includes("nova") ? '<i class="faixa-dev faixa-nova">NOVO</i>' : ""}
    </button>`;
  const secao = document.createElement("section");
  secao.className = "tela-titulo";
  secao.innerHTML = `
    <canvas class="pixel cena-titulo"></canvas>
    <div class="vinheta-titulo"></div>
    <div class="conteudo-titulo">
      <div class="logo-titulo">
        <div class="anel-logo"></div>
        ${brasao ? `<img class="pixel brasao-titulo" src="${brasao}" alt="">` : ""}
        <h1 data-texto="RPG IA">RPG IA</h1>
        <div class="faixa-logo"><span>Academia Arcana de Elyndor</span></div>
        <p class="lema-titulo">Aprenda Inteligência Artificial numa aventura de verdade</p>
      </div>
      <div class="janela-comando">
        <nav class="menu-titulo" aria-label="Menu principal">
          ${opcao("solo", "⚔️", "Um Jogador", "Tua jornada pela Academia e pelo Reino")}
          ${aoMulti
    ? opcao("multi", "🛡️", "Multijogador", "O Salão de Elyndor: amigos, recados e duelos", "nova")
    : opcao("multi", "🛡️", "Multijogador", "Explorar o Reino com os amigos", "bloqueada")}
          ${opcao("sobre", "📜", "Sobre o jogo", "Como o RPG IA nasceu e cresceu")}
          ${opcao("apoie", "💎", "Apoie o projeto", "Ajude o Reino a crescer")}
        </nav>
        <p class="descricao-comando" aria-live="polite">Tua jornada pela Academia e pelo Reino</p>
      </div>
    </div>
    <p class="aperte-titulo">◀ ▶ escolher · Enter confirmar</p>
    <footer class="rodape-titulo"><span>v${VERSAO_JOGO}</span><a class="link-privacidade" href="/privacidade" target="_blank" rel="noopener">Privacidade</a><span>Desenvolvido por Erickson</span></footer>
    <div class="painel-titulo" hidden></div>`;
  tela.replaceChildren(secao);
  criarCenaTitulo(secao.querySelector(".cena-titulo"), avatar);
  if (typeof Som !== "undefined") Som.musica("abertura");

  const opcoes = [...secao.querySelectorAll(".placa-titulo")];
  const painel = secao.querySelector(".painel-titulo");
  let saindo = false;

  const focar = (i) => {
    opcoes[(i + opcoes.length) % opcoes.length].focus();
    if (typeof Som !== "undefined") Som.efeito("clique");
  };
  const fecharPainel = () => {
    painel.hidden = true;
    painel.innerHTML = "";
    opcoes[0].focus();
  };
  const abrirPainel = (html) => {
    painel.innerHTML = `<div class="janela-painel"><button type="button" class="fechar-painel" aria-label="Voltar">✕</button>${html}</div>`;
    painel.hidden = false;
    painel.querySelector(".fechar-painel").addEventListener("click", fecharPainel);
    painel.querySelector(".fechar-painel").focus();
  };

  const sairPara = (destino) => {
    if (saindo) return;
    saindo = true;
    if (typeof Som !== "undefined") Som.efeito("evolucao");
    secao.classList.add("saindo");
    setTimeout(() => {
      document.body.classList.remove("modo-titulo");
      window.removeEventListener("keydown", teclas);
      // a tela inicial sai antes: ela fica por cima de tudo e tapava o prólogo de quem começa agora
      secao.remove();
      destino();
    }, 650);
  };
  const acoes = {
    solo: () => sairPara(aoJogar),
    multi: async () => {
      if (aoMulti) {
        if (saindo) return;
        const pode = podeMulti ? await podeMulti() : true;
        if (pode === "solo") return sairPara(aoJogar);
        if (pode === true) return sairPara(aoMulti);
        return;
      }
      const botao = secao.querySelector('[data-opcao="multi"]');
      botao.classList.remove("negado");
      void botao.offsetWidth;
      botao.classList.add("negado");
      if (typeof Som !== "undefined") Som.efeito("erro");
      if (typeof avisoFlutuante === "function") avisoFlutuante("🚧", "Multijogador em desenvolvimento", "Os magos da Academia ainda estão abrindo os portais entre os mundos. Em breve!");
    },
    sobre: () => abrirPainel(`
      <header class="cabeca-painel">
        ${brasao ? `<img class="pixel" src="${brasao}" alt="">` : ""}
        <div class="faixa-logo"><span>Sobre o RPG IA</span></div>
      </header>
      <ul class="placar-jogo">
        <li><b>1.014</b><small>perguntas</small></li>
        <li><b>42</b><small>monstros</small></li>
        <li><b>26</b><small>livros</small></li>
        <li><b>6</b><small>dungeons</small></li>
        <li><b>18</b><small>classes</small></li>
      </ul>
      <p>O RPG IA nasceu de uma pergunta simples: <b>e se aprender Inteligência Artificial fosse tão divertido quanto jogar um RPG?</b></p>
      <p>Em vez de apostila, tu entras na Academia Arcana de Elyndor, aprendes a escrever prompts com o mestre Zetsu e
        sais pelo Reino respondendo monstros que perguntam sobre prompts, fundamentos, código, segurança e IA no trabalho.
        Cada acerto é um golpe; cada erro, uma lição.</p>
      <p>Tudo o que aparece na tela, dos heróis aos dragões, das cidades ao próprio mapa, é <b>desenhado por código</b>,
        pixel a pixel, sem imagens baixadas da internet. O jogo foi criado por <b>Erickson</b>, construído junto com IA,
        num ciclo de ideias, testes e muito café.</p>
      <h3>📜 A jornada até aqui</h3>
      <ol class="marcos">${MARCOS_DESENVOLVIMENTO.map(([icone, titulo, texto], i) => `
        <li style="--i:${i}"><span>${icone}</span><div><b>${titulo}</b><small>${texto}</small></div><i class="feito">✓</i></li>`).join("")}
        <li class="futuro" style="--i:${MARCOS_DESENVOLVIMENTO.length}"><span>🛡️</span><div><b>Próximo capítulo: o Reino com os amigos</b><small>Depois do Salão, explorar o Reino juntos. Os magos estão abrindo os portais.</small></div><i>🔒</i></li>
      </ol>`),
    apoie: () => {
      abrirPainel(`
        <header class="cabeca-painel">
          <span class="tesouro-apoie" aria-hidden="true">💎</span>
          <div class="faixa-logo"><span>Apoie o projeto</span></div>
        </header>
        <p>O RPG IA é <b>gratuito</b> e feito com carinho. Se o jogo te ajudou a aprender (ou só te divertiu),
          qualquer valor via <b>Pix</b> ajuda a manter o Reino no ar.</p>
        <ul class="apoio-constroi">
          <li><span>🏰</span><b>O Reino no ar</b><small>servidor, domínio e cópias de segurança</small></li>
          <li><span>🛡️</span><b>O multijogador</b><small>explorar com os amigos</small></li>
          <li><span>🐉</span><b>Novas aventuras</b><small>dungeons, chefões e livros</small></li>
        </ul>
        <div class="caixa-pix">
          <span class="rotulo-pix">✦ Chave Pix (aleatória) ✦</span>
          <code>${CHAVE_PIX}</code>
          <button type="button" class="botao copiar-pix">📋 Copiar chave Pix</button>
          <small class="copiou" hidden>✓ Chave copiada! Cola no app do teu banco, em Pix › Pagar com chave.</small>
        </div>
        <p class="obrigado">Obrigado por fazer parte desta aventura, herói! 🧙</p>`);
      painel.querySelector(".copiar-pix").addEventListener("click", async () => {
        const aviso = painel.querySelector(".copiou");
        try {
          await navigator.clipboard.writeText(CHAVE_PIX);
        } catch {
          // sem permissão de área de transferência: seleciona o texto para copiar na mão
          const selecao = window.getSelection();
          const faixa = document.createRange();
          faixa.selectNodeContents(painel.querySelector(".caixa-pix code"));
          selecao.removeAllRanges();
          selecao.addRange(faixa);
          aviso.textContent = "Selecionei a chave: aperta Ctrl+C para copiar.";
        }
        aviso.hidden = false;
        if (typeof Som !== "undefined") Som.efeito("moeda");
      });
    },
  };

  // a linha de descrição da janela de comandos mostra o que a opção escolhida faz
  const descricao = secao.querySelector(".descricao-comando");
  opcoes.forEach((b) => {
    b.addEventListener("click", () => acoes[b.dataset.opcao]());
    b.addEventListener("mouseenter", () => b.focus({ preventScroll: true }));
    b.addEventListener("focus", () => {
      if (descricao) descricao.textContent = b.querySelector(".texto-placa small")?.textContent || "";
    });
  });
  const teclas = (e) => {
    if (!tela.contains(secao)) return window.removeEventListener("keydown", teclas);
    if (!painel.hidden) {
      if (e.key === "Escape") fecharPainel();
      return;
    }
    const atual = opcoes.indexOf(document.activeElement);
    // a janela de comandos é na horizontal: as setas dos lados (e as de cima/baixo, por costume) andam nela
    if (["ArrowDown", "ArrowRight", "s", "d"].includes(e.key)) { e.preventDefault(); focar(atual + 1); }
    if (["ArrowUp", "ArrowLeft", "w", "a"].includes(e.key)) { e.preventDefault(); focar(atual < 0 ? 0 : atual - 1); }
  };
  window.addEventListener("keydown", teclas);
  setTimeout(() => opcoes[0].focus({ preventScroll: true }), 1100);
}
