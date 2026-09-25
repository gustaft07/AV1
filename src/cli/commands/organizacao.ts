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

export function orgCriar(p: ComandoParseado["params"], ctx: Contexto): string {
  const codigo = textoParam(p, "codigo");
  const cnpj = textoParam(p, "cnpj");
  const razao = textoParam(p, "razao");
  const contrato = textoParam(p, "contrato");

  if (ctx.organizacoes.porCodigo(codigo)) {
    throw new Error(`Já existe organização com código "${codigo}".`);
  }

  const org = FabricaEntidades.criarOrganizacao({
    codigo,
    razaoSocial: razao,
    cnpj,
    contratoColeta: contrato,
  });
  ctx.organizacoes.salvar(org);
  ctx.registrarJournal("org.criar", { codigo, cnpj });
  return `[OK] Organização "${codigo}" cadastrada (id=${org.id}).`;
}

export function orgListar(_p: ComandoParseado["params"], ctx: Contexto): string {
  const todas = ctx.organizacoes.listar();
  if (todas.length === 0) return "Nenhuma organização cadastrada.";
  return todas
    .map((o) => `- ${o.codigo} | ${o.razaoSocial} | CNPJ ${o.cnpj}`)
    .join("\n");
}

export function orgConsultar(p: ComandoParseado["params"], ctx: Contexto): string {
  const codigo = textoParam(p, "codigo");
  const org = ctx.organizacoes.porCodigo(codigo);
  if (!org) return `[ERRO] Organização "${codigo}" não encontrada.`;
  return JSON.stringify(org.paraJSON(), null, 2);
}
