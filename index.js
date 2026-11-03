const express = require("express");
const app = express();
const PORT = 3000;
const cors = require("cors");

app.use(cors());

// Permite receber dados no formato JSON
app.use(express.json());

// Dados temporários em memória
const usuarios = [
  {
    id: 1,
    login: "admin",
    senha: "123456",
  },
  {
    id: 2,
    login: "usuario",
    senha: "654321",
  },
];

// GET - Listar todos os usuários
app.get("/usuarios", (req, res) => {
  return res.status(200).json(usuarios);
});

// GET - Buscar usuário por ID
app.get("/usuarios/:id", (req, res) => {
  const id = Number(req.params.id);

  const usuario = usuarios.find((item) => item.id === id);

  if (!usuario) {
    return res.status(404).json({
      mensagem: "Usuário não encontrado",
    });
  }

  return res.status(200).json(usuario);
});

// POST - Cadastrar novo usuário
app.post("/usuarios", (req, res) => {
  const { login, senha } = req.body;

  if (!login || !senha) {
    return res.status(400).json({
      mensagem: "Login e senha são obrigatórios",
    });
  }

  const usuarioExistente = usuarios.find((item) => item.login === login);

  if (usuarioExistente) {
    return res.status(409).json({
      mensagem: "Login já cadastrado",
    });
  }

  const novoUsuario = {
    id:
      usuarios.length > 0
        ? Math.max(...usuarios.map((item) => item.id)) + 1
        : 1,
    login,
    senha,
  };

  usuarios.push(novoUsuario);

  return res.status(201).json({
    mensagem: "Usuário cadastrado com sucesso",
    usuario: novoUsuario,
  });
});

// PUT - Atualizar usuário
app.put("/usuarios/:id", (req, res) => {
  const id = Number(req.params.id);
  const { login, senha } = req.body;

  const indice = usuarios.findIndex((item) => item.id === id);

  if (indice === -1) {
    return res.status(404).json({
      mensagem: "Usuário não encontrado",
    });
  }

  if (!login || !senha) {
    return res.status(400).json({
      mensagem: "Login e senha são obrigatórios",
    });
  }

  const loginExistente = usuarios.find(
    (item) => item.login === login && item.id !== id,
  );

  if (loginExistente) {
    return res.status(409).json({
      mensagem: "Login já utilizado por outro usuário",
    });
  }

  usuarios[indice] = {
    id,
    login,
    senha,
  };

  return res.status(200).json({
    mensagem: "Usuário atualizado com sucesso",
    usuario: usuarios[indice],
  });
});

// DELETE - Excluir usuário
app.delete("/usuarios/:id", (req, res) => {
  const id = Number(req.params.id);

  const indice = usuarios.findIndex((item) => item.id === id);

  if (indice === -1) {
    return res.status(404).json({
      mensagem: "Usuário não encontrado",
    });
  }

  const usuarioRemovido = usuarios.splice(indice, 1);

  return res.status(200).json({
    mensagem: "Usuário removido com sucesso",
    usuario: usuarioRemovido[0],
  });
});

// Inicialização do servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
