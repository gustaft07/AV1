import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { Contexto } from "./contexto";
import { parseComando } from "./parser";
import { COMANDOS } from "./comandos";
import { papelPodeExecutar, acoesPermitidas } from "./permissoes";
import { montarMenu } from "./menu";

const NOME_HISTORICO = ".greencode_history";

function caminhoHistorico(diretorioBase: string): string {
  return path.join(diretorioBase, NOME_HISTORICO);
}

function carregarHistorico(diretorioBase: string): string[] {
  const caminho = caminhoHistorico(diretorioBase);
  if (!fs.existsSync(caminho)) return [];
  return fs
    .readFileSync(caminho, "utf8")
    .split("\n")
    .filter(Boolean)
    .reverse(); 
}

function gravarHistorico(diretorioBase: string, linha: string): void {
  fs.appendFileSync(caminhoHistorico(diretorioBase), linha + "\n");
}

export function executarComando(linha: string, ctx: Contexto): { saida: string; deveSair: boolean } {
  if (ctx.sessao.expirada()) {
    return {
      saida: "[SESSÃO EXPIRADA] Mais de 30 minutos de inatividade. Faça login novamente.",
      deveSair: true,
    };
  }
  ctx.sessao.tocar();

  const comando = parseComando(linha);
  if (!comando) return { saida: "", deveSair: false };

  if (comando.acao === "sair") {
    return { saida: "Encerrando sessão...", deveSair: true };
  }
  if (comando.acao === "ajuda") {
    return { saida: montarMenu(ctx.sessao.papel), deveSair: false };
  }

  const handler = COMANDOS[comando.acao];
  if (!handler) {
    return {
      saida: `[ERRO] Comando desconhecido: "${comando.acao}". Digite "ajuda" para ver as opções.`,
      deveSair: false,
    };
  }
  if (!papelPodeExecutar(ctx.sessao.papel, comando.acao)) {
    return {
      saida: `[ACESSO NEGADO] Seu papel (${ctx.sessao.papel}) não tem permissão para "${comando.acao}".`,
      deveSair: false,
    };
  }

  try {
    const saida = handler(comando.params, ctx);
    return { saida, deveSair: false };
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : String(erro);
    return { saida: `[ERRO] ${msg}`, deveSair: false };
  }
}

export function iniciarRepl(ctx: Contexto): Promise<void> {
  return new Promise((resolve) => {
    const acoesDisponiveis = acoesPermitidas(ctx.sessao.papel).concat(["sair", "ajuda"]);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `greencode(${ctx.sessao.login})> `,
      history: carregarHistorico(ctx.diretorioBase),
      completer: (linhaAtual: string) => {
        const hits = acoesDisponiveis.filter((a) => a.startsWith(linhaAtual));
        return [hits.length ? hits : acoesDisponiveis, linhaAtual];
      },
    });

    console.log(montarMenu(ctx.sessao.papel));
    rl.prompt();

    rl.on("line", (linha) => {
      if (linha.trim()) gravarHistorico(ctx.diretorioBase, linha.trim());
      const { saida, deveSair } = executarComando(linha, ctx);
      if (saida) console.log(saida);
      if (deveSair) {
        rl.close();
        return;
      }
      rl.prompt();
    });

    rl.on("close", () => {
      console.log("Sessão encerrada. Até logo!");
      resolve();
    });
  });
}
