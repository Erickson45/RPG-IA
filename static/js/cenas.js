// Painéis de quadrinho que ilustram as falas do Zetsu.
// Cada fala do fases.json pode trazer uma "cena"; renderCena() transforma ela em HTML.
//
// Tipos de cena:
//   destaque:   { titulo, icone, texto, efeito? }        um ícone grande com estouro de quadrinho
//   fluxo:      { titulo, itens: [{ icone, texto }] }      passos ligados por setas
//   comparacao: { titulo, ruim: {rotulo, texto, icone}, bom: {...} }
//   grade:      { titulo, itens: [{ icone, titulo, texto }] }
//   codigo:     { titulo, codigo }                         uma janela de terminal
//   mensagem:   { titulo, formato: "email" | "chat", de, assunto, texto }   uma situação de trabalho

function escaparCena(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

function negritoCena(texto) {
  return escaparCena(texto).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
}

const CENAS = {
  destaque(c) {
    return `
      <div class="cena-destaque">
        <div class="estouro"><span class="icone-grande">${c.icone}</span></div>
        ${c.efeito ? `<span class="onomatopeia">${escaparCena(c.efeito)}</span>` : ""}
        <p>${negritoCena(c.texto)}</p>
        ${c.espolio?.length ? `
          <ul class="espolio-batalha">
            ${c.espolio.map((g, i) => `
              <li class="${g.raro ? "raro" : ""}" style="animation-delay:${0.25 + i * 0.18}s" title="${escaparCena(g.texto)}">
                <span class="slot-espolio">${typeof iconeDoGanho === "function" ? iconeDoGanho(g) : g.icone}</span>
                <small>${escaparCena(g.texto)}</small>
              </li>`).join("")}
          </ul>` : ""}
      </div>`;
  },
  fluxo(c) {
    return `
      <div class="cena-fluxo">
        ${c.itens.map((item, i) => `
          ${i ? `<span class="seta" style="animation-delay:${i * 0.35 - 0.15}s">➜</span>` : ""}
          <div class="passo-cena" style="animation-delay:${i * 0.35}s">
            <span class="icone">${item.icone}</span>
            <span>${negritoCena(item.texto)}</span>
          </div>`).join("")}
      </div>`;
  },
  comparacao(c) {
    const lado = (l, classe, marca) => `
      <div class="lado ${classe}">
        <span class="marca">${marca}</span>
        <strong>${escaparCena(l.rotulo)}</strong>
        ${l.icone ? `<span class="icone">${l.icone}</span>` : ""}
        <p>${negritoCena(l.texto)}</p>
      </div>`;
    return `<div class="cena-comparacao">${lado(c.ruim, "ruim", "✗")}<span class="versus">VS</span>${lado(c.bom, "bom", "✓")}</div>`;
  },
  grade(c) {
    return `
      <div class="cena-grade">
        ${c.itens.map((item, i) => `
          <div class="carta-cena" style="animation-delay:${i * 0.18}s">
            <span class="icone">${item.icone}</span>
            ${item.titulo ? `<strong>${escaparCena(item.titulo)}</strong>` : ""}
            <span>${negritoCena(item.texto)}</span>
          </div>`).join("")}
      </div>`;
  },
  codigo(c) {
    return `
      <div class="cena-codigo">
        <div class="janela"><span></span><span></span><span></span></div>
        <pre><code>${escaparCena(c.codigo)}</code></pre>
      </div>`;
  },
  // uma situação de trabalho: e-mail ou mensagem de chat
  mensagem(c) {
    const chat = c.formato === "chat";
    return `
      <div class="cena-mensagem ${chat ? "chat" : "email"}">
        <div class="cabecalho-mensagem">
          <span class="avatar-mensagem">${escaparCena((c.de || "?").trim()[0])}</span>
          <div><strong>${escaparCena(c.de)}</strong>${c.assunto ? `<small>${escaparCena(c.assunto)}</small>` : ""}</div>
          <span class="selo-mensagem">${chat ? "💬 Chat" : "📧 E-mail"}</span>
        </div>
        <p>${negritoCena(c.texto)}</p>
      </div>`;
  },
};

function renderCena(cena) {
  const desenhar = CENAS[cena.tipo];
  if (!desenhar) return "";
  return `
    <div class="quadro-conteudo">
      ${cena.titulo ? `<span class="legenda-quadro">${escaparCena(cena.titulo)}</span>` : ""}
      ${desenhar(cena)}
    </div>`;
}
