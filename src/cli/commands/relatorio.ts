import { Contexto } from "../contexto";
import { ComandoParseado } from "../parser";

export function relatorioJournal(
  p: ComandoParseado["params"],
  ctx: Contexto
): string {
  const limite = p["limite"] && p["limite"] !== true ? Number(p["limite"]) : 20;
  const entradas = ctx.journal.lerTudo().slice(-limite);
  if (entradas.length === 0) return "Journal vazio.";
  return entradas
    .map(
      (e) =>
        `${e.timestamp} | ${e.ator} (${e.papel}) | ${e.acao} | ${JSON.stringify(e.detalhes)}`
    )
    .join("\n");
}
