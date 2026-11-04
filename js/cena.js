// A cena animada da tela de título do RPG IA (aurora, estrelas cadentes, a lua, o dragão, a Academia no morro
// e os três heróis no penhasco), copiada do próprio jogo (static/js/titulo.js). Tudo é desenhado por código,
// pixel a pixel, num canvas de 180 px de altura que o CSS estica sem borrar.
// A silhueta do dragão voando para a direita, desenhada a cada quadro: duas asas de morcego que batem
// (bate vai de -1, asas embaixo, a 1, asas no alto; a de trás vem um pouco atrasada e mais escura), o
// pescoço e a cabeça com chifre e olho aceso, e a cauda que ondula até a ponta em lança.
function desenharDragaoVoando(ctx, x, y, t, bate) {
  const corpo = "#1b1030";
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
  asa(0.5, "#120a22");
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
  ctx.beginPath();
  ctx.moveTo(15, -8);
  ctx.lineTo(11, -11);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 209, 102, 0.35)";
  ctx.fillRect(17, -8, 3, 3);
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(18, -7, 1, 1);
  asa(0, corpo);
  // o contorno de luar na asa da frente quando ela sobe
  if (bate > 0.3) {
    ctx.fillStyle = "rgba(169, 139, 255, 0.35)";
    ctx.fillRect(-10, Math.round(-3 - bate * 20), 3, 1);
  }
  ctx.restore();
}

// A cena: desenhada num canvas pequeno (180 px de altura) e esticada pelo CSS, pixel por pixel.
// herois: [[quadroParado, quadroRespirando], ...] (imagens de 32x51 olhando para a direita)
function criarCena(canvas, herois = []) {
  const ctx = canvas.getContext("2d");
  const H = 180;
  const W = Math.max(240, Math.round((H * canvas.clientWidth) / Math.max(1, canvas.clientHeight)));
  canvas.width = W;
  canvas.height = H;
  const sorte = (n) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
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
  };

  const inicio = performance.now();
  let rodando = true;
  const quadro = (agora) => {
    if (!canvas.isConnected) {
      window.removeEventListener("mousemove", aoMexer);
      rodando = false;
      return;
    }
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
        const g = ctx.createLinearGradient(0, y - 22, 0, y + 4);
        g.addColorStop(0, `rgba(${cor}, 0)`);
        g.addColorStop(1, `rgba(${cor}, ${brilho})`);
        ctx.fillStyle = g;
        ctx.fillRect(x + px(2), Math.round(y - 22), 2, 26);
      }
    });
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
      const s = quadros[Math.floor(t * 1.4 + i) % 2 ? 1 : 0];
      // na ponta do penhasco, embaixo do logo e olhando para o castelo
      const hx = Math.round(W * 0.37 + i * 24) + px(18);
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fillRect(hx + 6, pe, 20, 2);
      ctx.drawImage(s, hx, pe - 48 - 1 + (i === 1 ? -2 : 0));
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
