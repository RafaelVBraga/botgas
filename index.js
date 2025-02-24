const venom = require("venom-bot");
const express = require("express");
const axios = require("axios");

const app = express();
const PORT = 3000;
app.use(express.json());

let usuarioRespostas = {}; // Objeto para armazenar respostas temporárias

// Iniciar o Venom-Bot
//venom.create().then((client) => start(client)).catch((err) => console.log(err));
venom.create({
    session: "whatsapp-session",
    multidevice: true,
    headless: true, // Ativa o novo modo Headless
    browserArgs: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-software-rasterizer"
    ],
}).then((client) => start(client)).catch((err) => console.log("Erro ao iniciar Venom:", err));

function start(client) {
    console.log("✅ Bot do WhatsApp Iniciado!");

    client.onMessage(async (message) => {
        const numero = message.from;
        const texto = message.body.trim().toLowerCase();

        // Verifica se o número já está no fluxo de coleta de dados
        if (!usuarioRespostas[numero]) {
            usuarioRespostas[numero] = { etapa: 0, dados: {} };

            // Enviar saudação inicial baseada na hora do dia
            const hora = new Date().getHours();
            const saudacao = hora < 12 ? "Bom dia" : "Boa tarde";

            await client.sendText(numero, `${saudacao}! Vamos coletar algumas informações.`);
            await client.sendText(numero, "Qual o seu nome?");
            usuarioRespostas[numero].etapa = 1;
            return;
        }

        // Fluxo de perguntas ao usuário
        switch (usuarioRespostas[numero].etapa) {
            case 1:
                usuarioRespostas[numero].dados.nome = texto;
                await client.sendText(numero, "Qual seu cargo?");
                usuarioRespostas[numero].etapa++;
                break;
            case 2:
                usuarioRespostas[numero].dados.cargo = texto;
                await client.sendText(numero, "Qual o nome da escola?");
                usuarioRespostas[numero].etapa++;
                break;
            case 3:
                usuarioRespostas[numero].dados.escola = texto;
                await client.sendText(numero, "Qual a rota?");
                usuarioRespostas[numero].etapa++;
                break;
            case 4:
                usuarioRespostas[numero].dados.rota = texto;
                await client.sendText(numero, "Qual o tipo de gás: P13(pequeno) ou P45(grande)?");
                usuarioRespostas[numero].etapa++;
                break;
            case 5:
                if (texto !== "p13" && texto !== "p45") {
                    await client.sendText(numero, "Por favor, escolha entre P13 (pequeno) ou P45 (grande).");
                    return;
                }
                usuarioRespostas[numero].dados.tipoGas = texto.toUpperCase();
                await client.sendText(numero, "Quantos botijões cheios ainda possui na escola?");
                usuarioRespostas[numero].etapa++;
                break;
            case 6:
                if (isNaN(texto)) {
                    await client.sendText(numero, "Por favor, envie um número válido.");
                    return;
                }
                usuarioRespostas[numero].dados.botijoesCheios = parseInt(texto);
                await client.sendText(numero, "Quantos botijões vazios ainda possui na escola?");
                usuarioRespostas[numero].etapa++;
                break;
            case 7:
                if (isNaN(texto)) {
                    await client.sendText(numero, "Por favor, envie um número válido.");
                    return;
                }
                usuarioRespostas[numero].dados.botijoesVazios = parseInt(texto);

                // Aviso Final
                await client.sendText(numero, "⚠️ *Aviso!* Por favor, avise-nos sempre que estiver com o gás de reserva mínimo, o mais breve possível!");

                // Enviar os dados para o backend Spring Boot
                try {
                    await axios.post("http://localhost:8083/webhook/whatsapp", usuarioRespostas[numero].dados);
                    await client.sendText(numero, "✅ Suas informações foram registradas com sucesso!");
                } catch (error) {
                    console.error("Erro ao enviar dados para o backend:", error);
                    await client.sendText(numero, "❌ Houve um erro ao salvar suas informações. Tente novamente mais tarde.");
                }

                // Limpar os dados do usuário após o envio
                delete usuarioRespostas[numero];
                break;
        }
    });
}

// Iniciar API Express para monitoramento
app.listen(PORT, () => {
    console.log(`Servidor Node.js rodando na porta ${PORT}`);
});
