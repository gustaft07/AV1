import * as fs from "fs";
import * as path from "path";
import {
  criptografar,
  descriptografar,
  derivarChave,
  gerarChaveAleatoria,
  gerarSalt,
  PacoteCriptografado,
} from "./crypto";
import { Papel } from "../models/Papel";

const NOME_CONFIG = "config.master.json";
const SESSAO_TIMEOUT_MS = 30 * 60 * 1000;

export class ErroAutenticacao extends Error {}

interface KeySlot {
  login: string;
  papel: Papel;
  salt: string;
  chaveMestraEnvolvida: PacoteCriptografado;
  ativo: boolean;
  criadoEm: string;
}

interface ConfigMestre {
  versao: number;
  criadoEm: string;
  keyring: KeySlot[];
}

function caminhoConfig(diretorioBase: string): string {
  return path.join(diretorioBase, NOME_CONFIG);
}

export function configExiste(diretorioBase: string): boolean {
  return fs.existsSync(caminhoConfig(diretorioBase));
}

function salvarConfig(diretorioBase: string, config: ConfigMestre): void {
  const caminho = caminhoConfig(diretorioBase);
  const tmp = caminho + `.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, caminho);
}

function carregarConfig(diretorioBase: string): ConfigMestre {
  return JSON.parse(fs.readFileSync(caminhoConfig(diretorioBase), "utf8"));
}

export function provisionar(
  diretorioBase: string,
  loginAdmin: string,
  senhaAdmin: string
): void {
  if (configExiste(diretorioBase)) {
    throw new Error("Sistema já provisionado.");
  }
  if (senhaAdmin.length < 8) {
    throw new Error("Senha do administrador deve ter ao menos 8 caracteres.");
  }
  if (!fs.existsSync(diretorioBase)) fs.mkdirSync(diretorioBase, { recursive: true });

  const chaveMestra = gerarChaveAleatoria();
  const salt = gerarSalt();
  const kek = derivarChave(senhaAdmin, salt);
  const envolvida = criptografar(chaveMestra.toString("base64"), kek);

  const config: ConfigMestre = {
    versao: 1,
    criadoEm: new Date().toISOString(),
    keyring: [
      {
        login: loginAdmin,
        papel: Papel.ADMIN,
        salt: salt.toString("base64"),
        chaveMestraEnvolvida: envolvida,
        ativo: true,
        criadoEm: new Date().toISOString(),
      },
    ],
  };
  salvarConfig(diretorioBase, config);
}

export interface ResultadoLogin {
  login: string;
  papel: Papel;
  chaveMestra: Buffer;
}

export function login(
  diretorioBase: string,
  loginUsuario: string,
  senha: string
): ResultadoLogin {
  const config = carregarConfig(diretorioBase);
  const slot = config.keyring.find((s) => s.login === loginUsuario);
  if (!slot || !slot.ativo) {
    throw new ErroAutenticacao("Usuário inexistente ou inativo.");
  }
  const kek = derivarChave(senha, Buffer.from(slot.salt, "base64"));
  try {
    const chaveMestraBase64 = descriptografar(slot.chaveMestraEnvolvida, kek);
    return {
      login: slot.login,
      papel: slot.papel,
      chaveMestra: Buffer.from(chaveMestraBase64, "base64"),
    };
  } catch {
    throw new ErroAutenticacao("Login ou senha inválidos.");
  }
}

export function criarUsuarioNoKeyring(
  diretorioBase: string,
  chaveMestra: Buffer,
  novoLogin: string,
  novaSenha: string,
  papel: Papel
): void {
  if (novaSenha.length < 8) {
    throw new Error("Senha deve ter ao menos 8 caracteres.");
  }
  const config = carregarConfig(diretorioBase);
  if (config.keyring.some((s) => s.login === novoLogin)) {
    throw new Error(`Login "${novoLogin}" já existe.`);
  }
  const salt = gerarSalt();
  const kek = derivarChave(novaSenha, salt);
  const envolvida = criptografar(chaveMestra.toString("base64"), kek);
  config.keyring.push({
    login: novoLogin,
    papel,
    salt: salt.toString("base64"),
    chaveMestraEnvolvida: envolvida,
    ativo: true,
    criadoEm: new Date().toISOString(),
  });
  salvarConfig(diretorioBase, config);
}

export function desativarUsuario(diretorioBase: string, loginAlvo: string): void {
  const config = carregarConfig(diretorioBase);
  const slot = config.keyring.find((s) => s.login === loginAlvo);
  if (!slot) throw new Error(`Usuário "${loginAlvo}" não encontrado.`);
  slot.ativo = false;
  salvarConfig(diretorioBase, config);
}

export function listarUsuarios(
  diretorioBase: string
): { login: string; papel: Papel; ativo: boolean; criadoEm: string }[] {
  const config = carregarConfig(diretorioBase);
  return config.keyring.map(({ login, papel, ativo, criadoEm }) => ({
    login,
    papel,
    ativo,
    criadoEm,
  }));
}

export class Sessao {
  private expiraEm: number;
  constructor(
    public readonly login: string,
    public readonly papel: Papel,
    public readonly chaveMestra: Buffer
  ) {
    this.expiraEm = Date.now() + SESSAO_TIMEOUT_MS;
  }

  tocar(): void {
    this.expiraEm = Date.now() + SESSAO_TIMEOUT_MS;
  }

  expirada(): boolean {
    return Date.now() > this.expiraEm;
  }

  minutosRestantes(): number {
    return Math.max(0, Math.round((this.expiraEm - Date.now()) / 60000));
  }
}
