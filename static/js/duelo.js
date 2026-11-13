// O duelo na arena do Salão: a janela que abre por cima da arena para os dois duelistas.
// Três modos (as regras ficam no servidor, salao.py): o X1 de perguntas, o "Até um cair" (a torre de
// monstros-pergunta, com 3 corações) e as Perguntas dos jogadores (cada um escreve as suas e o outro
// responde). O servidor sorteia, cronometra e corrige; aqui só se mostra e se manda a resposta.
// DUELO.receber(m) recebe as mensagens "duelo_*" que chegam do Salão (salao.js).

const DUELO = {
  atual: null, // { id, modo, total, lado, oponente, pontos, vidas, rodada, pergunta, escolhida, ... }
  janela: null,
  relogio: null,

  receber(m) {
    const tratar = this[m.t.replace("duelo_", "ao_")];
    if (tratar) tratar.call(this, m);
  },

  // ---------- a janela ----------
  abrir() {
    let janela = document.getElementById("janela-duelo");
    if (!janela) {
      janela = document.createElement("dialog");
      janela.id = "janela-duelo";
      janela.className = "janela-duelo";
      // Esc pergunta se quer mesmo desistir
      janela.addEventListener("cancel", (e) => {
        e.preventDefault();
        this.perguntarDesistencia();
      });
      document.body.append(janela);
    }
    this.janela = janela;
    if (!janela.open) janela.showModal();
    return janela;
  },

  fechar() {
    clearInterval(this.relogio);
    this.relogio = null;
    if (this.janela?.open) this.janela.close();
    this.atual = null;
    window.removeEventListener("keydown", this.teclas);
  },

  conexaoCaiu() {
    if (!this.atual) return;
    this.fechar();
    avisoFlutuante("📡", "A conexão caiu no meio do duelo", "Sem conexão, o duelo conta como desistência. Volta e pede a revanche!");
  },

  async perguntarDesistencia() {
    if (!this.atual || this.atual.fim) return this.fechar();
    const sim = await confirmarRPG({ titulo: "Desistir do duelo?", texto: "Quem desiste perde o duelo (e o oponente fica com a vitória).", icone: "🏳️", perigo: true, confirmar: "Desistir", cancelar: "Continuar" });
    if (sim && this.atual && !this.atual.fim) enviarSalao({ t: "duelo_desistir" });
  },

  // o topo da janela: eu e o oponente, com retrato, nome, título, pontos (e corações no "até um cair")
  placar() {
    const d = this.atual;
    const eu = { nome: nomeAluno(), avatar: progresso.avatar, selo: principalDoHeroi() ? seloDoTitulo() : "" };
    const ele = { nome: d.oponente.nome, avatar: d.oponente.avatar, selo: seloDoJogador(d.oponente) };
    const coracoes = (vidas) => (d.vidasMaximas ? `<span class="coracoes-duelo">${Array.from({ length: d.vidasMaximas }, (_, i) => `<i class="${i < vidas ? "cheio" : "vazio"}"></i>`).join("")}</span>` : "");
    const lado = (p, pontos, vidas, classe) => `
      <div class="lado-duelo ${classe}">
        <img class="pixel" src="${heroiParado(p.avatar || {}).toDataURL()}" alt="">
        <div><b>${escapar(p.nome)}</b>${p.selo}${coracoes(vidas)}</div>
        <strong class="pontos-duelo" data-pontos="${classe}">${pontos}</strong>
      </div>`;
    const rodada = d.rodada ? (d.total ? `Rodada ${d.rodada} de ${d.total}` : `Rodada ${d.rodada}`) : d.preparo ? "Escrevendo" : "Preparando";
    return `
      <header class="placar-duelo">
        ${lado(eu, d.pontos[0], d.vidas?.[0], "eu")}
        <div class="meio-placar"><span>${escapar(d.nomeModo)}</span><b>VS</b><small>${rodada}</small></div>
        ${lado(ele, d.pontos[1], d.vidas?.[1], "ele")}
      </header>`;
  },

  pintar(corpo) {
    const janela = this.abrir();
    janela.innerHTML = `<div class="moldura-duelo">${this.placar()}<div class="corpo-duelo">${corpo}</div>
      <footer class="rodape-duelo"><button class="botao botao-fantasma" type="button" data-desistir>🏳️ Desistir</button></footer></div>`;
    janela.querySelector("[data-desistir]")?.addEventListener("click", () => this.perguntarDesistencia());
    return janela;
  },

  atualizarPontos(m) {
    if (m.pontos) this.atual.pontos = m.pontos;
    if (m.vidas) this.atual.vidas = m.vidas;
  },

  // ---------- as mensagens do servidor ----------
  ao_inicio(m) {
    document.getElementById("janela-salao")?.close();
    document.getElementById("modal-missao")?.close();
    this.atual = {
      id: m.duelo, modo: m.modo, nomeModo: m.nomeModo, total: m.total, lado: m.lado, oponente: m.oponente,
      pontos: m.pontos || [0, 0], vidas: m.vidas, vidasMaximas: m.vidasMaximas, rodada: 0, fim: false,
    };
    // os dois vão para os lados da arena (o servidor espalha a posição nova para quem assiste)
    const lugar = LADOS_DA_ARENA[m.lado] || LADOS_DA_ARENA[0];
    SALAO.mundo?.posicionar(lugar.x, lugar.y, lugar.direcao);
    Som.efeito("impacto");
    const janela = this.pintar(`<div class="contagem-duelo"><p>${escapar(m.nomeModo)}</p><b data-contagem>3</b><small>Prepara a mente, aventureiro.</small></div>`);
    if (m.modo === "autoral") return;
    let n = 3;
    const contar = setInterval(() => {
      n -= 1;
      const el = janela.querySelector("[data-contagem]");
      if (!el || n < 0) return clearInterval(contar);
      el.textContent = n === 0 ? "Duelo!" : n;
      el.classList.remove("pulsa");
      void el.offsetWidth;
      el.classList.add("pulsa");
      Som.efeito(n === 0 ? "critico" : "clique");
    }, Math.max(300, (m.contagem * 1000) / 3.4));
  },

  ao_preparo(m) {
    const d = this.atual;
    if (!d) return;
    d.preparo = { quantas: m.quantas, ate: Date.now() + m.segundos * 1000, entregue: false };
    const editor = (n) => `
      <fieldset class="pergunta-autoral">
        <legend>Pergunta ${n + 1}</legend>
        <textarea maxlength="220" rows="2" data-pergunta="${n}" placeholder="Ex.: O que é um prompt?"></textarea>
        ${[0, 1, 2, 3].map((k) => `
          <label class="opcao-autoral">
            <input type="radio" name="certa-${n}" value="${k}" ${k ? "" : "checked"} title="Esta é a certa">
            <input type="text" maxlength="90" data-opcao="${n}:${k}" placeholder="${k < 2 ? `Alternativa ${k + 1}` : `Alternativa ${k + 1} (opcional)`}">
          </label>`).join("")}
      </fieldset>`;
    const janela = this.pintar(`
      <div class="preparo-duelo">
        <h3>✍️ Escreve tuas ${m.quantas} perguntas</h3>
        <p>${escapar(d.oponente.nome)} vai responder as tuas, e tu as dele. Marca a bolinha da alternativa <b>certa</b>. Perguntas boas ensinam: capricha! (Passam pelo filtro do salão.)</p>
        <p class="tempo-preparo">⏳ <span data-tempo-preparo></span> · <span data-estado-oponente>${escapar(d.oponente.nome)} ainda está escrevendo...</span></p>
        <form data-form-autoral>${Array.from({ length: m.quantas }, (_, n) => editor(n)).join("")}
          <p class="erro-autoral" data-erro-autoral hidden></p>
          <button class="botao" type="submit">📜 Entregar minhas perguntas</button>
        </form>
      </div>`);
    const tempo = janela.querySelector("[data-tempo-preparo]");
    const tique = () => {
      const resta = Math.max(0, Math.round((d.preparo.ate - Date.now()) / 1000));
      if (tempo.isConnected) tempo.textContent = `${Math.floor(resta / 60)}:${String(resta % 60).padStart(2, "0")} para terminar`;
    };
    tique();
    clearInterval(this.relogio);
    this.relogio = setInterval(tique, 1000);
    janela.querySelector("[data-form-autoral]").addEventListener("submit", (e) => {
      e.preventDefault();
      const lista = Array.from({ length: m.quantas }, (_, n) => {
        const opcoes = [];
        let correta = 0;
        const marcada = Number(janela.querySelector(`input[name="certa-${n}"]:checked`)?.value || 0);
        [0, 1, 2, 3].forEach((k) => {
          const valor = janela.querySelector(`[data-opcao="${n}:${k}"]`).value.trim();
          if (!valor) return;
          if (k === marcada) correta = opcoes.length;
          opcoes.push(valor);
        });
        if (!janela.querySelector(`[data-opcao="${n}:${marcada}"]`).value.trim()) correta = -1;
        return { pergunta: janela.querySelector(`[data-pergunta="${n}"]`).value.trim(), opcoes, correta };
      });
      janela.querySelector("[data-form-autoral] button[type=submit]").disabled = true;
      enviarSalao({ t: "duelo_perguntas", lista });
    });
    janela.querySelector("[data-pergunta='0']")?.focus();
  },

  ao_recusado(m) {
    const el = this.janela?.querySelector("[data-erro-autoral]");
    if (!el) return avisoFlutuante("🛡️", m.motivo, "");
    el.hidden = false;
    el.textContent = `🛡️ ${m.motivo}`;
    this.janela.querySelector("[data-form-autoral] button[type=submit]").disabled = false;
    Som.efeito("erro");
  },

  ao_entregue() {
    if (!this.atual?.preparo) return;
    this.atual.preparo.entregue = true;
    const form = this.janela?.querySelector("[data-form-autoral]");
    if (form) {
      form.querySelectorAll("textarea, input, button").forEach((el) => { el.disabled = true; });
      form.insertAdjacentHTML("afterbegin", '<p class="entregue-autoral">✅ Perguntas entregues! Agora é esperar o oponente.</p>');
    }
    Som.efeito("acerto");
  },

  ao_respondeu(m) {
    if (!this.atual) return;
    if (m.preparo) {
      const el = this.janela?.querySelector("[data-estado-oponente]");
      if (el) el.textContent = `✅ ${this.atual.oponente.nome} já entregou as dele!`;
      return;
    }
    if (m.rodada !== this.atual.rodada) return;
    const el = this.janela?.querySelector("[data-oponente-estado]");
    if (el) {
      el.textContent = `⚡ ${this.atual.oponente.nome} já respondeu!`;
      el.classList.add("respondeu");
    }
    Som.efeito("clique");
  },

  ao_pergunta(m) {
    const d = this.atual;
    if (!d) return;
    clearInterval(this.relogio);
    d.rodada = m.rodada;
    d.total = m.total ?? d.total;
    d.pergunta = m.pergunta;
    d.escolhida = null;
    d.limite = m.limite;
    d.inicio = performance.now();
    this.atualizarPontos(m);
    const p = m.pergunta;
    const monstro = m.monstro ? `
      <div class="monstro-duelo">
        <canvas class="pixel" width="96" height="80" data-monstro></canvas>
        <div><b>${escapar(m.monstro.nome)}</b><small>pergunta ${m.monstro.rodadaDoMonstro} de 3</small></div>
      </div>` : "";
    const autor = p.autor ? `<p class="autor-pergunta">✍️ Pergunta escrita por <b>${escapar(p.autor)}</b></p>` : "";
    const enunciado = p.afirmacao
      ? `<p class="enunciado-duelo">${formatar(p.pergunta)}</p><blockquote class="afirmacao-duelo">“${formatar(p.afirmacao)}”</blockquote><p class="dica-vf">Essa afirmação é verdadeira ou falsa?</p>`
      : `<p class="enunciado-duelo">${formatar(p.pergunta)}</p>`;
    const janela = this.pintar(`
      ${monstro}
      <div class="tempo-duelo"><i style="animation-duration:${m.limite}s"></i><span data-segundos>${m.limite}</span></div>
      ${autor}
      ${p.cenario ? `<p class="cenario-duelo">📜 ${formatar(p.cenario)}</p>` : ""}
      ${enunciado}
      ${p.codigo ? blocoCodigo(p.codigo) : ""}
      <div class="opcoes-duelo">
        ${p.opcoes.map((o, i) => `<button class="opcao-duelo" type="button" data-opcao="${i}"><kbd>${i + 1}</kbd><span>${formatar(o)}</span></button>`).join("")}
      </div>
      <p class="estado-oponente" data-oponente-estado>🤔 ${escapar(d.oponente.nome)} está pensando...</p>`);
    if (m.monstro) this.desenharMonstro(janela.querySelector("[data-monstro]"), m.monstro.tipo);
    janela.querySelectorAll("[data-opcao]").forEach((b) => b.addEventListener("click", () => this.escolher(Number(b.dataset.opcao))));
    const segundos = janela.querySelector("[data-segundos]");
    this.relogio = setInterval(() => {
      const resta = Math.max(0, Math.ceil(d.limite - (performance.now() - d.inicio) / 1000));
      if (segundos.isConnected) segundos.textContent = resta;
      if (resta <= 5 && resta > 0 && segundos.isConnected) segundos.classList.add("acabando");
    }, 250);
    window.removeEventListener("keydown", this.teclas);
    this.teclas = (e) => {
      if (!/^[1-4]$/.test(e.key) || !this.atual || this.atual.escolhida !== null) return;
      const n = Number(e.key) - 1;
      if (n < (this.atual.pergunta?.opcoes.length || 0)) this.escolher(n);
    };
    window.addEventListener("keydown", this.teclas);
    Som.efeito("passar");
  },

  escolher(i) {
    const d = this.atual;
    if (!d || d.escolhida !== null) return;
    d.escolhida = i;
    enviarSalao({ t: "duelo_responder", rodada: d.rodada, resposta: i });
    this.janela?.querySelectorAll("[data-opcao]").forEach((b) => {
      b.disabled = true;
      b.classList.toggle("escolhida", Number(b.dataset.opcao) === i);
    });
    Som.efeito("clique");
  },

  desenharMonstro(canvas, tipo) {
    if (!canvas || typeof TIPOS_MONSTRO === "undefined" || !TIPOS_MONSTRO[tipo]) return;
    const sprite = spriteReino(`monstro-${tipo}`, TIPOS_MONSTRO[tipo].sprite);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const escala = Math.min(canvas.width / sprite.width, canvas.height / sprite.height, 2);
    const w = sprite.width * escala;
    const h = sprite.height * escala;
    ctx.drawImage(sprite, (canvas.width - w) / 2, canvas.height - h, w, h);
  },

  ao_resultado(m) {
    const d = this.atual;
    if (!d) return;
    clearInterval(this.relogio);
    window.removeEventListener("keydown", this.teclas);
    const antes = [...d.pontos];
    const vidasAntes = d.vidas ? [...d.vidas] : null;
    this.atualizarPontos(m);
    const janela = this.janela;
    if (!janela) return;
    janela.querySelectorAll("[data-opcao]").forEach((b) => {
      const i = Number(b.dataset.opcao);
      b.disabled = true;
      if (i === m.eu.resposta_certa) b.classList.add("certa");
      else if (i === d.escolhida) b.classList.add("errada");
    });
    janela.querySelector(".tempo-duelo")?.classList.add("parado");
    const eu = m.eu;
    const ele = m.oponente;
    const fraseEle = !ele.respondeu ? "não respondeu a tempo" : ele.correta ? `acertou (+${ele.ganhou}) em ${ele.segundos} s` : "errou";
    const fraseEu = eu.correta ? `✨ Acertaste! +${eu.ganhou} pontos${eu.segundos !== null ? ` em ${eu.segundos} s` : ""}` : eu.respondeu ? `❌ Não foi dessa vez. A certa: <b>${formatar(eu.texto_certo || "")}</b>` : `⌛ O tempo acabou. A certa: <b>${formatar(eu.texto_certo || "")}</b>`;
    const estado = janela.querySelector("[data-oponente-estado]");
    if (estado) {
      estado.innerHTML = `${ele.correta ? "✅" : "❌"} ${escapar(d.oponente.nome)} ${fraseEle}`;
      estado.classList.add("revelado");
    }
    janela.querySelector(".corpo-duelo")?.insertAdjacentHTML("beforeend", `
      <div class="resultado-rodada ${eu.correta ? "bom" : "ruim"}">
        <p>${fraseEu}</p>
        ${eu.explicacao ? `<small>${formatar(eu.explicacao)}</small>` : ""}
      </div>`);
    // os pontos sobem no placar (e o coração quebra no "até um cair")
    [["eu", 0], ["ele", 1]].forEach(([classe, i]) => {
      const el = janela.querySelector(`[data-pontos="${classe}"]`);
      if (!el) return;
      el.textContent = d.pontos[i];
      if (d.pontos[i] > antes[i]) el.classList.add("subiu");
      if (vidasAntes && d.vidas[i] < vidasAntes[i]) janela.querySelector(`.lado-duelo.${classe}`)?.classList.add("ferido");
    });
    if (vidasAntes) {
      janela.querySelectorAll(".lado-duelo").forEach((lado, i) => {
        lado.querySelectorAll(".coracoes-duelo i").forEach((c, k) => c.classList.toggle("cheio", k < d.vidas[i]));
      });
    }
    Som.efeito(eu.correta ? "acerto" : "erro");
    if (eu.correta && eu.segundos !== null && eu.segundos < 4) setTimeout(() => Som.efeito("critico"), 120);
  },

  ao_fim(m) {
    const d = this.atual;
    clearInterval(this.relogio);
    window.removeEventListener("keydown", this.teclas);
    if (!d) return;
    d.fim = true;
    if (m.pontos) d.pontos = m.pontos;
    if (m.resultado === "cancelado") {
      this.fechar();
      return;
    }
    const titulos = { vitoria: "Vitória!", derrota: "Derrota", empate: "Empate!" };
    const icones = { vitoria: "🏆", derrota: "🛡️", empate: "🤝" };
    const frases = {
      vitoria: m.desistente === "ele" ? `${d.oponente.nome} ${m.motivo || "desistiu"}. A vitória é tua!` : "Tua mente foi mais rápida. Esse saber é teu!",
      derrota: m.desistente === "eu" ? "Tu saíste do duelo. Volta mais forte!" : "Toda derrota ensina. Revê as respostas e pede a revanche!",
      empate: "Duas mentes no mesmo nível. Que tal o desempate?",
    };
    const janela = this.pintar(`
      <div class="fim-duelo ${m.resultado}">
        <span class="icone-fim">${icones[m.resultado]}</span>
        <h2>${titulos[m.resultado]}</h2>
        <p>${escapar(frases[m.resultado])}</p>
        <ul class="numeros-fim">
          <li><b>${d.pontos[0]}</b><small>teus pontos</small></li>
          <li><b>${m.acertos?.[0] ?? 0}/${m.rodadas}</b><small>teus acertos</small></li>
          <li><b>${d.pontos[1]}</b><small>pontos de ${escapar(d.oponente.nome)}</small></li>
        </ul>
        <div class="acoes-fim">
          <button class="botao" type="button" data-revanche>⚔️ Revanche</button>
          ${m.podeDenunciar ? '<button class="botao botao-fantasma perigo" type="button" data-denunciar-perguntas>🚩 Denunciar as perguntas</button>' : ""}
          <button class="botao botao-fantasma" type="button" data-sair-duelo>Voltar ao salão</button>
        </div>
      </div>`);
    janela.querySelector("[data-desistir]")?.remove();
    janela.querySelector("[data-revanche]").addEventListener("click", () => {
      enviarSalao({ t: "desafiar", sid: m.oponente, modo: m.modo, rodadas: m.total || 0 });
      this.fechar();
    });
    janela.querySelector("[data-denunciar-perguntas]")?.addEventListener("click", (e) => {
      enviarSalao({ t: "denunciar_perguntas", duelo: m.duelo });
      e.target.disabled = true;
    });
    janela.querySelector("[data-sair-duelo]").addEventListener("click", () => this.fechar());
    if (m.resultado === "vitoria") {
      Som.efeito("vitoria");
      if (typeof chuvaDeEstrelas === "function") chuvaDeEstrelas(40);
      setTimeout(() => SALAO.mundo && (SALAO.mundo.heroi.gesto = { id: "comemorar", icone: "🎉", nome: "Comemorar", dura: 2.2, inicio: null }, enviarSalao({ t: "gesto", id: "comemorar" })), 400);
    } else Som.efeito(m.resultado === "derrota" ? "derrota" : "acerto");
  },
};
