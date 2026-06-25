const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory database (loaded from JSON file)
let database = {
  modulos: [],
  questoes: [],
  resultados: []
};

// Initialize database from JSON file
function initializeDatabase() {
  try {
    // Try to load from questoes.json in the backend directory
    const questoesPath = path.join(__dirname, 'questoes.json');
    
    if (fs.existsSync(questoesPath)) {
      const data = JSON.parse(fs.readFileSync(questoesPath, 'utf8'));
      database.modulos = data.modulos || [];
      database.questoes = data.questoes || [];
      
      console.log('✅ Banco de dados inicializado com sucesso');
      console.log(`📊 Total de questões carregadas: ${database.questoes.length}`);
    } else {
      console.warn('⚠️  Arquivo questoes.json não encontrado em:', questoesPath);
      console.warn('⚠️  Inicializando com estrutura vazia...');
      
      database.modulos = [
        { id: 1, nome: '1A', descricao: 'Módulo 1A - Conceitos Fundamentais', quantidade_questoes: 0 },
        { id: 2, nome: '2A', descricao: 'Módulo 2A - Domínios de Desempenho', quantidade_questoes: 0 },
        { id: 3, nome: 'Integrado', descricao: 'Simulado Integrado', quantidade_questoes: 0 }
      ];
    }
  } catch (err) {
    console.error('Erro ao inicializar banco:', err);
  }
}

// Initialize on startup
initializeDatabase();

// ============ ENDPOINTS ============

// GET: Verificar versão
app.get('/api/version', (req, res) => {
  res.json({
    versao: '2.0',
    ultima_atualizacao: new Date().toISOString(),
    total_questoes: database.questoes.length,
    modulos: ['1A', '2A', 'Integrado']
  });
});

// GET: Buscar questões por módulo
app.get('/api/questoes', (req, res) => {
  try {
    const { modulo, tipo, quantidade } = req.query;

    if (tipo === 'misto') {
      // Simulado misto: questões aleatórias de 1A e 2A
      const qtd = quantidade ? parseInt(quantidade) : 50;
      
      const questoesMisto = database.questoes
        .filter(q => q.modulo_id === 1 || q.modulo_id === 2)
        .sort(() => Math.random() - 0.5)
        .slice(0, qtd);

      res.json({
        tipo: 'misto',
        total: questoesMisto.length,
        questoes: questoesMisto.map(q => ({
          id: q.id,
          numero: q.numero,
          pergunta: q.pergunta,
          opcoes: {
            a: q.opcao_a,
            b: q.opcao_b,
            c: q.opcao_c,
            d: q.opcao_d
          },
          resposta_correta: q.resposta_correta,
          dificuldade: q.dificuldade
        }))
      });
    } else if (modulo) {
      // Buscar por módulo específico
      const moduloMap = { '1a': 1, '2a': 2, 'integrado': 3, '1b': 1, '2b': 2, '3b': 3 };
      const moduloId = moduloMap[modulo.toLowerCase()];

      if (!moduloId) {
        return res.status(400).json({ error: 'Módulo inválido. Use: 1a, 2a ou integrado' });
      }

      const questoesModulo = database.questoes
        .filter(q => q.modulo_id === moduloId)
        .sort((a, b) => a.numero - b.numero);

      res.json({
        modulo: modulo.toUpperCase(),
        total: questoesModulo.length,
        questoes: questoesModulo.map(q => ({
          id: q.id,
          numero: q.numero,
          pergunta: q.pergunta,
          opcoes: {
            a: q.opcao_a,
            b: q.opcao_b,
            c: q.opcao_c,
            d: q.opcao_d
          },
          resposta_correta: q.resposta_correta,
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

    const resultado = {
      id: database.resultados.length + 1,
      modulo_id,
      tipo_simulado,
      questoes_respondidas,
      acertos,
      percentual,
      tempo_decorrido,
      data_simulado: new Date().toISOString()
    };

    database.resultados.push(resultado);

    res.json({
      id: resultado.id,
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
    const resultados = database.resultados
      .sort((a, b) => new Date(b.data_simulado) - new Date(a.data_simulado))
      .slice(0, 50);
    
    res.json(resultados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Buscar módulos
app.get('/api/modulos', (req, res) => {
  try {
    res.json(database.modulos);
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
