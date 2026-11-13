// Os efeitos visuais da batalha: uma camada de partículas por cima da tela (canvas fixo, sem cliques).
// Cada classe ataca do seu jeito: o mago lança um orbe de magia, o guerreiro avança e corta, o arqueiro
// dispara uma flecha. Também tem número de dano, golpe no herói, escudo, cura e o monstro se desfazendo
// em pixels quando cai. Tudo em quadradinhos, para combinar com a pixel art.
//   const fx = criarFxBatalha();  fx.ataque(kit, heroiEl, monstroEl, { cor, critico })  ...  fx.destruir()
// Dentro de um <dialog> (que fica por cima de tudo), passe o diálogo como "pai" para os efeitos aparecerem.
// Depende de som.js (Som).

function criarFxBatalha(ancora, pai = document.body) {
  const canvas = document.createElement("canvas");
  canvas.className = "fx-batalha";
  pai.append(canvas);
  const ctx = canvas.getContext("2d");
  let particulas = [];
  let desenhos = []; // formas que vivem por um tempo (projéteis, cortes, anéis)
  let ativo = true;

  function redimensionar() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.imageSmoothingEnabled = false;
  }
  redimensionar();
  window.addEventListener("resize", redimensionar);

  const centro = (el, dy = 0) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 + dy * r.height, w: r.width, h: r.height };
  };
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  function particula(x, y, { vx = 0, vy = 0, vida = 0.6, cor = "#fff", tamanho = 4, gravidade = 0, atrito = 0.98 } = {}) {
    particulas.push({ x, y, vx, vy, vida, total: vida, cor, tamanho, gravidade, atrito });
  }

  function explosao(x, y, cor, quantos = 18, forca = 340, tamanho = 8) {
    for (let i = 0; i < quantos; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = forca * (0.3 + Math.random() * 0.7);
      particula(x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 0.4 + Math.random() * 0.4, cor: Array.isArray(cor) ? cor[i % cor.length] : cor, tamanho: tamanho * (0.5 + Math.random() * 0.8), atrito: 0.9 });
    }
  }

  function anel(x, y, cor, raio = 60, duracao = 0.35) {
    desenhos.push({ tipo: "anel", x, y, cor, raio, t: 0, duracao });
  }

  function laco(agora) {
    if (!ativo) return;
    // saiu da batalha (a tela foi trocada): a camada some sozinha
    if (ancora && !ancora.isConnected) return destruir();
    requestAnimationFrame(laco);
    const dt = Math.min(0.05, (agora - (laco.ultimo || agora)) / 1000);
    laco.ultimo = agora;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    desenhos = desenhos.filter((d) => {
      d.t += dt;
      const p = Math.min(1, d.t / d.duracao);
      if (d.tipo === "anel") {
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = d.cor;
        ctx.lineWidth = 4 * (1 - p) + 1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.raio * p, 0, Math.PI * 2);
        ctx.stroke();
      } else if (d.tipo === "corte") {
        // um risco branco que cresce e some
        ctx.globalAlpha = 1 - p * p;
        ctx.strokeStyle = d.cor;
        ctx.lineWidth = 12 * (1 - p) + 3;
        ctx.lineCap = "square";
        ctx.beginPath();
        const fim = Math.min(1, p * 3);
        ctx.moveTo(d.x1, d.y1);
        ctx.lineTo(d.x1 + (d.x2 - d.x1) * fim, d.y1 + (d.y2 - d.y1) * fim);
        ctx.stroke();
      } else if (d.tipo === "projetil") {
        const x = d.x1 + (d.x2 - d.x1) * p;
        const y = d.y1 + (d.y2 - d.y1) * p - Math.sin(p * Math.PI) * d.arco;
        d.desenhar(ctx, x, y, p, Math.atan2(d.y2 - d.y1 - Math.cos(p * Math.PI) * d.arco * Math.PI, d.x2 - d.x1));
        if (d.rastro) d.rastro(x, y);
      } else if (d.tipo === "flash") {
        ctx.globalAlpha = (1 - p) * d.forca;
        ctx.fillStyle = d.cor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (d.tipo === "icone") {
        // ícone grande que surge, cresce e some (magias)
        ctx.globalAlpha = p < 0.7 ? 1 : (1 - p) / 0.3;
        const escala = p < 0.25 ? p / 0.25 * 1.3 : 1.3 - (p - 0.25) * 0.4;
        ctx.font = `${Math.round(64 * escala)}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(d.texto, d.x, d.y - p * 30);
      } else if (d.tipo === "bolha") {
        ctx.globalAlpha = (p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8) * 0.8;
        ctx.strokeStyle = d.cor;
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -d.t * 60;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.rx, d.ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha *= 0.15;
        ctx.fillStyle = d.cor;
        ctx.fill();
      } else if (d.tipo === "raios") {
        // a estrela do impacto: riscos que saem do centro, crescem e somem
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = d.cor;
        for (let i = 0; i < d.angulos.length; i++) {
          const a = d.angulos[i];
          const ini = d.raio * (0.2 + p * 0.6);
          const fim = d.raio * (0.45 + p * 0.9) * d.compr[i];
          for (let r = ini; r < fim; r += 6) {
            const t2 = Math.max(2, Math.round(7 * (1 - (r - ini) / Math.max(1, fim - ini)) * (1 - p)));
            ctx.fillRect(Math.round(d.x + Math.cos(a) * r - t2 / 2), Math.round(d.y + Math.sin(a) * r - t2 / 2), t2, t2);
          }
        }
      } else if (d.tipo === "runas") {
        // o círculo de runas que gira em volta de quem carrega a magia e fecha no fim
        const raio = d.raio * (1 - p * 0.6);
        ctx.globalAlpha = p < 0.2 ? p / 0.2 : 1 - Math.max(0, (p - 0.8) / 0.2);
        ctx.fillStyle = d.cor;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + d.t * 5;
          const tam = i % 3 === 0 ? 6 : 3;
          ctx.fillRect(Math.round(d.x + Math.cos(a) * raio - tam / 2), Math.round(d.y + Math.sin(a) * raio * 0.45 - tam / 2), tam, tam);
        }
        ctx.strokeStyle = d.cor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, raio, raio * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (d.tipo === "livre") {
        d.desenhar(ctx, p, d.t);
      }
      ctx.globalAlpha = 1;
      return d.t < d.duracao;
    });
    particulas = particulas.filter((q) => {
      q.vida -= dt;
      q.vx *= q.atrito;
      q.vy = q.vy * q.atrito + q.gravidade * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      ctx.globalAlpha = Math.max(0, q.vida / q.total);
      ctx.fillStyle = q.cor;
      const t = Math.max(1, Math.round(q.tamanho));
      ctx.fillRect(Math.round(q.x - t / 2), Math.round(q.y - t / 2), t, t);
      return q.vida > 0;
    });
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(laco);

  function raios(x, y, cor, raio = 120, quantos = 10, duracao = 0.3) {
    const angulos = Array.from({ length: quantos }, (_, i) => (i / quantos) * Math.PI * 2 + Math.random() * 0.3);
    desenhos.push({ tipo: "raios", x, y, cor, raio, angulos, compr: angulos.map(() => 0.6 + Math.random() * 0.6), t: 0, duracao });
  }

  // Empurra o elemento por um instante (somando à animação que ele já tem, sem brigar com o CSS).
  function empurrar(el, quadros, ms) {
    if (!el?.animate) return;
    try {
      el.animate(quadros, { duration: ms, easing: "cubic-bezier(.2,.8,.3,1)", composite: "add" });
    } catch {
      // navegador sem "composite": sem o empurrão, o resto da animação segue
    }
  }

  // O impacto: estrela de riscos, o monstro voa um pouco para trás (para longe de quem bateu) e, no
  // crítico, um "congela" curto de 70 ms antes do tranco, que dá peso ao golpe.
  function impacto(de, para, monstroEl, cor, critico) {
    raios(para.x, para.y, "#ffffff", critico ? 170 : 110, critico ? 14 : 9);
    if (critico) setTimeout(() => raios(para.x, para.y, cor, 200, 8, 0.4), 60);
    const lado = Math.sign(para.x - de.x) || 1;
    const forca = critico ? 34 : 18;
    empurrar(monstroEl, [
      { transform: "translate(0,0)", filter: "brightness(1)" },
      { transform: "translate(0,0)", filter: "brightness(4)", offset: critico ? 0.18 : 0.05 },
      { transform: `translate(${lado * forca}px, -6px) rotate(${lado * 6}deg)`, filter: "brightness(1.6)", offset: 0.35 },
      { transform: "translate(0,0)", filter: "brightness(1)" },
    ], critico ? 520 : 380);
  }

  // A carga antes do ataque: faíscas que se juntam no herói e o círculo de runas girando aos pés dele.
  async function carga(heroiEl, cor, ms = 300) {
    const h = centro(heroiEl);
    desenhos.push({ tipo: "runas", x: h.x, y: h.y + h.h * 0.38, raio: h.w * 0.7, cor, t: 0, duracao: ms / 1000 + 0.15 });
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 50;
      const vida = ms / 1000;
      particula(h.x + Math.cos(a) * dist, h.y + Math.sin(a) * dist, { vx: -Math.cos(a) * dist / vida, vy: -Math.sin(a) * dist / vida, vida, cor: i % 3 ? cor : "#ffffff", tamanho: 4, atrito: 1 });
    }
    await esperar(ms);
  }

  // ---------- ataques de cada classe ----------

  function projetil(de, para, { duracao, arco = 0, desenhar, rastro }) {
    return new Promise((resolver) => {
      desenhos.push({ tipo: "projetil", x1: de.x, y1: de.y, x2: para.x, y2: para.y, arco, t: 0, duracao, desenhar, rastro });
      setTimeout(resolver, duracao * 1000);
    });
  }

  async function ataqueMago(de, para, cor, critico) {
    Som.efeito("feitico");
    await projetil(de, para, {
      duracao: 0.45, arco: 60,
      desenhar: (c, x, y, p) => {
        const r = critico ? 24 : 17;
        c.fillStyle = cor;
        c.fillRect(Math.round(x - r), Math.round(y - r / 2), r * 2, r);
        c.fillRect(Math.round(x - r / 2), Math.round(y - r), r, r * 2);
        c.fillStyle = "#ffffff";
        c.fillRect(Math.round(x - r / 3), Math.round(y - r / 3), Math.round(r / 1.5), Math.round(r / 1.5));
      },
      rastro: (x, y) => {
        for (let i = 0; i < 2; i++) particula(x + (Math.random() - 0.5) * 22, y + (Math.random() - 0.5) * 22, { vy: -40, vida: 0.5, cor: i ? "#ffffff" : cor, tamanho: 6 + Math.random() * 6 });
      },
    });
    explosao(para.x, para.y, [cor, "#ffffff", cor], critico ? 50 : 32, critico ? 520 : 380, 10);
    anel(para.x, para.y, cor, critico ? 170 : 110);
  }

  async function ataqueGuerreiro(heroiEl, de, para, critico) {
    heroiEl.classList.remove("investida-heroi");
    void heroiEl.offsetWidth;
    heroiEl.classList.add("investida-heroi");
    Som.efeito("espada");
    await esperar(180);
    const tam = Math.max(120, para.w * 0.9);
    const cortes = critico ? [[-1, -1, 1, 1], [1, -1, -1, 1], [-1, 0, 1, 0]] : [[-1, -1, 1, 1]];
    cortes.forEach(([a, b, c, d], i) => setTimeout(() => desenhos.push({
      tipo: "corte", x1: para.x + a * tam / 2, y1: para.y + b * tam / 2, x2: para.x + c * tam / 2, y2: para.y + d * tam / 2, cor: "#ffffff", t: 0, duracao: 0.3,
    }), i * 90));
    explosao(para.x, para.y, ["#ffffff", "#ffd166", "#cfd6e6"], critico ? 44 : 26, 420, 8);
    anel(para.x, para.y, "#ffffff", critico ? 150 : 90, 0.3);
  }

  async function ataqueArqueiro(de, para, critico) {
    Som.efeito("flecha");
    const disparos = critico ? 3 : 1;
    for (let i = 0; i < disparos; i++) {
      const alvo = { x: para.x + (i - (disparos - 1) / 2) * 18, y: para.y + (i % 2) * 10 };
      const voo = projetil(de, alvo, {
        duracao: 0.28, arco: 18,
        desenhar: (c, x, y, p, angulo) => {
          c.save();
          c.translate(x, y);
          c.rotate(angulo);
          c.scale(2, 2);
          c.fillStyle = "#8b5a2b";
          c.fillRect(-22, -1, 30, 3);
          c.fillStyle = "#d8dee9";
          c.fillRect(8, -3, 6, 7);
          c.fillStyle = "#e63946";
          c.fillRect(-24, -4, 6, 3);
          c.fillRect(-24, 2, 6, 3);
          c.restore();
        },
        rastro: (x, y) => particula(x, y, { vida: 0.2, cor: "#ffffff", tamanho: 4 }),
      });
      if (i === disparos - 1) await voo;
      else await esperar(90);
    }
    explosao(para.x, para.y, ["#ffd166", "#ffffff", "#8b5a2b"], critico ? 40 : 24, 360, 7);
    anel(para.x, para.y, "#ffd166", critico ? 130 : 80, 0.3);
  }

  // O herói ataca: espera o golpe chegar (o projétil, o corte) e devolve quando o monstro é atingido.
  async function ataque(kit, heroiEl, monstroEl, { cor = "#6ef0ff", critico = false } = {}) {
    const de = centro(heroiEl, -0.1);
    const para = centro(monstroEl);
    if (kit === "guerreiro") {
      // o guerreiro firma os pés: poeira e um brilho na lâmina antes de avançar
      explosao(de.x, de.y + de.h * 0.45, ["#cfc2a0", "#ffffff"], 10, 160, 4);
      await esperar(90);
      await ataqueGuerreiro(heroiEl, de, para, critico);
    } else if (kit === "arqueiro") {
      await carga(heroiEl, "#ffd166", critico ? 320 : 200);
      await ataqueArqueiro(de, para, critico);
    } else {
      await carga(heroiEl, cor, critico ? 420 : 280);
      await ataqueMago(de, para, cor, critico);
    }
    Som.efeito(critico ? "critico" : "impacto");
    impacto(de, para, monstroEl, cor, critico);
    if (critico) desenhos.push({ tipo: "flash", cor: "#ffffff", forca: 0.35, t: 0, duracao: 0.25 });
  }

  // Número que pula de cima de alguém: dano no monstro, dano no herói, cura...
  function numero(el, texto, tipo = "dano") {
    const c = centro(el, -0.35);
    const n = document.createElement("span");
    n.className = `numero-batalha ${tipo}`;
    n.textContent = texto;
    n.style.left = `${c.x}px`;
    n.style.top = `${c.y}px`;
    pai.append(n);
    setTimeout(() => n.remove(), 1300);
  }

  // O monstro acerta o herói: garras vermelhas, tela piscando e o número de corações perdidos.
  function golpeNoHeroi(heroiEl, dano) {
    const c = centro(heroiEl);
    Som.efeito("dano");
    [[-1, -1, 1, 1], [-1, -0.4, 1, 0.6], [-1, 0.2, 1, 1.2]].forEach(([a, b, x, y], i) => setTimeout(() => desenhos.push({
      tipo: "corte", x1: c.x + a * 70, y1: c.y + b * 70, x2: c.x + x * 70, y2: c.y + y * 70, cor: "#ff4d6d", t: 0, duracao: 0.3,
    }), i * 60));
    desenhos.push({ tipo: "flash", cor: "#ff1a3c", forca: 0.3, t: 0, duracao: 0.35 });
    explosao(c.x, c.y, ["#ff4d6d", "#ffb3c1"], 24, 300, 7);
    numero(heroiEl, `−${dano} ❤`, "no-heroi");
  }

  // O monstro avança contra o herói: um rastro escuro corta a tela no caminho e uma onda de choque
  // estoura em volta do herói, que leva um tranco para trás.
  async function ataqueDoMonstro(monstroEl, heroiEl, cor = "#ff4d6d") {
    const m = centro(monstroEl);
    const h = centro(heroiEl);
    const lado = Math.sign(h.x - m.x) || -1;
    // o monstro se encolhe antes do bote
    empurrar(monstroEl, [
      { transform: "translate(0,0) scale(1)" },
      { transform: `translate(${-lado * 14}px, 4px) scale(1.08, 0.9)`, offset: 0.5 },
      { transform: "translate(0,0) scale(1)" },
    ], 260);
    await esperar(200);
    for (let i = 0; i < 16; i++) {
      const k = i / 16;
      setTimeout(() => particula(m.x + (h.x - m.x) * k, m.y + (h.y - m.y) * k + (Math.random() - 0.5) * 30, {
        vx: lado * 120, vy: (Math.random() - 0.5) * 40, vida: 0.35, cor: i % 2 ? cor : "#2a0f1a", tamanho: 6,
      }), k * 140);
    }
    await esperar(150);
    anel(h.x, h.y, cor, 120, 0.35);
    raios(h.x, h.y, cor, 100, 8, 0.25);
    empurrar(heroiEl, [
      { transform: "translate(0,0)" },
      { transform: `translate(${lado * 16}px, -4px) rotate(${lado * 5}deg)`, offset: 0.3 },
      { transform: "translate(0,0)" },
    ], 360);
  }

  // A aura do monstro na arena: fiapos subindo devagar em volta dele (chefões soltam brasas vermelhas).
  function aura(monstroEl, cor, chefe = false) {
    const relogio = setInterval(() => {
      if (!ativo || !monstroEl.isConnected) return clearInterval(relogio);
      if (document.hidden || monstroEl.style.visibility === "hidden") return;
      const m = centro(monstroEl);
      particula(m.x + (Math.random() - 0.5) * m.w * 0.8, m.y + m.h * (0.1 + Math.random() * 0.35), {
        vy: -30 - Math.random() * 40, vx: (Math.random() - 0.5) * 12, vida: 1.2 + Math.random() * 0.6,
        cor: chefe ? (Math.random() < 0.5 ? "#ff6b3d" : "#ffd166") : cor, tamanho: chefe ? 4 : 3, atrito: 1,
      });
    }, chefe ? 110 : 220);
  }

  // Escudo, esquiva ou magia de classe seguraram o golpe.
  function bloqueio(heroiEl, texto = "BLOQUEADO!") {
    const c = centro(heroiEl);
    if (texto.startsWith("ESQUIV")) {
      empurrar(heroiEl, [{ transform: "translate(0,0)" }, { transform: "translate(-34px,-10px)", offset: 0.35 }, { transform: "translate(0,0)" }], 480);
      for (let i = 0; i < 8; i++) particula(c.x + 20, c.y + (Math.random() - 0.5) * c.h * 0.6, { vx: 140 + Math.random() * 80, vida: 0.3, cor: "#ffffff", tamanho: 3 });
    }
    Som.efeito("bloqueio");
    desenhos.push({ tipo: "bolha", x: c.x, y: c.y, rx: c.w * 0.55, ry: c.h * 0.55, cor: "#6ec8ff", t: 0, duracao: 0.9 });
    explosao(c.x, c.y - c.h * 0.3, ["#6ec8ff", "#ffffff"], 12, 180, 4);
    numero(heroiEl, texto, "bloqueio");
  }

  // As técnicas do grimório (ou arsenal, ou aljava): cada uma com sua cara.
  function tecnica(id, heroiEl, monstroEl, cor) {
    const h = centro(heroiEl);
    const m = centro(monstroEl);
    Som.efeito(id === "cura" ? "cura" : id === "escudo" ? "bloqueio" : "magia");
    if (id === "cura") {
      for (let i = 0; i < 24; i++) particula(h.x + (Math.random() - 0.5) * h.w * 0.8, h.y + h.h * 0.3, { vy: -80 - Math.random() * 80, vida: 0.9, cor: i % 2 ? "#7dff9a" : "#ffffff", tamanho: 5 });
      numero(heroiEl, "+❤", "cura");
    } else if (id === "escudo") {
      desenhos.push({ tipo: "bolha", x: h.x, y: h.y, rx: h.w * 0.55, ry: h.h * 0.55, cor: "#6ec8ff", t: 0, duracao: 1.4 });
    } else if (id === "visao") {
      anel(m.x, m.y, "#ffd166", 90, 0.5);
      setTimeout(() => anel(m.x, m.y, "#ffffff", 60, 0.4), 150);
    } else if (id === "lamina") {
      for (let i = 0; i < 16; i++) particula(h.x + (Math.random() - 0.5) * 40, h.y + (Math.random() - 0.5) * 60, { vy: -40, vida: 0.8, cor: i % 2 ? "#fff3b0" : cor, tamanho: 4 });
      anel(h.x, h.y, "#fff3b0", 60, 0.4);
    } else {
      // pergunta nova: um redemoinho em volta do herói
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        particula(h.x + Math.cos(a) * 40, h.y + Math.sin(a) * 40, { vx: -Math.sin(a) * 160, vy: Math.cos(a) * 160, vida: 0.5, cor, tamanho: 4 });
      }
    }
  }

  // Magia de classe: o ícone gigante aparece no monstro, com explosão na cor da raridade.
  function especial(magia, monstroEl) {
    const m = centro(monstroEl);
    const cor = { comum: "#8fb3d9", epica: "#b07cff", lendaria: "#ffc94d" }[magia.raridade] || "#ffffff";
    Som.efeito("especial");
    desenhos.push({ tipo: "icone", texto: magia.icone, x: m.x, y: m.y - m.h * 0.2, t: 0, duracao: 1.2 });
    setTimeout(() => {
      Som.efeito("explosao");
      explosao(m.x, m.y, [cor, "#ffffff", cor], magia.raridade === "lendaria" ? 60 : 36, 420, 6);
      anel(m.x, m.y, cor, 140, 0.5);
      desenhos.push({ tipo: "flash", cor, forca: 0.3, t: 0, duracao: 0.4 });
    }, 450);
  }

  // O monstro se desfaz em pixels: cada pedaço do desenho voa para um lado e cai.
  function morte(monstroEl) {
    Som.efeito("morte");
    const r = monstroEl.getBoundingClientRect();
    try {
      const amostra = document.createElement("canvas");
      const passo = Math.max(4, Math.round(r.width / 28));
      amostra.width = Math.max(1, Math.round(r.width / passo));
      amostra.height = Math.max(1, Math.round(r.height / passo));
      const a = amostra.getContext("2d");
      a.imageSmoothingEnabled = false;
      a.drawImage(monstroEl, 0, 0, amostra.width, amostra.height);
      const dados = a.getImageData(0, 0, amostra.width, amostra.height).data;
      for (let y = 0; y < amostra.height; y++) {
        for (let x = 0; x < amostra.width; x++) {
          const i = (y * amostra.width + x) * 4;
          if (dados[i + 3] < 128) continue;
          const px = r.left + x * passo;
          const py = r.top + y * passo;
          const dx = px - (r.left + r.width / 2);
          particula(px, py, {
            vx: dx * 2 + (Math.random() - 0.5) * 120, vy: -120 - Math.random() * 200, vida: 0.8 + Math.random() * 0.6,
            cor: `rgb(${dados[i]}, ${dados[i + 1]}, ${dados[i + 2]})`, tamanho: passo, gravidade: 600, atrito: 0.99,
          });
        }
      }
    } catch {
      explosao(r.left + r.width / 2, r.top + r.height / 2, "#ffffff", 40, 300);
    }
    monstroEl.style.visibility = "hidden";
    anel(r.left + r.width / 2, r.top + r.height / 2, "#ffffff", 120, 0.5);
    raios(r.left + r.width / 2, r.top + r.height / 2, "#ffd166", 190, 16, 0.5);
    desenhos.push({ tipo: "flash", cor: "#ffffff", forca: 0.4, t: 0, duracao: 0.35 });
  }

  // Defesa ativa: um anel vermelho fecha em volta do herói; clicar (ou Espaço/Enter) quando ele encosta
  // no círculo dourado apara o golpe. Devolve true se o clique caiu na hora certa. Quem decide o dano
  // é o servidor, que confere o tempo de novo.
  const DURACAO_APARAR = 1.6;
  const ZONA_APARAR = [1.0, 1.34]; // segundos em que o anel está encostando no alvo
  function aparar(heroiEl) {
    const c = centro(heroiEl);
    const alvo = 46;
    const inicioRaio = 190;
    const dica = document.createElement("div");
    dica.className = "dica-aparar";
    dica.innerHTML = "🛡️ <b>APARA!</b> Clica quando o anel encostar no círculo <small>(ou Espaço)</small>";
    pai.append(dica);
    Som.efeito("rosnado", 0.6);
    const comeco = performance.now();
    return new Promise((resolver) => {
      let fim = false;
      const desenho = {
        tipo: "livre", t: 0, duracao: DURACAO_APARAR + 0.4,
        desenhar: (c2, p, t) => {
          const raio = Math.max(0, inicioRaio * (1 - t / DURACAO_APARAR));
          const naZona = t >= ZONA_APARAR[0] && t <= ZONA_APARAR[1];
          c2.globalAlpha = fim ? Math.max(0, 1 - (t - desenho.fimEm) * 4) : 1;
          c2.lineWidth = 6;
          c2.strokeStyle = naZona ? "#ffffff" : "#ffd166";
          c2.beginPath();
          c2.arc(c.x, c.y, alvo, 0, Math.PI * 2);
          c2.stroke();
          if (!fim) {
            c2.strokeStyle = naZona ? "#7dff9a" : "#ff4d6d";
            c2.lineWidth = 5;
            c2.beginPath();
            c2.arc(c.x, c.y, raio, 0, Math.PI * 2);
            c2.stroke();
          }
        },
      };
      desenhos.push(desenho);
      const encerrar = (apertou) => {
        if (fim) return;
        fim = true;
        desenho.fimEm = desenho.t;
        window.removeEventListener("pointerdown", aoApertar, true);
        window.removeEventListener("keydown", aoTeclar, true);
        clearTimeout(limite);
        dica.remove();
        const t = (performance.now() - comeco) / 1000;
        const acertou = apertou && t >= ZONA_APARAR[0] && t <= ZONA_APARAR[1];
        if (acertou) {
          explosao(c.x, c.y, ["#ffffff", "#ffd166", "#7dff9a"], 26, 320, 6);
          anel(c.x, c.y, "#ffffff", 120, 0.35);
        } else if (apertou) numero(heroiEl, t < ZONA_APARAR[0] ? "CEDO DEMAIS!" : "TARDE!", "bloqueio");
        resolver(acertou);
      };
      const aoApertar = (e) => {
        e.preventDefault();
        e.stopPropagation();
        encerrar(true);
      };
      const aoTeclar = (e) => {
        if (![" ", "Enter"].includes(e.key)) return;
        e.preventDefault();
        e.stopPropagation();
        encerrar(true);
      };
      window.addEventListener("pointerdown", aoApertar, true);
      window.addEventListener("keydown", aoTeclar, true);
      const limite = setTimeout(() => encerrar(false), DURACAO_APARAR * 1000);
    });
  }

  // O Golpe Final da Sequência: um 🔥 gigante cai no monstro, a tela pisca e três anéis explodem.
  async function golpeFinal(monstroEl, cor = "#ffd166") {
    const m = centro(monstroEl);
    Som.efeito("especial");
    desenhos.push({ tipo: "icone", texto: "🔥", x: m.x, y: m.y - m.h * 0.2, t: 0, duracao: 1.0 });
    await esperar(380);
    Som.efeito("explosao");
    explosao(m.x, m.y, ["#ff9a3c", "#ffd166", "#ffffff", cor], 70, 560, 10);
    for (let i = 0; i < 3; i++) setTimeout(() => anel(m.x, m.y, i % 2 ? "#ffffff" : "#ff9a3c", 180, 0.45), i * 110);
    desenhos.push({ tipo: "flash", cor: "#ff9a3c", forca: 0.45, t: 0, duracao: 0.45 });
    await esperar(250);
  }

  // Tela tremendo e piscando: a mudança de fase do chefão.
  function rugido(monstroEl, cor = "#ff2a4d") {
    const m = centro(monstroEl);
    Som.efeito("rugido");
    desenhos.push({ tipo: "flash", cor, forca: 0.4, t: 0, duracao: 0.6 });
    for (let i = 0; i < 3; i++) setTimeout(() => anel(m.x, m.y, cor, 160, 0.5), i * 150);
  }

  function destruir() {
    ativo = false;
    window.removeEventListener("resize", redimensionar);
    canvas.remove();
  }

  return { ataque, numero, golpeNoHeroi, bloqueio, tecnica, especial, morte, rugido, explosao, aparar, golpeFinal, ataqueDoMonstro, aura, raios, destruir };
}
