// A Fenda do Oráculo no navegador: a batalha em grupo contra um fragmento do Oráculo (as regras ficam no
// servidor, classe Fenda do salao.py). Cada herói responde a sua pergunta; os acertos tiram vida do chefão
// (rápido é crítico) e cada erro quebra um escudo do grupo.
// FENDA.receber(m) recebe as mensagens "fenda_*"; FENDA.estadoGeral(f) recebe o estado que todos veem.

const FENDA = {
  atual: null, // { fenda, rodada, pergunta, escolhida, limite, inicio }
  janela: null,
  relogio: null,

  estadoGeral(f) {
    if (typeof chamadoDaFenda === "function") chamadoDaFenda(f);
    if (!f && this.atual && !this.atual.fim) this.fechar();
  },

  receber(m) {
    const tratar = this[m.t.replace("fenda_", "ao_")];
    if (tratar) tratar.call(this, m);
  },

  abrir() {
    let janela = document.getElementById("janela-fenda");
    if (!janela) {
      janela = document.createElement("dialog");
      janela.id = "janela-fenda";
      janela.className = "janela-duelo janela-fenda";
      janela.addEventListener("cancel", (e) => {
        e.preventDefault();
        this.perguntarSaida();
      });
      document.body.append(janela);
    }
    this.janela = janela;
    if (!janela.open) janela.showModal();
    return janela;
  },

  fechar() {
    clearInterval(this.relogio);
    window.removeEventListener("keydown", this.teclas);
    if (this.janela?.open) this.janela.close();
    this.atual = null;
  },

  async perguntarSaida() {
    if (!this.atual || this.atual.fim) return this.fechar();
    const sim = await confirmarRPG({ titulo: "Deixar o grupo?", texto: "O grupo continua sem ti (e com menos gente para responder).", icone: "🌀", perigo: true, confirmar: "Sair", cancelar: "Ficar" });
    if (sim) {
      enviarSalao({ t: "fenda_sair" });
      this.fechar();
    }
  },

  // o topo: o chefão (desenho, nome, vida), os escudos e os heróis do grupo
  cabecalho() {
    const f = this.atual.fenda;
    const tipo = typeof TIPOS_MONSTRO !== "undefined" && TIPOS_MONSTRO[f.tipo];
    const vida = Math.round((f.vida / Math.max(1, f.vidaMaxima)) * 100);
    const respondeu = this.atual.responderam || new Set();
    return `
      <header class="topo-fenda ${f.furia ? "furia" : ""}">
        <canvas class="pixel" width="120" height="96" data-chefe></canvas>
        <div class="info-chefe">
          <small>Fragmento do Oráculo · rodada ${f.rodada}</small>
          <b>${escapar(f.nome || "")}${f.furia ? ' <em class="furia-tag">FÚRIA</em>' : ""}</b>
          <div class="vida-chefe"><i style="width:${vida}%"></i><span>${f.vida} / ${f.vidaMaxima}</span></div>
          <div class="escudos-grupo">${Array.from({ length: f.escudos }, () => "<i></i>").join("")}<small>escudos do grupo</small></div>
        </div>
      </header>
      <ul class="grupo-fenda">${f.membros.map((m) => `<li class="${respondeu.has(m.sid) ? "respondeu" : ""} ${m.sid === SALAO.sid ? "eu" : ""}"><b>${escapar(m.nome)}</b><small>${respondeu.has(m.sid) ? "✓ respondeu" : "pensando..."}</small></li>`).join("")}</ul>`;
  },

  pintar(corpo) {
    const janela = this.abrir();
    janela.innerHTML = `<div class="moldura-duelo moldura-fenda">${this.cabecalho()}<div class="corpo-duelo">${corpo}</div>
      <footer class="rodape-duelo"><button class="botao botao-fantasma" type="button" data-sair>🏃 Sair do grupo</button></footer></div>`;
    janela.querySelector("[data-sair]")?.addEventListener("click", () => this.perguntarSaida());
    this.desenharChefe(janela.querySelector("[data-chefe]"));
    return janela;
  },

  desenharChefe(canvas) {
    const tipo = this.atual?.fenda?.tipo;
    if (!canvas || typeof TIPOS_MONSTRO === "undefined" || !TIPOS_MONSTRO[tipo]) return;
    const sprite = spriteReino(`monstro-${tipo}`, TIPOS_MONSTRO[tipo].sprite);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const escala = Math.min(canvas.width / sprite.width, canvas.height / sprite.height, 2);
    ctx.drawImage(sprite, (canvas.width - sprite.width * escala) / 2, canvas.height - sprite.height * escala, sprite.width * escala, sprite.height * escala);
  },

  // ---------- as mensagens ----------
  ao_inicio(m) {
    document.getElementById("janela-salao")?.close();
    this.atual = { fenda: m.fenda, responderam: new Set() };
    // o grupo vai para a borda do Círculo da Fenda, cada um num ponto
    const i = m.fenda.membros.findIndex((x) => x.sid === SALAO.sid);
    const a = (i / Math.max(1, m.fenda.membros.length)) * Math.PI * 2 + Math.PI / 2;
    SALAO.mundo?.posicionar((CIRCULO_DA_FENDA.cx + Math.cos(a) * 3.2) * 16, (CIRCULO_DA_FENDA.cy + Math.sin(a) * 3.2) * 16, "cima");
    Som.efeito("rugido");
    Som.musica("chefao");
    this.pintar(`<div class="contagem-duelo"><p>A Fenda se rasga...</p><b class="pulsa">🌀</b><small>${escapar(m.fenda.nome)} atravessa o céu! Respondam rápido e juntos.</small></div>`);
  },

  ao_pergunta(m) {
    clearInterval(this.relogio);
    this.atual = { ...this.atual, fenda: m.fenda, rodada: m.rodada, pergunta: m.pergunta, escolhida: null, limite: m.limite, inicio: performance.now(), responderam: new Set() };
    const p = m.pergunta;
    const enunciado = p.afirmacao
      ? `<p class="enunciado-duelo">${formatar(p.pergunta)}</p><blockquote class="afirmacao-duelo">“${formatar(p.afirmacao)}”</blockquote><p class="dica-vf">Verdadeira ou falsa?</p>`
      : `<p class="enunciado-duelo">${formatar(p.pergunta)}</p>`;
    const janela = this.pintar(`
      <div class="tempo-duelo"><i style="animation-duration:${m.limite}s"></i><span data-segundos>${m.limite}</span></div>
      ${p.cenario ? `<p class="cenario-duelo">📜 ${formatar(p.cenario)}</p>` : ""}
      ${enunciado}
      ${p.codigo ? blocoCodigo(p.codigo) : ""}
      <div class="opcoes-duelo">${p.opcoes.map((o, i) => `<button class="opcao-duelo" type="button" data-opcao="${i}"><kbd>${i + 1}</kbd><span>${formatar(o)}</span></button>`).join("")}</div>`);
    janela.querySelectorAll("[data-opcao]").forEach((b) => b.addEventListener("click", () => this.escolher(Number(b.dataset.opcao))));
    const seg = janela.querySelector("[data-segundos]");
    this.relogio = setInterval(() => {
      const resta = Math.max(0, Math.ceil(this.atual.limite - (performance.now() - this.atual.inicio) / 1000));
      if (seg.isConnected) seg.textContent = resta;
    }, 250);
    window.removeEventListener("keydown", this.teclas);
    this.teclas = (e) => {
      if (/^[1-4]$/.test(e.key) && this.atual?.escolhida === null && Number(e.key) - 1 < (this.atual.pergunta?.opcoes.length || 0)) this.escolher(Number(e.key) - 1);
    };
    window.addEventListener("keydown", this.teclas);
    if (m.fenda.furia) Som.efeito("impacto");
  },

  escolher(i) {
    if (!this.atual || this.atual.escolhida !== null) return;
    this.atual.escolhida = i;
    this.atual.responderam.add(SALAO.sid);
    enviarSalao({ t: "fenda_responder", rodada: this.atual.rodada, resposta: i });
    this.janela?.querySelectorAll("[data-opcao]").forEach((b) => {
      b.disabled = true;
      b.classList.toggle("escolhida", Number(b.dataset.opcao) === i);
    });
    this.marcarGrupo();
    Som.efeito("clique");
  },

  marcarGrupo() {
    const lista = this.janela?.querySelector(".grupo-fenda");
    if (!lista) return;
    const tmp = criar(`<div>${this.cabecalho()}</div>`).querySelector(".grupo-fenda");
    lista.replaceWith(tmp);
  },

  ao_respondeu(m) {
    if (!this.atual || m.rodada !== this.atual.rodada) return;
    this.atual.responderam.add(m.sid);
    this.marcarGrupo();
  },

  ao_resultado(m) {
    clearInterval(this.relogio);
    window.removeEventListener("keydown", this.teclas);
    if (!this.atual) return;
    const vidaAntes = this.atual.fenda.vida;
    this.atual.fenda = m.fenda;
    const janela = this.janela;
    const eu = m.eu;
    janela?.querySelectorAll("[data-opcao]").forEach((b) => {
      b.disabled = true;
      if (eu && Number(b.dataset.opcao) === eu.resposta_certa) b.classList.add("certa");
      else if (b.classList.contains("escolhida")) b.classList.add("errada");
    });
    // o topo com a vida nova (a barra desce) e o resumo do grupo
    const topo = janela?.querySelector(".topo-fenda");
    if (topo) {
      const novo = criar(`<div>${this.cabecalho()}</div>`);
      topo.replaceWith(novo.querySelector(".topo-fenda"));
      this.desenharChefe(janela.querySelector("[data-chefe]"));
      if (m.fenda.vida < vidaAntes) janela.querySelector(".topo-fenda")?.classList.add("acertou-chefe");
    }
    janela?.querySelector(".corpo-duelo")?.insertAdjacentHTML("beforeend", `
      <div class="resultado-rodada ${eu?.correta ? "bom" : "ruim"}">
        <p>${eu?.correta ? `✨ Acertaste! −${eu.dano} de vida${eu.dano > 1 ? " (crítico!)" : ""}` : `🛡️ Um escudo quebrou. A certa: <b>${formatar(eu?.texto_certo || "")}</b>`}</p>
        <ul class="golpes-grupo">${m.todos.map((r) => `<li class="${r.correta ? "bom" : "ruim"}">${escapar(r.nome)}: ${r.correta ? `−${r.dano} ⚔️` : "🛡️💥"}</li>`).join("")}</ul>
        ${eu?.explicacao ? `<small>${formatar(eu.explicacao)}</small>` : ""}
      </div>`);
    Som.efeito(eu?.correta ? "impacto" : "erro");
  },

  ao_fim(m) {
    clearInterval(this.relogio);
    window.removeEventListener("keydown", this.teclas);
    if (!this.atual) this.atual = { fenda: SALAO.estado.fenda || { membros: [], tipo: m.tipo, nome: m.nome, vida: 0, vidaMaxima: 1, escudos: 0, rodada: m.rodadas } };
    this.atual.fim = true;
    Som.musica("salao");
    const janela = this.pintar(`
      <div class="fim-duelo ${m.venceu ? "vitoria" : "derrota"}">
        <span class="icone-fim">${m.venceu ? "🌀" : "💀"}</span>
        <h2>${m.venceu ? "Fenda fechada!" : "A Fenda venceu"}</h2>
        <p>${m.venceu ? `${escapar(m.nome)} se desfez em perguntas respondidas. O céu do castelo se acalma.` : `${escapar(m.nome)} quebrou os escudos do grupo. Juntem mais gente e voltem!`}</p>
        ${m.ganhos?.length ? `<ul class="vd-espolios-lista">${m.ganhos.map((g) => `<li class="${g.raro ? "raro" : ""}"><span>${g.icone}</span>${escapar(g.texto)}</li>`).join("")}</ul>` : ""}
        <div class="acoes-fim"><button class="botao" type="button" data-fechar-fenda>Voltar ao Salão</button></div>
      </div>`);
    janela.querySelector("[data-sair]")?.remove();
    janela.querySelector("[data-fechar-fenda]").addEventListener("click", () => this.fechar());
    if (m.venceu) {
      Som.efeito("vitoria");
      if (typeof chuvaDeEstrelas === "function") chuvaDeEstrelas(60);
      api(`/api/jogador/${jogadorId}`, undefined, "GET").then((r) => r.estado && aplicarEstado(r.estado)).catch(() => {});
    } else Som.efeito("derrota");
  },
};
