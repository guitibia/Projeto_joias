const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const router = express.Router();

// Rota para cadastro de clientes
router.post('/cadastro', (req, res) => {
    const { nome, email, senha, endereco } = req.body;

    // Verificar se o email já está registrado
    const query = 'SELECT * FROM clientes WHERE email = ?';
    db.query(query, [email], (err, result) => {
        if (err) throw err;
        if (result.length > 0) {
            return res.status(400).send('E-mail já cadastrado');
        }

        // Criptografar a senha
        bcrypt.hash(senha, 10, (err, hashedPassword) => {
            if (err) throw err;

            // Inserir novo cliente no banco de dados
            const insertQuery = 'INSERT INTO clientes (nome, email, senha, endereco) VALUES (?, ?, ?, ?)';
            db.query(insertQuery, [nome, email, hashedPassword, endereco], (err, result) => {
                if (err) throw err;
                res.status(200).send('Cadastro realizado com sucesso');
            });
        });
    });
});

module.exports = router;
