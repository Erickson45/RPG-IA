// O som do RPG IA, todo gerado no navegador (Web Audio): efeitos sintetizados e músicas chiptune em loop.
// Nada é baixado. O navegador só libera o áudio depois do primeiro clique ou tecla, então tudo espera por isso.
//   Som.efeito("moeda")        toca um efeito (lista em EFEITOS)
//   Som.musica("reino")         troca a música (lista em MUSICAS); Som.musica(null) para
//   Som.volumes()/ajustar(...)  volume da música e dos efeitos (guardado neste navegador)

const Som = (() => {
  const CHAVE = "rpg-ia-som";
  let volumes = { musica: 0.45, efeitos: 0.7, ambiente: 1, mudo: false, velocidadeTexto: 1 };
  try {
    volumes = { ...volumes, ...JSON.parse(localStorage.getItem(CHAVE) || "{}") };
  } catch {
    // sem localStorage: fica com o padrão
  }

  let ctx = null;
  let saidaMusica = null;
  let saidaEfeitos = null;
  let ruidoBuffer = null;
  let entradaMusica = null; // entrada da música (vai para o salão de reverb)
  let saidaAtual = null; // para onde vão os efeitos agora (um ganho próprio quando o som vem de longe)
  let eco = null;

  // A resposta de um salão grande: ruído estéreo que vai sumindo devagar.
  function respostaDeSalao(segundos) {
    const tamanho = Math.round(ctx.sampleRate * segundos);
    const buffer = ctx.createBuffer(2, tamanho, ctx.sampleRate);
    for (let canal = 0; canal < 2; canal++) {
      const d = buffer.getChannelData(canal);
      for (let i = 0; i < tamanho; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / tamanho) ** 2.8;
    }
    return buffer;
  }

  function iniciar() {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return;
    }
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return;
    ctx = new Contexto();
    const compressor = ctx.createDynamicsCompressor();
    compressor.connect(ctx.destination);
    saidaMusica = ctx.createGain();
    saidaEfeitos = ctx.createGain();
    saidaMusica.connect(compressor);
    saidaEfeitos.connect(compressor);
    // a música passa por um "salão": reverb (um eco longo e macio) somado ao som seco
    entradaMusica = ctx.createGain();
    entradaMusica.connect(saidaMusica);
    const salao = ctx.createConvolver();
    salao.buffer = respostaDeSalao(2.6);
    const envioSalao = ctx.createGain();
    envioSalao.gain.value = 0.42;
    entradaMusica.connect(envioSalao).connect(salao).connect(saidaMusica);
    // e os metais ganham um eco ritmado
    eco = ctx.createDelay(1);
    eco.delayTime.value = 0.32;
    const retorno = ctx.createGain();
    retorno.gain.value = 0.28;
    eco.connect(retorno).connect(eco);
    eco.connect(entradaMusica);
    aplicarVolumes();
    // um segundo de ruído branco, reaproveitado por todos os efeitos de "chiado"
    ruidoBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const dados = ruidoBuffer.getChannelData(0);
    for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1;
    if (musicaPedida) tocarMusica(musicaPedida);
    // o ambiente pedido antes de o áudio ser liberado começa agora
    if (ambienteAtual) {
      const pedido = ambienteAtual;
      ambienteAtual = null;
      ambiente(pedido);
    }
  }
  ["pointerdown", "keydown"].forEach((evento) => window.addEventListener(evento, iniciar, { passive: true }));

  function aplicarVolumes() {
    if (!ctx) return;
    saidaMusica.gain.value = volumes.mudo ? 0 : volumes.musica * 0.8;
    saidaEfeitos.gain.value = volumes.mudo ? 0 : volumes.efeitos;
  }

  function guardar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(volumes));
    } catch {
      // sem localStorage: vale só nesta visita
    }
  }

  // ---------- peças básicas ----------

  const NOTAS = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  function frequencia(nota) {
    if (typeof nota === "number") return nota;
    const [, letra, acidente, oitava] = nota.match(/^([A-G])(#|b)?(\d)$/);
    const semitons = NOTAS[letra] + (acidente === "#" ? 1 : acidente === "b" ? -1 : 0) + (Number(oitava) - 4) * 12;
    return 440 * 2 ** (semitons / 12);
  }

  // Um tom com envelope rápido: onda, frequência (pode deslizar até "ate"), duração e volume.
  function tom({ nota, ate, dur = 0.12, tipo = "square", vol = 0.2, quando = 0, saida = saidaAtual || saidaEfeitos, ataque = 0.005, vibrato = 0 }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + quando;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(frequencia(nota), t0);
    if (ate) osc.frequency.exponentialRampToValueAtTime(frequencia(ate), t0 + dur);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const profundidade = ctx.createGain();
      lfo.frequency.value = 7;
      profundidade.gain.value = vibrato;
      lfo.connect(profundidade).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(vol, t0 + ataque);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env).connect(saida);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Chiado filtrado: swish de espada, flecha, explosão, caixa da bateria...
  function ruido({ dur = 0.15, vol = 0.2, quando = 0, filtro = "bandpass", freq = 1200, ate, q = 1, saida = saidaAtual || saidaEfeitos }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + quando;
    const fonte = ctx.createBufferSource();
    fonte.buffer = ruidoBuffer;
    const f = ctx.createBiquadFilter();
    f.type = filtro;
    f.frequency.setValueAtTime(freq, t0);
    if (ate) f.frequency.exponentialRampToValueAtTime(ate, t0 + dur);
    f.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(vol, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    fonte.connect(f).connect(env).connect(saida);
    fonte.start(t0, Math.random() * 0.5);
    fonte.stop(t0 + dur + 0.02);
  }

  const arpejo = (notas, passo = 0.07, extra = {}) => notas.forEach((nota, i) => tom({ nota, dur: passo * 1.6, quando: i * passo, ...extra }));

  // ---------- efeitos ----------

  const EFEITOS = {
    clique: () => tom({ nota: "A5", dur: 0.04, vol: 0.05 }),
    passar: () => tom({ nota: "E5", ate: "A5", dur: 0.05, vol: 0.04, tipo: "triangle" }),
    erro: () => tom({ nota: "E4", ate: "B3", dur: 0.16, vol: 0.07, tipo: "square" }),
    porta: () => {
      ruido({ dur: 0.25, vol: 0.25, filtro: "lowpass", freq: 400 });
      tom({ nota: "C3", ate: "G2", dur: 0.2, tipo: "triangle", vol: 0.2 });
    },
    moeda: () => {
      tom({ nota: "B5", dur: 0.07, vol: 0.12 });
      tom({ nota: "E6", dur: 0.18, vol: 0.12, quando: 0.06 });
    },
    compra: () => arpejo(["E5", "G5", "B5", "E6"], 0.05, { vol: 0.1 }),
    acerto: () => arpejo(["C5", "E5", "G5"], 0.05, { vol: 0.1, tipo: "triangle" }),
    // os golpes de cada classe
    feitico: () => {
      tom({ nota: "C5", ate: "C7", dur: 0.35, tipo: "sine", vol: 0.18 });
      tom({ nota: "G5", ate: "G6", dur: 0.3, tipo: "triangle", vol: 0.1, quando: 0.05 });
    },
    espada: () => {
      ruido({ dur: 0.18, vol: 0.35, filtro: "highpass", freq: 1800, ate: 5000 });
      tom({ nota: "E6", dur: 0.25, tipo: "triangle", vol: 0.08, quando: 0.08 });
    },
    flecha: () => {
      ruido({ dur: 0.22, vol: 0.25, filtro: "bandpass", freq: 3000, ate: 800, q: 3 });
      tom({ nota: "G3", ate: "C3", dur: 0.08, tipo: "square", vol: 0.12, quando: 0.2 });
    },
    impacto: () => {
      ruido({ dur: 0.18, vol: 0.4, filtro: "lowpass", freq: 900, ate: 200 });
      tom({ nota: "A2", ate: "E2", dur: 0.15, tipo: "square", vol: 0.15 });
    },
    critico: () => {
      ruido({ dur: 0.35, vol: 0.45, filtro: "lowpass", freq: 1400, ate: 120 });
      arpejo(["E5", "B5", "E6"], 0.04, { vol: 0.1 });
    },
    dano: () => {
      ruido({ dur: 0.3, vol: 0.45, filtro: "lowpass", freq: 600, ate: 100 });
      tom({ nota: "C3", ate: "C2", dur: 0.3, tipo: "sawtooth", vol: 0.15 });
    },
    bloqueio: () => {
      tom({ nota: "A5", dur: 0.25, tipo: "square", vol: 0.1 });
      tom({ nota: "E6", dur: 0.3, tipo: "triangle", vol: 0.08, quando: 0.02 });
      ruido({ dur: 0.08, vol: 0.2, filtro: "highpass", freq: 4000 });
    },
    magia: () => {
      tom({ nota: "A4", ate: "A6", dur: 0.4, tipo: "sine", vol: 0.15, vibrato: 12 });
      arpejo(["E6", "A6", "C7"], 0.06, { vol: 0.05, tipo: "sine", quando: 0.15 });
    },
    cura: () => arpejo(["C5", "E5", "G5", "C6", "E6"], 0.07, { vol: 0.1, tipo: "sine" }),
    especial: () => {
      ruido({ dur: 0.6, vol: 0.35, filtro: "bandpass", freq: 300, ate: 3000, q: 2 });
      arpejo(["C4", "G4", "C5", "G5", "C6"], 0.06, { vol: 0.12, tipo: "square" });
    },
    explosao: () => {
      ruido({ dur: 0.7, vol: 0.55, filtro: "lowpass", freq: 1200, ate: 60 });
      tom({ nota: "E2", ate: "A1", dur: 0.6, tipo: "sawtooth", vol: 0.15 });
    },
    rugido: () => {
      tom({ nota: "A2", ate: "D2", dur: 0.9, tipo: "sawtooth", vol: 0.22, vibrato: 18 });
      ruido({ dur: 0.9, vol: 0.3, filtro: "lowpass", freq: 700, ate: 200 });
    },
    morte: () => {
      tom({ nota: "G4", ate: "C3", dur: 0.5, tipo: "square", vol: 0.12 });
      ruido({ dur: 0.5, vol: 0.2, filtro: "highpass", freq: 2000, ate: 6000 });
    },
    vitoria: () => {
      [["C5", 0], ["E5", 0.1], ["G5", 0.2], ["C6", 0.3], ["G5", 0.45], ["C6", 0.55]].forEach(([nota, quando]) => tom({ nota, dur: 0.18, quando, vol: 0.14 }));
      [["C3", 0], ["G3", 0.3], ["C4", 0.55]].forEach(([nota, quando]) => tom({ nota, dur: 0.3, quando, vol: 0.12, tipo: "triangle" }));
    },
    derrota: () => [["G4", 0], ["E4", 0.2], ["C4", 0.4], ["G3", 0.6]].forEach(([nota, quando]) => tom({ nota, dur: 0.3, quando, vol: 0.12, tipo: "triangle" })),
    nivel: () => {
      arpejo(["C5", "E5", "G5", "C6", "E6", "G6"], 0.06, { vol: 0.12 });
      tom({ nota: "C6", dur: 0.6, quando: 0.4, vol: 0.1, tipo: "triangle" });
    },
    evolucao: () => {
      arpejo(["G4", "B4", "D5", "G5", "B5", "D6", "G6"], 0.07, { vol: 0.13 });
      ruido({ dur: 1, vol: 0.15, filtro: "highpass", freq: 3000, ate: 9000, quando: 0.2 });
    },
    // conversa dos moradores: três ou quatro "blips" de voz, mais agudos ou mais graves
    falar: () => {
      const base = 380 + Math.random() * 300;
      for (let i = 0; i < 3 + Math.floor(Math.random() * 2); i++) tom({ nota: base * (0.85 + Math.random() * 0.4), dur: 0.05, vol: 0.05, tipo: "square", quando: i * 0.08 });
    },
    // os monstros por perto
    slime: () => {
      tom({ nota: 320, ate: 140, dur: 0.18, tipo: "sine", vol: 0.25, vibrato: 30 });
      tom({ nota: 500, ate: 260, dur: 0.12, tipo: "sine", vol: 0.12, quando: 0.12 });
    },
    rosnado: () => {
      tom({ nota: 90, ate: 70, dur: 0.6, tipo: "sawtooth", vol: 0.12, vibrato: 14 });
      ruido({ dur: 0.6, vol: 0.12, filtro: "lowpass", freq: 500 });
    },
    uivo: () => tom({ nota: "E4", ate: "A4", dur: 1.4, tipo: "triangle", vol: 0.12, vibrato: 10, ataque: 0.3 }),
    croac: () => [0, 0.18].forEach((quando) => tom({ nota: 130, ate: 95, dur: 0.14, tipo: "square", vol: 0.1, quando, vibrato: 25 })),
    chiado: () => ruido({ dur: 0.45, vol: 0.14, filtro: "highpass", freq: 4000, ate: 7000 }),
    ossos: () => [0, 0.07, 0.15].forEach((quando) => ruido({ dur: 0.04, vol: 0.2, filtro: "bandpass", freq: 2400, q: 6, quando })),
    asas: () => [0, 0.3].forEach((quando) => ruido({ dur: 0.22, vol: 0.18, filtro: "lowpass", freq: 600, ate: 200, quando })),
    // a plateia do coliseu: o burburinho que sobe e as palmas espalhadas
    torcida: () => {
      ruido({ dur: 1.6, vol: 0.1, filtro: "bandpass", freq: 700, ate: 1100, q: 0.7 });
      for (let i = 0; i < 14; i++) ruido({ dur: 0.035, vol: 0.06 + Math.random() * 0.04, filtro: "highpass", freq: 2200 + Math.random() * 1500, quando: 0.1 + i * 0.09 + Math.random() * 0.05 });
    },
  };

  // intensidade (0 a 1): quanto mais longe a fonte do som, mais baixo
  function efeito(nome, intensidade = 1) {
    if (!ctx || volumes.mudo || !EFEITOS[nome] || intensidade <= 0) return;
    if (intensidade >= 1) return EFEITOS[nome]();
    const ganho = ctx.createGain();
    ganho.gain.value = intensidade;
    ganho.connect(saidaEfeitos);
    saidaAtual = ganho;
    try {
      EFEITOS[nome]();
    } finally {
      saidaAtual = null;
    }
  }

  // ---------- músicas ----------
  // Trilha de RPG com uma "orquestra" sintetizada: metais na melodia (com eco), cordas sustentando os
  // acordes, harpa em arpejo, baixo, cordas curtas nas batalhas, tambores taiko e prato, tudo passando
  // pelo reverb de salão. Cada música tem o acorde de cada compasso (8 colcheias), a melodia em
  // colcheias ("-" segura a nota anterior, "." é silêncio; "|" só separa os compassos) e a bateria de
  // um compasso: "T" taiko, "t" tom, "k" bumbo, "s" caixa, "h" chimbal ("-" nada).

  const SEMITOM = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  // as três notas do acorde ("Dm", "Bb", "F#"...) numa oitava
  function notasDoAcorde(nome, oitava) {
    const [, letra, acidente, menor] = nome.match(/^([A-G])(#|b)?(m)?$/);
    const raiz = SEMITOM[letra] + (acidente === "#" ? 1 : acidente === "b" ? -1 : 0);
    const base = 440 * 2 ** ((raiz - 9 + (oitava - 4) * 12) / 12);
    return [0, menor ? 3 : 4, 7].map((s) => base * 2 ** (s / 12));
  }

  function oscilador(tipo, freq, t0, t1, destino, cents = 0) {
    const o = ctx.createOscillator();
    o.type = tipo;
    o.frequency.value = freq;
    o.detune.value = cents;
    o.connect(destino);
    o.start(t0);
    o.stop(t1);
    return o;
  }

  // metais: duas serras um pouco desafinadas, com o filtro abrindo no ataque (o brilho do trompete)
  function metal(freq, dur, t0, vol) {
    const filtro = ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.setValueAtTime(500, t0);
    filtro.frequency.linearRampToValueAtTime(2800, t0 + 0.06);
    filtro.frequency.linearRampToValueAtTime(1600, t0 + Math.min(dur, 0.4));
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(vol, t0 + 0.03);
    env.gain.setValueAtTime(vol * 0.8, t0 + Math.max(0.05, dur - 0.06));
    env.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.12);
    filtro.connect(env);
    env.connect(destino);
    env.connect(eco);
    const fim = t0 + dur + 0.15;
    const vibrato = ctx.createOscillator();
    const profundidade = ctx.createGain();
    vibrato.frequency.value = 5.5;
    profundidade.gain.setValueAtTime(0, t0);
    profundidade.gain.linearRampToValueAtTime(freq * 0.006, t0 + Math.min(dur, 0.5));
    vibrato.connect(profundidade);
    vibrato.start(t0);
    vibrato.stop(fim);
    [-7, 7].forEach((cents) => profundidade.connect(oscilador("sawtooth", freq, t0, fim, filtro, cents).frequency));
  }

  // cordas: o acorde inteiro, entrando devagar e sumindo devagar
  function cordas(freqs, dur, t0, vol) {
    const filtro = ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 1400;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(vol, t0 + 0.35);
    env.gain.setValueAtTime(vol, t0 + Math.max(0.4, dur - 0.1));
    env.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.5);
    filtro.connect(env).connect(destino);
    freqs.forEach((f) => [-10, 10].forEach((cents) => oscilador("sawtooth", f, t0, t0 + dur + 0.6, filtro, cents)));
  }

  // cordas curtas e ritmadas (o "tchá-tchá-tchá" das batalhas)
  function staccato(freq, t0, vol) {
    const filtro = ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 2200;
    const env = ctx.createGain();
    env.gain.setValueAtTime(vol, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    filtro.connect(env).connect(destino);
    [-8, 8].forEach((cents) => oscilador("sawtooth", freq, t0, t0 + 0.16, filtro, cents));
  }

  // harpa: nota curtinha com um brilho uma oitava acima
  function harpa(freq, t0, vol) {
    const env = ctx.createGain();
    env.gain.setValueAtTime(vol, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
    env.connect(destino);
    oscilador("triangle", freq, t0, t0 + 0.72, env);
    const brilho = ctx.createGain();
    brilho.gain.value = 0.3;
    brilho.connect(env);
    oscilador("sine", freq * 2, t0, t0 + 0.72, brilho);
  }

  function baixoOrquestra(freq, dur, t0, vol) {
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    env.gain.setValueAtTime(vol * 0.85, t0 + Math.max(0.03, dur - 0.05));
    env.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.08);
    env.connect(destino);
    oscilador("triangle", freq, t0, t0 + dur + 0.1, env);
    oscilador("sine", freq / 2, t0, t0 + dur + 0.1, env);
  }

  // flauta: seno com vibrato e um sopro de ruído no ataque (dobra a melodia, uma oitava acima, na 2ª volta)
  function flauta(freq, dur, t0, vol) {
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(vol, t0 + 0.05);
    env.gain.setValueAtTime(vol * 0.85, t0 + Math.max(0.06, dur - 0.05));
    env.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.1);
    env.connect(destino);
    const o = oscilador("sine", freq, t0, t0 + dur + 0.12, env);
    const lfo = ctx.createOscillator();
    const prof = ctx.createGain();
    lfo.frequency.value = 5;
    prof.gain.value = freq * 0.008;
    lfo.connect(prof).connect(o.frequency);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.12);
    const quando = Math.max(0, t0 - ctx.currentTime);
    ruido({ dur: 0.06, vol: vol * 0.5, filtro: "bandpass", freq: freq * 2, q: 4, quando, saida: destino });
  }

  // sino: duas parciais que não são oitava (o "plim" metálico), longo, nos acordes da 2ª volta
  function sino(freq, t0, vol) {
    const env = ctx.createGain();
    env.gain.setValueAtTime(vol, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
    env.connect(destino);
    oscilador("sine", freq, t0, t0 + 1.65, env);
    const parcial = ctx.createGain();
    parcial.gain.value = 0.35;
    parcial.connect(env);
    oscilador("sine", freq * 2.76, t0, t0 + 1.65, parcial);
  }

  // guitarra pesada das batalhas: raiz e quinta numa serra distorcida e abafada ("tchug")
  let curvaDistorcao = null;
  function guitarra(raiz, t0, dur, vol) {
    if (!curvaDistorcao) {
      curvaDistorcao = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        const x = (i / 1023) * 2 - 1;
        curvaDistorcao[i] = Math.tanh(x * 6);
      }
    }
    const ws = ctx.createWaveShaper();
    ws.curve = curvaDistorcao;
    const filtro = ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.setValueAtTime(dur < 0.2 ? 900 : 2000, t0);
    const env = ctx.createGain();
    env.gain.setValueAtTime(vol, t0);
    env.gain.setValueAtTime(vol * 0.8, t0 + Math.max(0.02, dur - 0.04));
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.05);
    const pre = ctx.createGain();
    pre.gain.value = 0.6;
    pre.connect(ws).connect(filtro).connect(env).connect(destino);
    [raiz, raiz * 1.5, raiz * 2].forEach((f, i) => oscilador("sawtooth", f, t0, t0 + dur + 0.08, pre, i ? 4 : -4));
  }

  function percussao(golpe, t0) {
    const quando = Math.max(0, t0 - ctx.currentTime);
    const saida = destino;
    if (golpe === "T") {
      tom({ nota: 120, ate: 40, dur: 0.7, tipo: "sine", vol: 0.6, quando, saida });
      ruido({ dur: 0.14, vol: 0.3, filtro: "lowpass", freq: 320, quando, saida });
    } else if (golpe === "t") tom({ nota: 210, ate: 90, dur: 0.3, tipo: "sine", vol: 0.32, quando, saida });
    else if (golpe === "k") tom({ nota: 150, ate: 45, dur: 0.16, tipo: "sine", vol: 0.45, quando, saida });
    else if (golpe === "s") {
      ruido({ dur: 0.16, vol: 0.2, filtro: "bandpass", freq: 1800, quando, saida });
      tom({ nota: 190, dur: 0.08, tipo: "triangle", vol: 0.12, quando, saida });
    } else if (golpe === "h") ruido({ dur: 0.04, vol: 0.05, filtro: "highpass", freq: 8000, quando, saida });
    else if (golpe === "c") ruido({ dur: 1.8, vol: 0.12, filtro: "highpass", freq: 5000, quando, saida });
  }

  const MUSICAS = {
    // tema de abertura: majestoso e lento, em ré menor
    abertura: {
      bpm: 72, acordes: "Dm Bb F C Dm Bb C A", baixo: "longo", harpa: 4, metal: 0.05, cordas: 0.024,
      melodia: "D5 - - - A4 - D5 E5 | F5 - - - E5 D5 F5 - | A5 - - - G5 F5 E5 - | G5 - - - - - E5 - | F5 - - E5 D5 - A4 - | D5 - - - F5 - Bb5 - | A5 - G5 - E5 - C5 - | C#5 - - - E5 - - -",
      bateria: "T - - - t - - -",
    },
    // a Academia: mágica e acolhedora, em fá maior
    academia: {
      bpm: 90, acordes: "F C Dm Bb F C Bb C", baixo: "marcha", harpa: 5, metal: 0.035, cordas: 0.02,
      melodia: "A4 - C5 - F5 - E5 - | G5 - - - E5 - C5 - | D5 - F5 - A5 - G5 F5 | F5 - - - D5 - . . | C5 - F5 - A5 - C6 - | Bb5 - A5 - G5 - E5 - | F5 - G5 - A5 - D5 - | E5 - - - . . . .",
      parteB: {
        acordes: "Bb C Am Dm Bb C F F",
        melodia: "D5 - F5 - Bb5 - A5 - | G5 - - - E5 - C5 - | C5 - E5 - A5 - G5 - | F5 - - - D5 - . . | Bb4 - D5 - F5 - Bb5 - | A5 - G5 - E5 - C5 - | F5 - - - A5 - C6 - | F5 - - - . . . .",
      },
      bateria: "k - h - - - h -",
    },
    // o Reino: aventura heroica, em ré maior
    reino: {
      bpm: 124, acordes: "D A Bm G D A G A", baixo: "marcha", harpa: 4, metal: 0.05, cordas: 0.022,
      melodia: "D5 - - A4 D5 - F#5 - | E5 - - C#5 A4 - . . | F#5 - - D5 B4 - D5 - | G5 - F#5 - E5 - D5 - | A5 - - F#5 D5 - A5 - | B5 - A5 - G5 - F#5 E5 | D5 - E5 - F#5 - G5 - | E5 - - - C#5 - . .",
      parteB: {
        acordes: "G A F#m Bm G A D D",
        melodia: "B5 - - A5 G5 - D5 - | C#5 - E5 - A5 - - - | F#5 - - E5 D5 - C#5 - | B4 - - - D5 - F#5 - | G5 - - F#5 E5 - D5 - | E5 - F#5 - G5 - A5 - | F#5 - - - D5 - A4 - | D5 - - - - - . .",
      },
      bateria: "T - h - s - h k",
    },
    // o Salão de Elyndor (multijogador): festiva e majestosa, em dó maior, com a parte B subindo para o refrão
    salao: {
      bpm: 104, acordes: "C G Am F C G F G", baixo: "marcha", harpa: 5, metal: 0.05, cordas: 0.022,
      melodia: "E5 - G5 - C6 - B5 - | A5 - G5 - E5 - D5 - | C5 - E5 - A5 - G5 - | F5 - - - A5 - . . | G5 - E5 - C5 - E5 - | D5 - G5 - B5 - D6 - | C6 - B5 - A5 - F5 - | G5 - - - - - . .",
      parteB: {
        acordes: "F G Em Am F G C C",
        melodia: "A5 - C6 - F6 - E6 - | D6 - - - B5 - G5 - | G5 - B5 - E6 - D6 - | C6 - - - A5 - . . | A5 - C6 - F6 - A6 - | G6 - F6 - E6 - D6 - | E6 - - - C6 - G5 - | C6 - - - - - . .",
      },
      bateria: "T - h - s - h k",
    },
    // o Mercado e a Estalagem: alegre, em sol maior
    mercado: {
      bpm: 110, acordes: "G Em C D G Em C D", baixo: "marcha", harpa: 5, metal: 0.04, cordas: 0.018,
      melodia: "G5 - D5 - B4 - D5 - | E5 - G5 - B5 - G5 - | C6 - B5 - A5 - G5 - | F#5 - A5 - D5 - . . | B5 - - A5 G5 - D5 - | E5 - - D5 B4 - G4 - | A4 - B4 - C5 - E5 - | D5 - - - . . . .",
      bateria: "k - h h s - h -",
    },
    // batalha: rápida e tensa, em mi menor; a parte B sobe para o refrão, e a guitarra entra na 2ª volta
    batalha: {
      bpm: 158, acordes: "Em C D B Em C D B", baixo: "galope", ostinato: true, metal: 0.05, cordas: 0.016,
      melodia: "E5 - B4 - E5 - G5 - | E5 - - - C5 - E5 G5 | F#5 - - - D5 - A5 - | F#5 - D#5 - B4 - . . | B5 - - A5 G5 - E5 - | G5 - - F#5 E5 - C5 - | D5 - E5 - F#5 - A5 - | B5 - - - D#5 - F#5 -",
      parteB: {
        acordes: "C D Em Em C D B B",
        melodia: "G5 - E5 - G5 - C6 - | B5 - A5 - F#5 - D5 - | E5 - - - G5 - B5 - | E6 - - - D6 - B5 - | C6 - - B5 A5 - G5 - | A5 - - G5 F#5 - D5 - | D#5 - F#5 - B5 - A5 - | F#5 - - - D#5 - B4 -",
      },
      guitarra: "X - x x - x x -",
      bateria: "T h s h k T s h",
    },
    // chefão: sombrio e épico, em ré menor, com taikos pesados
    chefao: {
      bpm: 140, acordes: "Dm Bb C A Dm Gm Bb A", baixo: "galope", ostinato: true, metal: 0.055, cordas: 0.024,
      melodia: "D5 - - - A5 - - - | Bb5 - - A5 G5 - F5 - | E5 - - - G5 - C6 - | A5 - G#5 - E5 - C#5 - | D6 - - C6 A5 - F5 - | G5 - - - Bb5 - D6 - | C6 - Bb5 - A5 - G5 - | A5 - - - E5 - C#5 -",
      parteB: {
        acordes: "Gm Gm Dm Dm Bb C A A",
        melodia: "G5 - - - Bb5 - D6 - | C6 - Bb5 - A5 - G5 - | F5 - - - A5 - D6 - | E6 - - - D6 - A5 - | Bb5 - - A5 Bb5 - D6 - | C6 - - Bb5 C6 - E6 - | C#6 - - - A5 - E5 - | C#5 - - - E5 - A5 -",
      },
      guitarra: "X - x x X - x x",
      bateria: "T t s T T t s s",
    },
    // as cenas da história: misteriosa e lenta, em dó menor, com a harpa no alto
    misterio: {
      bpm: 64, acordes: "Cm Ab Eb Bb Cm Ab Fm G", baixo: "longo", harpa: 5, metal: 0.035, cordas: 0.026,
      melodia: "G5 - - - Eb5 - - - | C5 - - D5 Eb5 - - - | G5 - - - Ab5 - G5 - | F5 - - - - - . . | Eb5 - - - G5 - C6 - | Bb5 - - - Ab5 - G5 - | F5 - Ab5 - C6 - Bb5 - | B5 - - - - - . .",
      bateria: "T - - - - - - -",
    },
    // Umbraterra: o crepúsculo eterno, em si menor, devagar e pesado
    umbra: {
      bpm: 84, acordes: "Bm G Em F# Bm G A F#", baixo: "longo", harpa: 3, metal: 0.04, cordas: 0.026,
      melodia: "B4 - - - F#5 - - - | G5 - F#5 - E5 - D5 - | E5 - - - G5 - B5 - | A#5 - - - F#5 - . . | D6 - - C#6 B5 - F#5 - | G5 - - - B5 - E5 - | F#5 - G5 - A5 - C#6 - | A#5 - - - F#5 - . .",
      bateria: "T - - k t - - -",
    },
    // o Vazio: a última batalha, em dó sustenido menor, rápida, com taikos o tempo todo
    vazio: {
      bpm: 160, acordes: "C#m A B G# C#m F#m A G#", baixo: "galope", ostinato: true, metal: 0.06, cordas: 0.028,
      melodia: "C#6 - - - G#5 - - - | A5 - - B5 C#6 - E6 - | D#6 - - - B5 - F#5 - | G#5 - - - B#5 - D#6 - | E6 - - D#6 C#6 - G#5 - | A5 - - - C#6 - F#6 - | E6 - D#6 - C#6 - B5 - | B#5 - - - G#5 - B#5 -",
      guitarra: "x x x x X - x x",
      bateria: "T T s T T t s T",
    },
    // o fim da jornada e os créditos: triunfante, em ré maior
    triunfo: {
      bpm: 96, acordes: "D G A D Bm G A D", baixo: "marcha", harpa: 4, metal: 0.055, cordas: 0.026,
      melodia: "A4 - D5 - F#5 - A5 - | B5 - - - G5 - B5 - | C#6 - - B5 A5 - E5 - | F#5 - - - - - . . | D6 - - C#6 B5 - F#5 - | G5 - - A5 B5 - G5 - | A5 - B5 - C#6 - E6 - | D6 - - - - - . .",
      bateria: "T - h - s - h k",
    },
  };

  let musicaPedida = null;
  let musicaTocando = null;
  let relogio = null;
  let proximoTempo = 0;
  let passo = 0;
  let destino = null; // o volume da música que está tocando (para uma sumir enquanto a outra entra)

  // uma parte da música (A ou B): os acordes, as notas e quanto cada nota segura
  function prepararParte(acordesTexto, melodiaTexto) {
    const notas = melodiaTexto.replace(/\|/g, " ").trim().split(/\s+/);
    const acordes = acordesTexto.trim().split(/\s+/);
    const dur = notas.map((_, i) => {
      let n = 1;
      while (notas[(i + n) % notas.length] === "-" && n < 16) n++;
      return n;
    });
    return { notas, acordes, dur, passos: acordes.length * 8 };
  }

  function tocarMusica(nome) {
    pararMusica();
    const m = MUSICAS[nome];
    if (!m || !ctx) return;
    musicaTocando = nome;
    // a música nova entra devagar no seu próprio volume
    destino = ctx.createGain();
    destino.gain.setValueAtTime(0.0001, ctx.currentTime);
    destino.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.8);
    destino.connect(entradaMusica);
    const A = prepararParte(m.acordes, m.melodia);
    const B = m.parteB ? prepararParte(m.parteB.acordes, m.parteB.melodia) : null;
    // A, A (com flauta e sinos), B, A' ... assim o loop demora a se repetir igualzinho
    const ordem = B ? [A, A, B, A] : [A, A];
    const bateria = m.bateria.trim().split(/\s+/);
    const guitarraRitmo = m.guitarra ? m.guitarra.trim().split(/\s+/) : null;
    const colcheia = 60 / m.bpm / 2;
    proximoTempo = ctx.currentTime + 0.15;
    passo = 0;
    let volta = 0;
    let parte = ordem[0];
    relogio = setInterval(() => {
      while (proximoTempo < ctx.currentTime + 0.25) {
        const t0 = proximoTempo;
        if (passo >= parte.passos) {
          passo = 0;
          volta += 1;
          parte = ordem[volta % ordem.length];
        }
        const noLoop = passo;
        const variada = volta % 2 === 1;
        const { acordes, notas: melodia } = parte;
        const compasso = Math.floor(noLoop / 8);
        const noCompasso = noLoop % 8;
        const ultimoCompasso = compasso === acordes.length - 1;
        const acorde = acordes[compasso];
        const [raiz, , quinta] = notasDoAcorde(acorde, 2);
        const duracao = (i) => parte.dur[i] * colcheia;
        // cordas segurando o acorde do compasso; prato na volta do loop
        if (noCompasso === 0) {
          cordas(notasDoAcorde(acorde, 4), colcheia * 8, t0, m.cordas);
          if (compasso === 0) percussao("c", t0);
          // na volta variada, sinos tocam o acorde (nas lentas, também nas outras voltas)
          if (variada || m.bpm < 80) notasDoAcorde(acorde, 5).forEach((f, i) => sino(f, t0 + i * colcheia * 0.5, 0.014));
        }
        // a guitarra pesada das lutas, no ritmo da música (só depois da primeira volta, para crescer)
        if (guitarraRitmo && volta > 0) {
          const g = guitarraRitmo[noCompasso % guitarraRitmo.length];
          if (g === "x") guitarra(raiz, t0, colcheia * 0.55, 0.035);
          else if (g === "X") guitarra(raiz, t0, colcheia * 1.8, 0.04);
        }
        // baixo
        if (m.baixo === "galope") baixoOrquestra(noCompasso % 2 ? raiz * 2 : raiz, colcheia * 0.85, t0, 0.13);
        else if (m.baixo === "longo" && noCompasso === 0) baixoOrquestra(raiz, colcheia * 7.5, t0, 0.14);
        else if (m.baixo === "marcha" && [0, 3, 4, 6].includes(noCompasso)) baixoOrquestra(noCompasso === 6 ? quinta : raiz, colcheia * (noCompasso === 0 ? 2.8 : 1.5), t0, 0.14);
        // harpa em semicolcheias, subindo e descendo pelo acorde
        if (m.harpa) {
          const [a, b, c] = notasDoAcorde(acorde, m.harpa);
          const escala = [a, b, c, a * 2, c, b];
          for (let meia = 0; meia < 2; meia++) harpa(escala[(noCompasso * 2 + meia) % escala.length], t0 + meia * colcheia / 2, 0.045);
        }
        // cordas curtas nas batalhas: raiz e quinta alternando
        if (m.ostinato) staccato(noCompasso % 2 ? quinta * 2 : raiz * 2, t0, 0.05);
        // a melodia nos metais
        const nota = melodia[noLoop % melodia.length];
        if (nota !== "-" && nota !== ".") {
          const d = duracao(noLoop % melodia.length) * 0.95;
          metal(frequencia(nota), d, t0, m.metal * (variada ? 0.75 : 1));
          if (variada) flauta(frequencia(nota) * 2, d, t0, m.metal * 0.9);
        }
        // bateria; nas lutas, o último compasso de cada parte vira uma virada de caixa e tons
        const golpe = bateria[noCompasso % bateria.length];
        if (m.ostinato && ultimoCompasso && noCompasso >= 4) {
          percussao(noCompasso >= 6 ? "t" : "s", t0);
          percussao("s", t0 + colcheia / 2);
          if (noCompasso === 4) percussao("k", t0);
        } else if (golpe !== "-") percussao(golpe, t0);
        proximoTempo += colcheia;
        passo += 1;
      }
    }, 25);
  }

  function pararMusica() {
    clearInterval(relogio);
    relogio = null;
    musicaTocando = null;
    // a música que estava tocando some em meio segundo (as notas já marcadas somem junto)
    if (destino && ctx) {
      const velho = destino;
      velho.gain.cancelScheduledValues(ctx.currentTime);
      velho.gain.setValueAtTime(Math.max(0.0001, velho.gain.value), ctx.currentTime);
      velho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      setTimeout(() => velho.disconnect(), 3000);
    }
    destino = null;
  }

  function musica(nome) {
    musicaPedida = nome;
    if (!ctx) return; // toca assim que o navegador liberar o áudio
    if (nome === musicaTocando) return;
    if (!nome) return pararMusica();
    tocarMusica(nome);
  }

  // a música descansa quando a aba fica escondida
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });

  // ---------- ambiente, passos e falas ----------
  // O ambiente de cada lugar: um "chão" de ruído contínuo (vento, mar de lava, zumbido) mais sons soltos
  // que aparecem de vez em quando (pássaros, grilos, sapos, bolhas, sininhos). Tudo sintetizado, bem baixo,
  // passando pelo volume dos efeitos e pelo volume próprio do ambiente.
  const AMBIENTES = {
    campos: { vento: [700, 0.035], soltos: [["passaro", 1.6]] },
    floresta: { vento: [900, 0.045], soltos: [["folhas", 2.2], ["passaro", 4]] },
    pantano: { vento: [400, 0.03], soltos: [["sapo", 1.4], ["bolha", 0.9]] },
    deserto: { vento: [1100, 0.05], soltos: [["areia", 2.5]] },
    montanhas: { vento: [500, 0.07, true], soltos: [] },
    noite: { vento: [600, 0.025], soltos: [["grilo", 0.5], ["coruja", 9]] },
    chuva: { vento: [5000, 0.05], soltos: [["pingo", 0.12], ["trovao", 25]] },
    cinzas: { vento: [300, 0.05], drone: [55, 0.03], soltos: [["estalo", 0.35], ["bolha", 1.4]] },
    cristais: { vento: [1500, 0.02], soltos: [["sininho", 1.1]] },
    abismo: { vento: [350, 0.03], drone: [49, 0.035], soltos: [["bolha", 0.8]] },
    geleira: { vento: [550, 0.075, true], soltos: [["sininho", 5]] },
    trono: { vento: [250, 0.04, true], drone: [41, 0.05], soltos: [["sussurro", 3]] },
    fenda: { vento: [400, 0.035], drone: [62, 0.02], soltos: [["sussurro", 6], ["estalo", 3]] },
    academia: { vento: [300, 0.012], soltos: [["estalo", 1.8]] },
  };
  const SOLTOS = {
    passaro: (s) => { const base = 2400 + Math.random() * 1400; [0, 0.09, 0.2].forEach((q, i) => tom({ nota: base + i * 300, ate: base + 700, dur: 0.07, tipo: "sine", vol: 0.018, quando: q, saida: s })); },
    folhas: (s) => ruido({ dur: 0.6, vol: 0.03, filtro: "bandpass", freq: 2600, q: 0.6, saida: s }),
    sapo: (s) => { const n = 110 + Math.random() * 60; [0, 0.12].forEach((q) => tom({ nota: n, ate: n * 0.8, dur: 0.11, tipo: "square", vol: 0.02, quando: q, saida: s })); },
    bolha: (s) => tom({ nota: 300 + Math.random() * 300, ate: 900, dur: 0.06, tipo: "sine", vol: 0.025, saida: s }),
    areia: (s) => ruido({ dur: 1.2, vol: 0.025, filtro: "bandpass", freq: 1800, ate: 900, q: 0.8, saida: s }),
    grilo: (s) => [0, 0.05, 0.1].forEach((q) => tom({ nota: 4300 + Math.random() * 300, dur: 0.025, tipo: "sine", vol: 0.012, quando: q, saida: s })),
    coruja: (s) => [0, 0.35].forEach((q) => tom({ nota: 420, ate: 360, dur: 0.28, tipo: "sine", vol: 0.025, quando: q, saida: s })),
    estalo: (s) => ruido({ dur: 0.04, vol: 0.05, filtro: "highpass", freq: 3000, saida: s }),
    sininho: (s) => tom({ nota: 2200 + Math.floor(Math.random() * 4) * 330, dur: 0.6, tipo: "sine", vol: 0.016, saida: s }),
    sussurro: (s) => ruido({ dur: 1.4, vol: 0.03, filtro: "bandpass", freq: 700, ate: 1400, q: 3, saida: s }),
    pingo: (s) => tom({ nota: 1800 + Math.random() * 1600, ate: 900, dur: 0.03, tipo: "sine", vol: 0.012, saida: s }),
    trovao: (s) => ruido({ dur: 2.4, vol: 0.12, filtro: "lowpass", freq: 220, ate: 60, saida: s }),
  };
  let ambienteAtual = null;
  let camadaAmbiente = null;
  function ambiente(nome) {
    if (nome === ambienteAtual) return;
    ambienteAtual = nome;
    if (camadaAmbiente) {
      const velha = camadaAmbiente;
      velha.saida.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      clearInterval(velha.relogio);
      setTimeout(() => velha.nos.forEach((n) => { try { n.stop(); } catch { /* já parou */ } }), 1500);
      camadaAmbiente = null;
    }
    const a = AMBIENTES[nome];
    if (!ctx || !a) return;
    const saida = ctx.createGain();
    saida.gain.value = 0;
    saida.gain.setTargetAtTime(volumes.ambiente ?? 1, ctx.currentTime, 0.6);
    saida.connect(saidaEfeitos);
    const nos = [];
    // o vento: ruído passando por um filtro que respira devagar (com "uivo", o filtro sobe e desce mais)
    const [freq, vol, uiva] = a.vento;
    const fonte = ctx.createBufferSource();
    fonte.buffer = ruidoBuffer;
    fonte.loop = true;
    const filtro = ctx.createBiquadFilter();
    filtro.type = uiva ? "bandpass" : "lowpass";
    filtro.frequency.value = freq;
    filtro.Q.value = uiva ? 6 : 0.7;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = uiva ? 0.13 : 0.07;
    const profundidade = ctx.createGain();
    profundidade.gain.value = freq * (uiva ? 0.6 : 0.35);
    lfo.connect(profundidade).connect(filtro.frequency);
    const ganho = ctx.createGain();
    ganho.gain.value = vol;
    fonte.connect(filtro).connect(ganho).connect(saida);
    fonte.start();
    lfo.start();
    nos.push(fonte, lfo);
    // o zumbido grave dos lugares tomados pelo Vazio
    if (a.drone) {
      const [f, v] = a.drone;
      [f, f * 1.5].forEach((nota, i) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = nota;
        const g = ctx.createGain();
        g.gain.value = v / (i + 1);
        o.connect(g).connect(saida);
        o.start();
        nos.push(o);
      });
    }
    // os sons soltos, sorteados a cada fração de segundo conforme a frequência de cada um
    const relogio = setInterval(() => {
      if (volumes.mudo || document.hidden) return;
      a.soltos.forEach(([som, media]) => { if (Math.random() < 0.25 / media) SOLTOS[som](saida); });
    }, 250);
    camadaAmbiente = { saida, nos, relogio };
  }

  // o passo do herói, conforme o chão
  const PASSOS = {
    grama: () => ruido({ dur: 0.07, vol: 0.035, filtro: "lowpass", freq: 900 }),
    pedra: () => { ruido({ dur: 0.03, vol: 0.04, filtro: "bandpass", freq: 2200, q: 2 }); tom({ nota: 140, dur: 0.03, tipo: "sine", vol: 0.03 }); },
    neve: () => ruido({ dur: 0.1, vol: 0.04, filtro: "highpass", freq: 2500 }),
    areia: () => ruido({ dur: 0.09, vol: 0.03, filtro: "bandpass", freq: 1400, q: 0.7 }),
    madeira: () => tom({ nota: 190, ate: 150, dur: 0.05, tipo: "triangle", vol: 0.05 }),
    lama: () => ruido({ dur: 0.12, vol: 0.04, filtro: "lowpass", freq: 450, ate: 250 }),
  };
  let ultimoPasso = 0;
  function passoDoHeroi(chao = "grama") {
    if (!ctx || volumes.mudo || !PASSOS[chao]) return;
    const agora = ctx.currentTime;
    if (agora - ultimoPasso < 0.22) return;
    ultimoPasso = agora;
    PASSOS[chao]();
  }

  // o "blip" do texto aparecendo nas falas: cada personagem tem a sua altura de voz
  let ultimoBlip = 0;
  function blip(voz = 1) {
    if (!ctx || volumes.mudo) return;
    const agora = ctx.currentTime;
    if (agora - ultimoBlip < 0.045) return;
    ultimoBlip = agora;
    tom({ nota: 520 * voz * (0.94 + Math.random() * 0.12), dur: 0.03, tipo: "square", vol: 0.022 });
  }

  return {
    efeito,
    musica,
    ambiente,
    passo: passoDoHeroi,
    blip,
    volumes: () => ({ ...volumes }),
    ajustar(novos) {
      volumes = { ...volumes, ...novos };
      aplicarVolumes();
      if (camadaAmbiente && ctx) camadaAmbiente.saida.gain.setTargetAtTime(volumes.ambiente ?? 1, ctx.currentTime, 0.2);
      guardar();
    },
  };
})();
