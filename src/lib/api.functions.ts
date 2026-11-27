import { createServerFn } from "@tanstack/react-start";
import type { Json } from "@/lib/db-types";

type Obj = Record<string, unknown>;

const BOOL_NOTA = ["fracionado"];
const BOOL_REC = ["tem_ocorrencia", "lanc_kpi", "lanc_controle_paletes", "lanc_email"];

function linha(o: Obj, bools: string[] = [], jsons: string[] = []): Obj {
  const r: Obj = { ...o };
  for (const b of bools) if (b in r) r[b] = Boolean(r[b]);
  for (const j of jsons) if (typeof r[j] === "string") r[j] = JSON.parse(r[j] as string);
  return r;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const txt = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const int0 = (v: unknown) => Math.trunc(num(v) ?? 0);

/* ───────── Cargas ───────── */

export const buscarCargas = createServerFn({ method: "POST" })
  .inputValidator((i: { termo: string }) => ({ termo: String(i?.termo ?? "").trim() }))
  .handler(async ({ data }) => {
    const { banco } = await import("@/server/db");
    const like = `%${data.termo}%`;
    const rows =
      data.termo === ""
        ? banco().prepare("select * from cargas order by processada_em desc limit 500").all()
        : banco()
            .prepare(
              `select c.* from cargas c
               where c.numero_carga like ?1 or exists (
                 select 1 from notas n where n.carga_id = c.id
                   and (n.nf like ?1 or n.pedido like ?1 or n.destinatario like ?1))
               order by c.processada_em desc limit 500`,
            )
            .all(like);
    return rows as unknown as Json;
  });

export const lerCarga = createServerFn({ method: "POST" })
  .inputValidator((i: { id: string }) => ({ id: String(i?.id ?? "") }))
  .handler(async ({ data }) => {
    const { banco } = await import("@/server/db");
    const carga = banco().prepare("select * from cargas where id = ?").get(data.id) as Obj | undefined;
    if (!carga) return null;
    const notas = (banco().prepare("select * from notas where carga_id = ? order by rowid").all(data.id) as Obj[]).map((n) =>
      linha(n, BOOL_NOTA),
    );
    return { carga, notas } as unknown as Json;
  });

export const cargaExistente = createServerFn({ method: "POST" })
  .inputValidator((i: { numero: string }) => ({ numero: String(i?.numero ?? "").trim() }))
  .handler(async ({ data }) => {
    const { banco } = await import("@/server/db");
    return (
      (banco()
        .prepare("select processada_em, processada_por_email, total_notas from cargas where numero_carga = ?")
        .get(data.numero) as unknown as { processada_em: string; processada_por_email: string; total_notas: number } | undefined) ?? null
    );
  });

export const salvarCarga = createServerFn({ method: "POST" })
  .inputValidator((i: { carga: Obj; notas: Obj[]; substituir: boolean }) => ({
    carga: (i?.carga ?? {}) as Obj,
    notas: Array.isArray(i?.notas) ? i.notas : [],
    substituir: Boolean(i?.substituir),
  }))
  .handler(async ({ data }) => {
    const { banco, uuid } = await import("@/server/db");
    const db = banco();
    const c = data.carga;
    const numero = txt(c["numero_carga"]).trim();
    if (!numero) throw new Error("Número da carga vazio");
    const id = uuid();
    db.exec("begin immediate");
    try {
      const ja = db.prepare("select id from cargas where numero_carga = ?").get(numero);
      if (ja) {
        if (!data.substituir) throw new Error("CARGA_JA_EXISTE");
        db.prepare("delete from cargas where numero_carga = ?").run(numero);
      }
      db.prepare(
        `insert into cargas (id, numero_carga, processada_em, total_notas, vendas, trocas, bonificacoes, brindes, amostras, outras,
           notas_fracionadas, notas_sem_volume, peso_liquido_total_kg, peso_bruto_total_kg)
         values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        id, numero, new Date().toISOString(), int0(c["total_notas"]), int0(c["vendas"]), int0(c["trocas"]), int0(c["bonificacoes"]),
        int0(c["brindes"]), int0(c["amostras"]), int0(c["outras"]), int0(c["notas_fracionadas"]), int0(c["notas_sem_volume"]),
        num(c["peso_liquido_total_kg"]), num(c["peso_bruto_total_kg"]),
      );
      const ins = db.prepare(
        `insert into notas (id, carga_id, nf, pedido, numero_troca, natureza_operacao, tipo, destinatario, cidade_uf, valor_nf, volumes,
           qtde_cx, qtde_fd, qtde_un, fracionado, especie_volume, chave_acesso, peso_liquido_kg, peso_bruto_kg)
         values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      );
      for (const n of data.notas) {
        ins.run(
          uuid(), id, txt(n["nf"]), txt(n["pedido"]), txt(n["numero_troca"]) || null, txt(n["natureza_operacao"]), txt(n["tipo"]),
          txt(n["destinatario"]), txt(n["cidade_uf"]), num(n["valor_nf"]) ?? 0, num(n["volumes"]), num(n["qtde_cx"]) ?? 0,
          num(n["qtde_fd"]) ?? 0, num(n["qtde_un"]) ?? 0, n["fracionado"] ? 1 : 0, txt(n["especie_volume"]), txt(n["chave_acesso"]),
          num(n["peso_liquido_kg"]), num(n["peso_bruto_kg"]),
        );
      }
      db.exec("commit");
    } catch (e) {
      db.exec("rollback");
      throw e;
    }
    return id;
  });

export const excluirCarga = createServerFn({ method: "POST" })
  .inputValidator((i: { id: string }) => ({ id: String(i?.id ?? "") }))
  .handler(async ({ data }) => {
    const { banco } = await import("@/server/db");
    banco().prepare("delete from cargas where id = ?").run(data.id);
    return true;
  });

export const dashboardCargas = createServerFn({ method: "POST" })
  .inputValidator((i: { de: string | null; ate: string | null }) => ({ de: i?.de ?? null, ate: i?.ate ?? null }))
  .handler(async ({ data }) => {
    const { banco } = await import("@/server/db");
    const db = banco();
    const filtro = "(?1 is null or c.processada_em >= ?1) and (?2 is null or c.processada_em < ?2)";
    const cargas = db
      .prepare(
        `select c.id, c.numero_carga, c.processada_em,
           count(n.id) as notas,
           coalesce(sum(case when n.tipo = 'Troca' then 1 else 0 end), 0) as trocas,
           coalesce(sum(n.valor_nf), 0) as valor,
           coalesce(sum(case when n.tipo = 'Troca' then n.valor_nf else 0 end), 0) as valor_trocas,
           coalesce(sum(n.volumes), 0) as volumes,
           sum(n.peso_bruto_kg) as peso_bruto,
           sum(n.peso_liquido_kg) as peso_liquido,
           coalesce(sum(case when n.id is not null and n.peso_bruto_kg is null then 1 else 0 end), 0) as notas_sem_peso_bruto,
           coalesce(sum(case when n.id is not null and n.peso_liquido_kg is null then 1 else 0 end), 0) as notas_sem_peso_liquido
         from cargas c left join notas n on n.carga_id = c.id
         where ${filtro} group by c.id order by c.processada_em`,
      )
      .all(data.de, data.ate);
    const cidades = db
      .prepare(
        `select n.carga_id, n.cidade_uf, count(*) as notas, coalesce(sum(n.valor_nf), 0) as valor
         from notas n join cargas c on c.id = n.carga_id where ${filtro} group by n.carga_id, n.cidade_uf`,
      )
      .all(data.de, data.ate);
    return { cargas, cidades } as unknown as Json;
  });

/* ───────── Recebimentos ───────── */

const CAMPOS_REC = [
  "data_chegada", "hora_chegada", "hora_inicio", "hora_final", "data_saida", "cliente", "origem", "motorista", "transportadora",
  "veiculo", "placa", "peso_kg", "valor", "transporte", "cubagem_m3", "volumes", "quant_nfe", "lacre", "paletes_total", "paletes_pbr",
  "paletes_chep", "paletes_descartavel", "paletes_quebrados", "tem_ocorrencia", "ocorrencias", "lanc_kpi", "lanc_controle_paletes",
  "lanc_email", "conferente", "assinatura_conferente", "assinatura_motorista",
] as const;

const TEXTO_OBRIG = ["origem", "transportadora", "veiculo", "transporte", "lacre", "conferente"];

function valoresRec(r: Obj): unknown[] {
  return CAMPOS_REC.map((k) => {
    const v = r[k];
    if (k === "ocorrencias") return JSON.stringify(v ?? []);
    if (BOOL_REC.includes(k)) return v ? 1 : 0;
    if ((v === undefined || v === null) && TEXTO_OBRIG.includes(k)) return "";
    return v === undefined ? null : v;
  });
}

const LISTA_SEM_ASSINATURA =
  "id,criado_em,atualizado_em,criado_por,criado_por_email,data_chegada,hora_chegada,hora_inicio,hora_final,data_saida,cliente,origem,motorista,transportadora,veiculo,placa,peso_kg,valor,transporte,cubagem_m3,volumes,quant_nfe,lacre,paletes_total,paletes_pbr,paletes_chep,paletes_descartavel,paletes_quebrados,tem_ocorrencia,ocorrencias,lanc_kpi,lanc_controle_paletes,lanc_email,conferente";

export const listarRecebimentos = createServerFn({ method: "POST" }).handler(async () => {
  const { banco } = await import("@/server/db");
  const rows = banco()
    .prepare(`select ${LISTA_SEM_ASSINATURA} from recebimentos order by data_chegada desc, criado_em desc`)
    .all() as Obj[];
  return rows.map((r) => linha(r, BOOL_REC, ["ocorrencias"])) as unknown as Json;
});

export const lerRecebimento = createServerFn({ method: "POST" })
  .inputValidator((i: { id: string }) => ({ id: String(i?.id ?? "") }))
  .handler(async ({ data }) => {
    const { banco } = await import("@/server/db");
    const r = banco().prepare("select * from recebimentos where id = ?").get(data.id) as Obj | undefined;
    return r ? (linha(r, BOOL_REC, ["ocorrencias"]) as unknown as Json) : null;
  });

export const criarRecebimento = createServerFn({ method: "POST" })
  .inputValidator((i: { registro: Obj }) => ({ registro: (i?.registro ?? {}) as Obj }))
  .handler(async ({ data }) => {
    const { banco, uuid } = await import("@/server/db");
    const id = uuid();
    const agora = new Date().toISOString();
    banco()
      .prepare(
        `insert into recebimentos (id, criado_em, atualizado_em, ${CAMPOS_REC.join(",")}) values (?,?,?,${CAMPOS_REC.map(() => "?").join(",")})`,
      )
      .run(id, agora, agora, ...(valoresRec(data.registro) as never[]));
    return id;
  });

export const atualizarRecebimento = createServerFn({ method: "POST" })
  .inputValidator((i: { id: string; registro: Obj }) => ({ id: String(i?.id ?? ""), registro: (i?.registro ?? {}) as Obj }))
  .handler(async ({ data }) => {
    const { banco } = await import("@/server/db");
    banco()
      .prepare(`update recebimentos set atualizado_em = ?, ${CAMPOS_REC.map((k) => `${k} = ?`).join(", ")} where id = ?`)
      .run(new Date().toISOString(), ...(valoresRec(data.registro) as never[]), data.id);
    return true;
  });

export const excluirRecebimento = createServerFn({ method: "POST" })
  .inputValidator((i: { id: string }) => ({ id: String(i?.id ?? "") }))
  .handler(async ({ data }) => {
    const { banco } = await import("@/server/db");
    banco().prepare("delete from recebimentos where id = ?").run(data.id);
    return true;
  });

export const baixarBackup = createServerFn({ method: "POST" }).handler(async () => {
  const { copiaDoBanco } = await import("@/server/db");
  return copiaDoBanco().toString("base64");
});
