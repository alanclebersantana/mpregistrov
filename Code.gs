/**
 * MP · API do Dashboard de Emissões (planilha ponte)
 * ------------------------------------------------------------
 * NÃO mexe na planilha de vendas: só lê.
 * Funciona colado em qualquer projeto do Apps Script
 * (dentro de uma planilha vazia ou em script.google.com).
 *
 * 1. Cole este código no Code.gs (apague o que houver) → Salvar.
 * 2. Ajuste as duas linhas abaixo: PLANILHA_VENDAS e CHAVE.
 * 3. No seletor de funções escolha  testar  → Executar → autorize.
 *    O "Registro de execução" mostra quantas linhas leu por aba.
 * 4. Implantar → Nova implantação → App da Web
 *      Executar como: Eu  ·  Quem pode acessar: Qualquer pessoa
 *    Copie a URL /exec e cole no dashboard com a mesma CHAVE.
 *
 * Sua conta precisa ter pelo menos acesso de LEITOR à planilha de vendas.
 * Só as colunas da lista COLUNAS saem daqui:
 * CARTÕES, CONTA (senhas), CPFs e OBSERVAÇÃO nunca são enviados.
 */

// ▼▼▼ CONFIGURE AQUI ▼▼▼
const PLANILHA_VENDAS = 'COLE-AQUI-O-ID-DA-PLANILHA-DE-VENDAS';        // ID ou link inteiro
const CHAVE = 'mp-troque-esta-chave';                                   // sua senha do dashboard
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// chave de saída  →  nomes possíveis no cabeçalho (sem acento, maiúsculo)
const COLUNAS = {
  DATA: ['DATA'],
  LOCALIZADOR: ['LOCALIZADOR'],
  'MILHEIRO DE CUSTO': ['MILHEIRO DE CUSTO'],
  MILHAS: ['MILHAS'],
  TAXAS: ['TAXAS'],
  'TOTAL COM TAXAS RECEBIDO': ['TOTAL COM TAXAS RECEBIDO', 'TOTAL RECEBIDO', 'VALOR RECEBIDO'],
  'CUSTO COM TAXAS': ['CUSTO COM TAXAS'],
  LUCRO: ['LUCRO'],
  COMPANHIA: ['COMPANHIA', 'CIA'],
  STATUS: ['STATUS'],
  'PÓS': ['POS'],
  'RESPONSÁVEL': ['RESPONSAVEL'],
  FORNECEDOR: ['FORNECEDOR'],
  PAGO: ['PAGO'],
  CLIENTE: ['CLIENTE'],
  'MILHEIRO DE VENDA': ['MILHEIRO DE VENDA']
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    const cfg = config_();
    if (!cfg.chave || p.token !== cfg.chave) return json_({ ok: false, erro: 'Chave inválida' });
    if (p.modo === 'versao') return json_({ ok: true, versao: versao_() });   // consulta leve (tempo real)
    const d = montarDados_();
    d.versao = versao_();
    return json_(d);
  } catch (err) {
    return json_({ ok: false, erro: String(err) });
  }
}

function montarDados_() {
  const ss = fonte_();
  const tz = ss.getSpreadsheetTimeZone();
  const header = Object.keys(COLUNAS);
  const abas = [];

  ss.getSheets().forEach(function (sh) {
    const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 2) return;

    // procura o cabeçalho nas 30 primeiras linhas
    const topo = sh.getRange(1, 1, Math.min(30, lastRow), lastCol).getValues();
    let hi = -1, idx = null;
    for (let i = 0; i < topo.length; i++) {
      const h = topo[i].map(norm_);
      if (h.indexOf('LOCALIZADOR') >= 0 && h.indexOf('LUCRO') >= 0) {
        hi = i; idx = mapear_(topo[i]); break;
      }
    }
    if (hi < 0) return;

    const valores = sh.getRange(hi + 2, 1, lastRow - hi - 1, lastCol).getValues();
    const linhas = [];
    valores.forEach(function (r) {
      if (norm_(r[idx.LOCALIZADOR]) === 'LOCALIZADOR') { idx = mapear_(r); return; } // cabeçalho repetido
      const vazia = !r[idx.LOCALIZADOR] && !r[idx.MILHAS] && !r[idx.LUCRO];
      if (vazia) return;
      linhas.push(header.map(function (k) {
        const c = idx[k];
        if (c == null) return '';
        const v = r[c];
        if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
        return v;
      }));
    });
    abas.push({ nome: sh.getName(), linhas: linhas });
  });

  return {
    ok: true,
    planilha: ss.getName(),
    geradoEm: new Date().toISOString(),
    cabecalho: header,
    abas: abas
  };
}

function mapear_(linha) {
  const h = linha.map(norm_), idx = {};
  Object.keys(COLUNAS).forEach(function (k) {
    for (const nome of COLUNAS[k]) {
      const i = h.indexOf(nome);
      if (i >= 0) { idx[k] = i; break; }
    }
  });
  // cabeçalho DATA sobrescrito (ex.: aba de junho) → usa a coluna à esquerda do LOCALIZADOR
  if (idx.DATA == null && idx.LOCALIZADOR != null) idx.DATA = Math.max(0, idx.LOCALIZADOR - 1);
  return idx;
}

function norm_(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function config_() {
  return { fonte: String(PLANILHA_VENDAS).trim(), chave: String(CHAVE).trim() };
}

function fonte_() {
  const v = config_().fonte;
  if (!v) throw new Error('Preencha PLANILHA_VENDAS no topo do código');
  const m = v.match(/\/d\/([a-zA-Z0-9_-]{20,})/);           // aceita o link inteiro
  const id = m ? m[1] : v;
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error('Não consegui abrir a planilha de vendas (' + id + '). Confira o ID e se sua conta tem acesso de leitura.');
  }
}

// "Versão" da planilha de vendas = hora da última alteração no Drive.
// O dashboard consulta isso a cada 15 s e só baixa tudo quando muda.
function versao_() {
  try {
    const v = config_().fonte, m = v.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
    return DriveApp.getFileById(m ? m[1] : v).getLastUpdated().getTime();
  } catch (e) {
    return null; // sem permissão do Drive → dashboard cai para atualização a cada 2 min
  }
}

// Rode esta função no editor para autorizar e conferir a leitura
function testar() {
  const d = montarDados_();
  const total = d.abas.reduce(function (s, a) { return s + a.linhas.length; }, 0);
  Logger.log('OK — ' + d.planilha + ': ' + d.abas.length + ' abas, ' + total + ' linhas');
  d.abas.forEach(function (a) { Logger.log('  ' + a.nome + ': ' + a.linhas.length); });
  Logger.log('Última alteração: ' + new Date(versao_()));
  Logger.log('Chave do dashboard: ' + CHAVE);
}
