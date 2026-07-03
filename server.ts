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
        return res.status(400).json({ error: "Chave API do Gemini não configurada. Se você estiver usando o Google AI Studio, adicione sua chave de API válida no menu superior direito em 'Settings > Secrets' (Configurações > Segredos). Se exportou o projeto para o GitHub, local ou hospedado em outra plataforma (como Vercel ou Render), configure a variável de ambiente GEMINI_API_KEY com a sua chave obtida no Google AI Studio." });
      }

      // Extrai o tipo de mídia (mimeType) e os dados puros em base64 com segurança
      let mimeType = "image/jpeg";
      let base64Data = base64Image;

      if (base64Image.includes(";base64,")) {
        const parts = base64Image.split(";base64,");
        mimeType = parts[0].replace("data:", "");
        base64Data = parts[1];
      } else if (base64Image.includes(",")) {
        const parts = base64Image.split(",");
        base64Data = parts[1];
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
                    { text: "Extract product codes (exactly 9 digits, e.g. 100000134 or 400001625) and their associated quantities from the image. For each detected product, return in the format 'CODE:QUANTITY'. If the quantity is not specified, use 0 (e.g. 100000134:0). Separate each CODE:QUANTITY pair with a single space. Do NOT return any markdown, explanations, list indices, bullet points, or introductory text. Just the codes and quantities." },
                    { inlineData: { data: base64Data, mimeType: mimeType } }
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
      console.log("Raw OCR response from Gemini:", rawText);

      let cleanedText = rawText;
      // Join spaces inside 9-digit numbers (e.g. 100 000 134 -> 100000134)
      cleanedText = cleanedText.replace(/\b(\d{3})\s+(\d{3})\s+(\d{3})\b/g, '$1$2$3');
      // Clean up spacing around colons
      cleanedText = cleanedText.replace(/(\d{9})\s*:\s*(\d+)/g, '$1:$2');

      // Usar expressão regular para extrair APENAS padrões do tipo CÓDIGO (9 dígitos) opcionalmente seguidos por :QUANTIDADE
      const matches = cleanedText.match(/\b\d{9}(?::\d+)?\b/g);
      const recognizedText = matches ? matches.join(' ') : '';
      console.log("Parsed recognized text:", recognizedText);

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
