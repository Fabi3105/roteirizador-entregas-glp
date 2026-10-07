"use strict";
/* Roteirizador de entregas: cadastro, leitura de arquivo, otimização (VRP com capacidade), mapa e relatório.
   Tudo roda no navegador. Serviços externos (opcionais, com reserva): mapa e endereços do OpenStreetMap, rotas do OSRM. */

const CORES = ["#1B365D", "#D9713C", "#1a98b3", "#7a4fb5", "#2e8b57", "#c2378a", "#8a6d00", "#5b6470"];
const KM_H_RESERVA = 25, FATOR_RUA = 1.35, LIMITE_OSRM = 100, ESPERA_ENDERECO = 1100;
const OSRM = "https://router.project-osrm.org", NOMINATIM = "https://nominatim.openstreetmap.org/search";
const XLSX_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";

const $ = id => document.getElementById(id);
const num = (v, d = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const semAcento = t => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const coordValida = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
const paraNumero = v => { if (v == null || v === "") return NaN; const n = Number(String(v).trim().replace(/\s/g, "").replace(",", ".")); return n; };
const hhmm = min => { const m = Math.round(min); return String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
const duracao = min => { const m = Math.round(min); return m < 60 ? m + " min" : Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0") + " min"; };

let proximoId = 1;
const estado = {
  deposito: { nome: "Depósito", lat: NaN, lon: NaN },
  veiculos: [], entregas: [], resultado: null, modoMapa: null,
};

/* ================= Dados de exemplo (simulados) ================= */
const EXEMPLO = {
  deposito: { nome: "Depósito (exemplo)", lat: -29.25110, lon: -51.52475 },
  veiculos: [["Caminhão 1", 35], ["Caminhão 2", 25], ["Utilitário", 15]],
  // cliente, rua, número, bairro, cidade, lat, lon, botijões, hora marcada (opcional).
  // Clientes, números e pedidos inventados; os pontos foram sorteados sobre ruas de Garibaldi e Carlos Barbosa.
  // As coordenadas já vêm preenchidas para o exemplo abrir na hora; os três últimos mostram a busca pelo endereço.
  entregas: [
    ["Cliente 01", "", "", "", "Garibaldi", -29.24516, -51.52313, 1], ["Cliente 02", "Rua Buarque de Macedo", "2140", "Centro", "Garibaldi", -29.25483, -51.53083, 2],
    ["Cliente 03", "Rua 13 de Maio", "310", "", "Garibaldi", -29.25820, -51.53472, 1], ["Cliente 04", "Rua Hércules Grossi", "95", "", "Garibaldi", -29.25628, -51.53325, 1],
    ["Restaurante 05", "Rua Florgentino Palhano Ribeiro", "480", "", "Garibaldi", -29.25185, -51.52315, 6, "10:00"], ["Cliente 06", "Rua Ernesto Alves", "222", "", "Garibaldi", -29.25904, -51.53678, 1],
    ["Cliente 07", "", "", "", "Garibaldi", -29.26000, -51.52525, 2], ["Cliente 08", "Rua Vicente Faraon", "71", "", "Garibaldi", -29.25842, -51.52171, 1],
    ["Cliente 09", "", "", "", "Garibaldi", -29.26549, -51.52879, 1], ["Cliente 10", "Rua Alencar Araripe", "655", "", "Garibaldi", -29.25220, -51.53220, 2],
    ["Padaria 11", "Rua Assis Brasil", "128", "", "Garibaldi", -29.25343, -51.52137, 4], ["Cliente 12", "Rua João Prancutti", "340", "", "Garibaldi", -29.24248, -51.52758, 1],
    ["Cliente 13", "Rua Vicente Dal Bó", "57", "", "Garibaldi", -29.26034, -51.52319, 1], ["Cliente 14", "Rua Antônio Bonadiman", "912", "", "Garibaldi", -29.26734, -51.53671, 2],
    ["Cliente 15", "Rua General Osório", "45", "Centro", "Garibaldi", -29.25823, -51.52695, 1], ["Lancheria 16", "Rua Manoel Peterlongo Filho", "210", "", "Garibaldi", -29.25926, -51.52764, 5],
    ["Cliente 17", "Rua Quinze de Novembro", "830", "", "Garibaldi", -29.25959, -51.53988, 1], ["Cliente 18", "", "", "", "Garibaldi", -29.26371, -51.53410, 1],
    ["Cliente 19", "Rua João Prancutti", "398", "", "Garibaldi", -29.24248, -51.52692, 2], ["Cliente 20", "Rua Florgentino Palhano Ribeiro", "190", "", "Garibaldi", -29.25345, -51.52417, 1],
    ["Cliente 21", "Rua Doutor Carlos Barbosa", "33", "Centro", "Garibaldi", -29.25373, -51.53185, 1], ["Cliente 22", "Rua Irmã Dorothee", "140", "", "Garibaldi", -29.26477, -51.52924, 3],
    ["Cliente 23", "Rua Pinheiro Machado", "505", "", "Garibaldi", -29.25586, -51.53955, 1], ["Cliente 24", "Rua João Ludovico Salvador", "88", "", "Garibaldi", -29.25481, -51.52239, 1],
    ["Hotel 25", "Rua Frei Nicolau Lucian", "600", "", "Garibaldi", -29.26448, -51.51451, 8, "11:00"], ["Cliente 26", "Rua Irmã Camila Parmagnani", "75", "", "Carlos Barbosa", -29.30414, -51.50166, 1],
    ["Cliente 27", "Rua Júlio de Castilhos", "1020", "", "Carlos Barbosa", -29.30112, -51.49938, 2], ["Cliente 28", "Rua 21 de Abril", "64", "", "Carlos Barbosa", -29.28977, -51.49932, 1],
    ["Cliente 29", "", "", "", "Carlos Barbosa", -29.29516, -51.49352, 1], ["Refeitório 30", "Rua Elisa Tramontina", "300", "", "Carlos Barbosa", -29.29294, -51.50359, 10, "09:00"],
    ["Cliente 31", "Rua Cristóvão Colombo", "415", "", "Carlos Barbosa", -29.29977, -51.49683, 1], ["Cliente 32", "Rua Imigrantes", "52", "", "Carlos Barbosa", -29.30566, -51.50005, 2],
    ["Cliente 33", "Rua Princesa Isabel", "230", "", "Carlos Barbosa", -29.29443, -51.49630, 1], ["Cliente 34", "Rua Pinheiro Machado", "118", "", "Carlos Barbosa", -29.29252, -51.50670, 1],
    ["Cliente 35", "Rua 15 de Novembro", "77", "Centro", "Carlos Barbosa", -29.29701, -51.50474, 3], ["Cliente 36", "Rua Walter Jobim", "260", "", "Carlos Barbosa", -29.29858, -51.50596, 1],
    ["Mercado 37", "Avenida Ivo Tramontina", "1500", "", "Carlos Barbosa", -29.29468, -51.50058, 6], ["Cliente 38", "Rua Verona", "39", "", "Carlos Barbosa", -29.30478, -51.49934, 1],
    ["Cliente 39", "Avenida Presidente Kennedy", "700", "", "Carlos Barbosa", -29.29891, -51.49783, 2],
    ["Cliente 40", "Rua Júlio de Castilhos", "120", "Centro", "Garibaldi", NaN, NaN, 2], ["Cliente 41", "Rua Buarque de Macedo", "3300", "Centro", "Garibaldi", NaN, NaN, 1],
    ["Cliente 42", "Rua Rio Branco", "85", "", "Carlos Barbosa", NaN, NaN, 2],
  ],
};

function novaEntrega(dados) {
  return Object.assign({ id: proximoId++, cliente: "", rua: "", numero: "", bairro: "", cidade: "", hora: "", lat: NaN, lon: NaN, qtd: 1, origem: "" }, dados);
}
function enderecoTexto(e) {
  const rua = [e.rua, e.numero].filter(Boolean).join(", ");
  return [rua, e.bairro, e.cidade].filter(Boolean).join(" · ");
}
function carregarExemplo() {
  estado.deposito = { ...EXEMPLO.deposito };
  estado.veiculos = EXEMPLO.veiculos.map(([nome, cap]) => ({ id: proximoId++, nome, cap, ativo: true }));
  estado.entregas = EXEMPLO.entregas.map(([cliente, rua, numero, bairro, cidade, lat, lon, qtd, hora]) => novaEntrega({ cliente, rua, numero, bairro, cidade, lat, lon, qtd, hora: hora || "", origem: coordValida(lat, lon) ? "coord" : "" }));
  estado.resultado = null;
  desenharTudo();
}

/* ================= Leitura de arquivo ================= */
const CAMPOS = {
  cliente: ["cliente", "nome", "razao social", "destinatario"],
  rua: ["rua", "logradouro", "endereco", "endereço", "address", "avenida"],
  numero: ["numero", "número", "num", "nº", "n", "no"],
  bairro: ["bairro"],
  cidade: ["cidade", "municipio", "município"],
  qtd: ["qtd", "quantidade", "botijoes", "botijões", "qtde", "volume", "p13"],
  lat: ["lat", "latitude"], lon: ["lon", "lng", "long", "longitude"],
  coord: ["coordenada", "coordenadas", "localizacao", "localização"],
  hora: ["hora", "horario", "horário", "hora marcada", "agendado", "agendamento", "hora_marcada"],
};
/* Aceita "-29.2562, -51.5269", "-29,2562; -51,5269" e links de mapa que tragam a coordenada. */
/* Aceita "9:30", "09h30", "14h", "14" e devolve "HH:MM" (ou "" se não for hora). */
function lerHora(texto) {
  const m = String(texto || "").trim().toLowerCase().match(/^(\d{1,2})\s*(?:[:h]\s*(\d{2})?)?\s*(?:min|hs|h)?$/);
  if (!m) return "";
  const h = +m[1], min = +(m[2] || 0);
  return h < 24 && min < 60 ? String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0") : "";
}
const minutosDe = hhmmTexto => { const [h, m] = hhmmTexto.split(":").map(Number); return h * 60 + m; };
function lerCoordenada(texto) {
  const t = String(texto || "");
  let m = t.match(/(-?\d{1,2}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)/) || t.match(/(-?\d{1,2},\d+)\s*[;\s]\s*(-?\d{1,3},\d+)/);
  if (!m) return null;
  const lat = paraNumero(m[1]), lon = paraNumero(m[2]);
  return coordValida(lat, lon) ? { lat, lon } : null;
}
function separarLinha(linha, sep) {
  const out = []; let atual = "", aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') { if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas; }
    else if (c === sep && !aspas) { out.push(atual); atual = ""; }
    else atual += c;
  }
  out.push(atual); return out.map(v => v.trim());
}
function textoParaLinhas(texto) {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim() !== "");
  if (!linhas.length) return [];
  const conta = s => (linhas[0].match(new RegExp("\\" + s, "g")) || []).length;
  const sep = conta(";") >= conta("\t") && conta(";") >= conta(",") && conta(";") > 0 ? ";" : conta("\t") > conta(",") ? "\t" : ",";
  return linhas.map(l => separarLinha(l, sep));
}
function linhasParaEntregas(linhas) {
  if (!linhas.length) return { entregas: [], avisos: ["O arquivo está vazio."] };
  const cab = linhas[0].map(semAcento), mapa = {};
  for (const campo in CAMPOS) mapa[campo] = cab.findIndex(c => CAMPOS[campo].map(semAcento).includes(c));
  const temCabecalho = Object.values(mapa).some(i => i >= 0);
  if (!temCabecalho) Object.assign(mapa, { cliente: 0, rua: 1, numero: 2, bairro: 3, cidade: 4, qtd: 5 });   // ordem do modelo
  const entregas = [], avisos = [];
  linhas.slice(temCabecalho ? 1 : 0).forEach((l, i) => {
    const pega = campo => mapa[campo] >= 0 && mapa[campo] < l.length ? String(l[mapa[campo]] || "").trim() : "";
    let lat = paraNumero(pega("lat")), lon = paraNumero(pega("lon"));
    const solta = lerCoordenada(pega("coord"));
    if (!coordValida(lat, lon) && solta) { lat = solta.lat; lon = solta.lon; }
    const qtdLida = paraNumero(pega("qtd")), tem = coordValida(lat, lon);
    const e = novaEntrega({ cliente: pega("cliente") || "Entrega " + (entregas.length + 1), rua: pega("rua"), numero: pega("numero"), bairro: pega("bairro"), cidade: pega("cidade"), hora: lerHora(pega("hora")),
      lat: tem ? lat : NaN, lon: tem ? lon : NaN, qtd: Number.isFinite(qtdLida) && qtdLida > 0 ? Math.round(qtdLida) : 1, origem: tem ? "coord" : "" });
    if (!e.rua && !tem) { avisos.push(`Linha ${i + (temCabecalho ? 2 : 1)}: sem rua e sem coordenada, ignorada.`); return; }
    entregas.push(e);
  });
  return { entregas, avisos };
}
function carregarScript(url) {
  return new Promise((ok, erro) => { const s = document.createElement("script"); s.src = url; s.onload = ok; s.onerror = () => erro(new Error("biblioteca indisponível")); document.head.appendChild(s); });
}
async function lerArquivo(arquivo) {
  if (/\.xlsx?$/i.test(arquivo.name)) {
    if (!window.XLSX) await carregarScript(XLSX_URL);
    const livro = window.XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
    return window.XLSX.utils.sheet_to_json(livro.Sheets[livro.SheetNames[0]], { header: 1, raw: true, defval: "" }).filter(l => l.some(c => String(c).trim() !== "")).map(l => l.map(c => String(c)));
  }
  return textoParaLinhas(await arquivo.text());
}

/* ================= Distâncias ================= */
function linhaReta(a, b) {
  const R = 6371, rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
async function buscar(url, ms = 15000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
/* Devolve { km[i][j], min[i][j], fonte }. Tenta as ruas reais (OSRM); se falhar, linha reta com fator. */
async function matriz(pontos, usarRuas) {
  const n = pontos.length;
  if (usarRuas && n <= LIMITE_OSRM) {
    try {
      const coords = pontos.map(p => p.lon.toFixed(6) + "," + p.lat.toFixed(6)).join(";");
      const r = await buscar(`${OSRM}/table/v1/driving/${coords}?annotations=duration,distance`);
      if (r.code === "Ok" && r.durations.length === n && r.durations.every(l => l.every(v => v != null)))
        return { km: r.distances.map(l => l.map(v => v / 1000)), min: r.durations.map(l => l.map(v => v / 60)), fonte: "ruas" };
    } catch (e) { /* cai para a reserva */ }
  }
  const km = pontos.map(a => pontos.map(b => linhaReta(a, b) * FATOR_RUA));
  return { km, min: km.map(l => l.map(v => v / KM_H_RESERVA * 60)), fonte: usarRuas && n > LIMITE_OSRM ? "reta-limite" : "reta" };
}

/* ================= Otimização =================
   Problema: dividir as entregas entre os veículos (respeitando a capacidade) e ordenar cada rota.
   Nos dois modos cada veículo fica com um território, para as rotas não se cruzarem.

   1. Agrupamento com capacidade (k-medoides): um grupo por viagem, cada entrega no grupo do centro mais
      próximo em que ainda cabe. Os centros são recalculados até estabilizar. Vários pontos de partida são
      testados e fica o melhor.
   2. Cada grupo vira uma rota, ordenada por inserção mais barata e melhorada por 2-opt e remanejamento.
   3. Ajuste nas divisas, que é onde os modos diferem:
      - "regiao" (menor quilometragem): uma entrega só troca de veículo se o total diminuir sem alongar a
        rota mais comprida.
      - "tempo" (menor tempo de entrega): uma entrega troca de veículo se isso encurtar o mais demorado dos
        dois. O trabalho fica dividido por igual e a última entrega sai mais cedo, ao custo de alguns km.

   Custo de uma rota = minutos dirigindo + minutos parado. */
function tempoRota(rota, M, parada, retorno) {
  if (!rota.length) return 0;
  let t = M[0][rota[0]];
  for (let i = 1; i < rota.length; i++) t += M[rota[i - 1]][rota[i]];
  if (retorno) t += M[rota[rota.length - 1]][0];
  return t + parada * rota.length;
}
/* Custo de uma rota para a otimização: duração (com esperas) mais multa por atraso em hora marcada.
   o.janelas[i] = [mais cedo, mais tarde] em minutos do dia, ou nada. Chegar cedo espera; chegar tarde custa caro. */
const MULTA_ATRASO = 30, MULTA_POR_MINUTO = 10;
function custoRota(rota, M, o, inicio) {
  if (!rota.length) return 0;
  if (!o.janelas) return tempoRota(rota, M, o.parada, o.retorno);
  let t = inicio, multa = 0, ant = 0;
  for (const i of rota) {
    t += M[ant][i];
    const j = o.janelas[i];
    if (j) { if (t < j[0]) t = j[0]; else if (t > j[1]) multa += MULTA_ATRASO + MULTA_POR_MINUTO * (t - j[1]); }
    t += o.parada; ant = i;
  }
  if (o.retorno) t += M[ant][0];
  return t - inicio + multa;
}
const soma = v => v.reduce((s, x) => s + x, 0), maior = v => v.reduce((m, x) => Math.max(m, x), 0);

/* Busca local. dono[i] diz a que veículo pertence a rota i (um veículo pode ter mais de uma viagem). */
function melhorar(rotas, M, demanda, capacidades, opcoes, modo, dono) {
  dono = dono || rotas.map((_, i) => i);
  const { recarga = 0 } = opcoes, saida = opcoes.saida || 0, nv = rotas.length, EPS = 1e-6;
  // hora em que cada viagem começa: as viagens seguintes do mesmo veículo saem depois das anteriores e da recarga
  const inicio = rotas.map(() => saida);
  const T = (r, i) => custoRota(r, M, opcoes, inicio[i]);
  const tempos = rotas.map((r, i) => T(r, i));
  const acertarInicios = () => {
    if (!opcoes.janelas) return;
    const fim = {};
    for (let i = 0; i < nv; i++) { if (!rotas[i].length) continue; const v = dono[i]; inicio[i] = fim[v] === undefined ? saida : fim[v] + recarga; tempos[i] = T(rotas[i], i); fim[v] = inicio[i] + tempos[i]; }
  };
  acertarInicios();
  const carga = rotas.map(r => soma(r.map(i => demanda[i])));
  // tempo de um veículo: soma das suas viagens mais as recargas entre elas
  const TV = v => { let t = 0, n = 0; for (let i = 0; i < nv; i++) if (dono[i] === v && rotas[i].length) { t += tempos[i]; n++; } return t + recarga * Math.max(0, n - 1); };
  let melhorou = true, voltas = 0;
  while (melhorou && voltas++ < 200) {
    melhorou = false; acertarInicios();
    // dentro da rota: inverter um trecho (2-opt) e mudar uma entrega de posição
    for (let a = 0; a < nv; a++) {
      for (let i = 0; i < rotas[a].length - 1; i++) for (let j = i + 1; j < rotas[a].length; j++) {
        const nova = rotas[a].slice(0, i).concat(rotas[a].slice(i, j + 1).reverse(), rotas[a].slice(j + 1)), t = T(nova, a);
        if (t < tempos[a] - EPS) { rotas[a] = nova; tempos[a] = t; melhorou = true; }
      }
      for (let i = 0; i < rotas[a].length; i++) {
        const no = rotas[a][i], sem = rotas[a].slice(0, i).concat(rotas[a].slice(i + 1));
        let melhor = null;
        for (let p = 0; p <= sem.length; p++) { if (p === i) continue; const nova = sem.slice(0, p).concat([no], sem.slice(p)), t = T(nova, a); if (t < tempos[a] - EPS && (!melhor || t < melhor.t)) melhor = { nova, t }; }
        if (melhor) { rotas[a] = melhor.nova; tempos[a] = melhor.t; melhorou = true; }
      }
    }
    if (modo === "ordem") continue;                              // só reordena dentro de cada rota
    // entre rotas: mover uma entrega
    for (let a = 0; a < nv; a++) for (let ia = 0; ia < rotas[a].length; ia++) {
      const no = rotas[a][ia], semNo = rotas[a].slice(0, ia).concat(rotas[a].slice(ia + 1)), tSem = T(semNo, a), teto = maior(tempos);
      if (!semNo.length) continue;                               // não esvazia uma viagem
      let melhor = null;
      for (let b = 0; b < nv; b++) {
        if (b === a || carga[b] + demanda[no] > capacidades[b]) continue;
        const mesmo = dono[a] === dono[b], va = TV(dono[a]), vb = TV(dono[b]);
        for (let p = 0; p <= rotas[b].length; p++) {
          const nova = rotas[b].slice(0, p).concat([no], rotas[b].slice(p)), tb = T(nova, b), ganho = tempos[a] + tempos[b] - tSem - tb;
          let nota;
          if (modo === "tempo" && !mesmo) {
            const antes = Math.max(va, vb), depois = Math.max(va - tempos[a] + tSem, vb - tempos[b] + tb + (rotas[b].length ? 0 : recarga));
            if (!(depois < antes - EPS || (depois <= antes + EPS && ganho > EPS))) continue;
            nota = (antes - depois) * 1000 + ganho;
          } else {
            if (ganho <= EPS || Math.max(tSem, tb) > teto + EPS) continue;
            nota = ganho;
          }
          if (!melhor || nota > melhor.nota) melhor = { b, nova, tb, nota };
        }
      }
      if (melhor) {
        rotas[a] = semNo; tempos[a] = tSem; rotas[melhor.b] = melhor.nova; tempos[melhor.b] = melhor.tb;
        carga[a] -= demanda[no]; carga[melhor.b] += demanda[no]; melhorou = true; ia--;
      }
    }
    // entre rotas: trocar duas entregas
    for (let a = 0; a < nv; a++) for (let b = a + 1; b < nv; b++) for (let ia = 0; ia < rotas[a].length; ia++) for (let ib = 0; ib < rotas[b].length; ib++) {
      const x = rotas[a][ia], y = rotas[b][ib];
      if (carga[a] - demanda[x] + demanda[y] > capacidades[a] || carga[b] - demanda[y] + demanda[x] > capacidades[b]) continue;
      const teto = maior(tempos), mesmo = dono[a] === dono[b], va = TV(dono[a]), vb = TV(dono[b]);
      rotas[a][ia] = y; rotas[b][ib] = x; const ta = T(rotas[a], a), tb = T(rotas[b], b), ganho = tempos[a] + tempos[b] - ta - tb;
      let aceita;
      if (modo === "tempo" && !mesmo) { const antes = Math.max(va, vb), depois = Math.max(va - tempos[a] + ta, vb - tempos[b] + tb); aceita = depois < antes - EPS || (depois <= antes + EPS && ganho > EPS); }
      else aceita = ganho > EPS && Math.max(ta, tb) <= teto + EPS;
      if (aceita) { tempos[a] = ta; tempos[b] = tb; carga[a] += demanda[y] - demanda[x]; carga[b] += demanda[x] - demanda[y]; melhorou = true; }
      else { rotas[a][ia] = x; rotas[b][ib] = y; }
    }
  }
  return tempos;
}

/* Ordena as entregas de um grupo por inserção mais barata. */
function rotaPorInsercao(nos, M, opcoes) {
  let rota = [];
  const T = r => custoRota(r, M, opcoes, opcoes.saida || 0);
  const faltam = nos.slice().sort((a, b) => M[0][b] - M[0][a]);     // começa pelos mais distantes do depósito
  for (const no of faltam) {
    let melhor = null;
    for (let p = 0; p <= rota.length; p++) { const nova = rota.slice(0, p).concat([no], rota.slice(p)), t = T(nova); if (!melhor || t < melhor.t) melhor = { nova, t }; }
    rota = melhor.nova;
  }
  return rota;
}

/* Agrupa as entregas em torno de centros, um grupo por veículo, respeitando a capacidade. */
function agrupar(D, demanda, capacidades, sementes) {
  const n = demanda.length - 1, k = sementes.length;
  let centros = sementes.slice(), grupos = [], veiculoDoGrupo = [], fora = [];
  for (let volta = 0; volta < 20; volta++) {
    // o grupo que naturalmente pede mais carga fica com o veículo maior
    const natural = centros.map(() => 0);
    for (let i = 1; i <= n; i++) { let m = 0; for (let c = 1; c < k; c++) if (D[i][centros[c]] < D[i][centros[m]]) m = c; natural[m] += demanda[i]; }
    const ordemGrupos = natural.map((d, c) => c).sort((a, b) => natural[b] - natural[a]);
    const ordemVeiculos = capacidades.map((c, v) => v).sort((a, b) => capacidades[b] - capacidades[a]);
    veiculoDoGrupo = []; ordemGrupos.forEach((c, pos) => { veiculoDoGrupo[c] = ordemVeiculos[pos]; });
    // quem tem mais a perder escolhe primeiro
    const itens = [];
    for (let i = 1; i <= n; i++) { const d = centros.map(c => D[i][c]).sort((a, b) => a - b); itens.push({ i, pressa: (d.length > 1 ? d[1] - d[0] : 0) + demanda[i] * 1e-3 }); }
    itens.sort((a, b) => b.pressa - a.pressa);
    grupos = centros.map(() => []); fora = [];
    const livre = centros.map((_, c) => capacidades[veiculoDoGrupo[c]]);
    for (const { i } of itens) {
      const ordem = centros.map((_, c) => c).sort((a, b) => D[i][centros[a]] - D[i][centros[b]]), c = ordem.find(g => livre[g] >= demanda[i]);
      if (c === undefined) fora.push(i); else { grupos[c].push(i); livre[c] -= demanda[i]; }
    }
    const novos = grupos.map((g, c) => {
      if (!g.length) return centros[c];
      let melhor = g[0], custo = Infinity;
      for (const cand of g) { let s = 0; for (const j of g) s += D[cand][j]; if (s < custo) { custo = s; melhor = cand; } }
      return melhor;
    });
    if (novos.every((c, i) => c === centros[i])) break;
    centros = novos;
  }
  return { grupos, veiculoDoGrupo, fora };
}

/* Minutos de atraso (em hora marcada) de uma rota que sai no minuto "inicio", e a hora em que ela termina. */
function simularRota(rota, M, o, inicio) {
  let t = inicio, atraso = 0, ant = 0;
  for (const i of rota) {
    t += M[ant][i];
    const j = o.janelas && o.janelas[i];
    if (j) { if (t < j[0]) t = j[0]; else if (t > j[1]) atraso += t - j[1]; }
    t += o.parada; ant = i;
  }
  return { fim: rota.length ? t + M[ant][0] : inicio, atraso };
}
/* Para veículos com mais de uma viagem: põe as viagens na ordem de menor atraso. Devolve o atraso que sobra. */
function ordenarViagens(rotas, dono, M, o) {
  let atrasoTotal = 0;
  for (const v of new Set(dono)) {
    const idx = dono.map((d, i) => d === v && rotas[i].length ? i : -1).filter(i => i >= 0);
    const avaliar = ordem => { let t = o.saida || 0, atraso = 0; ordem.forEach((r, k) => { if (k) t += o.recarga || 0; const s = simularRota(r, M, o, t); atraso += s.atraso; t = s.fim; }); return { atraso, fim: t }; };
    let melhor = { ordem: idx.map(i => rotas[i]), ...avaliar(idx.map(i => rotas[i])) };
    if (idx.length > 1 && idx.length <= 5) for (const ordem of permutacoes(idx.map(i => rotas[i]))) {
      const a = avaliar(ordem);
      if (a.atraso < melhor.atraso - 1e-6 || (Math.abs(a.atraso - melhor.atraso) <= 1e-6 && a.fim < melhor.fim - 1e-6)) melhor = { ordem, ...a };
    }
    idx.forEach((i, k) => { rotas[i] = melhor.ordem[k]; });
    atrasoTotal += melhor.atraso;
  }
  return atrasoTotal;
}

function porRegiao(M, demanda, capacidades, opcoes) {
  const n = M.length - 1, nv = capacidades.length, k = Math.min(nv, n);
  const D = M.map((l, i) => l.map((v, j) => (v + M[j][i]) / 2));     // distância simétrica entre pontos
  let semente = 12345; const sorteio = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
  let melhor = null;
  for (let tentativa = 0; tentativa < 12; tentativa++) {
    // pontos de partida bem espalhados: o primeiro varia, os outros são os mais distantes dos já escolhidos
    const sementes = [];
    if (tentativa === 0) { let far = 1; for (let i = 2; i <= n; i++) if (D[0][i] > D[0][far]) far = i; sementes.push(far); }
    else sementes.push(1 + Math.floor(sorteio() * n));
    while (sementes.length < k) {
      let prox = -1, dist = -1;
      for (let i = 1; i <= n; i++) { if (sementes.includes(i)) continue; const d = Math.min(...sementes.map(s => D[i][s])); if (d > dist) { dist = d; prox = i; } }
      sementes.push(prox);
    }
    const { grupos, veiculoDoGrupo, fora } = agrupar(D, demanda, capacidades, sementes);
    const rotas = capacidades.map(() => []);
    // a divisão por região é feita sem olhar as horas marcadas; elas entram depois, na ordem das paradas
    const semHora = { ...opcoes, janelas: null };
    grupos.forEach((g, c) => { rotas[veiculoDoGrupo[c]] = rotaPorInsercao(g, M, semHora); });
    // o que não coube no grupo mais próximo tenta entrar em qualquer veículo com espaço
    const carga = rotas.map(r => soma(r.map(i => demanda[i]))), sobra = [];
    for (const i of fora) {
      let escolha = null;
      for (let v = 0; v < nv; v++) {
        if (carga[v] + demanda[i] > capacidades[v]) continue;
        const antes = custoRota(rotas[v], M, semHora, opcoes.saida || 0);
        for (let p = 0; p <= rotas[v].length; p++) { const nova = rotas[v].slice(0, p).concat([i], rotas[v].slice(p)), custo = custoRota(nova, M, semHora, opcoes.saida || 0) - antes; if (!escolha || custo < escolha.custo) escolha = { v, nova, custo }; }
      }
      if (escolha) { rotas[escolha.v] = escolha.nova; carga[escolha.v] += demanda[i]; } else sobra.push(i);
    }
    const modo = opcoes.modo === "tempo" ? "tempo" : "regiao", dono = opcoes.dono || rotas.map((_, i) => i);
    const tempos = melhorar(rotas, M, demanda, capacidades, semHora, modo, dono);
    const porVeiculo = {}; tempos.forEach((t, i) => { if (rotas[i].length) porVeiculo[dono[i]] = (porVeiculo[dono[i]] === undefined ? 0 : porVeiculo[dono[i]] + (opcoes.recarga || 0)) + t; });
    const demorado = maior(Object.values(porVeiculo));
    // "regiao": menor tempo total, com leve preferência por dividir o trabalho. "tempo": termina mais cedo.
    const nota = (modo === "tempo" ? demorado + 0.05 * soma(tempos) : soma(tempos) + 0.4 * maior(tempos)) + sobra.length * 1e6;
    if (!melhor || nota < melhor.nota - 1e-6) melhor = { rotas, fora: sobra, nota };
  }
  if (opcoes.janelas) {
    // Horas marcadas entram depois de definida a divisão por região.
    const rotas = melhor.rotas, modo = opcoes.modo === "tempo" ? "tempo" : "regiao", dono = opcoes.dono || rotas.map((_, i) => i);
    // 1º: cada entrega fica no seu veículo; muda só a ordem das paradas e das viagens
    ordenarViagens(rotas, dono, M, opcoes); melhorar(rotas, M, demanda, capacidades, opcoes, "ordem", dono);
    const atraso = ordenarViagens(rotas, dono, M, opcoes);
    melhorar(rotas, M, demanda, capacidades, opcoes, "ordem", dono);
    // 2º: só se ainda sobrar atraso, a entrega pode passar para outro veículo
    if (atraso > 0.5) { melhorar(rotas, M, demanda, capacidades, opcoes, modo, dono); ordenarViagens(rotas, dono, M, opcoes); melhorar(rotas, M, demanda, capacidades, opcoes, "ordem", dono); }
  }
  return { rotas: melhor.rotas, fora: melhor.fora };
}

function otimizar(M, demanda, capacidades, opcoes) { return porRegiao(M, demanda, capacidades, opcoes); }

/* Hora em que o veículo mais demorado termina, em minutos desde a saída (viagens mais recargas). */
function tempoDoMaisDemorado(rotas, dono, M, opcoes) {
  const porVeiculo = {};
  rotas.forEach((r, i) => { if (!r.length) return; const v = dono[i]; porVeiculo[v] = (porVeiculo[v] === undefined ? 0 : porVeiculo[v] + (opcoes.recarga || 0)) + tempoRota(r, M, opcoes.parada, true); });
  return maior(Object.values(porVeiculo));
}

/* Viagens com recarga: quando os pedidos passam da capacidade, um veículo volta ao depósito, recarrega e sai
   de novo. Cada viagem extra é testada em cada veículo e fica com o que deixar menos entregas de fora e, no
   empate, rodar menos quilômetros (modo "regiao") ou terminar mais cedo (modo "tempo").
   Devolve as rotas (uma por viagem) e o veículo de cada uma. */
function planejarViagens(M, K, demanda, capacidades, opcoes, permitirRecarga) {
  let caps = capacidades.slice(), dono = capacidades.map((_, v) => v), sol = otimizar(M, demanda, caps, opcoes);
  const porTempo = opcoes.modo === "tempo";
  const kmTotal = (rotas, donos) => {
    let km = 0;
    capacidades.forEach((_, v) => { const minhas = rotas.filter((r, i) => donos[i] === v && r.length); minhas.forEach((r, j) => { km += kmRota(r, K, j < minhas.length - 1 || opcoes.retorno); }); });
    return km;
  };
  const maiorCap = Math.max(...capacidades);
  for (let extra = 0; permitirRecarga && extra < 12 && sol.fora.some(i => demanda[i] <= maiorCap); extra++) {
    let melhor = null;
    capacidades.forEach((cap, v) => {
      const caps2 = caps.concat([cap]), dono2 = dono.concat([v]), s = otimizar(M, demanda, caps2, { ...opcoes, dono: dono2 });
      const km = porTempo ? tempoDoMaisDemorado(s.rotas, dono2, M, opcoes) : kmTotal(s.rotas, dono2);      // critério de desempate
      if (!melhor || s.fora.length < melhor.s.fora.length || (s.fora.length === melhor.s.fora.length && km < melhor.km - 1e-9)) melhor = { s, km, caps2, dono2 };
    });
    if (melhor.s.fora.length >= sol.fora.length) break;        // a viagem extra não ajudou
    sol = melhor.s; caps = melhor.caps2; dono = melhor.dono2;
  }
  return { rotas: sol.rotas, dono, fora: sol.fora };
}

/* Referência para medir o ganho: entregas na ordem da lista, enchendo um veículo de cada vez
   (e, com recarga, voltando ao primeiro veículo quando todos já saíram). */
function ordemDaLista(demanda, capacidades, comRecarga) {
  const rotas = [], dono = []; let v = 0, atual = [], carga = 0, voltas = 0;
  const fechar = () => { if (atual.length) { rotas.push(atual); dono.push(v); } atual = []; carga = 0; v++; if (v >= capacidades.length) { v = 0; voltas++; } };
  for (let i = 1; i < demanda.length; i++) {
    if (demanda[i] > Math.max(...capacidades)) continue;
    let tentativas = 0;
    while (carga + demanda[i] > capacidades[v] && tentativas++ <= capacidades.length) fechar();
    if (voltas > 0 && !comRecarga) break;
    atual.push(i); carga += demanda[i];
  }
  if (atual.length && (voltas === 0 || comRecarga)) { rotas.push(atual); dono.push(v); }
  return { rotas, dono };
}
function kmRota(rota, K, retorno) {
  if (!rota.length) return 0;
  let k = K[0][rota[0]];
  for (let i = 1; i < rota.length; i++) k += K[rota[i - 1]][rota[i]];
  return k + (retorno ? K[rota[rota.length - 1]][0] : 0);
}
function kmDasViagens(rotas, dono, nv, K, retorno) {
  let km = 0;
  for (let v = 0; v < nv; v++) { const minhas = rotas.filter((r, i) => dono[i] === v && r.length); minhas.forEach((r, j) => { km += kmRota(r, K, j < minhas.length - 1 || retorno); }); }
  return km;
}

/* ================= Rotas em andamento =================
   Entraram pedidos com os veículos já na rua. O que já foi entregue fica como está; cada veículo continua de
   onde parou, com os botijões que ainda tem a bordo; os pedidos novos entram no veículo e na posição em que
   menos aumentam o custo. Quem não tem carga para o pedido novo volta ao depósito e faz outra viagem.

   Cada veículo é descrito por: { cap, naRua, inicioNo, inicioHora, limite0, viagens: [[nós], ...] }
   viagens[0] é a viagem em curso (ou a próxima, se o veículo está no depósito); limite0 é quanto ele ainda
   pode entregar nela: o que resta a bordo se está na rua, ou a capacidade se está no depósito. */
function custoEmAndamento(v, M, K, o) {
  let t = v.inicioHora, pos = v.naRua ? v.inicioNo : 0, multa = 0, km = 0, dirigindo = 0;
  const viagens = v.viagens.map((x, j) => ({ x, j })).filter(({ x, j }) => x.length || j === 0);
  viagens.forEach(({ x }, k) => {
    if (k > 0) t += o.recarga || 0;
    for (const i of x) {
      t += M[pos][i]; km += K[pos][i]; dirigindo += M[pos][i];
      const jan = o.janelas && o.janelas[i];
      if (jan) { if (t < jan[0]) t = jan[0]; else if (t > jan[1]) multa += MULTA_ATRASO + MULTA_POR_MINUTO * (t - jan[1]); }
      t += o.parada; pos = i;
    }
    if ((k < viagens.length - 1 || o.retorno) && pos !== 0) { t += M[pos][0]; km += K[pos][0]; dirigindo += M[pos][0]; pos = 0; }
  });
  // custo = tempo dirigindo + multa por atraso. A espera por hora marcada não entra: senão um pedido novo
  // distante pareceria "de graça" só porque o veículo teria de esperar de qualquer jeito.
  return { custo: dirigindo + multa + 0.001 * (t - v.inicioHora), km, fim: t, multa };
}
function replanejarNucleo(M, K, demanda, veiculos, novas, o) {
  const carga = x => x.reduce((s, i) => s + demanda[i], 0), limite = (v, j) => j === 0 ? v.limite0 : v.cap;
  const custo = v => custoEmAndamento(v, M, K, o).custo, fora = [];
  // primeiro os pedidos com hora marcada (do mais cedo ao mais tarde), depois os mais distantes do depósito
  const fila = novas.slice().sort((a, b) => { const ja = o.janelas && o.janelas[a], jb = o.janelas && o.janelas[b]; return ja && jb ? ja[0] - jb[0] : ja ? -1 : jb ? 1 : M[0][b] - M[0][a]; });
  for (const i of fila) {
    let melhor = null;
    veiculos.forEach((v, k) => {
      const antes = custo(v), ultima = v.viagens.length;
      for (let j = 0; j <= ultima; j++) {
        if (j === ultima && (!o.permitirRecarga || demanda[i] > v.cap)) continue;        // viagem nova só com recarga
        const atual = v.viagens[j] || [];
        if (j < ultima && carga(atual) + demanda[i] > limite(v, j)) continue;
        for (let p = 0; p <= atual.length; p++) {
          const copia = v.viagens.map(x => x.slice()); if (j === ultima) copia.push([i]); else copia[j].splice(p, 0, i);
          const delta = custo({ ...v, viagens: copia }) - antes;
          if (!melhor || delta < melhor.delta - 1e-9) melhor = { k, copia, delta };
        }
      }
    });
    if (melhor) veiculos[melhor.k].viagens = melhor.copia; else fora.push(i);
  }
  // melhora a ordem do que ainda falta em cada veículo (sem trocar de veículo: os entregadores já estão na rua)
  for (const v of veiculos) {
    let melhorou = true, voltas = 0, atual = custo(v);
    const tentar = copia => { const c = custo({ ...v, viagens: copia }); if (c < atual - 1e-6) { v.viagens = copia; atual = c; melhorou = true; return true; } return false; };
    while (melhorou && voltas++ < 50) {
      melhorou = false;
      for (let j = 0; j < v.viagens.length; j++) {
        for (let a = 0; a < v.viagens[j].length - 1; a++) for (let b = a + 1; b < v.viagens[j].length; b++) {
          const x = v.viagens[j], copia = v.viagens.map(y => y.slice()); copia[j] = x.slice(0, a).concat(x.slice(a, b + 1).reverse(), x.slice(b + 1)); tentar(copia);
        }
        for (let a = 0; a < v.viagens[j].length; a++) for (let j2 = 0; j2 < v.viagens.length; j2++) {
          const no = v.viagens[j][a]; if (no === undefined) break;
          if (j2 !== j && carga(v.viagens[j2]) + demanda[no] > limite(v, j2)) continue;
          for (let p = 0; p <= v.viagens[j2].length; p++) {
            if (j2 === j && (p === a || p === a + 1)) continue;
            const copia = v.viagens.map(y => y.slice()); copia[j].splice(a, 1); copia[j2].splice(j2 === j && p > a ? p - 1 : p, 0, no);
            if (tentar(copia)) break;
          }
        }
      }
    }
    v.viagens = v.viagens.filter((x, j) => x.length || j === 0);
  }
  return { veiculos, fora };
}

/* ================= Endereços =================
   Busca no OpenStreetMap (Nominatim). Com bairro, a busca livre acha o trecho certo de ruas compridas.
   Onde o mapa não tem o número da casa, o resultado é o meio do trecho da rua: fica marcado como aproximado. */
const memoriaEnderecos = new Map();
async function localizarUm(e, cidadePadrao, uf) {
  const cidade = e.cidade || cidadePadrao, d = estado.deposito;
  const chave = semAcento([e.rua, e.numero, e.bairro, cidade, uf].join("|"));
  if (memoriaEnderecos.has(chave)) return memoriaEnderecos.get(chave);
  const caixa = coordValida(d.lat, d.lon) ? `&viewbox=${(d.lon - 0.8).toFixed(3)},${(d.lat + 0.8).toFixed(3)},${(d.lon + 0.8).toFixed(3)},${(d.lat - 0.8).toFixed(3)}&bounded=1` : "";
  const base = `${NOMINATIM}?format=jsonv2&limit=1&addressdetails=1&countrycodes=br${caixa}&`, c = encodeURIComponent;
  const local = `&city=${c(cidade)}` + (uf ? `&state=${c(uf)}` : "") + "&country=Brasil";
  const tentativas = [];
  if (e.bairro) tentativas.push("q=" + c([e.rua, e.numero, e.bairro, cidade, uf, "Brasil"].filter(Boolean).join(", ")));
  if (e.numero) tentativas.push("street=" + c(e.numero + " " + e.rua) + local);
  tentativas.push("street=" + c(e.rua) + local);
  let achado = null, respondeu = false;
  for (let i = 0; i < tentativas.length && !achado; i++) {
    if (i > 0) await new Promise(ok => setTimeout(ok, ESPERA_ENDERECO));
    try {
      const r = await buscar(base + tentativas[i], 12000); respondeu = true;
      if (r.length) achado = { lat: Number(r[0].lat), lon: Number(r[0].lon), exato: !!(r[0].address && r[0].address.house_number) };
    } catch (err) { if (!respondeu && i === 0) break; }           // sem conexão: não insiste nas outras formas
  }
  if (achado) memoriaEnderecos.set(chave, achado);
  return achado || { semResposta: !respondeu };
}
async function localizarEnderecos(aoAvancar) {
  const faltam = estado.entregas.filter(e => !coordValida(e.lat, e.lon) && e.rua && e.origem !== "falhou");   // "não encontrado" só tenta de novo se o endereço mudar
  const cidadePadrao = $("p-cidade").value.trim(), uf = $("p-uf").value.trim();
  let achados = 0, aproximados = 0, semServico = 0;
  for (let i = 0; i < faltam.length; i++) {
    const e = faltam[i];
    aoAvancar(i + 1, faltam.length, e);
    const r = await localizarUm(e, cidadePadrao, uf);
    if (r.lat !== undefined) { e.lat = r.lat; e.lon = r.lon; e.origem = r.exato ? "endereco" : "rua"; achados++; if (!r.exato) aproximados++; }
    else if (r.semResposta) { semServico++; e.origem = ""; if (semServico >= 2) break; }     // serviço fora do ar: para de tentar
    else e.origem = "falhou";
    if (i < faltam.length - 1) await new Promise(ok => setTimeout(ok, ESPERA_ENDERECO));   // limite de uso do serviço gratuito
  }
  return { total: faltam.length, achados, aproximados, semServico };
}

/* ================= Cálculo das rotas ================= */
function parametros() {
  const [h, m] = ($("p-saida").value || "08:00").split(":").map(Number);
  return { saida: h * 60 + m, parada: Math.max(0, paraNumero($("p-parada").value) || 0), recarga: Math.max(0, paraNumero($("p-recarga").value) || 0), tolerancia: Math.max(0, paraNumero($("p-tolerancia").value) || 0),
           retorno: $("p-retorno").checked, cheio: $("p-cheio").checked, permitirRecarga: $("p-viagens").checked,
           modo: $("p-objetivo").value === "tempo" ? "tempo" : "regiao", usarRuas: $("p-ruas").checked };
}
function aviso(texto, tipo = "") { const a = $("aviso"); a.textContent = texto; a.className = "aviso " + tipo; a.hidden = !texto; }

/* Monta horários, quilômetros e carga de um veículo a partir das suas viagens (listas de índices da matriz). */
function permutacoes(lista) {
  if (lista.length <= 1) return [lista];
  return lista.flatMap((x, i) => permutacoes(lista.slice(0, i).concat(lista.slice(i + 1))).map(resto => [x].concat(resto)));
}
/* Monta horários, quilômetros e carga de um veículo a partir das suas viagens (listas de índices da matriz).
   Com hora marcada: quem chega cedo espera; quem chega tarde fica marcado com o atraso. */
function simularVeiculo(veiculo, cor, viagensIdx, validas, demanda, Mx, P) {
  let t = P.saida, ordem = 0, atrasoTotal = 0, esperaTotal = 0;
  const viagens = viagensIdx.map((rota, j) => {
    if (j > 0) t += P.recarga;
    const inicio = t, pedidos = rota.reduce((s, i) => s + demanda[i], 0), carregado = P.cheio ? veiculo.cap : pedidos, volta = j < viagensIdx.length - 1 || P.retorno;
    let km = 0, ant = 0, aBordo = carregado;
    const paradas = rota.map(i => {
      const trechoKm = Mx.km[ant][i]; t += Mx.min[ant][i]; km += trechoKm;
      const janela = P.janelas && P.janelas[i], chegouAs = t; let espera = 0, atraso = 0;
      if (janela) { if (t < janela[0]) { espera = janela[0] - t; t = janela[0]; } else if (t > janela[1]) atraso = t - janela[1]; }
      const chegada = t; t += P.parada; aBordo -= demanda[i]; ant = i; atrasoTotal += atraso; esperaTotal += espera;
      return { ordem: ++ordem, entrega: validas[i - 1], chegada, chegouAs, espera, atraso, marcada: !!janela, trechoKm, restam: aBordo, feito: false, nova: false };
    });
    let voltaKm = 0;
    if (volta) { voltaKm = Mx.km[ant][0]; t += Mx.min[ant][0]; km += voltaKm; }
    return { numero: j + 1, paradas, km, carregado, pedidos, folga: carregado - pedidos, inicio, fim: t, volta, voltaKm, geometria: null };
  });
  const nParadas = viagens.reduce((s, v) => s + v.paradas.length, 0), total = t - P.saida, parado = P.parada * nParadas + P.recarga * Math.max(0, viagens.length - 1) + esperaTotal;
  return { veiculo, cor, viagens, km: viagens.reduce((s, v) => s + v.km, 0), paradas: nParadas, botijoes: viagens.reduce((s, v) => s + v.pedidos, 0), fim: t, total, dirigindo: total - parado, parado,
           atrasoTotal, esperaTotal };
}
/* Com mais de uma viagem e hora marcada, testa a ordem das viagens e fica com a de menor atraso. */
function montarVeiculo(veiculo, cor, viagensIdx, validas, demanda, Mx, P) {
  if (!P.janelas || viagensIdx.length < 2 || viagensIdx.length > 5) return simularVeiculo(veiculo, cor, viagensIdx, validas, demanda, Mx, P);
  let melhor = null;
  for (const ordem of permutacoes(viagensIdx)) {
    const r = simularVeiculo(veiculo, cor, ordem, validas, demanda, Mx, P);
    if (!melhor || r.atrasoTotal < melhor.atrasoTotal - 1e-6 || (Math.abs(r.atrasoTotal - melhor.atrasoTotal) <= 1e-6 && r.fim < melhor.fim - 1e-6)) melhor = r;
  }
  return melhor;
}

async function criarRotas() {
  const botao = $("btn-rotas");
  botao.disabled = true; estado.resultado = null;
  try {
    lerFormularios();
    const P = parametros(), d = estado.deposito;
    if (!coordValida(d.lat, d.lon)) throw new Error("Informe a latitude e a longitude do depósito, ou clique em “Marcar depósito no mapa”.");
    const veiculos = estado.veiculos.filter(v => v.ativo && v.cap > 0);
    if (!veiculos.length) throw new Error("Cadastre ao menos um veículo com capacidade maior que zero.");
    if (!estado.entregas.length) throw new Error("Cadastre ou carregue ao menos uma entrega.");

    let aproximados = 0, semServico = 0;
    if (estado.entregas.some(e => !coordValida(e.lat, e.lon) && e.rua && e.origem !== "falhou")) {
      const r = await localizarEnderecos((i, total, e) => aviso(`Localizando endereços: ${i} de ${total} (${e.cliente})…`, "andando"));
      desenharEntregas(); semServico = r.semServico;
    }
    aproximados = estado.entregas.filter(e => e.origem === "rua").length;
    const validas = estado.entregas.filter(e => coordValida(e.lat, e.lon));
    if (!validas.length) throw new Error("Nenhuma entrega foi localizada. Confira rua e cidade, ou informe a coordenada.");
    const semLocal = estado.entregas.filter(e => !coordValida(e.lat, e.lon));

    aviso("Calculando distâncias…", "andando");
    const pontos = [d].concat(validas), Mx = await matriz(pontos, P.usarRuas);
    aviso("Otimizando as rotas…", "andando");
    await new Promise(ok => setTimeout(ok, 30));
    const demanda = [0].concat(validas.map(e => e.qtd)), caps = veiculos.map(v => v.cap);
    const marcadas = validas.filter(e => lerHora(e.hora));
    if (marcadas.length) P.janelas = [null].concat(validas.map(e => { const h = lerHora(e.hora); return h ? [minutosDe(h) - P.tolerancia, minutosDe(h) + P.tolerancia] : null; }));
    const sol = planejarViagens(Mx.min, Mx.km, demanda, caps, P, P.permitirRecarga);

    const rotas = veiculos.map((v, k) => montarVeiculo(v, CORES[estado.veiculos.indexOf(v) % CORES.length], sol.rotas.filter((r, i) => sol.dono[i] === k && r.length), validas, demanda, Mx, P));
    const base = ordemDaLista(demanda, caps, P.permitirRecarga), atendidasBase = base.rotas.reduce((s, r) => s + r.length, 0);
    estado.resultado = { rotas, fora: sol.fora.map(i => validas[i - 1]), semLocal, fonte: Mx.fonte, P, km: rotas.reduce((s, r) => s + r.km, 0),
                         kmBase: kmDasViagens(base.rotas, base.dono, caps.length, Mx.km, P.retorno), baseCompleta: atendidasBase === validas.length && !sol.fora.length };
    desenharResultado(); desenharMapa();

    await desenharTrajetos(Mx.fonte);
    const atrasadas = rotas.flatMap(r => r.viagens.flatMap(vg => vg.paradas.filter(p => p.atraso > 0.5)));
    estado.resultado.marcadas = marcadas.length; estado.resultado.atrasadas = atrasadas.length; desenharResultado();
    const partes = [], extras = rotas.reduce((s, r) => s + Math.max(0, r.viagens.length - 1), 0);
    if (atrasadas.length) partes.push(`${atrasadas.length} de ${marcadas.length} entrega(s) com hora marcada não serão atendidas no horário: ${atrasadas.map(p => `${p.entrega.cliente} (${duracao(p.atraso)} de atraso)`).join(", ")}.`);
    if (extras) partes.push(`A carga passou da capacidade: ${extras} viagem(ns) com recarga no depósito.`);
    if (aproximados) partes.push(`${aproximados} endereço(s) com número aproximado: o mapa só tem a rua. Arraste o marcador para corrigir.`);
    if (Mx.fonte !== "ruas") partes.push(Mx.fonte === "reta-limite" ? `Mais de ${LIMITE_OSRM - 1} entregas: distâncias em linha reta com fator de correção.` : P.usarRuas ? "O serviço de rotas não respondeu: distâncias em linha reta com fator de correção." : "Distâncias em linha reta com fator de correção.");
    if (sol.fora.length) partes.push(`${sol.fora.length} entrega(s) não couberam nos veículos.`);
    if (semLocal.length) partes.push(`${semLocal.length} entrega(s) sem localização ficaram de fora` + (semServico ? ": a busca de endereços não respondeu (sem internet?)." : "."));
    aviso(partes.join(" "), atrasadas.length ? "erro" : partes.length ? "alerta" : "");
    $("resultado").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) { aviso(e.message, "erro"); }
  finally { botao.disabled = false; }
}

/* Monta a rota de um veículo em andamento: viagens já feitas, paradas já entregues e o que ainda falta. */
function montarEmAndamento(anterior, v, fechadas, feitasNaAtual, validas, demanda, Mx, P, idsNovos) {
  let t = v.inicioHora, pos = v.naRua ? v.inicioNo : 0, atrasoTotal = 0, esperaTotal = 0;
  const viagens = fechadas.slice(), pendentes = v.viagens.map((x, j) => ({ x, j })).filter(({ x, j }) => x.length || (j === 0 && feitasNaAtual.length));
  pendentes.forEach(({ x, j }, k) => {
    const emCurso = j === 0 && v.naRua, original = emCurso ? anterior.viagens[fechadas.length] : null;
    if (k > 0) t += P.recarga;
    const pedidos = x.reduce((s, i) => s + demanda[i], 0) + (emCurso ? feitasNaAtual.reduce((s, p) => s + p.entrega.qtd, 0) : 0);
    const carregado = emCurso ? original.carregado : P.cheio ? anterior.veiculo.cap : pedidos, inicio = emCurso ? original.inicio : t;
    let km = emCurso ? feitasNaAtual.reduce((s, p) => s + p.trechoKm, 0) : 0, aBordo = emCurso ? v.limite0 : carregado;
    const paradas = (emCurso ? feitasNaAtual.slice() : []).concat(x.map(i => {
      const trechoKm = Mx.km[pos][i]; t += Mx.min[pos][i]; km += trechoKm;
      const janela = P.janelas && P.janelas[i], chegouAs = t; let espera = 0, atraso = 0;
      if (janela) { if (t < janela[0]) { espera = janela[0] - t; t = janela[0]; } else if (t > janela[1]) atraso = t - janela[1]; }
      const chegada = t; t += P.parada; aBordo -= demanda[i]; pos = i; atrasoTotal += atraso; esperaTotal += espera;
      return { entrega: validas[i - 1], chegada, chegouAs, espera, atraso, marcada: !!janela, trechoKm, restam: aBordo, feito: false, nova: idsNovos.has(validas[i - 1].id) };
    }));
    const volta = k < pendentes.length - 1 || P.retorno; let voltaKm = 0;
    if (volta && pos !== 0) { voltaKm = Mx.km[pos][0]; t += Mx.min[pos][0]; km += voltaKm; pos = 0; }
    viagens.push({ paradas, km, carregado, pedidos, folga: carregado - pedidos, inicio, fim: t, volta, voltaKm, geometria: null });
  });
  let ordem = 0; viagens.forEach((vg, j) => { vg.numero = j + 1; vg.paradas.forEach(p => { p.ordem = ++ordem; }); });
  const fim = viagens.length ? viagens[viagens.length - 1].fim : P.saida, total = fim - P.saida;
  return { veiculo: anterior.veiculo, cor: anterior.cor, viagens, km: viagens.reduce((s, vg) => s + vg.km, 0), paradas: ordem, botijoes: viagens.reduce((s, vg) => s + vg.pedidos, 0),
           fim, total, dirigindo: null, parado: null, atrasoTotal, esperaTotal };
}

/* Recalcula as rotas com os veículos na rua: mantém o que foi entregue e encaixa os pedidos novos. */
async function atualizarRotas() {
  const R0 = estado.resultado, botao = $("btn-atualizar");
  if (!R0) return;
  botao.disabled = true;
  try {
    lerFormularios();
    const P = { ...parametros(), saida: R0.P.saida, cheio: R0.P.cheio }, d = estado.deposito;
    if (estado.entregas.some(e => !coordValida(e.lat, e.lon) && e.rua && e.origem !== "falhou")) {
      await localizarEnderecos((i, total, e) => aviso(`Localizando endereços: ${i} de ${total} (${e.cliente})…`, "andando")); desenharEntregas();
    }
    const validas = estado.entregas.filter(e => coordValida(e.lat, e.lon)), semLocal = estado.entregas.filter(e => !coordValida(e.lat, e.lon));
    const noDe = new Map(validas.map((e, i) => [e.id, i + 1]));
    // entregas já feitas que saíram da lista continuam valendo como ponto de partida do veículo
    R0.rotas.forEach(r => r.viagens.forEach(vg => vg.paradas.forEach(p => { if (p.feito && !noDe.has(p.entrega.id)) { validas.push(p.entrega); noDe.set(p.entrega.id, validas.length); } })));
    aviso("Calculando distâncias…", "andando");
    const Mx = await matriz([d].concat(validas), P.usarRuas), demanda = [0].concat(validas.map(e => e.qtd));
    if (validas.some(e => lerHora(e.hora))) P.janelas = [null].concat(validas.map(e => { const h = lerHora(e.hora); return h ? [minutosDe(h) - P.tolerancia, minutosDe(h) + P.tolerancia] : null; }));

    const feitos = R0.rotas.flatMap(r => r.viagens.flatMap(vg => vg.paradas.filter(p => p.feito)));
    const agora = Math.max(P.saida, ...feitos.map(p => p.chegada + P.parada));
    const jaNaRota = new Set(), partes = [];
    const veiculos = R0.rotas.map(r => {
      const existe = p => noDe.has(p.entrega.id) && estado.entregas.includes(p.entrega);
      let atual = r.viagens.findIndex(vg => vg.paradas.some(p => !p.feito && existe(p)));
      if (atual < 0) atual = r.viagens.length;
      const fechadas = r.viagens.slice(0, atual).map(vg => ({ ...vg, paradas: vg.paradas.filter(p => p.feito) })).filter(vg => vg.paradas.length);
      const vg = r.viagens[atual], feitas = vg ? vg.paradas.filter(p => p.feito) : [], pend = vg ? vg.paradas.filter(p => !p.feito && existe(p)).map(p => noDe.get(p.entrega.id)) : [];
      const depois = r.viagens.slice(atual + 1).map(x => x.paradas.filter(p => !p.feito && existe(p)).map(p => noDe.get(p.entrega.id))).filter(x => x.length);
      const ultima = feitas[feitas.length - 1], anteriorFim = fechadas.length ? fechadas[fechadas.length - 1].fim : null;
      const v = ultima ? { naRua: true, inicioNo: noDe.get(ultima.entrega.id), inicioHora: ultima.chegada + P.parada, limite0: ultima.restam }
                       : { naRua: false, inicioNo: 0, inicioHora: anteriorFim !== null ? anteriorFim + P.recarga : r.viagens.length ? vg ? vg.inicio : agora : agora, limite0: r.veiculo.cap };
      [pend].concat(depois).forEach(x => x.forEach(i => jaNaRota.add(i)));
      feitos.forEach(p => jaNaRota.add(noDe.get(p.entrega.id)));
      return { anterior: r, fechadas, feitas, estado: { cap: r.veiculo.cap, ...v, viagens: [pend].concat(depois) } };
    });
    const novas = validas.map((e, i) => i + 1).filter(i => !jaNaRota.has(i)), idsNovos = new Set(novas.map(i => validas[i - 1].id));
    aviso("Encaixando os pedidos novos…", "andando"); await new Promise(ok => setTimeout(ok, 30));
    const sol = replanejarNucleo(Mx.min, Mx.km, demanda, veiculos.map(x => x.estado), novas, P);
    const rotas = veiculos.map(x => montarEmAndamento(x.anterior, x.estado, x.fechadas, x.feitas, validas, demanda, Mx, P, idsNovos));
    const marcadas = validas.filter(e => lerHora(e.hora)).length, atrasadas = rotas.flatMap(r => r.viagens.flatMap(vg => vg.paradas.filter(p => !p.feito && p.atraso > 0.5)));
    estado.resultado = { rotas, fora: sol.fora.map(i => validas[i - 1]), semLocal, fonte: Mx.fonte, P, km: rotas.reduce((s, r) => s + r.km, 0), kmBase: 0, baseCompleta: false,
                         marcadas, atrasadas: atrasadas.length, atualizada: { novos: novas.length - sol.fora.length, hora: agora, vez: (R0.atualizada ? R0.atualizada.vez : 0) + 1 } };
    desenharResultado(); desenharMapa();
    await desenharTrajetos(Mx.fonte);
    const comNova = rotas.filter(r => r.viagens.some(vg => vg.paradas.some(p => p.nova)));
    partes.push(novas.length ? `${novas.length - sol.fora.length} pedido(s) novo(s) encaixado(s) em ${comNova.map(r => r.veiculo.nome).join(", ") || "nenhum veículo"}. Envie a rota atualizada a cada entregador.` : "Nenhum pedido novo: as rotas foram só recalculadas a partir do que já foi entregue.");
    if (atrasadas.length) partes.push(`${atrasadas.length} entrega(s) com hora marcada ficarão atrasadas: ${atrasadas.map(p => `${p.entrega.cliente} (${duracao(p.atraso)})`).join(", ")}.`);
    if (sol.fora.length) partes.push(`${sol.fora.length} pedido(s) não couberam em nenhum veículo.`);
    if (semLocal.length) partes.push(`${semLocal.length} entrega(s) sem localização ficaram de fora.`);
    aviso(partes.join(" "), atrasadas.length || sol.fora.length ? "erro" : "ok");
    $("resultado").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) { aviso(e.message, "erro"); }
  finally { botao.disabled = false; }
}
/* Busca o trajeto pelas ruas de cada viagem, só para o desenho no mapa. */
async function desenharTrajetos(fonte) {
  if (fonte !== "ruas" || !estado.resultado) return;
  const d = estado.deposito, todas = estado.resultado.rotas.flatMap(r => r.viagens);
  await Promise.all(todas.map(async vg => {
    const pts = [d].concat(vg.paradas.map(p => p.entrega), vg.volta ? [d] : []);
    try {
      const g = await buscar(`${OSRM}/route/v1/driving/${pts.map(p => p.lon.toFixed(6) + "," + p.lat.toFixed(6)).join(";")}?overview=full&geometries=geojson`);
      if (g.code === "Ok") vg.geometria = g.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
    } catch (e) { /* mantém a linha reta */ }
  }));
  desenharMapa();
}

/* ================= Saída: impressão e imagem por veículo ================= */
function imprimir(indice) {
  const cartoes = document.querySelectorAll("#r-rotas .rota");
  cartoes.forEach((c, i) => c.classList.toggle("fora-da-impressao", indice !== null && i !== indice));
  document.body.classList.add("imprimindo-rotas");
  const limpar = () => { document.body.classList.remove("imprimindo-rotas"); cartoes.forEach(c => c.classList.remove("fora-da-impressao")); window.removeEventListener("afterprint", limpar); };
  window.addEventListener("afterprint", limpar);
  window.print();
}
/* Desenha a rota de um veículo em uma imagem (PNG), para mandar ao entregador. Sem bibliotecas: canvas do navegador. */
function imagemDaRota(r, R) {
  const L = 1080, M = 44, FONTE = "Calibri, 'Segoe UI', Arial, sans-serif", c = document.createElement("canvas"), x = c.getContext("2d");
  const quebrar = (texto, largura, fonte, maxLinhas) => {
    x.font = fonte; const palavras = String(texto).split(/\s+/), linhas = []; let atual = "";
    for (const p of palavras) { const t = atual ? atual + " " + p : p; if (x.measureText(t).width <= largura || !atual) atual = t; else { linhas.push(atual); atual = p; } }
    if (atual) linhas.push(atual);
    if (linhas.length > maxLinhas) { linhas.length = maxLinhas; let u = linhas[maxLinhas - 1]; while (u.length > 3 && x.measureText(u + "…").width > largura) u = u.slice(0, -1); linhas[maxLinhas - 1] = u + "…"; }
    return linhas;
  };
  // mede antes de desenhar
  const itens = [];
  r.viagens.forEach(vg => {
    if (r.viagens.length > 1) itens.push({ tipo: "viagem", vg, h: 64 });
    vg.paradas.forEach(p => { const end = quebrar(enderecoTexto(p.entrega) + (p.entrega.origem === "rua" ? " (nº aproximado)" : ""), L - 2 * M - 300, `26px ${FONTE}`, 2); itens.push({ tipo: "parada", p, end, h: Math.max(62 + end.length * 32 + (p.marcada ? 34 : 0), p.feito ? 0 : 128) }); });
    if (vg.volta) itens.push({ tipo: "volta", vg, h: 60 });
  });
  const pendentes = r.viagens.reduce((s, vg) => s + vg.paradas.filter(p => !p.feito).length, 0), topo = 214, rodape = 70;
  c.width = L; c.height = topo + itens.reduce((s, i) => s + i.h, 0) + rodape;
  x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = "#1B365D"; x.fillRect(0, 0, L, 150); x.fillStyle = "#FFD100"; x.fillRect(0, 150, L, 8);
  x.textBaseline = "alphabetic"; x.fillStyle = "#FFFFFF"; x.font = `700 54px ${FONTE}`; x.fillText(quebrar("Rota · " + r.veiculo.nome, L - 2 * M, `700 54px ${FONTE}`, 1)[0], M, 72);
  x.font = `28px ${FONTE}`; x.fillStyle = "#D1D7DF";
  x.fillText(R.atualizada ? `Atualizada: pedidos novos incluídos (versão ${R.atualizada.vez + 1})` : `Saída às ${hhmm(R.P.saida)} de ${estado.deposito.nome}`, M, 118);
  x.fillStyle = "#1F2A37"; x.font = `700 30px ${FONTE}`;
  x.fillText(`${pendentes} parada(s) a fazer · ${num(r.km, 1)} km · previsão de término ${hhmm(r.fim)}`, M, 198);
  let y = topo;
  for (const it of itens) {
    if (it.tipo === "viagem") {
      x.fillStyle = "#D1D7DF"; x.fillRect(M, y + 10, L - 2 * M, 44); x.fillStyle = "#142946"; x.font = `700 26px ${FONTE}`;
      x.fillText(`Viagem ${it.vg.numero} · sai às ${hhmm(it.vg.inicio)} com ${num(it.vg.carregado)} botijões cheios`, M + 14, y + 41);
    } else if (it.tipo === "volta") {
      x.fillStyle = "#6B7280"; x.font = `italic 26px ${FONTE}`;
      x.fillText((it.vg.numero < r.viagens.length ? "Volta ao depósito para recarga" : "Volta ao depósito") + ` · ${hhmm(it.vg.fim)}`, M + 78, y + 38);
    } else {
      const p = it.p, feito = p.feito;
      if (p.nova && !feito) { x.fillStyle = "#FFF6CC"; x.fillRect(M - 12, y + 4, L - 2 * M + 24, it.h - 8); }
      x.beginPath(); x.arc(M + 30, y + 46, 30, 0, Math.PI * 2); x.fillStyle = feito ? "#C5CAD3" : r.cor; x.fill();
      x.fillStyle = "#FFFFFF"; x.font = `700 30px ${FONTE}`; x.textAlign = "center"; x.fillText(feito ? "✓" : String(p.ordem), M + 30, y + 57); x.textAlign = "left";
      x.fillStyle = feito ? "#97999B" : "#1F2A37"; x.font = `700 32px ${FONTE}`;
      const nome = quebrar(p.entrega.cliente, L - 2 * M - 300 - (p.nova && !feito ? 110 : 0), `700 32px ${FONTE}`, 1)[0]; x.fillText(nome, M + 78, y + 42);
      if (p.nova && !feito) { const w = x.measureText(nome).width; x.fillStyle = "#BF9D00"; x.fillRect(M + 78 + w + 14, y + 14, 92, 36); x.fillStyle = "#FFFFFF"; x.font = `700 24px ${FONTE}`; x.fillText("NOVA", M + 78 + w + 26, y + 41); }
      x.fillStyle = feito ? "#97999B" : "#4B5563"; x.font = `26px ${FONTE}`; it.end.forEach((linha, k) => x.fillText(linha, M + 78, y + 78 + k * 32));
      if (p.marcada) { x.fillStyle = feito ? "#97999B" : p.atraso > 0.5 ? "#B42318" : "#17603A"; x.font = `700 24px ${FONTE}`;
        x.fillText(`Hora marcada: ${p.entrega.hora}` + (feito ? "" : p.atraso > 0.5 ? ` · atraso previsto de ${duracao(p.atraso)}` : ""), M + 78, y + 78 + it.end.length * 32); }
      x.textAlign = "right"; x.fillStyle = feito ? "#97999B" : "#1F2A37"; x.font = `700 34px ${FONTE}`; x.fillText(feito ? "entregue" : hhmm(p.chegada), L - M, y + 42);
      x.font = `26px ${FONTE}`; x.fillStyle = feito ? "#97999B" : "#4B5563"; x.fillText(`${num(p.entrega.qtd)} botij${p.entrega.qtd === 1 ? "ão" : "ões"}`, L - M, y + 78);
      if (!feito) x.fillText(p.restam === 1 ? "fica 1 cheio" : `ficam ${num(p.restam)} cheios`, L - M, y + 110);
      x.textAlign = "left"; x.fillStyle = "#E3E6EB"; x.fillRect(M, y + it.h - 1, L - 2 * M, 2);
    }
    y += it.h;
  }
  const hoje = new Date();
  x.fillStyle = "#6B7280"; x.font = `22px ${FONTE}`;
  x.fillText(`Gerada em ${hoje.toLocaleDateString("pt-BR")} às ${hoje.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · horários previstos, sem trânsito`, M, c.height - 28);
  return c;
}
const nomeDeArquivo = t => semAcento(t).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "veiculo";
async function exportarImagem(indice, acao) {
  const R = estado.resultado, r = R && R.rotas[indice]; if (!r) return;
  const canvas = imagemDaRota(r, R), nome = `rota_${nomeDeArquivo(r.veiculo.nome)}${R.atualizada ? "_v" + (R.atualizada.vez + 1) : ""}.png`;
  const blob = await new Promise(ok => canvas.toBlob(ok, "image/png"));
  try {
    if (acao === "copiar") { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); aviso(`Imagem da rota de ${r.veiculo.nome} copiada. Cole na conversa do WhatsApp (Ctrl+V).`, "ok"); return; }
    if (acao === "enviar") {
      const arquivo = new File([blob], nome, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [arquivo] })) { await navigator.share({ files: [arquivo], title: "Rota " + r.veiculo.nome }); return; }
      aviso("Este navegador não tem o botão de compartilhar. A imagem foi baixada: anexe no WhatsApp.", "alerta");
    }
  } catch (e) { if (e && e.name === "AbortError") return; aviso("Não foi possível " + (acao === "copiar" ? "copiar" : "compartilhar") + " direto. A imagem foi baixada: anexe no WhatsApp.", "alerta"); }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ================= Telas: cadastro ================= */
function lerFormularios() {
  const d = estado.deposito;
  d.nome = $("d-nome").value.trim() || "Depósito"; d.lat = paraNumero($("d-lat").value); d.lon = paraNumero($("d-lon").value);
  document.querySelectorAll("#t-veiculos tbody tr").forEach(tr => {
    const v = estado.veiculos.find(x => x.id === +tr.dataset.id); if (!v) return;
    v.nome = tr.querySelector('[data-c="nome"]').value.trim() || "Veículo"; v.cap = Math.max(0, Math.round(paraNumero(tr.querySelector('[data-c="cap"]').value) || 0)); v.ativo = tr.querySelector('[data-c="ativo"]').checked;
  });
  document.querySelectorAll("#t-entregas tbody tr").forEach(tr => {
    const e = estado.entregas.find(x => x.id === +tr.dataset.id); if (!e) return;
    const campo = c => tr.querySelector(`[data-c="${c}"]`).value.trim();
    const novo = { rua: campo("rua"), numero: campo("numero"), bairro: campo("bairro"), cidade: campo("cidade") };
    const mudouEndereco = ["rua", "numero", "bairro", "cidade"].some(k => novo[k] !== e[k]);
    const texto = campo("coord"), c = lerCoordenada(texto);
    e.cliente = campo("cliente") || "Entrega"; Object.assign(e, novo);
    e.qtd = Math.max(1, Math.round(paraNumero(campo("qtd")) || 1)); e.hora = lerHora(campo("hora"));
    if (c && (Math.abs(c.lat - e.lat) > 1e-6 || Math.abs(c.lon - e.lon) > 1e-6 || !["coord", "mapa"].includes(e.origem))) { e.lat = c.lat; e.lon = c.lon; e.origem = "coord"; }
    else if (!texto && ["coord", "mapa"].includes(e.origem)) { e.lat = NaN; e.lon = NaN; e.origem = ""; }                       // coordenada apagada
    else if (mudouEndereco && !["coord", "mapa"].includes(e.origem)) { e.lat = NaN; e.lon = NaN; e.origem = ""; }               // endereço novo: localizar de novo
  });
}
function desenharDeposito() {
  const d = estado.deposito;
  $("d-nome").value = d.nome; $("d-lat").value = coordValida(d.lat, d.lon) ? d.lat.toFixed(5) : ""; $("d-lon").value = coordValida(d.lat, d.lon) ? d.lon.toFixed(5) : "";
}
function desenharVeiculos() {
  const corpo = $("t-veiculos").querySelector("tbody");
  corpo.innerHTML = estado.veiculos.map((v, i) => `<tr data-id="${v.id}">
    <td><span class="bolinha" style="background:${CORES[i % CORES.length]}"></span></td>
    <td><input data-c="nome" value="${esc(v.nome)}" aria-label="Nome do veículo"></td>
    <td><input data-c="cap" type="number" min="0" step="1" value="${v.cap}" aria-label="Capacidade em botijões" class="curto"></td>
    <td class="centro"><input data-c="ativo" type="checkbox" ${v.ativo ? "checked" : ""} aria-label="Sai para entrega"></td>
    <td><button type="button" class="x" data-rem-veiculo="${v.id}" aria-label="Remover veículo">×</button></td></tr>`).join("");
  desenharResumo();
}
function desenharResumo() {
  const cap = estado.veiculos.filter(v => v.ativo).reduce((s, v) => s + v.cap, 0), pedido = estado.entregas.reduce((s, e) => s + e.qtd, 0);
  $("resumo-carga").textContent = `Capacidade dos veículos que saem: ${num(cap)} botijões. Pedidos: ${num(pedido)} botijões em ${num(estado.entregas.length)} entregas.` +
    (pedido > cap ? ` Faltam ${num(pedido - cap)} botijões de capacidade: ${$("p-viagens").checked ? "haverá volta ao depósito para recarga." : "parte das entregas ficará de fora."}` : "");
  $("resumo-carga").className = "nota" + (pedido > cap ? " falta" : "");
}
const ROTULO_ORIGEM = { coord: ["coordenada informada", "ok"], mapa: ["ajustado no mapa", "ok"], endereco: ["endereço localizado", "ok"], rua: ["rua localizada, nº aproximado", "meio"],
                        falhou: ["não encontrado", "ruim"], vazio: ["falta a rua", "ruim"], "": ["a localizar", "neutro"] };
function desenharEntregas() {
  const corpo = $("t-entregas").querySelector("tbody"), cidadePadrao = $("p-cidade").value.trim();
  corpo.innerHTML = estado.entregas.map((e, i) => {
    const tem = coordValida(e.lat, e.lon), manual = tem && ["coord", "mapa"].includes(e.origem);
    const [rot, classe] = rotuloDe(e);
    return `<tr data-id="${e.id}"><td class="n">${i + 1}</td>
    <td><input data-c="cliente" value="${esc(e.cliente)}" aria-label="Cliente" class="medio"></td>
    <td><input data-c="rua" value="${esc(e.rua)}" aria-label="Rua" class="largo" placeholder="Rua ou avenida"></td>
    <td><input data-c="numero" value="${esc(e.numero)}" aria-label="Número" class="mini" inputmode="numeric"></td>
    <td><input data-c="bairro" value="${esc(e.bairro)}" aria-label="Bairro (opcional)" class="medio" placeholder="opcional"></td>
    <td><input data-c="cidade" value="${esc(e.cidade)}" aria-label="Cidade" class="medio" placeholder="${esc(cidadePadrao)}"></td>
    <td><input data-c="qtd" type="number" min="1" step="1" value="${e.qtd}" aria-label="Botijões" class="mini"></td>
    <td><input data-c="hora" type="time" value="${esc(e.hora || "")}" aria-label="Hora marcada (opcional)" class="hora"></td>
    <td><input data-c="coord" value="${manual ? e.lat.toFixed(5) + ", " + e.lon.toFixed(5) : ""}" aria-label="Coordenada (opcional)" class="coord" placeholder="opcional"></td>
    <td><span class="etiqueta ${classe}">${rot}</span></td>
    <td><button type="button" class="x" data-rem-entrega="${e.id}" aria-label="Remover entrega">×</button></td></tr>`;
  }).join("") || `<tr><td colspan="11" class="vazio">Nenhuma entrega. Carregue um arquivo, use o exemplo ou adicione linhas.</td></tr>`;
}
function rotuloDe(e) {
  const tem = coordValida(e.lat, e.lon);
  return ROTULO_ORIGEM[tem ? (e.origem || "coord") : e.origem === "falhou" ? "falhou" : e.rua ? "" : "vazio"];
}
/* Atualiza só as etiquetas, sem redesenhar a tabela (para não tirar o cursor de quem está digitando). */
function atualizarEtiquetas() {
  document.querySelectorAll("#t-entregas tbody tr").forEach(tr => {
    const e = estado.entregas.find(x => x.id === +tr.dataset.id), et = tr.querySelector(".etiqueta"); if (!e || !et) return;
    const [rot, classe] = rotuloDe(e); et.textContent = rot; et.className = "etiqueta " + classe;
  });
}
function desenharTudo() { desenharDeposito(); desenharVeiculos(); desenharEntregas(); desenharResultado(); desenharMapa(true); }

/* ================= Telas: resultado ================= */
function desenharResultado() {
  const R = estado.resultado, area = $("resultado");
  $("btn-atualizar").hidden = !R;
  if (!R) { area.hidden = true; return; }
  area.hidden = false;
  const usadas = R.rotas.filter(r => r.paradas), entregas = usadas.reduce((s, r) => s + r.paradas, 0), botijoes = usadas.reduce((s, r) => s + r.botijoes, 0);
  const viagens = usadas.reduce((s, r) => s + r.viagens.length, 0), fim = Math.max(...usadas.map(r => r.fim), R.P.saida), ganho = R.kmBase > 0 ? (1 - R.km / R.kmBase) * 100 : 0;
  const chegadas = usadas.flatMap(r => r.viagens.flatMap(vg => vg.paradas.map(p => p.chegada))), media = chegadas.length ? soma(chegadas) / chegadas.length : R.P.saida;
  const cartoes = [
    ["Distância total", num(R.km, 1) + " km", `${num(usadas.length)} veículo(s)` + (viagens > usadas.length ? `, ${num(viagens)} viagens (${num(viagens - usadas.length)} com recarga)` : " em rota")],
    ["Entregas", num(entregas), `${num(botijoes)} botijões` + (R.marcadas ? ` · hora marcada: ${num(R.marcadas - (R.atrasadas || 0))} de ${num(R.marcadas)} no horário` : "")],
    [R.P.retorno ? "Última volta ao depósito" : "Última entrega concluída", hhmm(fim), `saída às ${hhmm(R.P.saida)}; em média o cliente recebe às ${hhmm(media)}`],
    R.atualizada ? ["Rotas atualizadas", num(R.atualizada.novos) + (R.atualizada.novos === 1 ? " pedido novo" : " pedidos novos"), `encaixados com os veículos na rua; versão ${R.atualizada.vez + 1}`] :
    R.baseCompleta ? ["Ganho sobre a ordem da lista", (ganho >= 0 ? "−" : "+") + num(Math.abs(ganho), 0) + "%", `de ${num(R.kmBase, 1)} para ${num(R.km, 1)} km`]
                   : ["Ordem da lista", "—", "sem comparação: nem tudo foi atendido"]];
  $("r-cartoes").innerHTML = cartoes.map(([a, b, c]) => `<div class="cartao indicador"><div class="rotulo">${a}</div><div class="valor">${b}</div><div class="detalhe">${c}</div></div>`).join("");
  $("r-fonte").textContent = R.fonte === "ruas" ? "Distâncias e tempos pelas ruas (OSRM, dados do OpenStreetMap), sem trânsito." : `Distâncias em linha reta × ${String(FATOR_RUA).replace(".", ",")} e velocidade média de ${KM_H_RESERVA} km/h.`;
  const hojeTxt = new Date().toLocaleDateString("pt-BR");
  $("r-rotas").innerHTML = R.rotas.map((r, k) => {
    if (!r.paradas) return `<div class="cartao rota" style="border-left-color:${r.cor}"><h3><span class="bolinha" style="background:${r.cor}"></span>${esc(r.veiculo.nome)}</h3><p class="nota">Não foi necessário: fica no depósito.</p></div>`;
    const blocos = r.viagens.map(vg => {
      const linhas = vg.paradas.map(p => `<tr class="${p.feito ? "feito" : ""}${p.nova ? " nova" : ""}"><td class="chk"><input type="checkbox" data-feito="${p.entrega.id}" ${p.feito ? "checked" : ""} aria-label="Entregue: ${esc(p.entrega.cliente)}"></td>
        <td class="n"><span class="num" style="background:${r.cor}">${p.ordem}</span></td>
        <td class="cli">${esc(p.entrega.cliente)}${p.nova ? ' <span class="etiqueta meio">nova</span>' : ""}<small>${esc(enderecoTexto(p.entrega))}${p.entrega.origem === "rua" ? " (nº aproximado)" : ""}</small></td>
        <td>${hhmm(p.chegada)}${p.marcada ? `<small class="${p.atraso > 0.5 ? "tarde" : "nahora"}">marcada ${esc(p.entrega.hora)}${p.atraso > 0.5 ? " · atraso de " + duracao(p.atraso) : p.espera > 0.5 ? " · espera " + duracao(p.espera) : " · no horário"}</small>` : ""}</td>
        <td>${num(p.trechoKm, 1)}</td><td>${num(p.entrega.qtd)}</td><td><strong>${num(p.restam)}</strong></td></tr>`).join("");
      return (r.viagens.length > 1 ? `<h4>Viagem ${vg.numero}${vg.numero > 1 ? ` · recarrega e sai às ${hhmm(vg.inicio)}` : ` · sai às ${hhmm(vg.inicio)}`}</h4>` : "") + `
      <div class="carga" title="Carga do veículo">
        <div class="barra"><i style="width:${Math.min(100, vg.carregado / r.veiculo.cap * 100)}%;background:${r.cor}"></i></div>
        <span>Sai com <b>${num(vg.carregado)}</b> botijões cheios (capacidade ${num(r.veiculo.cap)}): <b>${num(vg.pedidos)}</b> de pedidos${vg.folga > 0 ? ` e <b>${num(vg.folga)}</b> de reserva para pedidos novos` : R.P.cheio ? ", sem reserva" : ""}</span>
      </div>
      <div class="tabela-rolagem"><table><thead><tr><th title="Marque o que já foi entregue">Feito</th><th>#</th><th>Cliente</th><th>Chegada</th><th>Km</th><th>Entrega</th><th>Cheios a bordo</th></tr></thead>
      <tbody>${linhas}${vg.volta ? `<tr class="volta"><td></td><td></td><td class="cli">${vg.numero < r.viagens.length ? "Volta ao depósito para recarga" : "Volta ao depósito"}</td><td>${hhmm(vg.fim)}</td><td>${num(vg.voltaKm, 1)}</td><td></td><td></td></tr>` : ""}</tbody></table></div>`;
    }).join("");
    return `<div class="cartao rota" style="border-left-color:${r.cor}">
      <p class="so-impressao cabecalho-impressao">Rota de entrega · ${hojeTxt} · saída de ${esc(estado.deposito.nome)}${R.atualizada ? ` · atualizada (versão ${R.atualizada.vez + 1})` : ""}</p>
      <div class="topo-rota">
        <h3><span class="bolinha" style="background:${r.cor}"></span>${esc(r.veiculo.nome)}${r.viagens.length > 1 ? ` <span class="etiqueta meio">${r.viagens.length} viagens</span>` : ""}</h3>
        <div class="acoes-rota">
          <button type="button" class="secundario pequeno" data-imprimir="${k}">Imprimir</button>
          <button type="button" class="secundario pequeno" data-imagem="${k}" data-acao="baixar">Baixar imagem</button>
          <button type="button" class="secundario pequeno" data-imagem="${k}" data-acao="copiar">Copiar imagem</button>
          <button type="button" class="secundario pequeno" data-imagem="${k}" data-acao="enviar">Compartilhar</button>
        </div>
      </div>
      <div class="fatos">
        <span><b>${num(r.paradas)}</b> paradas</span><span><b>${num(r.botijoes)}</b> botijões</span><span><b>${num(r.km, 1)} km</b></span>
        <span><b>${duracao(r.total)}</b>${r.dirigindo === null ? "" : ` (${duracao(r.dirigindo)} dirigindo + ${duracao(r.parado)} parado)`}</span>
        <span>${hhmm(R.P.saida)} → <b>${hhmm(r.fim)}</b></span>
      </div>${blocos}
      <p class="so-impressao rodape-impressao">Horários previstos, sem trânsito. Marque cada entrega feita na coluna "Feito".</p></div>`;
  }).join("");
  const pend = R.fora.concat(R.semLocal);
  $("r-fora").hidden = !pend.length;
  $("r-fora").innerHTML = pend.length ? `<h3>Entregas fora das rotas</h3><ul class="limpa">` +
    R.fora.map(e => `<li>${esc(e.cliente)} (${num(e.qtd)} botijões): ${R.P.permitirRecarga ? "pedido maior que a capacidade de qualquer veículo" : "não coube; ligue a recarga no depósito para atender em outra viagem"}.</li>`).join("") +
    R.semLocal.map(e => `<li>${esc(e.cliente)}: ${e.rua ? "endereço não localizado (" + esc(enderecoTexto(e)) + ")" : "sem rua e sem coordenada"}.</li>`).join("") + "</ul>" : "";
}
function exportarCsv() {
  const R = estado.resultado; if (!R) return;
  const linhas = [["veiculo", "viagem", "ordem", "cliente", "rua", "numero", "bairro", "cidade", "latitude", "longitude", "chegada", "hora_marcada", "atraso_min", "km_trecho", "botijoes_entregues", "cheios_a_bordo_apos"]];
  R.rotas.forEach(r => r.viagens.forEach(vg => vg.paradas.forEach(p => linhas.push([r.veiculo.nome, vg.numero, p.ordem, p.entrega.cliente, p.entrega.rua, p.entrega.numero, p.entrega.bairro, p.entrega.cidade,
    p.entrega.lat.toFixed(5), p.entrega.lon.toFixed(5), hhmm(p.chegada), p.entrega.hora || "", p.marcada ? Math.round(p.atraso) : "", p.trechoKm.toFixed(1).replace(".", ","), p.entrega.qtd, p.restam]))));
  baixar("rotas.csv", linhas.map(l => l.map(c => /[;"\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : c).join(";")).join("\r\n"));
}
function baixar(nome, texto) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + texto], { type: "text/csv;charset=utf-8" })); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ================= Mapa ================= */
let mapa = null, camada = null;
function iniciarMapa() {
  if (!window.L) { $("mapa").classList.add("sem-leaflet"); return; }
  mapa = L.map("mapa", { scrollWheelZoom: true }).setView([-29.27, -51.515], 12);
  // Fundos que funcionam sem chave e também com a página aberta direto do disco (o servidor principal do
  // OpenStreetMap recusa páginas locais). O seletor no canto do mapa troca de fundo se um deles estiver fora do ar.
  const osm = '&copy; colaboradores do <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  const fundos = {
    "Ruas (OpenStreetMap França)": L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", { maxZoom: 19, subdomains: "abc", attribution: osm + ", estilo HOT, servidor OSM França" }),
    "Ruas (OpenStreetMap Alemanha)": L.tileLayer("https://tile.openstreetmap.de/{z}/{x}/{y}.png", { maxZoom: 18, attribution: osm + ", servidor OSM Alemanha" }),
    "Ruas (Esri)": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Tiles &copy; Esri" }),
  };
  fundos["Ruas (OpenStreetMap França)"].addTo(mapa);
  L.control.layers(fundos, null, { position: "topright" }).addTo(mapa);
  camada = L.layerGroup().addTo(mapa);
  mapa.on("click", ev => cliqueNoMapa(ev.latlng.lat, ev.latlng.lng));
}
function cliqueNoMapa(lat, lon) {
  if (!estado.modoMapa) return;
  lerFormularios();
  if (estado.modoMapa === "deposito") { estado.deposito.lat = lat; estado.deposito.lon = lon; definirModo(null); }
  else estado.entregas.push(novaEntrega({ cliente: "Entrega " + (estado.entregas.length + 1), lat, lon, origem: "mapa" }));
  estado.resultado = null; desenharTudo();
}
function definirModo(modo) {
  estado.modoMapa = estado.modoMapa === modo ? null : modo;
  $("btn-modo-deposito").setAttribute("aria-pressed", estado.modoMapa === "deposito"); $("btn-modo-entrega").setAttribute("aria-pressed", estado.modoMapa === "entrega");
  $("mapa").classList.toggle("marcando", !!estado.modoMapa);
  $("dica-mapa").textContent = estado.modoMapa === "deposito" ? "Clique no mapa para marcar o depósito." : estado.modoMapa === "entrega" ? "Clique no mapa para adicionar entregas. Clique de novo no botão para parar." : "Arraste um marcador para corrigir a posição de uma entrega.";
}
function elementosDoMapa() {
  const R = estado.resultado, d = estado.deposito, itens = { deposito: coordValida(d.lat, d.lon) ? d : null, pontos: [], linhas: [] };
  const roteadas = new Set();
  if (R) R.rotas.forEach(r => r.viagens.forEach(vg => {
    const seq = [d].concat(vg.paradas.map(p => p.entrega), vg.volta ? [d] : []).map(p => [p.lat, p.lon]);
    itens.linhas.push({ cor: r.cor, caminho: vg.geometria || seq, reta: !vg.geometria, segunda: vg.numero > 1, nome: r.veiculo.nome + (r.viagens.length > 1 ? " · viagem " + vg.numero : "") });
    vg.paradas.forEach(p => { roteadas.add(p.entrega.id); itens.pontos.push({ entrega: p.entrega, lat: p.entrega.lat, lon: p.entrega.lon, cor: r.cor, texto: String(p.ordem),
      dica: `<b>${esc(r.veiculo.nome)}${r.viagens.length > 1 ? " · viagem " + vg.numero : ""} · parada ${p.ordem}</b><br>${esc(p.entrega.cliente)}<br>${esc(enderecoTexto(p.entrega))}<br>Chegada ${hhmm(p.chegada)}${p.marcada ? " (marcada " + esc(p.entrega.hora) + (p.atraso > 0.5 ? ", atraso de " + duracao(p.atraso) : "") + ")" : ""} · entrega ${num(p.entrega.qtd)} · ficam ${num(p.restam)} cheios` }); });
  }));
  estado.entregas.filter(e => coordValida(e.lat, e.lon) && !roteadas.has(e.id)).forEach(e =>
    itens.pontos.push({ entrega: e, lat: e.lat, lon: e.lon, cor: "#97999B", texto: "", dica: `<b>${esc(e.cliente)}</b><br>${esc(enderecoTexto(e))}<br>${num(e.qtd)} botijões` }));
  return itens;
}
function desenharLegenda() {
  const R = estado.resultado;
  $("legenda-mapa").innerHTML = `<span><i class="marca deposito"></i>Depósito</span>` + (R ? R.rotas.filter(r => r.paradas).map(r =>
    `<span><i class="marca" style="background:${r.cor}"></i>${esc(r.veiculo.nome)} (${r.viagens.length > 1 ? r.viagens.length + " viagens, " : ""}${num(r.paradas)} paradas, ${num(r.km, 1)} km)</span>`).join("") : `<span><i class="marca" style="background:#97999B"></i>Entregas a roteirizar</span>`);
}
function desenharMapa(enquadrar) {
  desenharLegenda();
  const itens = elementosDoMapa(), todos = itens.pontos.map(p => [p.lat, p.lon]).concat(itens.deposito ? [[itens.deposito.lat, itens.deposito.lon]] : []);
  if (!mapa) return desenharMapaSimples(itens, todos);
  camada.clearLayers();
  itens.linhas.forEach(l => L.polyline(l.caminho, { color: l.cor, weight: 4, opacity: .85, dashArray: l.reta ? "6 8" : l.segunda ? "14 7" : null }).bindTooltip(l.nome, { sticky: true }).addTo(camada));
  itens.pontos.forEach(p => {
    const m = L.marker([p.lat, p.lon], { draggable: true, icon: L.divIcon({ className: "", iconSize: [24, 24], iconAnchor: [12, 12],
      html: `<div class="pino${p.texto ? "" : " pequeno"}" style="background:${p.cor}">${p.texto}</div>` }) }).bindPopup(p.dica).addTo(camada);
    m.on("dragend", () => {                                  // posição corrigida à mão vale mais que a do endereço
      const ll = m.getLatLng(); lerFormularios();
      p.entrega.lat = ll.lat; p.entrega.lon = ll.lng; p.entrega.origem = "mapa";
      const tinhaRota = !!estado.resultado; estado.resultado = null;
      desenharEntregas(); desenharResultado(); desenharMapa();
      aviso(`Posição de ${p.entrega.cliente} ajustada no mapa.` + (tinhaRota ? " Clique em “Criar rotas” para recalcular." : ""), "ok");
    });
  });
  if (itens.deposito) L.marker([itens.deposito.lat, itens.deposito.lon], { zIndexOffset: 1000, icon: L.divIcon({ className: "", iconSize: [30, 30], iconAnchor: [15, 15], html: `<div class="pino deposito">D</div>` }) })
    .bindPopup(`<b>${esc(itens.deposito.nome)}</b><br>Saída e volta dos veículos`).addTo(camada);
  if ((enquadrar || estado.resultado) && todos.length) mapa.fitBounds(todos, { padding: [30, 30], maxZoom: 16 });
}
/* Sem a biblioteca de mapas (sem internet): desenho simples dos pontos e das rotas, sem ruas ao fundo. */
function desenharMapaSimples(itens, todos) {
  const el = $("mapa");
  if (!todos.length) { el.innerHTML = `<p class="vazio">O mapa precisa de internet. Sem ela, os pontos aparecem aqui sem as ruas ao fundo.</p>`; return; }
  const W = 800, H = 520, m = 30, lats = todos.map(p => p[0]), lons = todos.map(p => p[1]);
  const la0 = Math.min(...lats), la1 = Math.max(...lats), lo0 = Math.min(...lons), lo1 = Math.max(...lons), k = Math.cos((la0 + la1) / 2 * Math.PI / 180);
  const esc2 = Math.min((W - 2 * m) / ((lo1 - lo0) * k || 1e-6), (H - 2 * m) / ((la1 - la0) || 1e-6));
  const x = lon => m + (lon - lo0) * k * esc2 + ((W - 2 * m) - (lo1 - lo0) * k * esc2) / 2, y = lat => H - m - (lat - la0) * esc2 - ((H - 2 * m) - (la1 - la0) * esc2) / 2;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Rotas sem mapa de fundo">` +
    itens.linhas.map(l => `<polyline points="${l.caminho.map(c => x(c[1]).toFixed(1) + "," + y(c[0]).toFixed(1)).join(" ")}" fill="none" stroke="${l.cor}" stroke-width="3" stroke-linejoin="round" opacity=".85"/>`).join("") +
    itens.pontos.map(p => `<g><circle cx="${x(p.lon).toFixed(1)}" cy="${y(p.lat).toFixed(1)}" r="${p.texto ? 10 : 5}" fill="${p.cor}" stroke="#fff" stroke-width="2"/>` +
      (p.texto ? `<text x="${x(p.lon).toFixed(1)}" y="${(y(p.lat) + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${p.texto}</text>` : "") + `</g>`).join("") +
    (itens.deposito ? `<rect x="${(x(itens.deposito.lon) - 11).toFixed(1)}" y="${(y(itens.deposito.lat) - 11).toFixed(1)}" width="22" height="22" rx="5" fill="#FFD100" stroke="#1B365D" stroke-width="2"/><text x="${x(itens.deposito.lon).toFixed(1)}" y="${(y(itens.deposito.lat) + 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#1B365D">D</text>` : "") + `</svg>`;
}

/* ================= Eventos ================= */
function iniciar() {
  iniciarMapa();
  $("btn-exemplo").addEventListener("click", carregarExemplo);
  $("btn-limpar").addEventListener("click", () => { lerFormularios(); estado.entregas = []; estado.resultado = null; aviso(""); desenharTudo(); });
  $("btn-add-veiculo").addEventListener("click", () => { lerFormularios(); estado.veiculos.push({ id: proximoId++, nome: "Veículo " + (estado.veiculos.length + 1), cap: 30, ativo: true }); desenharVeiculos(); });
  $("btn-add-entrega").addEventListener("click", () => { lerFormularios(); estado.entregas.push(novaEntrega({ cliente: "Entrega " + (estado.entregas.length + 1) })); desenharEntregas(); desenharResumo(); });
  $("btn-rotas").addEventListener("click", criarRotas);
  $("btn-csv").addEventListener("click", exportarCsv);
  $("btn-imprimir").addEventListener("click", () => imprimir(null));
  $("btn-atualizar").addEventListener("click", atualizarRotas);
  $("r-rotas").addEventListener("click", ev => {
    const bi = ev.target.closest("[data-imprimir]"), bg = ev.target.closest("[data-imagem]");
    if (bi) imprimir(+bi.dataset.imprimir);
    if (bg) exportarImagem(+bg.dataset.imagem, bg.dataset.acao);
  });
  $("r-rotas").addEventListener("change", ev => {
    const caixa = ev.target.closest("[data-feito]"); if (!caixa || !estado.resultado) return;
    estado.resultado.rotas.forEach(r => r.viagens.forEach(vg => vg.paradas.forEach(p => { if (String(p.entrega.id) === caixa.dataset.feito) p.feito = caixa.checked; })));
    caixa.closest("tr").classList.toggle("feito", caixa.checked);
  });
  $("btn-modo-deposito").addEventListener("click", () => definirModo("deposito"));
  $("btn-modo-entrega").addEventListener("click", () => definirModo("entrega"));
  $("btn-modelo").addEventListener("click", () => baixar("modelo_entregas.csv", "cliente;rua;numero;bairro;cidade;quantidade;hora_marcada;coordenada\r\nMaria Silva;Rua Exemplo;100;Centro;Garibaldi;1;;\r\nJoão Souza;Avenida Modelo;2350;;Carlos Barbosa;2;14:30;\r\nRestaurante Sabor;;;;Garibaldi;4;;-29.2562, -51.5269\r\n"));
  $("arquivo").addEventListener("change", async ev => {
    const arq = ev.target.files[0]; if (!arq) return;
    try {
      const { entregas, avisos } = linhasParaEntregas(await lerArquivo(arq));
      lerFormularios();
      estado.entregas = $("p-somar").checked ? estado.entregas.concat(entregas) : entregas; estado.resultado = null;
      desenharTudo();
      aviso(`${entregas.length} entrega(s) lidas de ${arq.name}.` + (avisos.length ? " " + avisos.slice(0, 3).join(" ") + (avisos.length > 3 ? ` E mais ${avisos.length - 3}.` : "") : ""), avisos.length ? "alerta" : "ok");
    } catch (e) { aviso("Não consegui ler o arquivo: " + e.message + ". Salve a planilha como CSV e tente de novo.", "erro"); }
    ev.target.value = "";
  });
  document.addEventListener("click", ev => {
    const rv = ev.target.closest("[data-rem-veiculo]"), re = ev.target.closest("[data-rem-entrega]");
    if (rv) { lerFormularios(); estado.veiculos = estado.veiculos.filter(v => v.id !== +rv.dataset.remVeiculo); estado.resultado = null; desenharTudo(); }
    if (re) { lerFormularios(); estado.entregas = estado.entregas.filter(e => e.id !== +re.dataset.remEntrega); estado.resultado = null; desenharTudo(); }
  });
  // sem redesenhar as tabelas aqui, para não tirar o cursor de quem está digitando
  ["t-veiculos", "t-entregas"].forEach(id => $(id).addEventListener("change", () => { lerFormularios(); desenharResumo(); if (id === "t-entregas") { atualizarEtiquetas(); desenharMapa(); } }));
  ["d-lat", "d-lon"].forEach(id => $(id).addEventListener("change", () => { lerFormularios(); desenharMapa(true); }));
  $("p-viagens").addEventListener("change", desenharResumo);
  $("p-cidade").addEventListener("change", () => { lerFormularios(); desenharEntregas(); });
  definirModo(null);
  carregarExemplo();
}
if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", iniciar);
if (typeof module !== "undefined") module.exports = { custoEmAndamento, replanejarNucleo, custoRota, simularRota, ordenarViagens, lerHora, otimizar, planejarViagens, tempoDoMaisDemorado, kmDasViagens, lerCoordenada, ordemDaLista, kmRota, tempoRota, textoParaLinhas, linhasParaEntregas, linhaReta, FATOR_RUA, KM_H_RESERVA, EXEMPLO };
