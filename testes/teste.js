/* Testes da leitura de arquivo, da otimização e da recarga. Rodar com: node testes/teste.js */
const A = require('../src/app.js');
let falhas = 0;
const confere = (nome, ok, detalhe = '') => { console.log((ok ? 'OK     ' : 'FALHOU ') + nome + (detalhe ? ' | ' + detalhe : '')); if (!ok) falhas++; };

// 1. leitura de arquivo
const t = A.linhasParaEntregas(A.textoParaLinhas('cliente;rua;numero;bairro;cidade;quantidade;coordenada\nA;"Rua X; fundos";10;Centro;Garibaldi;2;\nB;;;;;3;-29.25, -51.52\nC;;;;;1;\n'));
confere('CSV com cabeçalho', t.entregas.length === 2 && t.entregas[0].rua === 'Rua X; fundos' && t.entregas[0].numero === '10' && t.entregas[1].lat === -29.25 && t.avisos.length === 1, JSON.stringify(t.avisos));
const t2 = A.linhasParaEntregas(A.textoParaLinhas('Nome,Endereço,Número,Município,Botijões,Latitude,Longitude\nZ,Av. Teste,55,Carlos Barbosa,4,"-29,3","-51,5"\n'));
confere('CSV com vírgula e sinônimos', t2.entregas[0].rua === 'Av. Teste' && t2.entregas[0].cidade === 'Carlos Barbosa' && t2.entregas[0].qtd === 4 && t2.entregas[0].lat === -29.3);
confere('coordenada colada', ['-29.2562, -51.5269', '-29,2562; -51,5269', 'https://maps.google.com/?q=-29.2562,-51.5269', 'https://www.google.com/maps/@-29.2562,-51.5269,17z'].every(x => { const c = A.lerCoordenada(x); return c && c.lat === -29.2562 && c.lon === -51.5269; }) && A.lerCoordenada('Rua 13 de Maio, 310') === null);

// 2. otimização com o exemplo (linha reta)
const d = A.EXEMPLO.deposito, es = A.EXEMPLO.entregas.filter(e => Number.isFinite(e[5])).map(e => ({ lat: e[5], lon: e[6], qtd: e[7] }));
const pts = [d].concat(es), K = pts.map(a => pts.map(b => A.linhaReta(a, b) * A.FATOR_RUA)), M = K.map(l => l.map(v => v / A.KM_H_RESERVA * 60));
const dem = [0].concat(es.map(e => e.qtd)), total = dem.reduce((s, x) => s + x, 0);
const cobre = (rotas, fora) => { const todos = rotas.flat().concat(fora).sort((a, b) => a - b); return todos.length === es.length && todos.every((v, i) => v === i + 1); };
const nV = c => c.map((_, i) => i);
for (const caps of [[60, 45, 25], [200], [40, 40, 40, 40]]) for (const modo of ['regiao', 'tempo']) {
  const s = A.otimizar(M, dem, caps, { parada: 7, retorno: true, modo });
  const cargas = s.rotas.map(r => r.reduce((x, i) => x + dem[i], 0)), km = s.rotas.reduce((x, r) => x + A.kmRota(r, K, true), 0), base = A.ordemDaLista(dem, caps, false);
  confere(`${JSON.stringify(caps)} ${modo}`, cobre(s.rotas, s.fora) && !s.fora.length && cargas.every((c, i) => c <= caps[i]) && km < A.kmDasViagens(base.rotas, base.dono, caps.length, K, true),
    `km ${km.toFixed(1)} | termina em ${Math.round(A.tempoDoMaisDemorado(s.rotas, nV(caps), M, { parada: 7 }))} min | paradas ${s.rotas.map(r => r.length)}`);
}
for (const caps of [[60, 45, 25], [40, 40, 40, 40]]) { // os dois modos têm de entregar o que prometem
  const P = { parada: 7, retorno: true }, r = A.otimizar(M, dem, caps, { ...P, modo: 'regiao' }), t = A.otimizar(M, dem, caps, { ...P, modo: 'tempo' });
  const km = s => s.rotas.reduce((x, y) => x + A.kmRota(y, K, true), 0), fim = s => A.tempoDoMaisDemorado(s.rotas, nV(caps), M, P);
  confere(`${JSON.stringify(caps)} região roda menos, tempo termina antes`, km(r) <= km(t) + 1e-6 && fim(t) <= fim(r) + 1e-6, `região ${km(r).toFixed(1)} km / ${Math.round(fim(r))} min; tempo ${km(t).toFixed(1)} km / ${Math.round(fim(t))} min`);
}
{ // as entregas de Carlos Barbosa (latitude abaixo de -29,28) devem ficar em um único veículo
  const s = A.otimizar(M, dem, [60, 45, 25], { parada: 7, retorno: true, modo: 'regiao' });
  const comCB = s.rotas.filter(r => r.some(i => es[i - 1].lat < -29.28)), misto = comCB.filter(r => r.some(i => es[i - 1].lat >= -29.28));
  confere('cada cidade com o seu veículo', comCB.length === 1 && misto.length === 0, `veículos em Carlos Barbosa: ${comCB.length}; rotas que misturam cidades: ${misto.length}`);
}

// 3. recarga: capacidade menor que os pedidos
for (const caps of [[30, 25, 20], [30, 20], [15], [40, 10]]) {
  const P = { parada: 7, retorno: true, recarga: 10, modo: 'regiao' };
  const sem = A.planejarViagens(M, K, dem, caps, P, false), com = A.planejarViagens(M, K, dem, caps, P, true);
  const cargasOk = com.rotas.every((r, i) => r.reduce((x, j) => x + dem[j], 0) <= caps[com.dono[i]]);
  const viagens = caps.map((_, v) => com.rotas.filter((r, i) => com.dono[i] === v && r.length).length);
  confere(`recarga ${JSON.stringify(caps)} para ${total} botijões`, cobre(com.rotas, com.fora) && com.fora.length === 0 && cargasOk && sem.fora.length > 0,
    `sem recarga ficam ${sem.fora.length} de fora; com recarga, viagens por veículo ${viagens}, km ${A.kmDasViagens(com.rotas, com.dono, caps.length, K, true).toFixed(1)}`);
}
{ // a viagem extra deve ir para o veículo que roda menos: testa contra forçar cada veículo
  const caps = [30, 25, 20], P = { parada: 7, retorno: true, modo: 'regiao' }, com = A.planejarViagens(M, K, dem, caps, P, true);
  const km = A.kmDasViagens(com.rotas, com.dono, 3, K, true);
  const alternativas = caps.map((c, v) => { const s = A.otimizar(M, dem, caps.concat([c]), P); return s.fora.length ? Infinity : A.kmDasViagens(s.rotas, [0, 1, 2, v], 3, K, true); });
  confere('viagem extra no veículo mais eficiente', km <= Math.min(...alternativas) + 1e-6, `escolhido ${km.toFixed(1)} km; por veículo ${alternativas.map(x => x.toFixed(1))}`);
}
{ // pedido maior que qualquer veículo fica de fora mesmo com recarga
  const dem2 = dem.slice(); dem2[1] = 99;
  const s = A.planejarViagens(M, K, dem2, [30, 25, 20], { parada: 7, retorno: true, modo: 'regiao' }, true);
  confere('pedido maior que o maior veículo', s.fora.length === 1 && s.fora[0] === 1);
}

{ // recarga no modo de menor tempo: também atende tudo e não termina depois do modo por região
  const caps = [30, 25, 20], P = { parada: 7, retorno: true, recarga: 10 };
  const r = A.planejarViagens(M, K, dem, caps, { ...P, modo: 'regiao' }, true), t = A.planejarViagens(M, K, dem, caps, { ...P, modo: 'tempo' }, true);
  const fim = s => A.tempoDoMaisDemorado(s.rotas, s.dono, M, P);
  confere('recarga no modo tempo', cobre(t.rotas, t.fora) && !t.fora.length && fim(t) <= fim(r) + 1e-6, `região termina em ${Math.round(fim(r))} min com ${A.kmDasViagens(r.rotas, r.dono, 3, K, true).toFixed(1)} km; tempo em ${Math.round(fim(t))} min com ${A.kmDasViagens(t.rotas, t.dono, 3, K, true).toFixed(1)} km`);
}

// 3b. hora marcada
confere('leitura de hora', A.lerHora('9:30') === '09:30' && A.lerHora('14h') === '14:00' && A.lerHora('09h05') === '09:05' && A.lerHora('8') === '08:00' && A.lerHora('25:00') === '' && A.lerHora('tarde') === '');
{
  const atrasos = (s, P) => { // simula cada rota saindo às P.saida e soma os minutos de atraso
    let total = 0, n = 0;
    s.rotas.forEach(r => { let t = P.saida, ant = 0; r.forEach(i => { t += M[ant][i]; const j = P.janelas[i]; if (j) { if (t < j[0]) t = j[0]; else if (t > j[1]) { total += t - j[1]; n++; } } t += P.parada; ant = i; }); });
    return { total, n };
  };
  for (const modo of ['regiao', 'tempo']) {
    // três entregas com hora marcada espalhadas pela manhã, tolerância de 15 min
    const marc = { 5: 600, 25: 660, 30: 540, 12: 500, 38: 630 }, janelas = dem.map((_, i) => marc[i] ? [marc[i] - 15, marc[i] + 15] : null);
    const P = { parada: 7, retorno: true, saida: 480, modo, janelas }, livre = { parada: 7, retorno: true, saida: 480, modo };
    const com = A.otimizar(M, dem, [60, 45, 25], P), sem = A.otimizar(M, dem, [60, 45, 25], livre);
    const a = atrasos(com, P), b = atrasos(sem, P);
    confere(`hora marcada respeitada (${modo})`, cobre(com.rotas, com.fora) && a.n === 0, `com a regra: ${a.n} atrasadas; ignorando a hora: ${b.n} atrasadas, ${Math.round(b.total)} min`);
  }
  { // a hora marcada muda a ordem das paradas, não a divisão por região
    const marc = { 5: 600, 25: 660, 30: 540 }, janelas = dem.map((_, i) => marc[i] ? [marc[i] - 15, marc[i] + 15] : null), P = { parada: 7, retorno: true, saida: 480, modo: 'regiao' };
    const sem = A.otimizar(M, dem, [60, 45, 25], P), com = A.otimizar(M, dem, [60, 45, 25], { ...P, janelas });
    const divisao = x => x.rotas.map(r => r.slice().sort((a, b) => a - b).join(',')).sort().join(' | ');
    confere('hora marcada mantém cada entrega no seu veículo', divisao(sem) === divisao(com) && atrasos(com, { ...P, janelas }).n === 0);
  }
  // horário impossível: saída às 8h e entrega marcada para as 6h tem de aparecer como atraso, sem travar
  const janelas = dem.map((_, i) => i === 30 ? [345, 375] : null), P = { parada: 7, retorno: true, saida: 480, modo: 'regiao', janelas };
  const s = A.otimizar(M, dem, [60, 45, 25], P), a = atrasos(s, P);
  confere('hora impossível vira atraso e é a primeira parada', cobre(s.rotas, s.fora) && a.n === 1 && s.rotas.some(r => r[0] === 30));
  confere('sem hora marcada o custo é o tempo da rota', Math.abs(A.custoRota([3, 7, 9], M, { parada: 7, retorno: true }, 480) - A.tempoRota([3, 7, 9], M, 7, true)) < 1e-9);
}

// 3c. rotas em andamento: pedidos novos com os veículos na rua
{
  const P = { parada: 7, retorno: true, recarga: 10, saida: 480, modo: 'regiao', permitirRecarga: true };
  // plano original sem as cinco últimas entregas; depois elas chegam como pedidos novos
  const corte = es.length - 4, nNovo = [corte, corte + 1, corte + 2, corte + 3, corte + 4];
  const plano = A.otimizar(M.slice(0, corte).map(l => l.slice(0, corte)), dem.slice(0, corte), [60, 45, 25], P);
  // cada veículo já entregou as três primeiras paradas; saiu cheio
  const caps = [60, 45, 25];
  const veiculos = plano.rotas.map((r, k) => { const feitas = r.slice(0, 3), resto = r.slice(3), entregue = feitas.reduce((x, i) => x + dem[i], 0);
    return { cap: caps[k], naRua: feitas.length > 0, inicioNo: feitas.length ? feitas[feitas.length - 1] : 0, inicioHora: 480 + 30, limite0: caps[k] - entregue, viagens: [resto] }; });
  const antes = veiculos.map(v => v.viagens[0].slice()), kmAntes = veiculos.reduce((x, v) => x + A.custoEmAndamento(v, M, K, P).km, 0);
  const r = A.replanejarNucleo(M, K, dem, veiculos, nNovo, P);
  const depois = r.veiculos.flatMap(v => v.viagens.flat()), todos = antes.flat().concat(nNovo).sort((a, b) => a - b);
  const mantidas = antes.every((lista, k) => lista.every(i => r.veiculos[k].viagens.flat().includes(i)));
  const cargaOk = r.veiculos.every(v => v.viagens.every((x, j) => x.reduce((y, i) => y + dem[i], 0) <= (j === 0 ? v.limite0 : v.cap)));
  const kmDepois = r.veiculos.reduce((x, v) => x + A.custoEmAndamento(v, M, K, P).km, 0);
  confere('pedidos novos entram sem tirar entrega de veículo', r.fora.length === 0 && mantidas && cargaOk && new Set(depois).size === depois.length && !antes.flat().some(i => nNovo.includes(i)) && depois.slice().sort((a, b) => a - b).join() === todos.join(),
    `5 pedidos novos: de ${kmAntes.toFixed(1)} para ${kmDepois.toFixed(1)} km restantes; viagens por veículo ${r.veiculos.map(v => v.viagens.length)}`);
  // sem carga a bordo: o pedido novo exige volta ao depósito
  const seco = [{ cap: 20, naRua: true, inicioNo: 3, inicioHora: 540, limite0: 2, viagens: [[4, 6]] }];
  const r2 = A.replanejarNucleo(M, K, dem.map((q, i) => i === 4 || i === 6 ? 1 : q), seco, [5], P);       // a entrega 5 pede 6 botijões
  confere('sem carga a bordo, o pedido novo vai em nova viagem com recarga', r2.fora.length === 0 && r2.veiculos[0].viagens.length === 2 && r2.veiculos[0].viagens[1].includes(5) && !r2.veiculos[0].viagens[0].includes(5));
  const r3 = A.replanejarNucleo(M, K, dem.map((q, i) => i === 4 || i === 6 ? 1 : q), [{ cap: 20, naRua: true, inicioNo: 3, inicioHora: 540, limite0: 2, viagens: [[4, 6]] }], [5], { ...P, permitirRecarga: false });
  confere('sem recarga permitida, o pedido novo fica de fora', r3.fora.length === 1 && r3.fora[0] === 5);
  // pedido novo com hora marcada apertada passa na frente
  const janelas = dem.map((_, i) => i === 12 ? [545, 575] : null);
  const r4 = A.replanejarNucleo(M, K, dem, [{ cap: 60, naRua: true, inicioNo: 2, inicioHora: 540, limite0: 40, viagens: [[3, 4, 6, 8, 10]] }], [12], { ...P, janelas });
  const t = A.custoEmAndamento(r4.veiculos[0], M, K, { ...P, janelas });
  confere('pedido novo com hora marcada é atendido no horário', r4.fora.length === 0 && t.multa === 0, `ordem ${r4.veiculos[0].viagens[0]}`);
}

{ // pedido novo perto de um veículo não vai para outro só porque este tem tempo de espera sobrando
  const janelas = dem.map((_, i) => i === 5 ? [700, 730] : null), P = { parada: 7, retorno: true, recarga: 10, saida: 480, janelas, permitirRecarga: true };
  const cb = es.map((e, i) => i + 1).filter(i => es[i - 1].lat < -29.28), gar = es.map((e, i) => i + 1).filter(i => es[i - 1].lat >= -29.28 && i !== 5);
  const novo = cb[cb.length - 1];
  const vs = [{ cap: 60, naRua: true, inicioNo: cb[0], inicioHora: 500, limite0: 40, viagens: [cb.slice(1, 6)] },                 // em Carlos Barbosa
              { cap: 60, naRua: true, inicioNo: gar[0], inicioHora: 500, limite0: 40, viagens: [gar.slice(1, 4).concat([5])] }];   // em Garibaldi, com espera longa pela hora marcada
  const r = A.replanejarNucleo(M, K, dem, vs, [novo], P);
  confere('pedido novo vai para o veículo que está perto, não para o que tem espera', r.veiculos[0].viagens.flat().includes(novo));
}

// 4. estresse: 99 pontos aleatórios
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const Pn = [{ lat: -29.25, lon: -51.52 }]; for (let i = 0; i < 99; i++) Pn.push({ lat: -29.25 + (rnd() - .5) * .1, lon: -51.52 + (rnd() - .5) * .1 });
const K2 = Pn.map(a => Pn.map(b => A.linhaReta(a, b) * 1.35)), M2 = K2.map(l => l.map(v => v / 25 * 60)), dem2 = [0].concat(Pn.slice(1).map(() => 1 + Math.floor(rnd() * 3)));
const t0 = Date.now(), s2 = A.planejarViagens(M2, K2, dem2, [40, 30, 30], { parada: 7, retorno: true, modo: 'regiao' }, true);
confere('99 entregas com recarga', s2.fora.length === 0 && Date.now() - t0 < 20000, `${Date.now() - t0} ms; viagens ${s2.dono.length}; km ${A.kmDasViagens(s2.rotas, s2.dono, 3, K2, true).toFixed(1)}`);

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\nTodos os testes passaram');
process.exit(falhas ? 1 : 0);
