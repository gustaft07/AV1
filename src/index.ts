import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";
import { configExiste, provisionar, login, Sessao, ErroAutenticacao } from "./core/auth";
import { Journal } from "./core/journal";
import { Contexto } from "./cli/contexto";
import { iniciarRepl, executarComando } from "./cli/repl";
import { lerSenhaOculta } from "./cli/entradaSegura";
import { parseComando } from "./cli/parser";

function lerArgv(): { datadir: string; scriptPath?: string } {
  const args = process.argv.slice(2);
  let datadir = path.join(process.cwd(), "dados");
  let scriptPath: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--datadir" && args[i + 1]) {
      datadir = args[i + 1];
      i++;
    } else if (args[i] === "--script" && args[i + 1]) {
      scriptPath = args[i + 1];
      i++;
    }
  }
  return { datadir, scriptPath };
}

function perguntar(pergunta: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(pergunta, (r) => { rl.close(); resolve(r); }));
}

async function provisionarInterativo(datadir: string): Promise<void> {
  console.log("== Provisionamento inicial do greencode ==");
  console.log("Nenhuma base de dados encontrada em: " + datadir);
  const loginAdmin = await perguntar("Login do administrador: ");
  const senha1 = await lerSenhaOculta("Senha do administrador (mín. 8 caracteres): ");
  const senha2 = await lerSenhaOculta("Confirme a senha: ");
  if (senha1 !== senha2) {
    console.error("[ERRO] As senhas não conferem. Reinicie o programa.");
    process.exit(1);
  }
  provisionar(datadir, loginAdmin, senha1);
  console.log(`[OK] Administrador "${loginAdmin}" provisionado com sucesso.\n`);
}

async function loginInterativo(datadir: string): Promise<Sessao> {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const loginUsuario = await perguntar("Login: ");
    const senha = await lerSenhaOculta("Senha: ");
    try {
      const resultado = login(datadir, loginUsuario, senha);
      console.log(`\nBem-vindo(a), ${resultado.login}!`);
      return new Sessao(resultado.login, resultado.papel, resultado.chaveMestra);
    } catch (e) {
      if (e instanceof ErroAutenticacao) {
        console.error(`[ERRO] ${e.message} (tentativa ${tentativa + 1}/3)`);
      } else {
        throw e;
      }
    }
  }
  console.error("[ERRO] Número máximo de tentativas de login excedido.");
  process.exit(1);
}

async function executarScript(datadir: string, scriptPath: string): Promise<void> {
  const linhas = fs
    .readFileSync(scriptPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  let sessao: Sessao | undefined;
  let ctx: Contexto | undefined;

  for (const linha of linhas) {
    const cmd = parseComando(linha);
    if (!cmd) continue;

    if (cmd.acao === "provisionar") {
      try {
        const loginAdmin = String(cmd.params["login"]);
        const senha = String(cmd.params["senha"]);
        provisionar(datadir, loginAdmin, senha);
        console.log(`[SCRIPT] provisionar -> [OK] admin "${loginAdmin}" criado.`);
      } catch (e) {
        console.log(`[SCRIPT] provisionar -> [ERRO] ${e instanceof Error ? e.message : e}`);
      }
      continue;
    }

    if (cmd.acao === "login") {
      try {
        const loginUsuario = String(cmd.params["login"]);
        const senha = String(cmd.params["senha"]);
        const resultado = login(datadir, loginUsuario, senha);
        sessao = new Sessao(resultado.login, resultado.papel, resultado.chaveMestra);
        ctx = new Contexto(datadir, sessao);
        console.log(`[SCRIPT] login -> [OK] logado como "${loginUsuario}" (${resultado.papel}).`);
      } catch (e) {
        console.log(`[SCRIPT] login -> [ERRO] ${e instanceof Error ? e.message : e}`);
      }
      continue;
    }

    if (!ctx) {
      console.error(`[SCRIPT] Comando "${cmd.acao}" ignorado: nenhum login ativo.`);
      continue;
    }

    const { saida, deveSair } = executarComando(linha, ctx);
    console.log(`[SCRIPT] ${linha}\n${saida}\n`);
    if (deveSair) break;
  }
}

async function main(): Promise<void> {
  const { datadir, scriptPath } = lerArgv();

  new Journal(datadir).aplicarRetencao();

  if (scriptPath) {
    await executarScript(datadir, scriptPath);
    return;
  }

  if (!configExiste(datadir)) {
    await provisionarInterativo(datadir);
  }

  const sessao = await loginInterativo(datadir);
  const ctx = new Contexto(datadir, sessao);
  await iniciarRepl(ctx);
}

main().catch((erro) => {
  console.error("[FALHA FATAL]", erro instanceof Error ? erro.message : erro);
  process.exit(1);
});

//Cliente não encontrado: Peter Parker