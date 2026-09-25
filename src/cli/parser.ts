export interface ComandoParseado {
  acao: string; 
  params: Record<string, string | true>;
}

function tokenizar(linha: string): string[] {
  const tokens: string[] = [];
  const regex = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(linha)) !== null) {
    tokens.push(m[1] !== undefined ? m[1] : m[2]);
  }
  return tokens;
}

export function parseComando(linha: string): ComandoParseado | null {
  const linhaLimpa = linha.trim();
  if (!linhaLimpa) return null;
  const tokens = tokenizar(linhaLimpa);

  const acaoTokens: string[] = [];
  let i = 0;
  while (i < tokens.length && !tokens[i].startsWith("--")) {
    acaoTokens.push(tokens[i]);
    i++;
  }

  const params: Record<string, string | true> = {};
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.startsWith("--")) {
      const chave = tok.slice(2);
      const proximo = tokens[i + 1];
      if (proximo !== undefined && !proximo.startsWith("--")) {
        params[chave] = proximo;
        i += 2;
      } else {
        params[chave] = true;
        i += 1;
      }
    } else {
      i += 1; 
    }
  }

  return { acao: acaoTokens.join(" "), params };
}
