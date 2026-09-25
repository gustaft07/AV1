import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const TAMANHO_MAX_BYTES = 10 * 1024 * 1024;
const RETENCAO_DIAS = 180;

export interface EntradaJournal {
  timestamp: string;
  ator: string;
  papel: string;
  acao: string;
  detalhes: Record<string, unknown>;
  hashAnterior: string;
  hash: string;
}

export class Journal {
  private readonly diretorio: string;
  private readonly arquivoAtivo: string;

  constructor(diretorioBase: string) {
    this.diretorio = path.join(diretorioBase, "journal");
    if (!fs.existsSync(this.diretorio)) {
      fs.mkdirSync(this.diretorio, { recursive: true });
    }
    this.arquivoAtivo = path.join(this.diretorio, "journal.log");
  }

  private ultimoHash(): string {
    if (!fs.existsSync(this.arquivoAtivo)) return "GENESIS";
    const conteudo = fs.readFileSync(this.arquivoAtivo, "utf8").trim();
    if (!conteudo) return "GENESIS";
    const linhas = conteudo.split("\n");
    const ultima = JSON.parse(linhas[linhas.length - 1]) as EntradaJournal;
    return ultima.hash;
  }

  registrar(
    ator: string,
    papel: string,
    acao: string,
    detalhes: Record<string, unknown>
  ): EntradaJournal {
    this.rotacionarSeNecessario();
    const hashAnterior = this.ultimoHash();
    const base = {
      timestamp: new Date().toISOString(),
      ator,
      papel,
      acao,
      detalhes,
      hashAnterior,
    };
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(base))
      .digest("hex");
    const entrada: EntradaJournal = { ...base, hash };
    fs.appendFileSync(this.arquivoAtivo, JSON.stringify(entrada) + "\n", {
      mode: 0o600,
    });
    return entrada;
  }

  private rotacionarSeNecessario(): void {
    if (!fs.existsSync(this.arquivoAtivo)) return;
    const stat = fs.statSync(this.arquivoAtivo);
    if (stat.size < TAMANHO_MAX_BYTES) return;
    const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
    const destino = path.join(this.diretorio, `journal-${carimbo}.log`);
    fs.renameSync(this.arquivoAtivo, destino);
  }

  aplicarRetencao(): number {
    const agora = Date.now();
    const limite = RETENCAO_DIAS * 24 * 60 * 60 * 1000;
    let removidos = 0;
    for (const nome of fs.readdirSync(this.diretorio)) {
      if (nome === "journal.log") continue;
      const caminho = path.join(this.diretorio, nome);
      const stat = fs.statSync(caminho);
      if (agora - stat.mtimeMs > limite) {
        fs.unlinkSync(caminho);
        removidos++;
      }
    }
    return removidos;
  }

  lerTudo(): EntradaJournal[] {
    if (!fs.existsSync(this.arquivoAtivo)) return [];
    return fs
      .readFileSync(this.arquivoAtivo, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as EntradaJournal);
  }
}
