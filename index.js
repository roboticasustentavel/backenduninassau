
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// CONFIGURAÇÕES
// =====================================================

app.use(cors());
app.use(express.json());

// =====================================================
// BANCO DE DADOS EM MEMÓRIA
// =====================================================

const usuarios = [];
const movimentacoes = [];
const sessoes = new Map();

// =====================================================
// FUNÇÕES DE SENHA
// =====================================================

function gerarSenha(senha) {
  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto
    .scryptSync(senha, salt, 64)
    .toString("hex");

  return { salt, hash };
}

function verificarSenha(senha, salt, hashSalvo) {
  const hashDigitado = crypto.scryptSync(senha, salt, 64);
  const hashOriginal = Buffer.from(hashSalvo, "hex");

  if (hashDigitado.length !== hashOriginal.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashDigitado, hashOriginal);
}

// =====================================================
// CRIAR ADMINISTRADOR PADRÃO
// Login: admin
// Senha: 123456
// =====================================================

function criarAdministrador() {
  const administradorExiste = usuarios.find(
    (usuario) => usuario.login === "admin"
  );

  if (administradorExiste) {
    return;
  }

  const { salt, hash } = gerarSenha("123456");

  usuarios.push({
    id: crypto.randomUUID(),
    nome: "Administrador",
    login: "admin",
    salt,
    hash,
    tipo: "admin"
  });

  console.log("Administrador padrão criado.");
}

criarAdministrador();

// =====================================================
// MIDDLEWARE DE AUTENTICAÇÃO
// =====================================================

function autenticar(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      erro: "Token não informado."
    });
  }

  const token = authorization.split(" ")[1];
  const usuarioId = sessoes.get(token);

  if (!usuarioId) {
    return res.status(401).json({
      erro: "Token inválido ou sessão expirada."
    });
  }

  const usuario = usuarios.find(
    (item) => item.id === usuarioId
  );

  if (!usuario) {
    sessoes.delete(token);

    return res.status(401).json({
      erro: "Usuário não encontrado."
    });
  }

  req.usuario = usuario;
  req.token = token;

  next();
}

// =====================================================
// MIDDLEWARE: SOMENTE ADMINISTRADOR
// =====================================================

function somenteAdmin(req, res, next) {
  if (!req.usuario || req.usuario.tipo !== "admin") {
    return res.status(403).json({
      erro: "Acesso permitido somente ao administrador."
    });
  }

  next();
}

// =====================================================
// ROTAS INICIAIS
// =====================================================

app.get("/", (req, res) => {
  res.json({
    mensagem: "API do Sistema Financeiro funcionando!",
    status: "online"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

// =====================================================
// CADASTRAR USUÁRIO
// =====================================================

app.post("/usuarios/cadastrar", (req, res) => {
  const { nome, login, senha } = req.body;

  if (!nome || !login || !senha) {
    return res.status(400).json({
      erro: "Informe nome, login e senha."
    });
  }

  if (
    typeof nome !== "string" ||
    typeof login !== "string" ||
    typeof senha !== "string"
  ) {
    return res.status(400).json({
      erro: "Os dados informados são inválidos."
    });
  }

  const loginNormalizado = login.trim().toLowerCase();

  if (senha.length < 6) {
    return res.status(400).json({
      erro: "A senha deve ter pelo menos 6 caracteres."
    });
  }

  const usuarioExiste = usuarios.find(
    (usuario) => usuario.login === loginNormalizado
  );

  if (usuarioExiste) {
    return res.status(409).json({
      erro: "Este login já está cadastrado."
    });
  }

  const { salt, hash } = gerarSenha(senha);

  const novoUsuario = {
    id: crypto.randomUUID(),
    nome: nome.trim(),
    login: loginNormalizado,
    salt,
    hash,
    tipo: "usuario"
  };

  usuarios.push(novoUsuario);

  res.status(201).json({
    mensagem: "Usuário cadastrado com sucesso!",
    usuario: {
      id: novoUsuario.id,
      nome: novoUsuario.nome,
      login: novoUsuario.login,
      tipo: novoUsuario.tipo
    }
  });
});

// =====================================================
// LOGIN
// =====================================================

app.post("/usuarios/login", (req, res) => {
  const { login, senha } = req.body;

  if (!login || !senha) {
    return res.status(400).json({
      erro: "Informe login e senha."
    });
  }

  if (
    typeof login !== "string" ||
    typeof senha !== "string"
  ) {
    return res.status(400).json({
      erro: "Login ou senha inválidos."
    });
  }

  const loginNormalizado = login.trim().toLowerCase();

  const usuario = usuarios.find(
    (item) => item.login === loginNormalizado
  );

  if (!usuario) {
    return res.status(401).json({
      erro: "Login ou senha incorretos."
    });
  }

  const senhaCorreta = verificarSenha(
    senha,
    usuario.salt,
    usuario.hash
  );

  if (!senhaCorreta) {
    return res.status(401).json({
      erro: "Login ou senha incorretos."
    });
  }

  const token = crypto.randomBytes(32).toString("hex");

  sessoes.set(token, usuario.id);

  res.json({
    mensagem: "Login realizado com sucesso!",
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      login: usuario.login,
      tipo: usuario.tipo
    }
  });
});

// =====================================================
// VERIFICAR USUÁRIO LOGADO
// =====================================================

app.get("/usuarios/me", autenticar, (req, res) => {
  res.json({
    usuario: {
      id: req.usuario.id,
      nome: req.usuario.nome,
      login: req.usuario.login,
      tipo: req.usuario.tipo
    }
  });
});

// =====================================================
// FAZER LOGOUT
// =====================================================

app.post("/usuarios/logout", autenticar, (req, res) => {
  sessoes.delete(req.token);

  res.json({
    mensagem: "Logout realizado com sucesso!"
  });
});

// =====================================================
// CADASTRAR MOVIMENTAÇÃO FINANCEIRA
// =====================================================

app.post("/financeiro", autenticar, (req, res) => {
  const { descricao, tipo, valor } = req.body;

  if (!descricao || !tipo || valor === undefined) {
    return res.status(400).json({
      erro: "Informe descrição, tipo e valor."
    });
  }

  if (
    typeof descricao !== "string" ||
    !["entrada", "saida"].includes(tipo) ||
    typeof valor !== "number" ||
    !Number.isFinite(valor) ||
    valor <= 0
  ) {
    return res.status(400).json({
      erro: "Dados financeiros inválidos."
    });
  }

  const movimentacao = {
    id: crypto.randomUUID(),
    usuarioId: req.usuario.id,
    descricao: descricao.trim(),
    tipo,
    valor,
    data: new Date().toISOString()
  };

  movimentacoes.push(movimentacao);

  res.status(201).json({
    mensagem: "Movimentação cadastrada com sucesso!",
    movimentacao
  });
});

// =====================================================
// LISTAR MOVIMENTAÇÕES DO USUÁRIO
// =====================================================

app.get("/financeiro", autenticar, (req, res) => {
  const lista = movimentacoes.filter(
    (item) => item.usuarioId === req.usuario.id
  );

  res.json(lista);
});

// =====================================================
// BUSCAR UMA MOVIMENTAÇÃO
// =====================================================

app.get("/financeiro/:id", autenticar, (req, res) => {
  const movimentacao = movimentacoes.find(
    (item) =>
      item.id === req.params.id &&
      item.usuarioId === req.usuario.id
  );

  if (!movimentacao) {
    return res.status(404).json({
      erro: "Movimentação não encontrada."
    });
  }

  res.json(movimentacao);
});

// =====================================================
// ATUALIZAR MOVIMENTAÇÃO
// =====================================================

app.put("/financeiro/:id", autenticar, (req, res) => {
  const movimentacao = movimentacoes.find(
    (item) =>
      item.id === req.params.id &&
      item.usuarioId === req.usuario.id
  );

  if (!movimentacao) {
    return res.status(404).json({
      erro: "Movimentação não encontrada."
    });
  }

  const { descricao, tipo, valor } = req.body;

  if (
    descricao !== undefined &&
    (typeof descricao !== "string" || !descricao.trim())
  ) {
    return res.status(400).json({
      erro: "Descrição inválida."
    });
  }

  if (
    tipo !== undefined &&
    !["entrada", "saida"].includes(tipo)
  ) {
    return res.status(400).json({
      erro: "Tipo deve ser entrada ou saida."
    });
  }

  if (
    valor !== undefined &&
    (
      typeof valor !== "number" ||
      !Number.isFinite(valor) ||
      valor <= 0
    )
  ) {
    return res.status(400).json({
      erro: "Valor inválido."
    });
  }

  if (descricao !== undefined) {
    movimentacao.descricao = descricao.trim();
  }

  if (tipo !== undefined) {
    movimentacao.tipo = tipo;
  }

  if (valor !== undefined) {
    movimentacao.valor = valor;
  }

  res.json({
    mensagem: "Movimentação atualizada com sucesso!",
    movimentacao
  });
});

// =====================================================
// EXCLUIR MOVIMENTAÇÃO
// =====================================================

app.delete("/financeiro/:id", autenticar, (req, res) => {
  const indice = movimentacoes.findIndex(
    (item) =>
      item.id === req.params.id &&
      item.usuarioId === req.usuario.id
  );

  if (indice === -1) {
    return res.status(404).json({
      erro: "Movimentação não encontrada."
    });
  }

  movimentacoes.splice(indice, 1);

  res.json({
    mensagem: "Movimentação excluída com sucesso!"
  });
});

// =====================================================
// RESULTADO FINANCEIRO DO USUÁRIO
// =====================================================

app.get("/resultado", autenticar, (req, res) => {
  const lista = movimentacoes.filter(
    (item) => item.usuarioId === req.usuario.id
  );

  const entradas = lista
    .filter((item) => item.tipo === "entrada")
    .reduce((total, item) => total + item.valor, 0);

  const saidas = lista
    .filter((item) => item.tipo === "saida")
    .reduce((total, item) => total + item.valor, 0);

  res.json({
    entradas,
    saidas,
    saldo: entradas - saidas
  });
});

// =====================================================
// ROTAS ADMINISTRATIVAS
// Todas exigem autenticação e perfil admin.
// =====================================================

// Listar usuários

app.get(
  "/admin/usuarios",
  autenticar,
  somenteAdmin,
  (req, res) => {
    const lista = usuarios.map((usuario) => ({
      id: usuario.id,
      nome: usuario.nome,
      login: usuario.login,
      tipo: usuario.tipo
    }));

    res.json(lista);
  }
);

// Listar todas as movimentações

app.get(
  "/admin/financeiro",
  autenticar,
  somenteAdmin,
  (req, res) => {
    res.json(movimentacoes);
  }
);

// Consultar resultado geral

app.get(
  "/admin/resultado",
  autenticar,
  somenteAdmin,
  (req, res) => {
    const entradas = movimentacoes
      .filter((item) => item.tipo === "entrada")
      .reduce((total, item) => total + item.valor, 0);

    const saidas = movimentacoes
      .filter((item) => item.tipo === "saida")
      .reduce((total, item) => total + item.valor, 0);

    res.json({
      totalUsuarios: usuarios.length,
      totalMovimentacoes: movimentacoes.length,
      entradas,
      saidas,
      saldo: entradas - saidas
    });
  }
);

// =====================================================
// ROTA DE TESTE DO BACKEND
// =====================================================

app.get("/teste", (req, res) => {
  res.json({
    mensagem: "Backend funcionando corretamente!",
    rotas: [
      "/usuarios/cadastrar",
      "/usuarios/login",
      "/usuarios/me",
      "/financeiro",
      "/resultado",
      "/admin/usuarios",
      "/admin/financeiro",
      "/admin/resultado"
    ]
  });
});

// =====================================================
// ROTA NÃO ENCONTRADA
// Deve ficar depois de todas as outras rotas.
// =====================================================

app.use((req, res) => {
  res.status(404).json({
    erro: "Rota não encontrada.",
    caminho: req.originalUrl
  });
});

// =====================================================
// TRATAMENTO DE ERROS
// =====================================================

app.use((erro, req, res, next) => {
  console.error("Erro no servidor:", erro);

  if (res.headersSent) {
    return next(erro);
  }

  if (erro.type === "entity.parse.failed") {
    return res.status(400).json({
      erro: "O corpo da requisição contém JSON inválido."
    });
  }

  res.status(500).json({
    erro: "Erro interno do servidor."
  });
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
