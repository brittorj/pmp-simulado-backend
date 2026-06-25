const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const dbPath = path.join(__dirname, 'pmp_questoes.db');
let db;

try {
  db = new Database(dbPath);
  console.log('✅ Banco de dados conectado');
  initializeDatabase();
} catch (err) {
  console.error('Erro ao conectar ao banco:', err);
  process.exit(1);
}

// Initialize database tables
function initializeDatabase() {
  try {
    // Tabela de módulos
    db.exec(`
      CREATE TABLE IF NOT EXISTS modulos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT UNIQUE NOT NULL,
        descricao TEXT,
        quantidade_questoes INTEGER,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de questões
    db.exec(`
      CREATE TABLE IF NOT EXISTS questoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        modulo_id INTEGER NOT NULL,
        numero INTEGER,
        pergunta TEXT NOT NULL,
        opcao_a TEXT NOT NULL,
        opcao_b TEXT NOT NULL,
        opcao_c TEXT NOT NULL,
        opcao_d TEXT NOT NULL,
        resposta_correta TEXT NOT NULL,
        explicacao TEXT,
        dificuldade TEXT,
        topico TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (modulo_id) REFERENCES modulos(id)
      )
    `);

    // Tabela de resultados
    db.exec(`
      CREATE TABLE IF NOT EXISTS resultados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        modulo_id INTEGER,
        tipo_simulado TEXT,
        questoes_respondidas INTEGER,
        acertos INTEGER,
        percentual REAL,
        tempo_decorrido INTEGER,
        data_simulado DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (modulo_id) REFERENCES modulos(id)
      )
    `);

    // Verificar se há dados
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM questoes');
    const row = countStmt.get();
    
    if (row && row.count === 0) {
      console.log('📥 Populando banco com questões...');
      populateDatabase();
    }
  } catch (err) {
    console.error('Erro ao inicializar banco:', err);
  }
}

// Populate database with initial questions
function populateDatabase() {
  try {
    // Inserir módulos
    const modulos = [
      { nome: '1B', descricao: 'Iniciação e Planejamento', quantidade: 30 },
      { nome: '2B', descricao: 'Execução e Monitoramento', quantidade: 30 },
      { nome: '3B', descricao: 'Encerramento', quantidade: 24 }
    ];

    const insertModuloStmt = db.prepare(
      'INSERT OR IGNORE INTO modulos (nome, descricao, quantidade_questoes) VALUES (?, ?, ?)'
    );

    modulos.forEach(mod => {
      insertModuloStmt.run(mod.nome, mod.descricao, mod.quantidade);
    });

    // Inserir questões (usando dados do arquivo JSON existente)
    const questoesPath = path.join(__dirname, '../pmp_flutter/assets/questoes_mobile.json');
    
    if (fs.existsSync(questoesPath)) {
      const questoesData = JSON.parse(fs.readFileSync(questoesPath, 'utf8'));
      
      const insertQuestaoStmt = db.prepare(`
        INSERT INTO questoes 
        (modulo_id, numero, pergunta, opcao_a, opcao_b, opcao_c, opcao_d, resposta_correta, dificuldade) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Processar questões do módulo 1B
      if (questoesData.modulo_1b) {
        questoesData.modulo_1b.forEach((q, idx) => {
          insertQuestaoStmt.run(
            1,
            idx + 1,
            q.pergunta,
            q.opcoes.a,
            q.opcoes.b,
            q.opcoes.c,
            q.opcoes.d,
            q.respostaCorreta.toLowerCase(),
            'médio'
          );
        });
      }

      // Processar questões do módulo 2B
      if (questoesData.modulo_2b) {
        questoesData.modulo_2b.forEach((q, idx) => {
          insertQuestaoStmt.run(
            2,
            idx + 1,
            q.pergunta,
            q.opcoes.a,
            q.opcoes.b,
            q.opcoes.c,
            q.opcoes.d,
            q.respostaCorreta.toLowerCase(),
            'médio'
          );
        });
      }

      console.log('✅ Banco populado com sucesso');
    }
  } catch (err) {
    console.error('Erro ao popular banco:', err);
  }
}

// ============ ENDPOINTS ============

// GET: Verificar versão
app.get('/api/version', (req, res) => {
  try {
    const countStmt = db.prepare('SELECT COUNT(*) as total FROM questoes');
    const row = countStmt.get();
    
    res.json({
      versao: '2.0',
      ultima_atualizacao: new Date().toISOString(),
      total_questoes: row.total,
      modulos: ['1B', '2B', '3B']
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Buscar questões por módulo
app.get('/api/questoes', (req, res) => {
  try {
    const { modulo, tipo, quantidade } = req.query;

    if (tipo === 'misto') {
      // Simulado misto: 25 de 1B + 25 de 2B
      const qtd = quantidade ? parseInt(quantidade) : 50;
      
      const stmt = db.prepare(
        `SELECT * FROM questoes WHERE modulo_id IN (1, 2) ORDER BY RANDOM() LIMIT ?`
      );
      const rows = stmt.all(qtd);

      res.json({
        tipo: 'misto',
        total: rows.length,
        questoes: rows.map(q => ({
          id: q.id,
          numero: q.numero,
          pergunta: q.pergunta,
          opcoes: {
            a: q.opcao_a,
            b: q.opcao_b,
            c: q.opcao_c,
            d: q.opcao_d
          },
          respostaCorreta: q.resposta_correta,
          dificuldade: q.dificuldade
        }))
      });
    } else if (modulo) {
      // Buscar por módulo específico
      const moduloMap = { '1b': 1, '2b': 2, '3b': 3 };
      const moduloId = moduloMap[modulo.toLowerCase()];

      if (!moduloId) {
        return res.status(400).json({ error: 'Módulo inválido' });
      }

      const stmt = db.prepare(
        `SELECT * FROM questoes WHERE modulo_id = ? ORDER BY numero`
      );
      const rows = stmt.all(moduloId);

      res.json({
        modulo: modulo.toUpperCase(),
        total: rows.length,
        questoes: rows.map(q => ({
          id: q.id,
          numero: q.numero,
          pergunta: q.pergunta,
          opcoes: {
            a: q.opcao_a,
            b: q.opcao_b,
            c: q.opcao_c,
            d: q.opcao_d
          },
          respostaCorreta: q.resposta_correta,
          dificuldade: q.dificuldade
        }))
      });
    } else {
      res.status(400).json({ error: 'Parâmetro modulo ou tipo obrigatório' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Salvar resultado
app.post('/api/resultados', (req, res) => {
  try {
    const { modulo_id, tipo_simulado, questoes_respondidas, acertos, percentual, tempo_decorrido } = req.body;

    const stmt = db.prepare(`
      INSERT INTO resultados 
      (modulo_id, tipo_simulado, questoes_respondidas, acertos, percentual, tempo_decorrido) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      modulo_id,
      tipo_simulado,
      questoes_respondidas,
      acertos,
      percentual,
      tempo_decorrido
    );

    res.json({
      id: result.lastInsertRowid,
      status: 'salvo',
      mensagem: 'Resultado registrado com sucesso'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Buscar histórico de resultados
app.get('/api/resultados', (req, res) => {
  try {
    const stmt = db.prepare(
      `SELECT * FROM resultados ORDER BY data_simulado DESC LIMIT 50`
    );
    const rows = stmt.all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Buscar módulos
app.get('/api/modulos', (req, res) => {
  try {
    const stmt = db.prepare(`SELECT * FROM modulos`);
    const rows = stmt.all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 API disponível em http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  try {
    db.close();
    console.log('✅ Banco de dados fechado');
  } catch (err) {
    console.error('Erro ao fechar banco:', err);
  }
  process.exit(0);
});
