// A Prova do Degrau: para subir no caminho da classe, o herói encara 10 perguntas do currículo dele no
// Salão das Provas, com o Mestre Zetsu de examinador. A prova vai do fácil ao difícil (aquecimento,
// aplicação e desafio final), cada resposta acende uma runa na trilha (verde acertou, vermelha errou) e
// no fim vem o veredito: APROVADO com 7 ou mais (prêmio e, se o resto do degrau já estiver cumprido, a
// promoção) ou "ainda não", com o que estudar. Quem sorteia, corrige e decide é o servidor (jogador.py,
// /prova/iniciar e /prova/responder); daqui só sai a tela.
// Depende de app.js (acaoJogador, criar, escapar, formatar, tela, telaMapa, abrirArvore, avisoFlutuante,
// chuvaDeEstrelas, atualizarStatus, IMG_ZETSU) e som.js.

const ETAPAS_DA_PROVA = {
  1: { nome: "Aquecimento", cor: "#7dff9a", estrelas: "★☆☆" },
  2: { nome: "Aplicação", cor: "#ffd166", estrelas: "★★☆" },
  3: { nome: "Desafio final", cor: "#ff6b7a", estrelas: "★★★" },
};

// O cartão da prova na aba Ofício do Livro do Herói: pronta (botão), em andamento (continuar) ou o motivo
// de ainda não dar (dominar a skill, esperar depois de reprovar, já aprovada).
function cartaoDaProva(prova, aberta) {
  if (!prova || prova.fim) return "";
  const nome = prova.degrau === 1 ? "Prova do Aprendiz" : `Prova do Degrau ${prova.degrau}`;
  const estado = aberta ? "aberta" : prova.aprovada ? "aprovada" : prova.pode ? "pronta" : "trancada";
  const espera = prova.espera ? ` · tenta de novo em ${Math.ceil(prova.espera / 60)} min` : "";
  return `
    <div class="cartao-prova ${estado}">
      <span class="selo-prova">${estado === "aprovada" ? "✦" : "📜"}</span>
      <div>
        <small>${prova.skill ? `${prova.skill.icone || "📜"} ${escapar(prova.skill.nome)}` : "Teu ofício"}</small>
        <strong>${nome}</strong>
        <em>${aberta ? "Tu tens uma prova em andamento." : escapar(prova.motivo)}${espera}</em>
      </div>
      ${aberta || prova.pode ? `<button class="botao" type="button" data-prova>${aberta ? "Continuar ▸" : "Fazer a prova ⚔️"}</button>` : ""}
    </div>`;
}

async function telaProva() {
  let r;
  try {
    r = await acaoJogador("prova/iniciar");
  } catch (erro) {
    return avisoFlutuante("📜", "A prova ainda não abriu", erro.message);
  }
  window.scrollTo(0, 0);
  if (typeof fecharJanelasAbertas === "function") fecharJanelasAbertas();
  Som.musica?.("misterio");
  const degrau = r.provaDegrau;
  const skill = r.skillDaProva;
  const titulo = degrau === 1 ? "Prova do Aprendiz" : `Prova do Degrau ${degrau}`;
  const secao = criar(`
    <section class="prova-rpg">
      <div class="prova-runas-fundo" aria-hidden="true">${"ᚠᚱᛟᛉᚨᛞᛗᛇ".split("").map((c, i) => `<i style="--i:${i}">${c}</i>`).join("")}</div>
      <div class="prova-conteudo">
        <header class="prova-topo">
          <img class="prova-mestre" src="${IMG_ZETSU}" alt="Mestre Zetsu">
          <div>
            <small>✦ Salão das Provas ✦</small>
            <h2>${titulo}</h2>
            <p>${skill ? `${skill.icone || "📜"} ${escapar(skill.nome)} · ` : ""}10 perguntas do teu ofício, do fácil ao difícil. Aprova com 7.</p>
          </div>
        </header>
        <ol class="prova-trilha" aria-label="Progresso da prova">
          ${Array.from({ length: 10 }, (_, i) => `<li data-runa="${i}"><span>${i + 1}</span></li>`).join("")}
        </ol>
        <div class="prova-placar">
          <span class="prova-etapa" data-etapa></span>
          <span class="prova-nota"><b data-acertos>0</b> acertos · aprova com 7</span>
        </div>
        <article class="prova-pergunta" data-pergunta></article>
      </div>
    </section>`);
  tela.replaceChildren(secao);
  const runas = [...secao.querySelectorAll("[data-runa]")];
  const caixa = secao.querySelector("[data-pergunta]");
  const etapa = secao.querySelector("[data-etapa]");

  // as runas já respondidas (ao retomar uma prova pela metade) e a da vez
  function pintarTrilha(numero, respostas = []) {
    runas.forEach((el, i) => {
      el.classList.toggle("atual", i === numero - 1);
      if (respostas[i] !== undefined) el.classList.add(respostas[i] ? "certa" : "errada");
    });
  }

  function mostrarPergunta(p) {
    const info = ETAPAS_DA_PROVA[p.dificuldade] || ETAPAS_DA_PROVA[2];
    etapa.innerHTML = `<i style="color:${info.cor}">${info.estrelas}</i> ${info.nome} · pergunta ${p.numero} de ${p.total}`;
    etapa.style.setProperty("--cor-etapa", info.cor);
    secao.dataset.dificuldade = p.dificuldade;
    secao.querySelector("[data-acertos]").textContent = p.acertos;
    pintarTrilha(p.numero);
    const cenario = p.cenario ? `
      <div class="prova-cenario ${p.cenario.tipo}">
        <small>${p.cenario.tipo === "email" ? "✉️ E-mail" : "💬 Chat"} · <b>${escapar(p.cenario.de)}</b> · ${escapar(p.cenario.assunto)}</small>
        <p>${escapar(p.cenario.texto)}</p>
      </div>` : "";
    caixa.innerHTML = `
      ${cenario}
      <h3>${formatar(p.pergunta)}</h3>
      ${p.codigo ? `<pre class="prova-codigo"><code>${escapar(p.codigo)}</code></pre>` : ""}
      <div class="prova-opcoes">
        ${p.opcoes.map((o, i) => `
          <button type="button" class="prova-opcao" data-opcao="${i}" style="--atraso:${i * 60}ms">
            <b>${"ABCD"[i]}</b><span>${formatar(o)}</span>
          </button>`).join("")}
      </div>
      <div class="prova-explicacao" data-explicacao hidden></div>`;
    caixa.classList.remove("entra");
    void caixa.offsetWidth; // reinicia a animação de entrada
    caixa.classList.add("entra");
    caixa.querySelectorAll("[data-opcao]").forEach((b) => b.addEventListener("click", () => responder(Number(b.dataset.opcao), p)));
  }

  let respondendo = false;
  async function responder(escolha, p) {
    if (respondendo) return;
    respondendo = true;
    const botoes = [...caixa.querySelectorAll("[data-opcao]")];
    botoes.forEach((b) => { b.disabled = true; });
    let res;
    try {
      res = await acaoJogador("prova/responder", { resposta: escolha });
    } catch (erro) {
      respondendo = false;
      botoes.forEach((b) => { b.disabled = false; });
      return avisoFlutuante("⚠️", "Não deu para enviar", erro.message);
    }
    const certa = res.correcao.correta;
    botoes[res.correcao.resposta_certa]?.classList.add("certa");
    if (!certa) botoes[escolha]?.classList.add("errada");
    runas[p.numero - 1].classList.remove("atual");
    runas[p.numero - 1].classList.add(certa ? "certa" : "errada");
    secao.querySelector("[data-acertos]").textContent = res.acertos;
    Som.efeito(certa ? "acerto" : "erro");
    const explicacao = caixa.querySelector("[data-explicacao]");
    explicacao.hidden = false;
    explicacao.className = `prova-explicacao ${certa ? "certa" : "errada"}`;
    explicacao.innerHTML = `<strong>${certa ? "✦ Certo!" : "✗ Não era essa."}</strong> ${formatar(res.correcao.explicacao || "")}
      <button class="botao" type="button" data-seguir>${res.resultado ? "Ver o veredito ▸" : "Próxima ▸"}</button>`;
    explicacao.querySelector("[data-seguir]").addEventListener("click", () => {
      respondendo = false;
      if (res.resultado) veredito(res.resultado);
      else mostrarPergunta(res.pergunta);
    }, { once: true });
    explicacao.querySelector("[data-seguir]").focus();
  }

  function veredito(v) {
    const aprovado = v.aprovado;
    Som.efeito(aprovado ? "vitoria" : "derrota");
    if (aprovado) chuvaDeEstrelas(60);
    caixa.classList.remove("entra");
    caixa.innerHTML = `
      <div class="prova-veredito ${aprovado ? "aprovado" : "reprovado"}">
        <div class="carimbo">${aprovado ? "Aprovado" : "Ainda não"}</div>
        <p class="nota-final"><b>${v.acertos}</b> de ${v.total} <small>(precisava de ${v.nota})</small></p>
        <ol class="prova-resumo">${v.respostas.map((ok) => `<li class="${ok ? "certa" : "errada"}">${ok ? "✓" : "✗"}</li>`).join("")}</ol>
        <p class="fala-mestre">${aprovado
          ? (v.subiu ? "Mestre Zetsu: “Tu sabes o que estás fazendo. Sobe mais um degrau, aventureiro!”"
            : "Mestre Zetsu: “Aprovado! Quando cumprires o resto do degrau (nível e o que mais ele pede), a promoção vem na hora.”")
          : `Mestre Zetsu: “Quase! Revê a lição de ${escapar(v.skill?.nome || "teu ofício")} no Livro do Herói e volta em ${Math.ceil(v.espera / 60)} minutos.” As que tu erraste vão voltar como ecos nas batalhas.`}</p>
        ${v.ganhos?.length ? `<ul class="vd-espolios-lista">${v.ganhos.map((g) => `<li><span>${g.icone}</span>${escapar(g.texto)}</li>`).join("")}</ul>` : ""}
        <div class="acoes">
          <button class="botao botao-fantasma" type="button" data-livro>📚 Livro do Herói</button>
          <button class="botao" type="button" data-voltar>Voltar à aventura ▸</button>
        </div>
      </div>`;
    caixa.classList.add("entra");
    etapa.textContent = aprovado ? "Prova concluída" : "Prova encerrada";
    caixa.querySelector("[data-voltar]").addEventListener("click", () => telaMapa());
    caixa.querySelector("[data-livro]").addEventListener("click", () => {
      telaMapa();
      setTimeout(() => abrirArvore("oficio"), 600);
    });
    atualizarStatus();
  }

  pintarTrilha(r.pergunta.numero, r.estado?.prova?.respostas || []);
  mostrarPergunta(r.pergunta);
}
