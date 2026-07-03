import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { base64Image } = req.body || {};

    if (!base64Image) {
      return res.status(400).json({ error: "Nenhuma imagem recebida." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      return res.status(400).json({
        error: "Chave API do Gemini não configurada nas variáveis de ambiente da Vercel (GEMINI_API_KEY)."
      });
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

    const ai = new GoogleGenAI({ apiKey });
    let response;
    let lastError: any = null;
    const modelsToTry = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"];

    for (const model of modelsToTry) {
      let attempts = 0;
      const maxAttempts = 2;
      while (attempts < maxAttempts) {
        try {
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
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      if (response) break;
    }

    if (!response) {
      throw lastError || new Error("Falha ao obter resposta de todos os modelos Gemini disponíveis.");
    }

    const rawText = response.text || "";
    const matches = rawText.match(/\b\d{9}(?::\d+)?\b/g);
    const recognizedText = matches ? matches.join(' ') : '';

    return res.status(200).json({ recognizedText });
  } catch (err: any) {
    console.error("Erro na Vercel Function:", err);
    return res.status(500).json({ 
      error: "Erro ao processar imagem no servidor Vercel: " + (err.message || String(err)) 
    });
  }
}
