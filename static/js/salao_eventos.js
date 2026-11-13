// As novidades do Salão de Elyndor (multijogador), no navegador: as Casas (escolher, o salão de cada uma, a
// Taça das Casas), a Pergunta do Dragão (o evento ao vivo da praça), o Altar da Fenda (os chefões em grupo:
// a batalha em si fica em fenda.js), o Desafio do Dia (com a sequência 🔥 e o baú), o palpite da plateia
// nos duelos, o modo foto (P) e os botões de toque para o celular.
// Quem decide tudo é o servidor (salao.py e, no Desafio do Dia, jogador.py); aqui só se mostra.
// Depende de salao.js (SALAO, enviarSalao, janelaDoSalao), lobby.js (os brasões e os dragões) e app.js.

// ---------- utilidades ----------

function brasaoUrl(casaId, escala = 6) {
  const casa = CASAS_DO_MAPA[casaId];
  const { canvas, ctx } = criarTela(BRASAO_LADO * escala + 8, BRASAO_LADO * escala + 8);
  retangulo(ctx, 0, 0, canvas.width, canvas.height, casa.escura);
  retangulo(ctx, 2, 2, canvas.width - 4, canvas.height - 4, casa.cor);
  brasaoNoCanvas(ctx, casaId, 4, 4, escala, casa.clara);
  return canvas.toDataURL();
}

// o prêmio de um evento: a janela dourada com o que veio (e o progresso do herói atualizado)
function mostrarPremio(titulo, ganhos = []) {
  if (!ganhos.length && !titulo) return;
  Som.efeito("vitoria");
  if (typeof chuvaDeEstrelas === "function") chuvaDeEstrelas(35);
  const el = criar(`
    <div class="premio-salao" role="status">
      <span class="icone-premio">🎁</span>
      <b>${escapar(titulo || "Prêmio!")}</b>
      <ul>${ganhos.map((g) => `<li class="${g.raro ? "raro" : ""}"><span>${g.icone}</span>${escapar(g.texto)}</li>`).join("") || "<li>O teto de XP e moedas do Salão por hoje já foi. A glória continua!</li>"}</ul>
    </div>`);
  document.body.append(el);
  setTimeout(() => el.classList.add("saindo"), 5200);
  setTimeout(() => el.remove(), 5800);
  // o progresso do herói (visual novo, XP, moedas) vem do servidor
  api(`/api/jogador/${jogadorId}`, undefined, "GET").then((r) => r.estado && aplicarEstado(r.estado)).catch(() => {});
}

// ---------- as Casas ----------

function cartaDaCasa(id, casa, opcoes = {}) {
  const pontos = SALAO.estado.casas?.placar?.[id] || 0;
  return `
    <article class="carta-casa" style="--cor-casa:${casa.cor}">
      <img class="pixel brasao-casa" src="${brasaoUrl(id)}" alt="">
      <h3>${casa.icone} ${escapar(casa.nome)}</h3>
      <p class="lema-casa">“${escapar(casa.lema)}”</p>
      <p>${escapar(casa.texto)}</p>
      <small>🏆 ${pontos} pontos nesta semana</small>
      ${opcoes.botao ? `<button class="botao" type="button" data-escolher-casa="${id}">${opcoes.botao}</button>` : ""}
    </article>`;
}

function escolherCasa() {
  const casas = SALAO.casas || {};
  const minha = SALAO.eu?.casa;
  const janela = janelaDoSalao(`
    <header class="topo-janela-salao"><h2>🛡️ ${minha ? "Trocar de Casa" : "Escolhe tua Casa"}</h2>
      <p>Tudo o que fazes no Salão (duelos, Fendas, a Pergunta do Dragão, o Desafio do Dia) soma pontos para a tua Casa na <b>Taça das Casas</b> da semana. Ganhas o manto dela e um canal só da Casa no chat. Dá para trocar a cada ${SALAO.trocarCasaDias || 7} dias.</p></header>
    <div class="cartas-casas">${Object.entries(casas).map(([id, c]) => cartaDaCasa(id, c, { botao: id === minha ? "" : "Entrar nesta Casa" })).join("")}</div>
    ${minha ? "" : '<p class="legenda-casas">Dá para escolher depois também: o Distrito das Casas fica ao sul do jardim, pela passagem no muro.</p>'}`, "larga");
  janela.querySelectorAll("[data-escolher-casa]").forEach((b) => b.addEventListener("click", () => {
    enviarSalao({ t: "escolher_casa", casa: b.dataset.escolherCasa });
    b.disabled = true;
  }));
}

function mostrarSalaoDaCasa(m) {
  const casa = SALAO.casas?.[m.casa];
  if (!casa) return;
  const minha = SALAO.eu?.casa === m.casa;
  const janela = janelaDoSalao(`
    <header class="topo-janela-salao topo-casa" style="--cor-casa:${casa.cor}">
      <img class="pixel brasao-casa" src="${brasaoUrl(m.casa, 5)}" alt="">
      <div><h2>${casa.icone} ${escapar(casa.nome)}</h2><p>“${escapar(casa.lema)}” · ${escapar(casa.texto)}</p></div>
    </header>
    <div class="colunas-casa">
      <section><h3 class="titulo-lista-salao">⭐ Destaques da semana</h3>
        ${m.destaques.length ? `<ol class="ranking-salao">${m.destaques.map((d, i) => `<li class="${i < 3 ? `pos-${i + 1}` : ""}"><span>${["🥇", "🥈", "🥉"][i] || `${i + 1}º`}</span><b>${escapar(d.nome)}</b><small>${d.pontos} pts</small></li>`).join("")}</ol>` : '<p class="vazio-quadro">Ninguém pontuou ainda nesta semana. Sê o primeiro!</p>'}
      </section>
      <section><h3 class="titulo-lista-salao">🟢 No castelo agora (${m.online.length})</h3>
        <ul class="online-casa">${m.online.map((o) => `<li>${escapar(o.nome)}</li>`).join("") || "<li>Ninguém da casa online.</li>"}</ul>
        <p class="pontos-da-casa">🏆 <b>${(m.placar || {})[m.casa] || 0}</b> pontos na Taça desta semana</p>
      </section>
    </div>
    <div class="acoes-cartao">
      ${minha ? `<span class="tag tag-concluida">Esta é a tua Casa ✓</span><button class="botao botao-fantasma" type="button" data-trocar-casa>Trocar de Casa</button>`
        : `<button class="botao" type="button" data-entrar-casa>Entrar na ${escapar(casa.nome)}</button>`}
    </div>`, "larga");
  janela.querySelector("[data-entrar-casa]")?.addEventListener("click", () => enviarSalao({ t: "escolher_casa", casa: m.casa }));
  janela.querySelector("[data-trocar-casa]")?.addEventListener("click", escolherCasa);
}

function htmlDaTaca() {
  const placar = SALAO.estado.casas?.placar || {};
  const casas = Object.entries(SALAO.casas || {}).map(([id, c]) => ({ id, ...c, pontos: placar[id] || 0 })).sort((a, b) => b.pontos - a.pontos);
  const maximo = Math.max(1, ...casas.map((c) => c.pontos));
  return casas.map((c, i) => `
    <div class="linha-taca" style="--cor-casa:${c.cor}">
      <span class="posicao-taca">${["🥇", "🥈", "🥉"][i]}</span>
      <img class="pixel" src="${brasaoUrl(c.id, 3)}" alt="">
      <b>${escapar(c.nome)}</b>
      <div class="barra-taca"><i style="width:${Math.round((c.pontos / maximo) * 100)}%"></i></div>
      <strong>${c.pontos}</strong>
    </div>`).join("");
}

function abrirTacaDasCasas() {
  janelaDoSalao(`
    <header class="topo-janela-salao"><h2>🏆 Taça das Casas</h2><p>Os pontos desta semana (de segunda a domingo). Duelo vencido: 10 · duelo jogado: 3 · Fenda fechada: 15 · Pergunta do Dragão: 5 · Desafio do Dia: 3.</p></header>
    <div class="placar-taca" data-taca>${htmlDaTaca()}</div>
    <div class="acoes-cartao"><button class="botao" type="button" data-minha-casa>${SALAO.eu?.casa ? "🛡️ Minha Casa" : "🛡️ Escolher minha Casa"}</button></div>`, "estreita")
    .querySelector("[data-minha-casa]").addEventListener("click", () => (SALAO.eu?.casa ? enviarSalao({ t: "casa_info", casa: SALAO.eu.casa }) : escolherCasa()));
}

function atualizarJanelaDasCasas() {
  const taca = document.querySelector("#janela-salao[open] [data-taca]");
  if (taca) taca.innerHTML = htmlDaTaca();
}

// ---------- a Pergunta do Dragão ----------

let cartaoDoDragao = null;
let relogioDoDragao = null;

function dragaoChegando(m) {
  if (typeof chamarDragaoParaAPraca === "function") chamarDragaoParaAPraca();
  Som.efeito("rugido");
  avisoFlutuante("🐉", "Um dragão pousa na praça!", "Ele vai soltar uma pergunta para todo o castelo. Quem acertar primeiro leva o prêmio!");
}

function mostrarPerguntaDoDragao(m) {
  cartaoDoDragao?.remove();
  clearInterval(relogioDoDragao);
  const p = m.pergunta;
  cartaoDoDragao = criar(`
    <div class="cartao-dragao" data-id="${m.id}">
      <header><span>🐉</span><b>A Pergunta do Dragão</b><small>quem acertar primeiro vence</small></header>
      <div class="tempo-duelo"><i style="animation-duration:${m.resta ?? m.limite}s"></i><span data-resta>${m.resta ?? m.limite}</span></div>
      ${p.cenario ? `<p class="cenario-duelo">📜 ${formatar(p.cenario)}</p>` : ""}
      <p class="enunciado-duelo">${formatar(p.pergunta)}</p>
      ${p.codigo ? blocoCodigo(p.codigo) : ""}
      <div class="opcoes-duelo">${p.opcoes.map((o, i) => `<button class="opcao-duelo" type="button" data-opcao="${i}"><kbd>${i + 1}</kbd><span>${formatar(o)}</span></button>`).join("")}</div>
      <p class="estado-oponente" data-estado-dragao>O castelo inteiro está pensando...</p>
    </div>`);
  document.body.append(cartaoDoDragao);
  const fim = Date.now() + (m.resta ?? m.limite) * 1000;
  relogioDoDragao = setInterval(() => {
    const el = cartaoDoDragao?.querySelector("[data-resta]");
    if (el) el.textContent = Math.max(0, Math.ceil((fim - Date.now()) / 1000));
  }, 300);
  cartaoDoDragao.querySelectorAll("[data-opcao]").forEach((b) => b.addEventListener("click", () => {
    enviarSalao({ t: "dragao_responder", id: m.id, resposta: Number(b.dataset.opcao) });
    cartaoDoDragao.querySelectorAll("[data-opcao]").forEach((x) => { x.disabled = true; x.classList.toggle("escolhida", x === b); });
    Som.efeito("clique");
  }));
  Som.efeito("passar");
}

function respostaDoDragao(m) {
  const el = cartaoDoDragao?.querySelector("[data-estado-dragao]");
  if (!el) return;
  el.textContent = !m.correta ? "❌ Não foi dessa vez..." : m.primeiro ? "⚡ Acertaste primeiro! O dragão te escolheu!" : `✅ Acertaste, mas ${m.vencedor} foi mais rápido.`;
  el.classList.add("respondeu");
  Som.efeito(m.correta ? "acerto" : "erro");
}

function fimDoDragao(m) {
  clearInterval(relogioDoDragao);
  if (!cartaoDoDragao) return;
  cartaoDoDragao.querySelectorAll("[data-opcao]").forEach((b) => {
    b.disabled = true;
    if (Number(b.dataset.opcao) === m.resposta_certa) b.classList.add("certa");
    else if (b.classList.contains("escolhida")) b.classList.add("errada");
  });
  cartaoDoDragao.querySelector(".tempo-duelo")?.classList.add("parado");
  cartaoDoDragao.insertAdjacentHTML("beforeend", `<div class="resultado-rodada ${m.vencedor ? "bom" : "ruim"}"><p>${m.vencedor ? `🐉 ${escapar(m.vencedor.nome)} domou o dragão!` : "🐉 Ninguém acertou a tempo. O dragão bocejou."}</p><small>${formatar(m.explicacao || "")}</small></div>`);
  const cartao = cartaoDoDragao;
  setTimeout(() => cartao.classList.add("saindo"), 7000);
  setTimeout(() => { cartao.remove(); if (cartaoDoDragao === cartao) cartaoDoDragao = null; }, 7600);
}

// ---------- a Fenda do Oráculo (o altar) ----------

function abrirAltarDaFenda() {
  const f = SALAO.estado.fenda;
  const dentro = f?.membros?.some((m) => m.sid === SALAO.sid);
  const janela = janelaDoSalao(`
    <header class="topo-janela-salao"><h2>🌀 Altar da Fenda</h2>
      <p>Um fragmento do Oráculo tenta rasgar o céu do castelo. De <b>2 a 4 heróis</b> enfrentam o chefão juntos: cada um responde a sua pergunta, os acertos tiram vida dele (rápido é crítico) e cada erro quebra um escudo do grupo. Fechar a Fenda dá XP, moedas, o <b>Manto da Fenda do Oráculo</b> e 15 pontos para a tua Casa.</p></header>
    ${f ? `<div class="estado-fenda">
        <p>${f.estado === "reunindo" ? `🌀 A Fenda está aberta e chamando heróis: <b>${f.membros.length}/${f.maximo}</b> (começa em ${f.resta}s ou com 4).` : `⚔️ Um grupo está lutando contra <b>${escapar(f.nome || "o fragmento")}</b>. Assiste do círculo!`}</p>
        <ul class="online-casa">${f.membros.map((m) => `<li>${escapar(m.nome)}</li>`).join("")}</ul>
      </div>` : '<p class="vazio-quadro">O altar está quieto. Abre a Fenda e chama os amigos (o castelo inteiro fica sabendo).</p>'}
    <div class="acoes-cartao">
      ${!f ? '<button class="botao" type="button" data-abrir-fenda>🌀 Abrir a Fenda</button>' : ""}
      ${f?.estado === "reunindo" && !dentro ? '<button class="botao" type="button" data-entrar-fenda>⚔️ Entrar no grupo</button>' : ""}
      ${f?.estado === "reunindo" && dentro ? '<button class="botao botao-fantasma" type="button" data-sair-fenda>Sair do grupo</button>' : ""}
    </div>`, "estreita");
  janela.querySelector("[data-abrir-fenda]")?.addEventListener("click", () => { enviarSalao({ t: "fenda_abrir" }); janela.close(); });
  janela.querySelector("[data-entrar-fenda]")?.addEventListener("click", () => { enviarSalao({ t: "fenda_entrar" }); janela.close(); });
  janela.querySelector("[data-sair-fenda]")?.addEventListener("click", () => { enviarSalao({ t: "fenda_sair" }); janela.close(); });
}

// ---------- o Desafio do Dia ----------

async function abrirDesafioDoDia() {
  let d;
  try {
    d = await api(`/api/jogador/${jogadorId}/desafio-dia`, undefined, "GET");
  } catch (erro) {
    return avisoFlutuante("🔮", "O Oráculo está em silêncio", erro.message);
  }
  pintarDesafioDoDia(d);
}

function chamaDaSequencia(d) {
  const dias = Array.from({ length: d.bauA }, (_, i) => {
    const feito = i < (d.sequencia % d.bauA || (d.sequencia && d.sequencia % d.bauA === 0 ? d.bauA : 0));
    return `<li class="${feito ? "acesa" : ""}">${i === d.bauA - 1 ? "🎁" : "🔥"}</li>`;
  }).join("");
  return `<div class="sequencia-dia"><b>🔥 ${d.sequencia} dia${d.sequencia === 1 ? "" : "s"} seguido${d.sequencia === 1 ? "" : "s"}</b><ol>${dias}</ol><small>Acerta ${d.precisa} de ${d.total} todo dia para manter a chama. A cada ${d.bauA} dias seguidos, o baú abre.</small></div>`;
}

function pintarDesafioDoDia(d, ultimo = null) {
  const marcas = Array.from({ length: d.total }, (_, i) => `<li class="${d.respostas[i] === true ? "certa" : d.respostas[i] === false ? "errada" : i === d.respostas.length ? "atual" : ""}">${i + 1}</li>`).join("");
  let corpo;
  if (d.feito) {
    const fim = ultimo?.fim;
    corpo = `
      <div class="fim-desafio">
        <span class="icone-fim">${d.acertos >= d.precisa ? "🔮" : "🌫️"}</span>
        <h3>${d.acertos} de ${d.total}</h3>
        <p>${d.acertos >= d.precisa ? "O Oráculo aprova. A chama continua acesa!" : `Faltou pouco: precisava de ${d.precisa}. Amanhã tem mais.`}</p>
        ${fim?.bau ? '<p class="bau-desafio">🎁 O baú da semana abriu!</p>' : ""}
        ${fim?.ganhos?.length ? `<ul class="vd-espolios-lista">${fim.ganhos.map((g) => `<li><span>${g.icone}</span>${escapar(g.texto)}</li>`).join("")}</ul>` : ""}
        <small>As perguntas de amanhã são outras (e as mesmas para todo mundo: compara com os amigos!).</small>
      </div>`;
  } else {
    const p = d.pergunta;
    corpo = `
      ${p.cenario ? `<p class="cenario-duelo">📜 ${formatar(p.cenario)}</p>` : ""}
      <p class="enunciado-duelo">${formatar(p.pergunta)}</p>
      ${p.codigo ? blocoCodigo(p.codigo) : ""}
      <div class="opcoes-duelo">${p.opcoes.map((o, i) => `<button class="opcao-duelo" type="button" data-opcao="${i}"><kbd>${i + 1}</kbd><span>${formatar(o)}</span></button>`).join("")}</div>`;
  }
  const janela = janelaDoSalao(`
    <header class="topo-janela-salao"><h2>🔮 Oráculo do Dia</h2><p>${d.total} perguntas, as mesmas para todo o reino hoje. Uma tentativa por dia.</p></header>
    ${chamaDaSequencia(d)}
    <ol class="marcas-desafio">${marcas}</ol>
    ${ultimo && !ultimo.fim ? `<div class="resultado-rodada ${ultimo.correta ? "bom" : "ruim"}"><p>${ultimo.correta ? "✨ Certo!" : `❌ A certa era: <b>${formatar(ultimo.texto_certo || "")}</b>`}</p><small>${formatar(ultimo.explicacao || "")}</small></div>` : ""}
    <div class="corpo-desafio">${corpo}</div>`, "larga desafio-dia");
  janela.querySelectorAll("[data-opcao]").forEach((b) => b.addEventListener("click", async () => {
    janela.querySelectorAll("[data-opcao]").forEach((x) => { x.disabled = true; });
    try {
      const r = await api(`/api/jogador/${jogadorId}/desafio-dia/responder`, { resposta: Number(b.dataset.opcao) });
      if (r.estado) aplicarEstado(r.estado);
      Som.efeito(r.correta ? "acerto" : "erro");
      if (r.fim?.contou) {
        if (typeof chuvaDeEstrelas === "function") chuvaDeEstrelas(r.fim.bau ? 70 : 30);
        Som.efeito(r.fim.bau ? "vitoria" : "evolucao");
      }
      pintarDesafioDoDia(r.desafio, r);
    } catch (erro) {
      avisoFlutuante("🔮", "Não deu", erro.message);
    }
  }));
}

// ---------- a plateia do coliseu: o palpite ----------

let cartaoDaPlateia = null;

function estouNaArquibancada() {
  const h = SALAO.mundo?.heroi;
  if (!h) return false;
  return Math.hypot(h.x / 16 - ARENA_SALAO.cx, h.y / 16 - ARENA_SALAO.cy) < ARENA_SALAO.muralha + 1;
}

function palpiteDaPlateia(m) {
  if (!estouNaArquibancada()) return;
  cartaoDaPlateia?.remove();
  const p = m.pergunta;
  cartaoDaPlateia = criar(`
    <div class="cartao-plateia" data-duelo="${m.duelo}" data-rodada="${m.rodada}">
      <header><b>🏟️ Teu palpite</b><small>${escapar(m.nomes[0])} × ${escapar(m.nomes[1])}${m.monstro ? ` · ${escapar(m.monstro.nome)}` : ""}</small></header>
      <p>${formatar(p.afirmacao ? `${p.pergunta} “${p.afirmacao}”` : p.pergunta)}</p>
      <div class="opcoes-plateia">${p.opcoes.map((o, i) => `<button type="button" data-opcao="${i}">${formatar(o)}</button>`).join("")}</div>
      <small data-estado-plateia>Escolhe antes de eles responderem!</small>
    </div>`);
  document.body.append(cartaoDaPlateia);
  cartaoDaPlateia.querySelectorAll("[data-opcao]").forEach((b) => b.addEventListener("click", () => {
    cartaoDaPlateia.dataset.palpite = b.dataset.opcao;
    cartaoDaPlateia.querySelectorAll("[data-opcao]").forEach((x) => x.classList.toggle("escolhida", x === b));
    cartaoDaPlateia.querySelector("[data-estado-plateia]").textContent = "Palpite feito. Agora é torcer!";
    Som.efeito("clique");
  }));
}

function resultadoParaPlateia(m) {
  if (estouNaArquibancada()) Som.efeito("torcida");
  const c = cartaoDaPlateia;
  if (!c || c.dataset.duelo !== m.duelo || Number(c.dataset.rodada) !== m.rodada) return;
  c.querySelectorAll("[data-opcao]").forEach((b) => {
    b.disabled = true;
    if (Number(b.dataset.opcao) === m.resposta_certa) b.classList.add("certa");
  });
  const palpite = c.dataset.palpite;
  const acertou = palpite !== undefined && Number(palpite) === m.resposta_certa;
  const lados = m.nomes.map((n, i) => `${escapar(n)} ${m.acertos[i] ? "✅" : "❌"}`).join(" · ");
  c.querySelector("[data-estado-plateia]").innerHTML = `${palpite === undefined ? "Sem palpite." : acertou ? "🎯 Teu palpite acertou!" : "Teu palpite errou."} ${lados}`;
  setTimeout(() => { if (cartaoDaPlateia === c) { c.remove(); cartaoDaPlateia = null; } }, 5000);
}

// ---------- o modo foto, os botões de toque e o chamado da Fenda ----------

function ligarExtrasDoSalao(secao) {
  // P: o modo foto (some o HUD, entra a moldura dourada), para prints bonitos
  const teclas = (e) => {
    if (!secao.isConnected) {
      document.body.classList.remove("modo-foto");
      return window.removeEventListener("keydown", teclas);
    }
    if (e.target instanceof Element && e.target.closest("input, textarea")) return;
    if (document.querySelector("dialog[open]")) return;
    if (e.key === "p" || e.key === "P") {
      document.body.classList.toggle("modo-foto");
      Som.efeito("passar");
    }
  };
  window.addEventListener("keydown", teclas);
  secao.append(criar('<div class="moldura-foto" aria-hidden="true"><span>RPG IA · Salão de Elyndor</span></div>'));
  // no celular: falar, gestos e o "E" (entrar ou conversar) em botões grandes
  if (window.matchMedia("(pointer: coarse)").matches) {
    const botoes = criar(`
      <div class="botoes-toque">
        <button type="button" data-toque="falar" aria-label="Falar">💬</button>
        <button type="button" data-toque="gestos" aria-label="Gestos">🙂</button>
        <button type="button" data-toque="agir" aria-label="Interagir">E</button>
        <button type="button" data-toque="foto" aria-label="Modo foto">📸</button>
      </div>`);
    botoes.querySelector('[data-toque="falar"]').addEventListener("click", () => secao.querySelector("[data-entrada]")?.focus());
    botoes.querySelector('[data-toque="gestos"]').addEventListener("click", () => SALAO.mundo?.abrirGestos());
    botoes.querySelector('[data-toque="agir"]').addEventListener("click", () => SALAO.mundo?.interagir());
    botoes.querySelector('[data-toque="foto"]').addEventListener("click", () => document.body.classList.toggle("modo-foto"));
    secao.querySelector(".hud-salao").append(botoes);
  }
}

// o chamado da Fenda: enquanto ela junta heróis, um cartão no canto deixa entrar de qualquer lugar
function chamadoDaFenda(f) {
  const caixa = SALAO.secao?.querySelector("[data-convites]");
  if (!caixa) return;
  let el = caixa.querySelector(".chamado-fenda");
  const dentro = f?.membros?.some((m) => m.sid === SALAO.sid);
  if (!f || f.estado !== "reunindo") return el?.remove();
  if (!el) {
    el = criar('<div class="convite-salao chamado-fenda"></div>');
    caixa.prepend(el);
  }
  el.innerHTML = `
    <span class="icone-convite">🌀</span>
    <div><b>Uma Fenda do Oráculo se abriu!</b><small>${f.membros.map((m) => escapar(m.nome)).join(", ")} · ${f.membros.length}/${f.maximo} heróis</small></div>
    ${dentro ? '<button class="botao botao-fantasma" type="button" data-sair>Sair</button>' : '<button class="botao" type="button" data-entrar>Entrar</button>'}`;
  el.querySelector("[data-entrar]")?.addEventListener("click", () => enviarSalao({ t: "fenda_entrar" }));
  el.querySelector("[data-sair]")?.addEventListener("click", () => enviarSalao({ t: "fenda_sair" }));
}
