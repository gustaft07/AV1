import { Contexto } from "../contexto";
import { ComandoParseado } from "../parser";
import { FabricaEntidades } from "../../models/Fabrica";
import { Movimentacao } from "../../models/Movimentacao";
import { EstadoFisico, ESCALA_ESTADO_FISICO } from "../../core/validation";

function textoParam(p: ComandoParseado["params"], chave: string): string {
  const v = p[chave];
  if (v === undefined || v === true) {
    throw new Error(`Parâmetro obrigatório ausente: --${chave}`);
  }
  return v;
}

function validarEstado(estado: string): EstadoFisico {
  if (!(ESCALA_ESTADO_FISICO as readonly string[]).includes(estado)) {
    throw new Error(
      `Estado físico inválido: "${estado}". Válidos: ${ESCALA_ESTADO_FISICO.join(", ")}`
    );
  }
  return estado as EstadoFisico;
}

export function equipamentoCadastrar(
  p: ComandoParseado["params"],
  ctx: Contexto
): string {
  const codigoBarras = textoParam(p, "codigo");
  const codigoLote = textoParam(p, "lote");
  const tipo = textoParam(p, "tipo");
  const estado = validarEstado(textoParam(p, "estado"));

  const lote = ctx.lotes.porCodigo(codigoLote);
  if (!lote) throw new Error(`Lote "${codigoLote}" não encontrado.`);
  if (ctx.equipamentos.porCodigoBarras(codigoBarras)) {
    throw new Error(`Já existe equipamento com código de barras "${codigoBarras}".`);
  }

  const equip = FabricaEntidades.criarEquipamento({
    codigoBarras,
    loteId: lote.id,
    tipo,
    estadoFisico: estado,
  });
  ctx.equipamentos.salvar(equip);
  ctx.registrarJournal("equipamento.cadastrar", { codigoBarras, lote: codigoLote, tipo, estado });
  return `[OK] Equipamento "${codigoBarras}" cadastrado no lote "${codigoLote}".`;
}

export function equipamentoTriagem(
  p: ComandoParseado["params"],
  ctx: Contexto
): string {
  const codigoBarras = textoParam(p, "codigo");
  const equip = ctx.equipamentos.porCodigoBarras(codigoBarras);
  if (!equip) throw new Error(`Equipamento "${codigoBarras}" não encontrado.`);

  equip.status = equip.status === "recebido" ? "triagem" : "triagem_completa";
  ctx.equipamentos.salvar(equip);

  const mov = new Movimentacao({
    equipamentoId: equip.id,
    tipo: "triagem",
    ator: ctx.sessao.login,
    observacao: `Status -> ${equip.status}`,
  });
  mov.validar();
  ctx.movimentacoes.salvar(mov);
  ctx.registrarJournal("equipamento.triagem", { codigoBarras, novoStatus: equip.status });
  return `[OK] Equipamento "${codigoBarras}" agora em status "${equip.status}".`;
}

export function equipamentoEstado(
  p: ComandoParseado["params"],
  ctx: Contexto
): string {
  const codigoBarras = textoParam(p, "codigo");
  const novoEstado = validarEstado(textoParam(p, "estado"));
  const justificativa =
    p["justificativa"] && p["justificativa"] !== true ? p["justificativa"] : undefined;

  const equip = ctx.equipamentos.porCodigoBarras(codigoBarras);
  if (!equip) throw new Error(`Equipamento "${codigoBarras}" não encontrado.`);

  const estadoAnterior = equip.estadoFisico;
  equip.alterarEstadoFisico(novoEstado, justificativa); 
  ctx.equipamentos.salvar(equip);
  ctx.registrarJournal("equipamento.alterar_estado", {
    codigoBarras,
    de: estadoAnterior,
    para: novoEstado,
    justificativa: justificativa ?? null,
  });
  return `[OK] Estado físico de "${codigoBarras}" alterado: ${estadoAnterior} -> ${novoEstado}.`;
}

export function equipamentoDesmonte(
  p: ComandoParseado["params"],
  ctx: Contexto
): string {
  const codigoBarras = textoParam(p, "codigo");
  const equip = ctx.equipamentos.porCodigoBarras(codigoBarras);
  if (!equip) throw new Error(`Equipamento "${codigoBarras}" não encontrado.`);

  equip.moverParaDesmonte(); 
  ctx.equipamentos.salvar(equip);

  const mov = new Movimentacao({
    equipamentoId: equip.id,
    tipo: "desmonte",
    ator: ctx.sessao.login,
  });
  mov.validar();
  ctx.movimentacoes.salvar(mov);
  ctx.registrarJournal("equipamento.desmonte", { codigoBarras });
  return `[OK] Equipamento "${codigoBarras}" movido para desmonte.`;
}

export function equipamentoListar(
  _p: ComandoParseado["params"],
  ctx: Contexto
): string {
  const todos = ctx.equipamentos.listar();
  if (todos.length === 0) return "Nenhum equipamento cadastrado.";
  return todos
    .map(
      (e) =>
        `- ${e.codigoBarras} | ${e.tipo} | estado=${e.estadoFisico} | status=${e.status}`
    )
    .join("\n");
}

export function equipamentoConsultar(
  p: ComandoParseado["params"],
  ctx: Contexto
): string {
  const codigoBarras = textoParam(p, "codigo");
  const equip = ctx.equipamentos.porCodigoBarras(codigoBarras);
  if (!equip) return `[ERRO] Equipamento "${codigoBarras}" não encontrado.`;
  return JSON.stringify(equip.paraJSON(), null, 2);
}

export function equipamentoRastreabilidade(
  p: ComandoParseado["params"],
  ctx: Contexto
): string {
  const codigoBarras = textoParam(p, "codigo");
  const equip = ctx.equipamentos.porCodigoBarras(codigoBarras);
  if (!equip) return `[ERRO] Equipamento "${codigoBarras}" não encontrado.`;
  const movs = ctx.movimentacoes
    .porEquipamento(equip.id)
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));

  const linhas = [
    `Equipamento: ${equip.codigoBarras} (${equip.tipo})`,
    `Estado físico atual: ${equip.estadoFisico} | Status: ${equip.status}`,
    `Histórico de estado físico:`,
    ...equip.historicoEstado.map(
      (h) => `  ${h.em} | ${h.de} -> ${h.para}${h.justificativa ? ` (${h.justificativa})` : ""}`
    ),
    `Movimentações:`,
    ...movs.map((m) => `  ${m.criadoEm} | ${m.tipo} | por ${m.ator}${m.observacao ? ` | ${m.observacao}` : ""}`),
  ];
  return linhas.join("\n");
}
