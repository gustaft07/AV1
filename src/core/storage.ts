import * as fs from "fs";
import * as path from "path";
import { criptografar, descriptografar, PacoteCriptografado } from "./crypto";

export class Storage {
  constructor(private readonly diretorioBase: string, private readonly chaveMestra: Buffer) {
    if (!fs.existsSync(diretorioBase)) {
      fs.mkdirSync(diretorioBase, { recursive: true });
    }
  }

  private caminho(nomeArquivo: string): string {
    return path.join(this.diretorioBase, nomeArquivo);
  }

  existe(nomeArquivo: string): boolean {
    return fs.existsSync(this.caminho(nomeArquivo));
  }

  lerJSON<T>(nomeArquivo: string, valorPadrao: T): T {
    const caminho = this.caminho(nomeArquivo);
    if (!fs.existsSync(caminho)) return valorPadrao;
    const bruto = fs.readFileSync(caminho, "utf8");
    const pacote: PacoteCriptografado = JSON.parse(bruto);
    const textoPlano = descriptografar(pacote, this.chaveMestra);
    return JSON.parse(textoPlano) as T;
  }

  escreverJSON<T>(nomeArquivo: string, valor: T): void {
    const caminho = this.caminho(nomeArquivo);
    const tmp = caminho + `.tmp-${process.pid}-${Date.now()}`;
    const textoPlano = JSON.stringify(valor, null, 2);
    const pacote = criptografar(textoPlano, this.chaveMestra);
    fs.writeFileSync(tmp, JSON.stringify(pacote), { mode: 0o600 });
    fs.renameSync(tmp, caminho); 
  }

  caminhoAbsoluto(nomeArquivo: string): string {
    return this.caminho(nomeArquivo);
  }
}
