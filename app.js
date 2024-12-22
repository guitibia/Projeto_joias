const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2');
const session = require('express-session');
const port = 3000;
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Usando multer para lidar com uploads de imagem

// Configuração do Banco de Dados
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'pedido_db'
});

db.connect(err => {
  if (err) throw err;
  console.log('Conectado ao banco de dados!');
});

app.use(session({
  secret: 'seu-segredo',
  resave: false,
  saveUninitialized: true
}));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Servir arquivos estáticos da pasta 'uploads'
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuração do EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));  // Pasta onde os arquivos .ejs estarão

// Rota principal para renderizar a página com os produtos e verificar login
app.get('/', (req, res) => {
  const query = 'SELECT * FROM produtos'; // Exemplo, ajuste conforme sua lógica
  db.query(query, (err, produtos) => {
    if (err) throw err;

    // Converte o preço para número, caso seja necessário
    produtos = produtos.map(produto => ({
      ...produto,
      preco: parseFloat(produto.preco) || 0 // Garantir que 'preco' seja um número
    }));

    let clienteLogado = null;
    if (req.session.cliente_id) { // Verificando se o cliente está logado
      db.query('SELECT * FROM clientes WHERE id = ?', [req.session.cliente_id], (err, results) => {
        if (err) throw err;
        clienteLogado = results[0];

        // Renderiza a página passando os dados
        res.render('index', { produtos, clienteLogado });
      });
    } else {
      // Se não houver cliente logado, renderiza sem clienteLogado
      res.render('index', { produtos, clienteLogado: null });
    }
  });
});


// Rota de logout
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Erro ao deslogar");
    }
    res.redirect('/'); // Redireciona para a página inicial após logout
  });
});

// Rota de cadastro de cliente
app.get('/cadastro', (req, res) => {
  res.render('cadastro');
});

app.post('/cadastro', [
  body('email').isEmail().withMessage('Email inválido'),
  body('telefone').isLength({ min: 10, max: 15 }).withMessage('Telefone inválido'),
  // Adicione outras validações conforme necessário
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { nome, email, senha, cep, endereco, cidade, estado, telefone } = req.body;

  const query = 'INSERT INTO clientes (nome, email, senha, cep, endereco, cidade, estado, telefone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  db.query(query, [nome, email, senha, cep, endereco, cidade, estado, telefone], (err, result) => {
    if (err) {
      res.status(500).send("Erro ao cadastrar o cliente");
    } else {
      res.redirect('/login');
    }
  });
});

// Rota de login
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const { email, senha } = req.body;
  const query = 'SELECT * FROM clientes WHERE email = ? AND senha = ?';
  db.query(query, [email, senha], (err, result) => {
    if (err || result.length === 0) {
      res.status(400).send("Email ou senha incorretos");
    } else {
      // Salvar sessão ou token para manter o usuário logado
      req.session.cliente_id = result[0].id;
      req.session.nome = result[0].nome;  // Armazenando o nome do cliente
      req.session.is_admin = result[0].is_admin;  // Armazenando se o cliente é admin

      console.log('Usuário logado:', req.session);  // Verifique a sessão no console

      res.redirect('/');  // Redireciona para a página principal após login
    }
  });
});



// Rota de administração
app.get('/admin', (req, res) => {
  if (req.session.is_admin !== 1) {
    return res.status(403).send("Acesso restrito!"); // Bloquear o acesso de usuários não administradores
  }

  res.render('admin'); // Exibir página de administração
});

// Rota de adicionar ao carrinho
app.get('/carrinho/adicionar', (req, res) => {
  const { cliente_id, semi_joia_id, quantidade } = req.query;

  const query = 'INSERT INTO carrinho (cliente_id, semi_joia_id, quantidade) VALUES (?, ?, ?)';
  db.query(query, [cliente_id, semi_joia_id, quantidade], (err, result) => {
    if (err) {
      res.status(500).send("Erro ao adicionar produto ao carrinho");
    } else {
      res.redirect('/carrinho');
    }
  });
});

// Página para cadastrar produtos (acessível somente para admin)
app.get('/admin/cadastrar-produto', (req, res) => {
  if (!req.session.cliente_id || req.session.is_admin !== 1) {  // Altere para is_admin
    return res.status(403).send("Acesso restrito!"); // Bloquear acesso não autorizado
  }
  res.render('cadastrar-produto'); // Página onde o admin pode cadastrar produtos
});


// Processar o formulário de cadastro de produto
app.post('/admin/cadastrar-produto', upload.single('imagem'), (req, res) => {
  if (!req.session.cliente_id || req.session.is_admin !== 1) {  // Altere para is_admin
    return res.status(403).send("Acesso restrito!"); // Impede que usuários não administradores cadastrem produtos
  }

  const { nome, descricao, preco } = req.body;
  const imagem = req.file ? req.file.filename : null; // Armazenando o nome da imagem

  const query = 'INSERT INTO produtos (nome, descricao, preco, imagem) VALUES (?, ?, ?, ?)';
  db.query(query, [nome, descricao, preco, imagem], (err, result) => {
    if (err) {
      console.error("Erro ao cadastrar produto:", err);
      return res.status(500).send("Erro ao cadastrar produto");
    }

    res.redirect('/'); // Redireciona para a página inicial após o cadastro
  });
});


// Rota de exibição do carrinho
app.get('/carrinho', (req, res) => {
  const cliente_id = req.session.cliente_id; // Assumindo que você tem o cliente logado na sessão
  const query = `SELECT semi_joias.nome, semi_joias.preco, carrinho.quantidade
                 FROM carrinho
                 JOIN semi_joias ON carrinho.semi_joia_id = semi_joias.id
                 WHERE carrinho.cliente_id = ?`;

  db.query(query, [cliente_id], (err, result) => {
    if (err) throw err;
    res.render('carrinho', { produtos: result });
  });
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
