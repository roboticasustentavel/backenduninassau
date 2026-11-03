
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// ======================================================
// 1. CONFIGURAÇÕES
// ======================================================

app.use(cors());
app.use(express.json());

// ======================================================
// 2. ARMAZENAMENTO EM MEMÓRIA
// ======================================================

let usuarios = [];
let movimentacoes = [];
let sessoes = {};

// ======================================================
// 3. FUNÇÕES AUXILIARES
// ======================================================

function gerarId() {
  return crypto.randomUUID();
}

function gerarHash(senha, salt) {
  return crypto.scryptSync(senha, salt, 64).toString("hex");
}

function verificarSenha(senha, salt, hashSalvo) {
  const hashDigitado = Buffer.from(
    gerarHash(senha, salt),
    "hex"
  );

  const hashOriginal = Buffer.from(hashSalvo, "hex");

  return crypto.timingSafeEqual(hashDigitado, hashOriginal);
}

// ======================================================
// 4. CRIAR ADMINISTRADOR AUTOMATICAMENTE
// ======================================================

function criarAdministrador() {
  const login = "admin";
  const senha = "123456";

  const existe = usuarios.find(
    usuario => usuario.login === login
  );

  if (existe) return;

  const salt = crypto.randomBytes(16).toString("hex");

  const administrador = {
    id: gerarId(),
    login,
    salt,
    senha: gerarHash(senha, salt),
    tipo: "admin"
  };

  usuarios.push(administrador);

  console.log("Administrador criado!");
  console.log("Login: admin");
  console.log("Senha: 123456");
}

// ======================================================
// 5. AUTENTICAÇÃO
// ======================================================

function autenticar(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).json({
      mensagem: "Faça login primeiro."
    });
  }

  const partes = authorization.split(" ");

  if (partes.length !== 2 || partes[0] !== "Bearer") {
    return res.status(401).json({
      mensagem: "Token inválido."
    });
  }

  const token = partes[1];
  const usuarioId = sessoes[token];

  if (!usuarioId) {
    return res.status(401).json({
      mensagem: "Sessão inválida ou encerrada."
    });
  }

  const usuario = usuarios.find(
    item => item.id === usuarioId
  );

  if (!usuario) {
    return res.status(401).json({
      mensagem: "Usuário não encontrado."
    });
  }

  req.usuarioId = usuario.id;
  req.usuario = usuario;

  next();
}

// ======================================================
// 6. VERIFICAR ADMINISTRADOR
// ======================================================

function somenteAdmin(req, res, next) {
  if (req.usuario.tipo !== "admin") {
    return res.status(403).json({
      mensagem: "Acesso permitido somente ao administrador."
    });
  }

  next();
}

// ======================================================
// 7. CADASTRAR USUÁRIO
// ======================================================

// POST /usuarios/cadastrar

app.post("/usuarios/cadastrar", (req, res) => {
  const { login, senha } = req.body;

  if (
    typeof login !== "string" ||
    typeof senha !== "string" ||
    !login.trim() ||
    !senha
  ) {
    return res.status(400).json({
      mensagem: "Informe login e senha."
    });
  }

  if (login.trim().length < 3) {
    return res.status(400).json({
      mensagem: "O login precisa ter pelo menos 3 caracteres."
    });
  }

  if (senha.length < 6) {
    return res.status(400).json({
      mensagem: "A senha precisa ter pelo menos 6 caracteres."
    });
  }

  const loginNormalizado = login.trim().toLowerCase();

  const existe = usuarios.find(
    usuario => usuario.login === loginNormalizado
  );

  if (existe) {
    return res.status(409).json({
      mensagem: "Login já cadastrado."
    });
  }

  const salt = crypto.randomBytes(16).toString("hex");

  const novoUsuario = {
    id: gerarId(),
    login: loginNormalizado,
    salt,
    senha: gerarHash(senha, salt),
    tipo: "usuario"
  };

  usuarios.push(novoUsuario);

  return res.status(201).json({
    mensagem: "Usuário cadastrado com sucesso!",
    usuario: {
      id: novoUsuario.id,
      login: novoUsuario.login,
      tipo: novoUsuario.tipo
    }
  });
});

// ======================================================
// 8. LOGIN
// ======================================================

// POST /usuarios/login

app.post("/usuarios/login", (req, res) => {
  const { login, senha } = req.body;

  if (
    typeof login !== "string" ||
    typeof senha !== "string"
  ) {
    return res.status(400).json({
      mensagem: "Informe login e senha."
    });
  }

  const usuario = usuarios.find(
    item => item.login === login.trim().toLowerCase()
  );

  if (!usuario) {
    return res.status(401).json({
      mensagem: "Login ou senha incorretos."
    });
  }

  const correta = verificarSenha(
    senha,
    usuario.salt,
    usuario.senha
  );

  if (!correta) {
    return res.status(401).json({
      mensagem: "Login ou senha incorretos."
    });
  }

  const token = crypto.randomBytes(32).toString("hex");

  sessoes[token] = usuario.id;

  return res.status(200).json({
    mensagem: "Login realizado com sucesso!",
    token,
    usuario: {
      id: usuario.id,
      login: usuario.login,
      tipo: usuario.tipo
    }
  });
});

// ======================================================
// 9. CADASTRAR MOVIMENTAÇÃO
// ======================================================

// POST /financeiro

app.post("/financeiro", autenticar, (req, res) => {
  const { descricao, valor, tipo } = req.body;

  if (
    typeof descricao !== "string" ||
    !descricao.trim() ||
    valor === undefined ||
    !tipo
  ) {
    return res.status(400).json({
      mensagem: "Informe descrição, valor e tipo."
    });
  }

  if (
    typeof valor !== "number" ||
    !Number.isFinite(valor) ||
    valor <= 0
  ) {
    return res.status(400).json({
      mensagem: "Valor inválido."
    });
  }

  if (!["entrada", "saida"].includes(tipo)) {
    return res.status(400).json({
      mensagem: "Tipo deve ser entrada ou saida."
    });
  }

  const novaMovimentacao = {
    id: gerarId(),
    usuarioId: req.usuarioId,
    descricao: descricao.trim(),
    valor: Number(valor.toFixed(2)),
    tipo,
    data: new Date().toISOString()
  };

  movimentacoes.push(novaMovimentacao);

  return res.status(201).json({
    mensagem: "Movimentação cadastrada!",
    movimentacao: novaMovimentacao
  });
});

// ======================================================
// 10. LISTAR MOVIMENTAÇÕES DO USUÁRIO
// ======================================================

// GET /financeiro

app.get("/financeiro", autenticar, (req, res) => {
  const lista = movimentacoes.filter(
    item => item.usuarioId === req.usuarioId
  );

  res.status(200).json({
    total: lista.length,
    movimentacoes: lista
  });
});

// ======================================================
// 11. BUSCAR MOVIMENTAÇÃO POR ID
// ======================================================

// GET /financeiro/:id

app.get("/financeiro/:id", autenticar, (req, res) => {
  const movimentacao = movimentacoes.find(
    item =>
      item.id === req.params.id &&
      item.usuarioId === req.usuarioId
  );

  if (!movimentacao) {
    return res.status(404).json({
      mensagem: "Movimentação não encontrada."
    });
  }

  res.status(200).json(movimentacao);
});

// ======================================================
// 12. ATUALIZAR MOVIMENTAÇÃO
// ======================================================

// PUT /financeiro/:id

app.put("/financeiro/:id", autenticar, (req, res) => {
  const movimentacao = movimentacoes.find(
    item =>
      item.id === req.params.id &&
      item.usuarioId === req.usuarioId
  );

  if (!movimentacao) {
    return res.status(404).json({
      mensagem: "Movimentação não encontrada."
    });
  }

  const { descricao, valor, tipo } = req.body;

  if (
    descricao !== undefined &&
    (typeof descricao !== "string" || !descricao.trim())
  ) {
    return res.status(400).json({
      mensagem: "Descrição inválida."
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
      mensagem: "Valor inválido."
    });
  }

  if (
    tipo !== undefined &&
    !["entrada", "saida"].includes(tipo)
  ) {
    return res.status(400).json({
      mensagem: "Tipo inválido."
    });
  }

  if (descricao !== undefined) {
    movimentacao.descricao = descricao.trim();
  }

  if (valor !== undefined) {
    movimentacao.valor = Number(valor.toFixed(2));
  }

  if (tipo !== undefined) {
    movimentacao.tipo = tipo;
  }

  res.status(200).json({
    mensagem: "Movimentação atualizada!",
    movimentacao
  });
});

// ======================================================
// 13. EXCLUIR MOVIMENTAÇÃO
// ======================================================

// DELETE /financeiro/:id

app.delete("/financeiro/:id", autenticar, (req, res) => {
  const indice = movimentacoes.findIndex(
    item =>
      item.id === req.params.id &&
      item.usuarioId === req.usuarioId
  );

  if (indice === -1) {
    return res.status(404).json({
      mensagem: "Movimentação não encontrada."
    });
  }

  const removida = movimentacoes.splice(indice, 1)[0];

  res.status(200).json({
    mensagem: "Movimentação excluída!",
    movimentacao: removida
  });
});

// ======================================================
// 14. RESULTADO FINANCEIRO DO USUÁRIO
// ======================================================

// GET /resultado

app.get("/resultado", autenticar, (req, res) => {
  const lista = movimentacoes.filter(
    item => item.usuarioId === req.usuarioId
  );

  const entradas = lista
    .filter(item => item.tipo === "entrada")
    .reduce((total, item) => total + item.valor, 0);

  const saidas = lista
    .filter(item => item.tipo === "saida")
    .reduce((total, item) => total + item.valor, 0);

  res.status(200).json({
    totalEntradas: Number(entradas.toFixed(2)),
    totalSaidas: Number(saidas.toFixed(2)),
    saldoAtual: Number((entradas - saidas).toFixed(2))
  });
});

// ======================================================
// 15. ADMINISTRADOR - LISTAR USUÁRIOS
// ======================================================

// GET /admin/usuarios

app.get(
  "/admin/usuarios",
  autenticar,
  somenteAdmin,
  (req, res) => {

    const lista = usuarios.map(usuario => ({
      id: usuario.id,
      login: usuario.login,
      tipo: usuario.tipo
    }));

    res.status(200).json({
      total: lista.length,
      usuarios: lista
    });
  }
);

// ======================================================
// 16. ADMINISTRADOR - EXCLUIR USUÁRIO
// ======================================================

// DELETE /admin/usuarios/:id

app.delete(
  "/admin/usuarios/:id",
  autenticar,
  somenteAdmin,
  (req, res) => {

    const id = req.params.id;

    const usuario = usuarios.find(
      item => item.id === id
    );

    if (!usuario) {
      return res.status(404).json({
        mensagem: "Usuário não encontrado."
      });
    }

    if (usuario.tipo === "admin") {
      return res.status(403).json({
        mensagem: "Não é permitido excluir o administrador."
      });
    }

    usuarios = usuarios.filter(
      item => item.id !== id
    );

    movimentacoes = movimentacoes.filter(
      item => item.usuarioId !== id
    );

    for (const token of Object.keys(sessoes)) {
      if (sessoes[token] === id) {
        delete sessoes[token];
      }
    }

    res.status(200).json({
      mensagem: "Usuário excluído com sucesso!"
    });
  }
);

// ======================================================
// 17. ADMINISTRADOR - TODAS AS MOVIMENTAÇÕES
// ======================================================

// GET /admin/financeiro

app.get(
  "/admin/financeiro",
  autenticar,
  somenteAdmin,
  (req, res) => {

    res.status(200).json({
      total: movimentacoes.length,
      movimentacoes
    });
  }
);

// ======================================================
// 18. ADMINISTRADOR - RESULTADO GERAL
// ======================================================

// GET /admin/resultado

app.get(
  "/admin/resultado",
  autenticar,
  somenteAdmin,
  (req, res) => {

    const entradas = movimentacoes
      .filter(item => item.tipo === "entrada")
      .reduce((total, item) => total + item.valor, 0);

    const saidas = movimentacoes
      .filter(item => item.tipo === "saida")
      .reduce((total, item) => total + item.valor, 0);

    res.status(200).json({
      totalUsuarios: usuarios.length,
      totalMovimentacoes: movimentacoes.length,
      totalEntradas: Number(entradas.toFixed(2)),
      totalSaidas: Number(saidas.toFixed(2)),
      saldoAtual: Number((entradas - saidas).toFixed(2))
    });
  }
);

// ======================================================
// 19. ROTAS PÚBLICAS PARA TESTES ONLINE
// NÃO UTILIZAR EM PRODUÇÃO
// ======================================================

// GET /teste/usuarios

app.get("/teste/usuarios", (req, res) => {
  const lista = usuarios.map(usuario => ({
    id: usuario.id,
    login: usuario.login,
    tipo: usuario.tipo
  }));

  res.status(200).json({
    total: lista.length,
    usuarios: lista
  });
});

// GET /teste/financeiro

app.get("/teste/financeiro", (req, res) => {
  res.status(200).json({
    total: movimentacoes.length,
    movimentacoes
  });
});

// GET /teste/resultado

app.get("/teste/resultado", (req, res) => {
  const entradas = movimentacoes
    .filter(item => item.tipo === "entrada")
    .reduce((total, item) => total + item.valor, 0);

  const saidas = movimentacoes
    .filter(item => item.tipo === "saida")
    .reduce((total, item) => total + item.valor, 0);

  res.status(200).json({
    totalUsuarios: usuarios.length,
    totalMovimentacoes: movimentacoes.length,
    totalEntradas: Number(entradas.toFixed(2)),
    totalSaidas: Number(saidas.toFixed(2)),
    saldoAtual: Number((entradas - saidas).toFixed(2))
  });
});

// GET /teste/login?login=admin&senha=123456
// Somente para testes. Não usar em produção.

app.get("/teste/login", (req, res) => {
  const { login, senha } = req.query;

  if (
    typeof login !== "string" ||
    typeof senha !== "string"
  ) {
    return res.status(400).json({
      mensagem: "Informe login e senha."
    });
  }

  const usuario = usuarios.find(
    item => item.login === login.trim().toLowerCase()
  );

  if (!usuario) {
    return res.status(401).json({
      mensagem: "Login ou senha incorretos."
    });
  }

  const correta = verificarSenha(
    senha,
    usuario.salt,
    usuario.senha
  );

  if (!correta) {
    return res.status(401).json({
      mensagem: "Login ou senha incorretos."
    });
  }

  const token = crypto.randomBytes(32).toString("hex");

  sessoes[token] = usuario.id;

  res.status(200).json({
    mensagem: "Login realizado com sucesso!",
    token,
    usuario: {
      id: usuario.id,
      login: usuario.login,
      tipo: usuario.tipo
    }
  });
});

// ======================================================
// 20. ROTA INICIAL
// ======================================================

app.get("/", (req, res) => {
  res.status(200).json({
    mensagem: "API do Sistema Financeiro funcionando!",
    status: "online"
  });
});

// ======================================================
// 21. INICIAR SERVIDOR
// ======================================================

criarAdministrador();

app.listen(PORT, "0.0.0.0", () => {
  console.log("==================================");
  console.log("SISTEMA FINANCEIRO ONLINE");
  console.log(`Servidor: http://localhost:${PORT}`);
  console.log("Administrador: admin");
  console.log("==================================");
});
