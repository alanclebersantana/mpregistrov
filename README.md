# MP · Dashboard de Emissões

Painel em tempo real das emissões da Milhas Plus. Os dados são lidos da planilha de vendas
por um Apps Script (só leitura) e o painel roda no GitHub Pages como PWA (dá para instalar no celular e no PC).

```
index.html             ← o dashboard (arquivo único, sem build)
manifest.webmanifest   ← dados do PWA
sw.js                  ← service worker (cache do app; os dados sempre vêm da rede)
icons/                 ← ícones do app
apps-script/Code.gs    ← API que lê a planilha de vendas
```

## 1. Apps Script (API)

1. Crie uma planilha vazia (ex.: "MP Dashboard – Ponte") → **Extensões → Apps Script**
   (ou crie direto em script.google.com).
2. Cole o conteúdo de `apps-script/Code.gs` e preencha no topo:
   - `PLANILHA_VENDAS` → ID ou link da planilha de registro de vendas
   - `CHAVE` → uma senha sua
3. Escolha a função **testar** → **Executar** → autorize (Planilhas + Drive).
   O registro deve mostrar `OK — … abas, … linhas`.
4. **Implantar → Nova implantação → App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
5. Copie a URL que termina em `/exec`.

> Ao alterar o script: **Implantar → Gerenciar implantações → Editar → Nova versão** (a URL continua a mesma).

## 2. GitHub Pages

1. Crie o repositório e envie estes arquivos (pode arrastar tudo em **Add file → Upload files**).
2. **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**.
3. Em 1–2 minutos o painel fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

## 3. Primeiro acesso

Abra o link → **Conectar à planilha online** → cole a URL `/exec` e a chave → **Salvar e conectar**.
A conexão fica salva só naquele navegador (cada computador/celular conecta uma vez).

## Segurança

- A URL do Apps Script e a chave **não ficam no repositório** — só no navegador de quem conectou.
- **Não coloque a chave real nem o ID da planilha no `Code.gs` que está no GitHub.** Preencha só na cópia colada no Apps Script.
- Só saem da planilha: data, localizador, milhas, taxas, valores, lucro, companhia, status, pós, responsável, fornecedor, pago, cliente e milheiros.
  **Cartões, senhas de conta, CPFs e observações nunca são enviados.**
- Quem tiver URL + chave vê os dados de vendas. Para trocar o acesso, mude a `CHAVE` e publique nova versão.

## Tempo real

A cada 15 s o painel consulta só a data da última alteração da planilha (leve) e baixa tudo quando muda;
de qualquer forma recarrega a cada 2 min. Com a aba escondida ele pausa e confere ao voltar.
Uma edição na planilha costuma aparecer em segundos até ~1 min (tempo do Google registrar a alteração).

## Atualizar o app

Edite `index.html` no GitHub. Se mudar os arquivos do cache, troque `CACHE = 'mp-emissoes-v1'`
em `sw.js` para `v2`, `v3`… para forçar os aparelhos a pegarem a versão nova.
