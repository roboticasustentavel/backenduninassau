
// ======================================================
// SISTEMA DE ORGANIZAÇÃO FINANCEIRA
// Tecnologias: Node.js, Express e CORS
// Armazenamento: Arrays (sem banco de dados)
// Autenticação: Login e senha (sem token)
// ======================================================


// 1. IMPORTAÇÃO DAS BIBLIOTECAS
// ------------------------------------------------------

// Express permite criar o servidor e as rotas da API.
const express = require("express");

// CORS permite que outros sistemas, como um frontend,
// possam acessar nosso backend.
const cors = require("cors");

// Crypto é uma biblioteca nativa do Node.js.
// Vamos utilizá-la para proteger as senhas com hash.
const crypto = require("crypto");


// 2. CONFIGURAÇÃO DO SERVIDOR
// ------------------------------------------------------

const app = express();

// Define a porta onde o servidor será executado.
const PORTA = 3000;

// Permite que o servidor receba dados no formato JSON.
app.use(express.json());

// Habilita o acesso de outros sistemas ao backend.
app.use(cors());


// 3. ARMAZENAMENTO DOS DADOS EM MEMÓRIA
// ------------------------------------------------------

// Array que armazenará os usuários cadastrados.
let usuarios = [];

// Array que armazenará as entradas e saídas financeiras.
let lancamentos = [];

// Contadores para gerar IDs automaticamente.
let proximoIdUsuario = 1;
let proximoIdLancamento = 1;


// ======================================================
// 4. ROTAS PRINCIPAIS
// ======================================================


// ROTA INICIAL
// ------------------------------------------------------

// GET: http://localhost:3000/

app.get("/", (req, res) => {

    res.json({
        mensagem: "API do Sistema Financeiro funcionando!",
        versao: "1.0",
        rotas: {
            cadastro: "POST /cadastro",
            login: "POST /login",
            usuarios: "GET /usuarios",
            lancamentos: "GET /lancamentos",
            cadastrarLancamento: "POST /lancamentos",
            consultarLancamento: "GET /lancamentos/:id",
            atualizarLancamento: "PUT /lancamentos/:id",
            excluirLancamento: "DELETE /lancamentos/:id",
            resultadoFinanceiro: "GET /resultado"
        }
    });

});


// ======================================================
// 5. MÓDULO DE CADASTRO E LOGIN
// ======================================================


// ROTA DE CADASTRO
// ------------------------------------------------------

// POST: http://localhost:3000/cadastro
//
// Dados enviados no Body (JSON):
// {
//     "login": "andre",
//     "senha": "123456"
// }

app.post("/cadastro", (req, res) => {

    // Recebe os dados enviados pelo frontend.
    const { login, senha } = req.body;

    // Verifica se os campos foram preenchidos.
    if (!login || !senha) {

        return res.status(400).json({
            mensagem: "Informe o login e a senha."
        });

    }

    // Verifica se o login já está cadastrado.
    const usuarioExistente = usuarios.find(
        usuario => usuario.login === login
    );

    if (usuarioExistente) {

        return res.status(409).json({
            mensagem: "Este login já está cadastrado."
        });

    }

    // Cria um salt aleatório para proteger a senha.
    const salt = crypto.randomBytes(16).toString("hex");

    // Gera o hash da senha.
    const senhaHash = crypto.scryptSync(
        senha,
        salt,
        64
    ).toString("hex");

    // Cria o novo usuário.
    const novoUsuario = {

        id: proximoIdUsuario,

        login: login,

        salt: salt,

        senha: senhaHash

    };

    // Armazena o usuário no array.
    usuarios.push(novoUsuario);

    // Incrementa o contador de IDs.
    proximoIdUsuario++;

    // Retorna a confirmação do cadastro.
    res.status(201).json({

        mensagem: "Usuário cadastrado com sucesso!",

        usuario: {
            id: novoUsuario.id,
            login: novoUsuario.login
        }

    });

});


// ROTA DE LOGIN
// ------------------------------------------------------

// POST: http://localhost:3000/login
//
// Dados enviados no Body:
// {
//     "login": "andre",
//     "senha": "123456"
// }

app.post("/login", (req, res) => {

    const { login, senha } = req.body;

    // Verifica se os campos foram informados.
    if (!login || !senha) {

        return res.status(400).json({
            mensagem: "Informe o login e a senha."
        });

    }

    // Procura o usuário pelo login.
    const usuario = usuarios.find(
        usuario => usuario.login === login
    );

    // Se não encontrar, retorna erro.
    if (!usuario) {

        return res.status(401).json({
            mensagem: "Login ou senha incorretos."
        });

    }

    // Gera novamente o hash da senha informada,
    // utilizando o mesmo salt armazenado no cadastro.
    const senhaHash = crypto.scryptSync(
        senha,
        usuario.salt,
        64
    ).toString("hex");

    // Compara os hashes de maneira segura.
    const senhaCorreta = crypto.timingSafeEqual(
        Buffer.from(senhaHash, "hex"),
        Buffer.from(usuario.senha, "hex")
    );

    if (!senhaCorreta) {

        return res.status(401).json({
            mensagem: "Login ou senha incorretos."
        });

    }

    // Login validado com sucesso.
    res.json({

        mensagem: "Login realizado com sucesso!",

        usuario: {
            id: usuario.id,
            login: usuario.login
        }

    });

});


// ROTA PARA LISTAR USUÁRIOS
// ------------------------------------------------------

// GET: http://localhost:3000/usuarios

app.get("/usuarios", (req, res) => {

    // Não retorna as senhas nem os hashes.
    const listaUsuarios = usuarios.map(usuario => ({

        id: usuario.id,

        login: usuario.login

    }));

    res.json(listaUsuarios);

});


// ======================================================
// 6. MÓDULO DE CONTROLE FINANCEIRO
// ======================================================


// ROTA PARA CADASTRAR ENTRADAS E SAÍDAS
// ------------------------------------------------------

// POST: http://localhost:3000/lancamentos
//
// Exemplo de ENTRADA:
// {
//     "descricao": "Venda de produto",
//     "tipo": "entrada",
//     "valor": 1500,
//     "categoria": "Vendas",
//     "data": "2026-11-03"
// }
//
// Exemplo de SAÍDA:
// {
//     "descricao": "Pagamento de energia",
//     "tipo": "saida",
//     "valor": 300,
//     "categoria": "Despesas",
//     "data": "2026-11-03"
// }

app.post("/lancamentos", (req, res) => {

    const {
        descricao,
        tipo,
        valor,
        categoria,
        data
    } = req.body;

    // Verifica se todos os campos foram preenchidos.
    if (
        !descricao ||
        !tipo ||
        valor === undefined ||
        !categoria ||
        !data
    ) {

        return res.status(400).json({
            mensagem: "Preencha todos os campos."
        });

    }

    // Verifica se o tipo é válido.
    if (tipo !== "entrada" && tipo !== "saida") {

        return res.status(400).json({
            mensagem: "O tipo deve ser entrada ou saida."
        });

    }

    // Verifica se o valor é um número positivo.
    if (
        typeof valor !== "number" ||
        !Number.isFinite(valor) ||
        valor <= 0
    ) {

        return res.status(400).json({
            mensagem: "Informe um valor numérico maior que zero."
        });

    }

    // Cria um novo lançamento financeiro.
    const novoLancamento = {

        id: proximoIdLancamento,

        descricao: descricao,

        tipo: tipo,

        valor: valor,

        categoria: categoria,

        data: data

    };

    // Adiciona o lançamento ao array.
    lancamentos.push(novoLancamento);

    proximoIdLancamento++;

    res.status(201).json({

        mensagem: "Lançamento cadastrado com sucesso!",

        lancamento: novoLancamento

    });

});


// ROTA PARA LISTAR TODOS OS LANÇAMENTOS
// ------------------------------------------------------

// GET: http://localhost:3000/lancamentos

app.get("/lancamentos", (req, res) => {

    res.json({

        quantidade: lancamentos.length,

        lancamentos: lancamentos

    });

});


// ROTA PARA CONSULTAR UM LANÇAMENTO PELO ID
// ------------------------------------------------------

// GET: http://localhost:3000/lancamentos/1

app.get("/lancamentos/:id", (req, res) => {

    // Captura o ID que veio pela URL.
    const id = Number(req.params.id);

    // Procura o lançamento no array.
    const lancamento = lancamentos.find(
        item => item.id === id
    );

    // Verifica se encontrou.
    if (!lancamento) {

        return res.status(404).json({
            mensagem: "Lançamento não encontrado."
        });

    }

    res.json(lancamento);

});


// ROTA PARA ATUALIZAR UM LANÇAMENTO
// ------------------------------------------------------

// PUT: http://localhost:3000/lancamentos/1
//
// Exemplo de Body:
// {
//     "descricao": "Venda atualizada",
//     "tipo": "entrada",
//     "valor": 2000,
//     "categoria": "Vendas",
//     "data": "2026-11-03"
// }

app.put("/lancamentos/:id", (req, res) => {

    const id = Number(req.params.id);

    // Procura a posição do lançamento no array.
    const indice = lancamentos.findIndex(
        item => item.id === id
    );

    // Verifica se existe.
    if (indice === -1) {

        return res.status(404).json({
            mensagem: "Lançamento não encontrado."
        });

    }

    const {
        descricao,
        tipo,
        valor,
        categoria,
        data
    } = req.body;

    // Verifica se todos os campos foram informados.
    if (
        !descricao ||
        !tipo ||
        valor === undefined ||
        !categoria ||
        !data
    ) {

        return res.status(400).json({
            mensagem: "Informe todos os campos."
        });

    }

    // Valida o tipo.
    if (tipo !== "entrada" && tipo !== "saida") {

        return res.status(400).json({
            mensagem: "Tipo inválido."
        });

    }

    // Valida o valor.
    if (
        typeof valor !== "number" ||
        !Number.isFinite(valor) ||
        valor <= 0
    ) {

        return res.status(400).json({
            mensagem: "Valor inválido."
        });

    }

    // Atualiza os dados mantendo o mesmo ID.
    lancamentos[indice] = {

        id: id,

        descricao: descricao,

        tipo: tipo,

        valor: valor,

        categoria: categoria,

        data: data

    };

    res.json({

        mensagem: "Lançamento atualizado com sucesso!",

        lancamento: lancamentos[indice]

    });

});


// ROTA PARA EXCLUIR UM LANÇAMENTO
// ------------------------------------------------------

// DELETE: http://localhost:3000/lancamentos/1

app.delete("/lancamentos/:id", (req, res) => {

    const id = Number(req.params.id);

    // Procura o índice do lançamento.
    const indice = lancamentos.findIndex(
        item => item.id === id
    );

    if (indice === -1) {

        return res.status(404).json({
            mensagem: "Lançamento não encontrado."
        });

    }

    // Remove um elemento do array.
    const lancamentoExcluido = lancamentos.splice(
        indice,
        1
    );

    res.json({

        mensagem: "Lançamento excluído com sucesso!",

        lancamento: lancamentoExcluido[0]

    });

});


// ======================================================
// 7. RESULTADO FINANCEIRO
// ======================================================


// ROTA PARA CONSULTAR O RESULTADO FINANCEIRO
// ------------------------------------------------------

// GET: http://localhost:3000/resultado

app.get("/resultado", (req, res) => {

    // Inicializa os totais.
    let totalEntradas = 0;

    let totalSaidas = 0;

    // Percorre todos os lançamentos.
    lancamentos.forEach(lancamento => {

        // Se for entrada, soma no total de entradas.
        if (lancamento.tipo === "entrada") {

            totalEntradas += lancamento.valor;

        }

        // Se for saída, soma no total de saídas.
        if (lancamento.tipo === "saida") {

            totalSaidas += lancamento.valor;

        }

    });

    // Calcula o saldo atual.
    const saldoAtual = totalEntradas - totalSaidas;

    // Retorna o resultado financeiro.
    res.json({

        mensagem: "Resultado financeiro calculado!",

        totalLancamentos: lancamentos.length,

        totalEntradas: Number(totalEntradas.toFixed(2)),

        totalSaidas: Number(totalSaidas.toFixed(2)),

        saldoAtual: Number(saldoAtual.toFixed(2)),

        situacao:
            saldoAtual > 0
                ? "Saldo positivo"
                : saldoAtual < 0
                    ? "Saldo negativo"
                    : "Saldo zerado"

    });

});


// ======================================================
// 8. INICIALIZAÇÃO DO SERVIDOR
// ======================================================

// Faz o servidor começar a funcionar na porta 3000.

app.listen(PORTA, () => {

    console.log("--------------------------------------");

    console.log("SISTEMA FINANCEIRO INICIADO!");

    console.log(`Servidor: http://localhost:${PORTA}`);

    console.log("--------------------------------------");

});
