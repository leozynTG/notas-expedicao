# Notas Expedicao

Crie um aplicativo web em português (Brasil), simples e limpo, chamado "Expedição CDLog". Ele roda 100% no navegador: NÃO use backend, banco de dados, login nem Supabase, e nenhum arquivo pode ser enviado para servidor. Use bibliotecas client-side: JSZip (ler/gerar zip), ExcelJS ou SheetJS (gerar .xlsx) e pdfjs-dist (ler PDF).

ENTRADAS (tela de upload com arrastar e soltar)
1. Um .zip com os XMLs de NF-e de uma carga (pode ter subpastas; ignore arquivos que não sejam .xml).
2. Opcional: o PDF (ou .txt do PDF) do "Mapa analítico / Impressão dos pedidos" da mesma carga.

LEITURA DE CADA XML (nfeProc v4.00, ignore namespaces)
- NF = ide/nNF
- Chave de acesso = atributo Id de infNFe sem o prefixo "NFe"
- Natureza da operação = ide/natOp
- Destinatário = dest/xNome; CNPJ/CPF = dest/CNPJ ou dest/CPF
- Cidade/UF = dest/enderDest/xMun + "/" + dest/enderDest/UF
- Valor da NF = total/ICMSTot/vNF
- Pedido: NÃO está em xPed. Está em infAdic/infCpl no formato "PEDIDO: AAJMxx  CARGA: ...". Extrair com a regex PEDIDO:\s*(\S+)
- Observação fiscal = infAdic/infAdFisco
- Volumes = transp/vol/qVol (esse campo PODE NÃO EXISTIR em algumas notas; nesse caso deixar a célula vazia, nunca 0). Espécie = transp/vol/esp
- Para cada item (det/prod): uCom (CX, FD ou UN) e qCom. Somar qCom por unidade para gerar Qtde CX, Qtde FD e Qtde UN da nota.
- Fracionado = "Sim" se qualquer quantidade somada por unidade tiver parte decimal (ex.: 6,75 CX), senão "Não".

CLASSIFICAÇÃO (coluna "Tipo")
- natOp começa com "OUTRA SAIDA": se infAdFisco contém "TROCA" (sem diferenciar maiúsculas) → "Troca"; senão se contém "BRINDE" → "Brinde"; senão "Outra saída"
- natOp contém "AMOSTRA" → "Amostra"
- natOp contém "BONIFICACAO" → "Bonificação"
- natOp começa com "VENDA" → "Venda"
- caso contrário → "Outro"

NÚMERO DA TROCA (se o PDF/txt dos pickings for enviado)
- Cada picking começa após uma linha "IMPRESSO DIA ...". A primeira linha seguinte é o número do picking (somente dígitos): esse é o "número de identificação da troca".
- Dentro do mesmo bloco há a linha "PEDIDO N?MERO: 01-AAJSMI | TROCA ARMAZENAMENTO" (o acento pode vir corrompido, então use a regex PEDIDO N\S+:\s*\d+-(\w+)\s*\|\s*(.+) ). O código após "01-" é o pedido, que deve ser cruzado com o Pedido da NF.
- Preencher a coluna "Nº troca (picking)" somente para as notas do tipo Troca. As demais ficam vazias.
- Observação: o mesmo número se repete para todos os pickings do mesmo cliente na carga. Isso é esperado.
- Validação: conferir se o CNPJ do picking ("CNPJ....:") bate com o do destinatário da NF e avisar se divergir. Avisar também se alguma troca não achar picking.

SAÍDAS (botões de download)
1. Planilha .xlsx, aba "Notas", ordenada por NF, com as colunas nesta ordem: NF | Pedido | Nº troca (picking) | Natureza da operação | Tipo | Destinatário | Cidade/UF | Valor da NF (R$) | Volumes (XML) | Qtde CX | Qtde FD | Qtde UN | Fracionado | Espécie volume | Chave de acesso.
   - Fonte Arial 10, cabeçalho azul escuro (#1F4E78) com texto branco em negrito, primeira linha congelada, filtro automático ligado.
   - Linha final TOTAL com fórmulas SUM para Valor, Volumes, Qtde CX/FD/UN e COUNTIF para contar "Sim" em Fracionado.
   - Destacar em amarelo claro as células de quantidade das linhas com Fracionado = "Sim".
   - Chave de acesso formatada como texto (para o Excel não converter em notação científica).
2. Dois arquivos .zip com os XMLs originais, sem repetir nenhuma nota:
   - "trocas_brindes_amostras.zip": notas cuja natOp começa com "OUTRA SAIDA" OU contém "AMOSTRA".
   - "demais_notas.zip": todas as outras.

TELA DE RESULTADO
Mostrar um resumo antes do download: total de XMLs, contagem por Tipo, quantas notas são fracionadas, quantas não têm volume no XML, quantos XMLs ficaram sem pedido e quantas trocas ficaram sem número de picking. Mostrar os avisos (CNPJ divergente, pedido não encontrado) numa lista legível. Uma pré-visualização em tabela das primeiras linhas também ajuda.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://notas-expedicao.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6f13529c-d17f-42c5-a159-86fc18890ab2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
