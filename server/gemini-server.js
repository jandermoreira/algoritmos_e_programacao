// Servidor para consultas ao Gemini 

require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3000;

// Configurações do servidor
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Verifica se a API KEY está configurada
if (!process.env.GEMINI_API_KEY) {
    console.error('ERRO: A chave API do Gemini não está configurada no arquivo .env');
    process.exit(1);
}

// Rota do proxy para o Gemini AI
app.post('/api/gemini-proxy', async (req, res) => {
    try {
        const { prompt } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ 
                error: 'O prompt é obrigatório',
                details: 'Nenhum texto de entrada foi fornecido'
            });
        }

        console.log('Processando prompt:', prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''));
        
        // Inicializa o Gemini AI
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        // Envia a solicitação para o Gemini
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        res.json({ response: text });

    } catch (error) {
        console.error('Erro na API Gemini:', error);
        
        // Verificação detalhada dos erros de quota
        const isQuotaError = (
            error.message.includes('RESOURCE_EXHAUSTED') ||
            error.message.includes('429') ||
            error.message.includes('quota') ||
            error.message.includes('Quota') ||
            error.message.includes('exhausted') ||
            (error.response && error.response.status === 429) ||
            (error.code && error.code === 429)
        );

        if (isQuotaError) {
            const quotaMessage = 'Limite de requisições atingido (quota excedida)';
            console.error('ERRO DE QUOTA:', quotaMessage);
            return res.status(429).json({ 
                error: quotaMessage,
                details: {
                    message: 'O serviço atingiu o limite máximo de requisições permitidas.',
                    solution: 'Tente novamente mais tarde ou verifique seu plano na Google Cloud Console',
                    docs: 'https://ai.google.dev/docs/errors'
                }
            });
        }

        // Tratamento para autenticação
        if (error.message.includes('401') || error.message.includes('PERMISSION_DENIED')) {
            return res.status(401).json({
                error: 'Problema de autenticação',
                details: 'A chave API pode estar inválida ou expirada'
            });
        }

        // Outros erros
        res.status(500).json({ 
            error: 'Erro ao processar sua solicitação',
            details: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                stack: error.stack
            } : null
        });
    }
});

// Rota para servir o HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Middleware para erros não tratados
app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    res.status(500).json({ 
        error: 'Ocorreu um erro inesperado no servidor',
        details: process.env.NODE_ENV === 'development' ? err.message : null
    });
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log(`Acesse a interface em http://localhost:${port}`);
});