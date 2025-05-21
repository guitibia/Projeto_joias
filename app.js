const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const path = require("path");
const mysql = require("mysql2");
const session = require("express-session");
const port = 3000;
const { body, validationResult } = require("express-validator");
const multer = require("multer");
const upload = multer({ dest: "uploads/" }); // Usando multer para lidar com uploads de imagem

// Configuração do Banco de Dados
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "pedido_db",
});

db.connect((err) => {
  if (err) throw err;
  console.log("Conectado ao banco de dados!");
});

app.use(
  session({
    secret: "seu-segredo",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json()); // Adicione isso no início do arquivo

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, "public")));

// Servir arquivos estáticos da pasta 'uploads'
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Configuração do EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views")); // Pasta onde os arquivos .ejs estarão

// Rota principal para renderizar a página com os produtos e verificar login
app.get("/", (req, res) => {
  const query = "SELECT * FROM produtos";
  db.query(query, (err, produtos) => {
    if (err) throw err;

    produtos = produtos.map((produto) => ({
      ...produto,
      preco: parseFloat(produto.preco) || 0,
    }));

    let clienteLogado = null;
    const tituloCategoria = "Novidades em Semi-Joias"; // ou "Todos" se preferir

    if (req.session.cliente_id) {
      db.query(
        "SELECT * FROM clientes WHERE id = ?",
        [req.session.cliente_id],
        (err, results) => {
          if (err) throw err;
          clienteLogado = results[0];
          res.render("index", {
            produtos,
            clienteLogado,
            mensagem: null,
            tituloCategoria,
          });
        }
      );
    } else {
      res.render("index", {
        produtos,
        clienteLogado: null,
        mensagem: null,
        tituloCategoria,
      });
    }
  });
});

// Rota de logout
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Erro ao deslogar");
    }
    res.redirect("/"); // Redireciona para a página inicial após logout
  });
});

// Rota de cadastro de cliente
app.get("/cadastro", (req, res) => {
  res.render("cadastro");
});

app.post(
  "/cadastro",
  [
    body("email").isEmail().withMessage("Email inválido"),
    body("telefone")
      .isLength({ min: 10, max: 15 })
      .withMessage("Telefone inválido"),
    // Adicione outras validações conforme necessário
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nome, email, senha, cep, endereco, cidade, estado, telefone } =
      req.body;

    const query =
      "INSERT INTO clientes (nome, email, senha, cep, endereco, cidade, estado, telefone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    db.query(
      query,
      [nome, email, senha, cep, endereco, cidade, estado, telefone],
      (err, result) => {
        if (err) {
          res.status(500).send("Erro ao cadastrar o cliente");
        } else {
          res.redirect("/login");
        }
      }
    );
  }
);

// Rota de login
app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  const { email, senha } = req.body;
  const query = "SELECT * FROM clientes WHERE email = ? AND senha = ?";
  db.query(query, [email, senha], (err, result) => {
    if (err || result.length === 0) {
      res.status(400).send("Email ou senha incorretos");
    } else {
      // Salvar sessão ou token para manter o usuário logado
      req.session.cliente_id = result[0].id;
      req.session.nome = result[0].nome; // Armazenando o nome do cliente
      req.session.is_admin = result[0].is_admin; // Armazenando se o cliente é admin

      console.log("Usuário logado:", req.session); // Verifique a sessão no console

      res.redirect("/"); // Redireciona para a página principal após login
    }
  });
});

// Rota de administração
app.get("/admin", (req, res) => {
  if (req.session.is_admin !== 1) {
    return res.status(403).send("Acesso restrito!"); // Bloquear o acesso de usuários não administradores
  }

  res.render("admin"); // Exibir página de administração
});

// Rota de adicionar ao carrinho
app.get("/carrinho/adicionar", (req, res) => {
  const { cliente_id, semi_joia_id, quantidade } = req.query;

  const query =
    "INSERT INTO carrinho (cliente_id, semi_joia_id, quantidade) VALUES (?, ?, ?)";
  db.query(query, [cliente_id, semi_joia_id, quantidade], (err, result) => {
    if (err) {
      res.status(500).send("Erro ao adicionar produto ao carrinho");
    } else {
      res.redirect("/carrinho");
    }
  });
});

app.post("/carrinho/adicionar", (req, res) => {
  if (!req.session.cliente_id) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  const { produto_id, quantidade } = req.body;
  const cliente_id = req.session.cliente_id;

  const checkQuery =
    "SELECT * FROM carrinho WHERE cliente_id = ? AND produto_id = ?";
  db.query(checkQuery, [cliente_id, produto_id], (err, result) => {
    if (err) return res.status(500).json({ error: "Erro no banco de dados" });
    if (result.length > 0) {
      const updateQuery =
        "UPDATE carrinho SET quantidade = quantidade + ? WHERE cliente_id = ? AND produto_id = ?";
      db.query(updateQuery, [quantidade, cliente_id, produto_id], (err) => {
        if (err) return res.status(500).json({ error: "Erro ao atualizar" });
        res.json({ success: true });
      });
    } else {
      const insertQuery =
        "INSERT INTO carrinho (cliente_id, produto_id, quantidade) VALUES (?, ?, ?)";
      db.query(insertQuery, [cliente_id, produto_id, quantidade], (err) => {
        if (err) return res.status(500).json({ error: "Erro ao inserir" });
        res.json({ success: true });
      });
    }
  });
});

// Página para cadastrar produtos (acessível somente para admin)
app.get("/admin/cadastrar-produto", (req, res) => {
  if (!req.session.cliente_id || req.session.is_admin !== 1) {
    // Altere para is_admin
    return res.status(403).send("Acesso restrito!"); // Bloquear acesso não autorizado
  }
  res.render("cadastrar-produto"); // Página onde o admin pode cadastrar produtos
});

// Processar o formulário de cadastro de produto
app.post("/admin/cadastrar-produto", upload.single("imagem"), (req, res) => {
  if (!req.session.cliente_id || req.session.is_admin !== 1) {
    // Altere para is_admin
    return res.status(403).send("Acesso restrito!"); // Impede que usuários não administradores cadastrem produtos
  }

  const { nome, descricao, preco, tipo } = req.body;
  const imagem = req.file ? req.file.filename : null; // Armazenando o nome da imagem

  // Validação dos dados (opcional)
  if (!nome || !descricao || !preco || !tipo || !imagem) {
    return res.status(400).send("Todos os campos são obrigatórios");
  }

  const query =
    "INSERT INTO produtos (nome, descricao, preco, tipo, imagem) VALUES (?, ?, ?, ?, ?)";
  db.query(query, [nome, descricao, preco, tipo, imagem], (err, result) => {
    if (err) {
      console.error("Erro ao cadastrar produto:", err);
      return res.status(500).send("Erro ao cadastrar produto");
    }

    res.redirect("/"); // Redireciona para a página inicial após o cadastro
  });
});

// Rota para exibir produtos filtrados por categoria
app.get("/categoria/:tipo", (req, res) => {
  const tipo = req.params.tipo;
  const query = "SELECT * FROM produtos WHERE tipo = ?";

  db.query(query, [tipo], (err, produtos) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Erro ao buscar produtos");
    }

    let clienteLogado = null;
    let tituloCategoria = tipo;
    switch (tipo) {
      case "Anel":
        tituloCategoria = "Anéis";
        break;
      case "Pulseira":
        tituloCategoria = "Pulseiras";
        break;
      case "Colar":
        tituloCategoria = "Colares";
        break;
      case "Conjunto":
        tituloCategoria = "Conjuntos";
        break;
      case "Brincos":
        tituloCategoria = "Brincos";
        break;
      default:
        tituloCategoria = "Produtos";
    }

    if (req.session.cliente_id) {
      db.query(
        "SELECT * FROM clientes WHERE id = ?",
        [req.session.cliente_id],
        (err, results) => {
          if (err) throw err;
          clienteLogado = results[0];
          res.render("index", {
            produtos,
            clienteLogado,
            mensagem:
              produtos.length === 0
                ? "Nenhum produto encontrado para esta categoria."
                : null,
            tituloCategoria,
          });
        }
      );
    } else {
      res.render("index", {
        produtos,
        clienteLogado: null,
        mensagem:
          produtos.length === 0
            ? "Nenhum produto encontrado para esta categoria."
            : null,
        tituloCategoria,
      });
    }
  });
});

// Rota de exibição do carrinho
app.get("/carrinho", (req, res) => {
  const cliente_id = req.session.cliente_id;
  const query = `SELECT produtos.id as produto_id, produtos.nome, produtos.preco, carrinho.quantidade
                 FROM carrinho
                 JOIN produtos ON carrinho.produto_id = produtos.id
                 WHERE carrinho.cliente_id = ?`;

  db.query(query, [cliente_id], (err, result) => {
    if (err) throw err;
    res.render("carrinho", { produtos: result });
  });
});

// Atualizar quantidade de um item no carrinho
app.post("/carrinho/atualizar", (req, res) => {
  const cliente_id = req.session.cliente_id;
  const { produto_id, quantidade } = req.body;
  if (!cliente_id) return res.redirect("/login");
  const query =
    "UPDATE carrinho SET quantidade = ? WHERE cliente_id = ? AND produto_id = ?";
  db.query(query, [quantidade, cliente_id, produto_id], (err) => {
    if (err) throw err;
    res.redirect("/carrinho");
  });
});

// Remover item do carrinho
app.post("/carrinho/remover", (req, res) => {
  const cliente_id = req.session.cliente_id;
  const { produto_id } = req.body;
  if (!cliente_id) return res.redirect("/login");
  const query = "DELETE FROM carrinho WHERE cliente_id = ? AND produto_id = ?";
  db.query(query, [cliente_id, produto_id], (err) => {
    if (err) throw err;
    res.redirect("/carrinho");
  });
});

// Rota para exibir os pedidos do cliente
app.get("/meus-pedidos", (req, res) => {
  const cliente_id = req.session.cliente_id;
  if (!cliente_id) return res.redirect("/login");
  const pedidosQuery = `
        SELECT p.id, p.data_pedido, p.status, p.total,
               GROUP_CONCAT(CONCAT(pi.quantidade, 'x ', pr.nome, ' (R$ ', FORMAT(pi.preco_unitario,2,'pt_BR'), ')') SEPARATOR ', ') as itens
        FROM pedidos p
        JOIN pedido_itens pi ON p.id = pi.pedido_id
        JOIN produtos pr ON pi.produto_id = pr.id
        WHERE p.cliente_id = ?
        GROUP BY p.id
        ORDER BY p.data_pedido DESC
    `;
  db.query(pedidosQuery, [cliente_id], (err, pedidos) => {
    if (err) throw err;
    res.render("meus-pedidos", { pedidos });
  });
});

app.get("/finalizar", (req, res) => {
  if (!req.session.cliente_id) return res.redirect("/login");
  res.render("escolher-pagamento");
});

app.post("/finalizar", (req, res) => {
  const cliente_id = req.session.cliente_id;
  const metodo_pagamento = req.body.pagamento;
  if (!cliente_id || !metodo_pagamento) return res.redirect("/carrinho");
  // Busca dados do cliente
  db.query(
    "SELECT nome FROM clientes WHERE id = ?",
    [cliente_id],
    (err, clientes) => {
      if (err) throw err;
      const nomeCliente = clientes[0].nome;
      const carrinhoQuery = `SELECT produtos.id as produto_id, produtos.nome, produtos.preco, carrinho.quantidade
                               FROM carrinho
                               JOIN produtos ON carrinho.produto_id = produtos.id
                               WHERE carrinho.cliente_id = ?`;
      db.query(carrinhoQuery, [cliente_id], (err, produtos) => {
        if (err) throw err;
        if (produtos.length === 0) return res.redirect("/carrinho");

        let total = 0;
        produtos.forEach((produto) => {
          total += produto.preco * produto.quantidade;
        });

        // Salva o pedido
        const pedidoQuery =
          "INSERT INTO pedidos (cliente_id, total) VALUES (?, ?)";
        db.query(pedidoQuery, [cliente_id, total], (err, result) => {
          if (err) throw err;
          const pedido_id = result.insertId;

          // Salva os itens do pedido
          const itensQuery =
            "INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario) VALUES ?";
          const itensValues = produtos.map((produto) => [
            pedido_id,
            produto.produto_id,
            produto.quantidade,
            produto.preco,
          ]);
          db.query(itensQuery, [itensValues], (err) => {
            if (err) throw err;

            // Limpa o carrinho do cliente
            db.query(
              "DELETE FROM carrinho WHERE cliente_id = ?",
              [cliente_id],
              (err) => {
                if (err) throw err;

                // Monta a mensagem para o WhatsApp
                let mensagem = `Olá! Meu nome é ${nomeCliente} e gostaria de finalizar meu pedido:%0A`;
                produtos.forEach((produto) => {
                  mensagem += `• ${produto.nome} (Qtd: ${
                    produto.quantidade
                  }) - R$ ${(produto.preco * produto.quantidade)
                    .toFixed(2)
                    .replace(".", ",")}%0A`;
                });
                mensagem += `%0ATotal: R$ ${total
                  .toFixed(2)
                  .replace(".", ",")}`;
                mensagem += `%0AForma de pagamento: ${metodo_pagamento}`;
                const numeroLoja = "5519995444947"; // Substitua pelo número da loja
                const urlWhatsapp = `https://wa.me/${numeroLoja}?text=${mensagem}`;
                // Renderiza a página de confirmação com o link do WhatsApp
                res.render("pedido-finalizado", { urlWhatsapp });
              }
            );
          });
        });
      });
    }
  );
});

// Rota para exibir todos os pedidos (admin)
app.get("/admin/pedidos", (req, res) => {
  if (!req.session.cliente_id || req.session.is_admin !== 1) {
    return res.status(403).send("Acesso negado");
  }
  const pedidosQuery = `
        SELECT p.id, p.data_pedido, p.status, p.total, c.nome as cliente,
               GROUP_CONCAT(CONCAT(pi.quantidade, 'x ', pr.nome, ' (R$ ', FORMAT(pi.preco_unitario,2,'pt_BR'), ')') SEPARATOR ', ') as itens
        FROM pedidos p
        JOIN clientes c ON p.cliente_id = c.id
        JOIN pedido_itens pi ON p.id = pi.pedido_id
        JOIN produtos pr ON pi.produto_id = pr.id
        GROUP BY p.id
        ORDER BY p.data_pedido DESC
    `;
  db.query(pedidosQuery, (err, pedidos) => {
    if (err) throw err;
    res.render("admin-pedidos", { pedidos });
  });
});

app.post("/admin/pedidos/status", (req, res) => {
  if (!req.session.cliente_id || req.session.is_admin !== 1) {
    return res.status(403).send("Acesso negado");
  }
  const { pedido_id, status } = req.body;
  db.query(
    "UPDATE pedidos SET status = ? WHERE id = ?",
    [status, pedido_id],
    (err) => {
      if (err) throw err;
      res.redirect("/admin/pedidos");
    }
  );
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
