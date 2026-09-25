import * as readline from "readline";

export function lerSenhaOculta(pergunta: string): Promise<string> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(pergunta, (resposta) => {
        rl.close();
        resolve(resposta);
      });
      return;
    }

    process.stdout.write(pergunta);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let senha = "";
    const onData = (char: string) => {
      const codigo = char.charCodeAt(0);
      if (char === "\n" || char === "\r" || codigo === 4) {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(senha);
      } else if (codigo === 3) {
        process.stdout.write("\n");
        process.exit(130);
      } else if (codigo === 127 || codigo === 8) {
        if (senha.length > 0) {
          senha = senha.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else {
        senha += char;
        process.stdout.write("*");
      }
    };
    stdin.on("data", onData);
  });
}
