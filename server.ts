import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Max body limits for image uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API scanner route
  app.post("/api/scan-image", async (req, res) => {
    try {
      const { base64Image } = req.body;
      if (!base64Image) {
        return res.status(400).json({ error: "Nenhuma imagem recebida." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      console.log("GEMINI_API_KEY present:", !!apiKey);
      if (apiKey) {
        console.log("GEMINI_API_KEY length:", apiKey.length);
        console.log("GEMINI_API_KEY preview:", apiKey.substring(0, 5) + "..." + apiKey.substring(apiKey.length - 5));
      }
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        console.warn("GEMINI_API_KEY env variable is not set or is using placeholder.");
        return res.status(400).json({ error: "Chave API do Gemini não configurada. Por favor, adicione sua chave válida em 'Settings > Secrets' (Configurações > Segredos) no menu superior direito do Google AI Studio para usar a câmera." });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
      let response;
      let lastError: any = null;
      const modelsToTry = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"];
      
      for (const model of modelsToTry) {
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
          try {
            console.log(`Tentando processar imagem com o modelo ${model} (Tentativa ${attempts + 1}/${maxAttempts})...`);
            
            const config: any = {};
            if (model.includes("3.5-flash")) {
              config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
            }
            
            response = await ai.models.generateContent({
              model: model,
              contents: [
                {
                  parts: [
                    { text: "Extract product codes (9 digits) and quantities (number before parentheses like '(CX6)'). Return as CODE:QUANTITY separated by spaces. If quantity is not found, use 0 (e.g., 400001889:0). Only return codes and quantities." },
                    { inlineData: { data: base64Image.split(',')[1], mimeType: "image/jpeg" } }
                  ]
                }
              ],
              config: config
            });
            
            break;
          } catch (err: any) {
            lastError = err;
            attempts++;
            console.warn(`Erro na tentativa ${attempts} com o modelo ${model}:`, err.message || err);
            if (attempts < maxAttempts) {
              // Exponential backoff with jitter to alleviate rate-limiting and demand spikes
              const delay = Math.pow(2, attempts) * 1000 + Math.floor(Math.random() * 1000);
              console.log(`Aguardando ${delay}ms antes da próxima tentativa...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        if (response) {
          break;
        }
      }

      if (!response) {
        throw lastError || new Error("Falha ao obter resposta de todos os modelos Gemini disponíveis.");
      }

      const rawText = response.text || "";
      const recognizedText = rawText.replace(/[^0-9:\s]/g, '').replace(/\s+/g, ' ').trim();

      return res.json({ recognizedText });
    } catch (err: any) {
      console.error("Erro no reconhecimento no servidor:", err);
      let errMsg = err.message || JSON.stringify(err);
      if (errMsg.includes("API key not valid") || errMsg.includes("API_KEY_INVALID") || errMsg.includes("400")) {
        errMsg = "A chave de API do Gemini configurada é inválida ou expirou. Por favor, acesse o painel 'Settings > Secrets' (Configurações > Segredos) no topo direito do Google AI Studio e adicione uma chave válida.";
      } else if (errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand") || errMsg.includes("temporary")) {
        errMsg = "O serviço do Gemini está temporariamente com alta demanda ou indisponível (Erro 503). Por favor, tente novamente em alguns segundos ou adicione os itens manualmente.";
      }
      return res.status(500).json({ error: "Erro ao processar imagem no servidor: " + errMsg });
    }
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
