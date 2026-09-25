import { Contexto } from "../contexto";
import { ComandoParseado } from "../parser";
import { criarUsuarioNoKeyring, desativarUsuario, listarUsuarios } from "../../core/auth";
import { Papel, TODOS_OS_PAPEIS } from "../../models/Papel";

function textoParam(p: ComandoParseado["params"], chave: string): string {
  const v = p[chave];
  if (v === undefined || v === true) {
    throw new Error(`Parâmetro obrigatório ausente: --${chave}`);
  }
  return v;
}

export function usuarioCriar(p: ComandoParseado["params"], ctx: Contexto): string {
  const login = textoParam(p, "login");
  const senha = textoParam(p, "senha");
  const papel = textoParam(p, "papel") as Papel;

  if (!TODOS_OS_PAPEIS.includes(papel)) {
    throw new Error(`Papel inválido. Use um de: ${TODOS_OS_PAPEIS.join(", ")}`);
  }

  criarUsuarioNoKeyring(ctx.diretorioBase, ctx.sessao.chaveMestra, login, senha, papel);
  ctx.registrarJournal("usuario.criar", { login, papel });
  return `[OK] Usuário "${login}" criado com papel "${papel}".`;
}

export function usuarioDesativar(p: ComandoParseado["params"], ctx: Contexto): string {
  const login = textoParam(p, "login");
  desativarUsuario(ctx.diretorioBase, login);
  ctx.registrarJournal("usuario.desativar", { login });
  return `[OK] Usuário "${login}" desativado.`;
}

export function usuarioListar(_p: ComandoParseado["params"], ctx: Contexto): string {
  const usuarios = listarUsuarios(ctx.diretorioBase);
  return usuarios
    .map((u) => `- ${u.login} | ${u.papel} | ${u.ativo ? "ativo" : "inativo"}`)
    .join("\n");
}
