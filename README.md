# Roteirizador de entregas

Ferramenta que monta a rota de entrega de cada veículo: o usuário cadastra os veículos, informa ou carrega a lista de entregas e recebe o roteiro no mapa, com a carga a bordo e o horário previsto de cada parada. Roda inteira no navegador, em um único arquivo HTML.

**Abrir a ferramenta:** https://fabi3105.github.io/roteirizador-entregas-glp/

## O que faz

- Cadastro de veículos com capacidade em botijões e marcação de quais saem no dia.
- Entregas digitadas ou carregadas de arquivo CSV ou Excel, com rua, número, bairro (opcional) e cidade. Quando o cliente manda a localização, a coordenada ou o link do mapa pode ser colado no lugar do endereço.
- Localização automática de endereços pelo OpenStreetMap, com aviso quando só a rua foi encontrada, e correção arrastando o marcador no mapa.
- Hora marcada opcional por entrega, com tolerância configurável: a divisão por região não muda, só a ordem das paradas de cada veículo; o veículo espera se chegar antes e o atraso previsto aparece quando o horário é impossível.
- Volta ao depósito para recarga quando os pedidos passam da capacidade: a viagem extra vai para o veículo que roda menos quilômetros no total.
- Divisão das entregas entre os veículos respeitando a capacidade, e ordenação de cada rota.
- Dois modos: um veículo por região, para rodar menos quilômetros, ou menor tempo de entrega, para a última entrega sair mais cedo em horários de pico.
- Mapa com uma cor por veículo, paradas numeradas e trajeto pelas ruas.
- Para cada parada: horário de chegada, quilômetros do trecho, botijões entregues e cheios que restam a bordo.
- Tempo total por veículo, com minutos por parada configuráveis (padrão de 7).
- Comparação com a ordem original da lista, exportação das rotas em CSV e impressão.

No exemplo embutido (42 entregas simuladas em Garibaldi e Carlos Barbosa, 3 veículos e uma recarga), o roteiro otimizado roda cerca de 60% menos quilômetros do que seguir a ordem da lista (medido com distâncias em linha reta; pelas ruas o número muda um pouco).

## Saída para o entregador

- **Impressão por veículo**: cada cartão de rota tem o botão "Imprimir"; "Imprimir todas" gera uma folha por veículo, com coluna para marcar a entrega feita.
- **Imagem da rota**: gera um PNG por veículo (paradas em ordem, endereço, hora prevista, botijões a entregar e cheios que ficam a bordo), para baixar, copiar ou compartilhar no WhatsApp.
- **Pedidos durante a rota**: marque as entregas já feitas, inclua os pedidos novos na lista e use "Atualizar rotas em andamento". As entregas feitas ficam como estão, cada veículo é considerado na última parada concluída e o pedido novo entra no veículo em que custa menos tempo de direção, respeitando os botijões cheios que ainda estão a bordo (ou abrindo uma viagem com recarga). A imagem sai marcada como versão 2, 3... com o pedido novo em destaque.
- **Sair com o veículo cheio** (opção ligada por padrão): o que sobra da capacidade vira reserva para pedidos novos.

## Como o roteiro é calculado

O problema é o de roteirização de veículos com capacidade (CVRP). A solução é uma heurística, escrita em JavaScript sem bibliotecas:

1. **Distâncias.** Tempo e quilômetros entre todos os pontos pelas ruas, pelo serviço público do OSRM sobre o mapa do OpenStreetMap. Sem resposta, usa linha reta × 1,35 a 25 km/h.
2. **Regiões.** Agrupamento com capacidade (k-medoides): um grupo de entregas próximas por veículo, com o grupo de maior carga no veículo maior. Vários pontos de partida são testados e fica o melhor.
3. **Ordem.** Em cada grupo, inserção mais barata, depois 2-opt e remanejamento de paradas.
4. **Divisas.** É onde os modos diferem. Por região: uma entrega só troca de veículo se o total diminuir sem alongar a rota mais comprida. Menor tempo: troca se isso encurtar o veículo mais demorado dos dois, mesmo rodando um pouco mais.

No exemplo, em linha reta e com três veículos sem recarga: por região, 36,6 km e término às 10h25; menor tempo, 46,0 km e término às 10h09.

O custo de uma rota é o tempo dirigindo mais o tempo parado, mais uma multa alta por minuto de atraso em entrega com hora marcada.

## Arquivos

| Caminho | Conteúdo |
|---|---|
| `index.html` | a ferramenta pronta, gerada por `montar.py` |
| `src/app.js` | leitura de arquivo, otimização, horários, mapa e telas |
| `src/corpo.html`, `src/*.css` | estrutura e aparência da página |
| `exemplos/entregas_exemplo.csv` | lista de entregas simulada, no formato aceito |
| `testes/teste.js` | testes da leitura de arquivo, da otimização e da recarga (`node testes/teste.js`) |

Formato do arquivo de entregas: colunas `cliente`, `rua`, `numero`, `bairro`, `cidade` e `quantidade`, mais `hora_marcada` e `coordenada` (opcionais), separadas por ponto e vírgula, vírgula ou tabulação. A ordem das colunas é livre quando há cabeçalho.

## Limites

- A rota é boa, não a melhor possível comprovada.
- Os tempos não consideram trânsito nem pausas.
- O OpenStreetMap não tem o número das casas em muitas cidades. Nesses casos o endereço cai no meio do trecho da rua e fica marcado como aproximado.
- A recarga considera que o depósito tem botijões cheios para todas as viagens.
- Pelas ruas, até 99 entregas por cálculo.
- Mapa, endereços e rotas vêm de serviços públicos gratuitos, sem garantia de disponibilidade. Para uso diário, o indicado é contratar ou hospedar os próprios.

## Privacidade

Os dados digitados ou carregados ficam no navegador. Endereços e coordenadas são enviados aos serviços do OpenStreetMap (Nominatim) e do OSRM para localizar e calcular as rotas.

## Autor

Fabian Aliatti Mayer. Estudo independente com dados simulados. Não usa dados internos da Aliatti Comércio de Gás.

Outros estudos da série: [preço do gás de cozinha no RS](https://github.com/Fabi3105/preco-gas-p13-rs) e [mercado de gás por município](https://github.com/Fabi3105/potencial-mercado-glp-rs).
