import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/**
 * Banco de dados local (SQLite). O arquivo fica em DATA_DIR (padrão ./dados), fora da pasta do
 * sistema, para sobreviver às atualizações. Backup diário em DATA_DIR/backups (últimos 30).
 */
const DIR = path.resolve(process.env["DATA_DIR"] ?? "./dados");
let db: DatabaseSync | null = null;

const ESQUEMA = `
create table if not exists cargas (
  id text primary key,
  numero_carga text not null unique,
  processada_em text not null,
  processada_por text,
  processada_por_email text not null default '',
  total_notas integer not null default 0,
  vendas integer not null default 0,
  trocas integer not null default 0,
  bonificacoes integer not null default 0,
  brindes integer not null default 0,
  amostras integer not null default 0,
  outras integer not null default 0,
  notas_fracionadas integer not null default 0,
  notas_sem_volume integer not null default 0,
  peso_liquido_total_kg real,
  peso_bruto_total_kg real
);
create table if not exists notas (
  id text primary key,
  carga_id text not null references cargas(id) on delete cascade,
  nf text not null default '',
  pedido text not null default '',
  numero_troca text,
  natureza_operacao text not null default '',
  tipo text not null default '',
  destinatario text not null default '',
  cidade_uf text not null default '',
  valor_nf real not null default 0,
  volumes real,
  qtde_cx real not null default 0,
  qtde_fd real not null default 0,
  qtde_un real not null default 0,
  fracionado integer not null default 0,
  especie_volume text not null default '',
  chave_acesso text not null default '',
  peso_liquido_kg real,
  peso_bruto_kg real
);
create index if not exists notas_carga_id_idx on notas (carga_id);
create table if not exists recebimentos (
  id text primary key,
  criado_em text not null,
  atualizado_em text not null,
  criado_por text,
  criado_por_email text not null default '',
  data_chegada text not null,
  hora_chegada text, hora_inicio text, hora_final text, data_saida text,
  cliente text not null,
  origem text not null default '',
  motorista text not null,
  transportadora text not null default '',
  veiculo text not null default '',
  placa text not null,
  peso_kg real, valor real,
  transporte text not null default '',
  cubagem_m3 real,
  volumes integer not null,
  quant_nfe integer,
  lacre text not null default '',
  paletes_total integer, paletes_pbr integer, paletes_chep integer, paletes_descartavel integer, paletes_quebrados integer,
  tem_ocorrencia integer not null default 0,
  ocorrencias text not null default '[]',
  lanc_kpi integer not null default 0,
  lanc_controle_paletes integer not null default 0,
  lanc_email integer not null default 0,
  conferente text not null default '',
  assinatura_conferente text,
  assinatura_motorista text
);
create index if not exists recebimentos_data_idx on recebimentos (data_chegada desc);
`;

export function banco(): DatabaseSync {
  if (db) return db;
  fs.mkdirSync(DIR, { recursive: true });
  db = new DatabaseSync(path.join(DIR, "expedicao.db"));
  db.exec("pragma journal_mode = wal; pragma foreign_keys = on; pragma busy_timeout = 5000;");
  db.exec(ESQUEMA);
  try {
    importarArquivo();
  } catch (e) {
    console.error("Importação falhou:", e);
  }
  try {
    backupDiario();
  } catch (e) {
    console.error("Backup diário falhou:", e);
  }
  const t = setInterval(() => {
    try {
      backupDiario();
    } catch (e) {
      console.error("Backup diário falhou:", e);
    }
  }, 6 * 3600 * 1000);
  t.unref?.();
  return db;
}

export function backupDiario(): void {
  const pasta = path.join(DIR, "backups");
  fs.mkdirSync(pasta, { recursive: true });
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const alvo = path.join(pasta, `expedicao-${hoje}.db`);
  if (!fs.existsSync(alvo)) banco().exec(`vacuum into '${alvo.replace(/'/g, "''")}'`);
  const antigos = fs.readdirSync(pasta).filter((f) => /^expedicao-.*\.db$/.test(f)).sort();
  for (const f of antigos.slice(0, Math.max(0, antigos.length - 30))) fs.rmSync(path.join(pasta, f), { force: true });
}

export const uuid = () => crypto.randomUUID();

const COLS_REC = [
  "id", "criado_em", "atualizado_em", "criado_por_email", "data_chegada", "hora_chegada", "hora_inicio", "hora_final", "data_saida",
  "cliente", "origem", "motorista", "transportadora", "veiculo", "placa", "peso_kg", "valor", "transporte", "cubagem_m3", "volumes",
  "quant_nfe", "lacre", "paletes_total", "paletes_pbr", "paletes_chep", "paletes_descartavel", "paletes_quebrados", "tem_ocorrencia",
  "ocorrencias", "lanc_kpi", "lanc_controle_paletes", "lanc_email", "conferente", "assinatura_conferente", "assinatura_motorista",
];

/** Se existir DATA_DIR/importar.json ({ recebimentos: [...] }), importa uma vez e renomeia o arquivo. */
function importarArquivo(): void {
  const arq = path.join(DIR, "importar.json");
  if (!fs.existsSync(arq)) return;
  const dados = JSON.parse(fs.readFileSync(arq, "utf8")) as { recebimentos?: Record<string, unknown>[] };
  const d = db!;
  const ins = d.prepare(
    `insert or ignore into recebimentos (${COLS_REC.join(",")}) values (${COLS_REC.map(() => "?").join(",")})`,
  );
  d.exec("begin");
  try {
    for (const r of dados.recebimentos ?? []) {
      ins.run(
        ...(COLS_REC.map((c) => {
          const v = r[c];
          if (c === "ocorrencias") return JSON.stringify(v ?? []);
          if (typeof v === "boolean") return v ? 1 : 0;
          return v === undefined ? null : v;
        }) as never[]),
      );
    }
    d.exec("commit");
  } catch (e) {
    d.exec("rollback");
    throw e;
  }
  fs.renameSync(arq, path.join(DIR, "importar.feito.json"));
}

/** Cópia consistente do banco, em bytes (para o botão "Baixar backup"). */
export function copiaDoBanco(): Buffer {
  const tmp = path.join(DIR, `copia-${Date.now()}.tmp`);
  banco().exec(`vacuum into '${tmp.replace(/'/g, "''")}'`);
  try {
    return fs.readFileSync(tmp);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}
