const express = require('express');
const db = require('../config/database');
const router = express.Router();

// Adicionar semi joia
router.post('/adicionar', (req, res) => {
    const { nome, descricao, preco, imagem } = req.body;

    const query = 'INSERT INTO semi_joias (nome, descricao, preco, imagem) VALUES (?, ?, ?, ?)';
    db.query(query, [nome, descricao, preco, imagem], (err, result) => {
        if (err) throw err;
        res.status(200).send('Produto adicionado com sucesso');
    });
});

// Remover semi joia
router.delete('/remover/:id', (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM semi_joias WHERE id = ?';
    db.query(query, [id], (err, result) => {
        if (err) throw err;
        res.status(200).send('Produto removido com sucesso');
    });
});

module.exports = router;
