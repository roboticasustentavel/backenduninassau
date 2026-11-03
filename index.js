// ======================================================
// 1. IMPORTANDO AS BIBLIOTECAS
// ======================================================

// Express cria o servidor e gerencia as rotas.
const express = require("express");

// CORS permite que outros sistemas acessem nossa API.
const cors = require("cors");

// Crypto é uma biblioteca nativa do Node.js.
// Vamos utilizá-la para proteger as senhas e gerar IDs.
const crypto = require("crypto");

// Criamos a aplicação Express.
const app = express();

// Define a porta em que o servidor será executado.
const PORT = 3000;

// ======================================================
// 2. CONFIGURAÇÕES DO SERVIDOR
// ======================================================

// Permite receber requisições de outros endereços.
app.use(cors());

// Permite que o servidor receba dados no formato JSON.
app.use(express.json());

// ======================================================
// 3. ARMAZENAMENTO DOS DADOS EM MEMÓRIA
// ======================================================

// Array que armazenará os usuários cadastrados.
// Os dados serão perdidos quando o servidor for desligado.
let usuarios = [];

// Array que armazenará as movimentações financeiras.
let movimentacoes = [];

// Objeto que armazenará os tokens de acesso dos usuários.
// Cada token representa uma sessão autenticada.
let sessoes = {};

// ======================================================
// 4. FUNÇÕES AUXILIARES
// ======================================================

// Gera um identificador único.
function gerarId() {
  return crypto.randomUUID();
}

// Transforma a senha em um hash seguro.
// Assim, não precisamos guardar a senha original.
function gerarHash(senha, salt) {
  return crypto.scryptSync(senha, salt, 64).toString("hex");
}

// Compara a senha digitada com o hash armazenado.
function verificarSenha(senha, salt, hashSalvo) {
  const hashDigitado = Buffer.from(gerarHash(senha, salt), "hex");
  const hashOriginal = Buffer.from(hashSalvo, "hex");

  return crypto.timingSafeEqual(hashDigitado, hashOriginal);
}

// ======================================================
// 5. MIDDLEWARE DE AUTENTICAÇÃO
// ======================================================

// Essa função verifica se o usuário está autenticado.
// Será utilizada nas rotas financeiras.
function autenticar(req, res, next) {
  // Recupera o cabeçalho Authorization.
  const authorization = req.headers.authorization;

  // Verifica se o cabeçalho foi enviado.
  if (!authorization) {
    return res.status(401).json({
      mensagem: "Acesso negado. Faça login primeiro.",
    });
  }

  // Esperamos receber: Bearer TOKEN
  const partes = authorization.split(" ");

  if (partes.length !== 2 || partes[0] !== "Bearer") {
    return res.status(401).json({
      mensagem: "Formato do token inválido.",
    });
  }

  const token = partes[1];

  // Verifica se o token existe nas sessões.
  const usuarioId = sessoes[token];

  if (!usuarioId) {
    return res.status(401).json({
      mensagem: "Token inválido ou sessão encerrada.",
    });
  }

  // Guarda o ID do usuário na requisição.
  req.usuarioId = usuarioId;

  // Permite continuar para a rota solicitada.
  next();
}

// ======================================================
// 6. CADASTRO DE USUÁRIOS
// ======================================================

// POST: cadastrar um novo usuário.
// Endereço: http://localhost:3000/usuarios/cadastrar

app.post("/usuarios/cadastrar", (req, res) => {
  // Recebe login e senha enviados pelo frontend.
  const { login, senha } = req.body;

  // Verifica se os campos foram preenchidos.
  if (!login || !senha) {
    return res.status(400).json({
      mensagem: "Informe login e senha.",
    });
  }

  // Verifica se o login possui pelo menos 3 caracteres.
  if (login.trim().length < 3) {
    return res.status(400).json({
      mensagem: "O login precisa ter pelo menos 3 caracteres.",
    });
  }

  // Verifica se a senha possui pelo menos 6 caracteres.
  if (senha.length < 6) {
    return res.status(400).json({
      mensagem: "A senha precisa ter pelo menos 6 caracteres.",
    });
  }

  // Padroniza o login para evitar duplicidades por maiúsculas.
  const loginNormalizado = login.trim().toLowerCase();

  // Procura se já existe um usuário com esse login.
  const usuarioExistente = usuarios.find(
    (usuario) => usuario.login === loginNormalizado,
  );

  if (usuarioExistente) {
    return res.status(409).json({
      mensagem: "Esse login já está cadastrado.",
    });
  }

  // Gera um salt aleatório para proteger a senha.
  const salt = crypto.randomBytes(16).toString("hex");

  // Gera o hash da senha.
  const hashSenha = gerarHash(senha, salt);

  // Cria o objeto do usuário.
  const novoUsuario = {
    id: gerarId(),
    login: loginNormalizado,
    salt: salt,
    senha: hashSenha,
  };

  // Guarda o usuário no array.
  usuarios.push(novoUsuario);

  // Retorna uma confirmação.
  return res.status(201).json({
    mensagem: "Usuário cadastrado com sucesso!",
    usuario: {
      id: novoUsuario.id,
      login: novoUsuario.login,
    },
  });
});

// ======================================================
// 7. LOGIN DO USUÁRIO
// ======================================================

// POST: validar login e senha.
// Endereço: http://localhost:3000/usuarios/login

app.post("/usuarios/login", (req, res) => {
  // Recebe os dados enviados pelo usuário.
  const { login, senha } = req.body;

  // Verifica se os campos foram informados.
  if (!login || !senha) {
    return res.status(400).json({
      mensagem: "Informe login e senha.",
    });
  }

  // Procura o usuário pelo login.
  const usuario = usuarios.find(
    (usuario) => usuario.login === login.trim().toLowerCase(),
  );

  // Se não encontrou, retorna erro.
  if (!usuario) {
    return res.status(401).json({
      mensagem: "Login ou senha incorretos.",
    });
  }

  // Confere se a senha está correta.
  const senhaCorreta = verificarSenha(senha, usuario.salt, usuario.senha);

  if (!senhaCorreta) {
    return res.status(401).json({
      mensagem: "Login ou senha incorretos.",
    });
  }

  // Cria um token aleatório para identificar a sessão.
  const token = crypto.randomBytes(32).toString("hex");

  // Relaciona o token ao ID do usuário.
  sessoes[token] = usuario.id;

  // Retorna o token para o frontend.
  return res.status(200).json({
    mensagem: "Login realizado com sucesso!",
    token: token,
    usuario: {
      id: usuario.id,
      login: usuario.login,
    },
  });
});

// ======================================================
// 8. CADASTRAR UMA MOVIMENTAÇÃO FINANCEIRA
// ======================================================

// POST: cadastrar entrada ou saída.
// Endereço: http://localhost:3000/financeiro

app.post("/financeiro", autenticar, (req, res) => {
  // Recebe os dados da movimentação.
  const { descricao, valor, tipo } = req.body;

  // Verifica se os campos foram preenchidos.
  if (!descricao || valor === undefined || !tipo) {
    return res.status(400).json({
      mensagem: "Informe descrição, valor e tipo.",
    });
  }

  // Verifica se o valor é numérico e positivo.
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
    return res.status(400).json({
      mensagem: "O valor precisa ser um número maior que zero.",
    });
  }

  // Verifica se o tipo é entrada ou saída.
  if (!["entrada", "saida"].includes(tipo)) {
    return res.status(400).json({
      mensagem: "O tipo deve ser entrada ou saida.",
    });
  }

  // Cria uma nova movimentação.
  const novaMovimentacao = {
    id: gerarId(),
    usuarioId: req.usuarioId,
    descricao: descricao.trim(),
    valor: Number(valor.toFixed(2)),
    tipo: tipo,
    data: new Date().toISOString(),
  };

  // Armazena no array.
  movimentacoes.push(novaMovimentacao);

  // Retorna a movimentação cadastrada.
  return res.status(201).json({
    mensagem: "Movimentação cadastrada com sucesso!",
    movimentacao: novaMovimentacao,
  });
});

// ======================================================
// 9. LISTAR TODAS AS MOVIMENTAÇÕES
// ======================================================

// GET: listar movimentações do usuário logado.
// Endereço: http://localhost:3000/financeiro

app.get("/financeiro", autenticar, (req, res) => {
  // Filtra somente as movimentações do usuário autenticado.
  const lista = movimentacoes.filter(
    (item) => item.usuarioId === req.usuarioId,
  );

  return res.status(200).json({
    total: lista.length,
    movimentacoes: lista,
  });
});

// ======================================================
// 10. BUSCAR UMA MOVIMENTAÇÃO PELO ID
// ======================================================

// GET: buscar uma movimentação específica.
// Endereço: http://localhost:3000/financeiro/ID

app.get("/financeiro/:id", autenticar, (req, res) => {
  // Recebe o ID enviado na URL.
  const id = req.params.id;

  // Procura a movimentação pertencente ao usuário.
  const movimentacao = movimentacoes.find(
    (item) => item.id === id && item.usuarioId === req.usuarioId,
  );

  // Se não encontrou, retorna erro.
  if (!movimentacao) {
    return res.status(404).json({
      mensagem: "Movimentação não encontrada.",
    });
  }

  return res.status(200).json(movimentacao);
});

// ======================================================
// 11. ATUALIZAR UMA MOVIMENTAÇÃO
// ======================================================

// PUT: atualizar descrição, valor ou tipo.
// Endereço: http://localhost:3000/financeiro/ID

app.put("/financeiro/:id", autenticar, (req, res) => {
  // Recebe o ID da movimentação.
  const id = req.params.id;

  // Procura a movimentação do usuário logado.
  const movimentacao = movimentacoes.find(
    (item) => item.id === id && item.usuarioId === req.usuarioId,
  );

  if (!movimentacao) {
    return res.status(404).json({
      mensagem: "Movimentação não encontrada.",
    });
  }

  // Recebe os campos que poderão ser atualizados.
  const { descricao, valor, tipo } = req.body;

  // Valida a descrição, caso tenha sido enviada.
  if (
    descricao !== undefined &&
    (typeof descricao !== "string" || !descricao.trim())
  ) {
    return res.status(400).json({
      mensagem: "Descrição inválida.",
    });
  }

  // Valida o valor, caso tenha sido enviado.
  if (
    valor !== undefined &&
    (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0)
  ) {
    return res.status(400).json({
      mensagem: "O valor precisa ser um número maior que zero.",
    });
  }

  // Valida o tipo, caso tenha sido enviado.
  if (tipo !== undefined && !["entrada", "saida"].includes(tipo)) {
    return res.status(400).json({
      mensagem: "O tipo deve ser entrada ou saida.",
    });
  }

  // Atualiza somente os campos enviados.
  if (descricao !== undefined) {
    movimentacao.descricao = descricao.trim();
  }

  if (valor !== undefined) {
    movimentacao.valor = Number(valor.toFixed(2));
  }

  if (tipo !== undefined) {
    movimentacao.tipo = tipo;
  }

  // Retorna o objeto atualizado.
  return res.status(200).json({
    mensagem: "Movimentação atualizada com sucesso!",
    movimentacao: movimentacao,
  });
});

// ======================================================
// 12. EXCLUIR UMA MOVIMENTAÇÃO
// ======================================================

// DELETE: excluir uma movimentação.
// Endereço: http://localhost:3000/financeiro/ID

app.delete("/financeiro/:id", autenticar, (req, res) => {
  // Recebe o ID da movimentação.
  const id = req.params.id;

  // Procura o índice da movimentação do usuário.
  const indice = movimentacoes.findIndex(
    (item) => item.id === id && item.usuarioId === req.usuarioId,
  );

  // Verifica se encontrou.
  if (indice === -1) {
    return res.status(404).json({
      mensagem: "Movimentação não encontrada.",
    });
  }

  // Remove um elemento do array.
  const removida = movimentacoes.splice(indice, 1)[0];

  return res.status(200).json({
    mensagem: "Movimentação excluída com sucesso!",
    movimentacao: removida,
  });
});

// ======================================================
// 13. RESULTADO FINANCEIRO ATUAL
// ======================================================

// GET: calcular entradas, saídas e saldo.
// Endereço: http://localhost:3000/resultado

app.get("/resultado", autenticar, (req, res) => {
  // Recupera somente as movimentações do usuário logado.
  const lista = movimentacoes.filter(
    (item) => item.usuarioId === req.usuarioId,
  );

  // Calcula a soma das entradas.
  const totalEntradas = lista
    .filter((item) => item.tipo === "entrada")
    .reduce((total, item) => total + item.valor, 0);

  // Calcula a soma das saídas.
  const totalSaidas = lista
    .filter((item) => item.tipo === "saida")
    .reduce((total, item) => total + item.valor, 0);

  // Calcula o saldo atual.
  const saldoAtual = totalEntradas - totalSaidas;

  // Retorna o resultado financeiro.
  return res.status(200).json({
    totalEntradas: Number(totalEntradas.toFixed(2)),
    totalSaidas: Number(totalSaidas.toFixed(2)),
    saldoAtual: Number(saldoAtual.toFixed(2)),
  });
});

// ======================================================
// 14. ROTA INICIAL
// ======================================================

// Essa rota serve para verificar se o servidor está funcionando.
app.get("/", (req, res) => {
  res.send("API do Sistema Financeiro funcionando!");
});

// ======================================================
// 15. INICIANDO O SERVIDOR
// ======================================================

// Faz o servidor começar a receber requisições.
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
