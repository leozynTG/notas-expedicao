# Expedição CDLog

Sistema interno da CDLog Logística: processa XMLs de NF-e, mapas analíticos, CTe, NF-e/boletos e o Controle de Recebimento.

- Roda no PC da expedição (Node.js), sem login, apenas na rede da empresa.
- Dados em SQLite (`dados/expedicao.db`, fora da pasta do sistema), com backup diário em `dados/backups`.
- Atualização automática: o PC baixa a versão publicada no ramo `entrega` deste repositório.
