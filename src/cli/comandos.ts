import { Contexto } from "./contexto";
import { ComandoParseado } from "./parser";
import * as org from "./commands/organizacao";
import * as lote from "./commands/lote";
import * as equip from "./commands/equipamento";
import * as usuario from "./commands/usuario";
import * as relatorio from "./commands/relatorio";

export type HandlerComando = (
  params: ComandoParseado["params"],
  ctx: Contexto
) => string;

export const COMANDOS: Record<string, HandlerComando> = {
  "org criar": org.orgCriar,
  "org listar": org.orgListar,
  "org consultar": org.orgConsultar,

  "lote criar": lote.loteCriar,
  "lote listar": lote.loteListar,
  "lote consultar": lote.loteConsultar,

  "equipamento cadastrar": equip.equipamentoCadastrar,
  "equipamento triagem": equip.equipamentoTriagem,
  "equipamento estado": equip.equipamentoEstado,
  "equipamento desmonte": equip.equipamentoDesmonte,
  "equipamento listar": equip.equipamentoListar,
  "equipamento consultar": equip.equipamentoConsultar,
  "equipamento rastreabilidade": equip.equipamentoRastreabilidade,

  "usuario criar": usuario.usuarioCriar,
  "usuario desativar": usuario.usuarioDesativar,
  "usuario listar": usuario.usuarioListar,

  "relatorio journal": relatorio.relatorioJournal,
};
