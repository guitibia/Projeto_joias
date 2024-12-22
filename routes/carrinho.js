const express = require('express');
const db = require('../config/database');
const router = express.Router();

// Adicionar item ao carrinho
router.post('/adicionar', (req, res) => {
  const { cliente_id, semi_joia_id, quantidade } = req.body;

  // Verificar se o item já existe no carrinho
  const query = 'SELECT * FROM carrinho WHERE cliente_id = ? AND semi_joia_id = ?';
  db.query(query, [cliente_id, semi_joia_id], (err, result) => {
    if (err) throw err;
    if (result.length > 0) {
      // Atualizar a quantidade
      const updateQuery = 'UPDATE carrinho SET quantidade = quantidade + ? WHERE cliente_id = ? AND semi_joia_id = ?';
      db.query(updateQuery, [quantidade, cliente_id, semi_joia_id], (err, result) => {
        if (err) throw err;
        res.status(200).send('Quantidade atualizada no carrinho');
      });
    } else {
      // Inserir no carrinho
      const insertQuery = 'INSERT INTO carrinho (cliente_id, semi_joia_id, quantidade) VALUES (?, ?, ?)';
      db.query(insertQuery, [cliente_id, semi_joia_id, quantidade], (err, result) => {
        if (err) throw err;
        res.status(200).send('Produto adicionado ao carrinho');
      });
    }
  });
});

router.get('/carrinho/:cliente_id', (req, res) => {
  const { cliente_id } = req.params;
  const query = `SELECT semi_joias.nome, semi_joias.preco, carrinho.quantidade
                 FROM carrinho
                 JOIN semi_joias ON carrinho.semi_joia_id = semi_joias.id
                 WHERE carrinho.cliente_id = ?`;

  db.query(query, [cliente_id], (err, result) => {
    if (err) throw err;
    res.json(result);
  });
});

app.get('/carrinho', (req, res) => {
  const cliente_id = req.query.cliente_id;
  const query = `SELECT semi_joias.nome, semi_joias.preco, carrinho.quantidade
                 FROM carrinho
                 JOIN semi_joias ON carrinho.semi_joia_id = semi_joias.id
                 WHERE carrinho.cliente_id = ?`;

  db.query(query, [cliente_id], (err, result) => {
    if (err) throw err;
    res.render('carrinho', { produtos: result });
  });
});



module.exports = router;
