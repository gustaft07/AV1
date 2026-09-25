import { Contexto } from "../contexto";
import { ComandoParseado } from "../parser";
import { FabricaEntidades } from "../../models/Fabrica";

function textoParam(p: ComandoParseado["params"], chave: string): string {
  const v = p[chave];
  if (v === undefined || v === true) {
    throw new Error(`Parâmetro obrigatório ausente: --${chave}`);
  }
  return v;
}

export function loteCriar(p: ComandoParseado["params"], ctx: Contexto): string {
  const codigo = textoParam(p, "codigo");
  const org = textoParam(p, "org");
  const nf = textoParam(p, "nf");
  const transp = textoParam(p, "transp");
  const dataEntrada = p["data"] && p["data"] !== true ? p["data"] : undefined;

  if (!ctx.organizacoes.porCodigo(org)) {
    throw new Error(`Organização "${org}" não encontrada. Cadastre-a primeiro.`);
  }
  if (ctx.lotes.porCodigo(codigo)) {
    throw new Error(`Já existe lote com código "${codigo}".`);
  }

  const lote = FabricaEntidades.criarLote({
    codigoLote: codigo,
    organizacaoCodigo: org,
    notaFiscal: nf,
    transportadora: transp,
    dataEntrada,
  });
  ctx.lotes.salvar(lote);
  ctx.registrarJournal("lote.criar", { codigo, org, nf, transp });
  return `[OK] Lote "${codigo}" criado para organização "${org}" (id=${lote.id}).`;
}

export function loteListar(_p: ComandoParseado["params"], ctx: Contexto): string {
  const todos = ctx.lotes.listar();
  if (todos.length === 0) return "Nenhum lote cadastrado.";
  return todos
    .map(
      (l) =>
        `- ${l.codigoLote} | org=${l.organizacaoCodigo} | NF=${l.notaFiscal} | ${l.transportadora}`
    )
    .join("\n");
}

export function loteConsultar(p: ComandoParseado["params"], ctx: Contexto): string {
  const codigo = textoParam(p, "codigo");
  const lote = ctx.lotes.porCodigo(codigo);
  if (!lote) return `[ERRO] Lote "${codigo}" não encontrado.`;
  return JSON.stringify(lote.paraJSON(), null, 2);
}
