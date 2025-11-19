import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedData } from "../types";

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the Data URL prefix (e.g., "data:application/pdf;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const analyzeBankStatement = async (file: File): Promise<ExtractedData> => {
  // Inicialização ajustada para usar diretamente process.env.API_KEY conforme diretrizes
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = await fileToBase64(file);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Data
          }
        },
        {
          // Prompt minimalista para reduzir o processamento de tokens de entrada.
          // As regras detalhadas foram movidas para as descrições do Schema abaixo.
          text: `Extrair dados bancários.`
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      // Garante resposta imediata sem raciocínio profundo (thinking)
      thinkingConfig: { thinkingBudget: 0 },
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          bankName: { type: Type.STRING, nullable: true },
          accountHolder: { type: Type.STRING, nullable: true },
          transactions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { 
                  type: Type.STRING, 
                  description: "Data da transação em formato ISO 8601 (YYYY-MM-DD)" 
                },
                description: { type: Type.STRING },
                amount: { 
                  type: Type.NUMBER, 
                  description: "Valor float. Negativo para saídas/débitos, Positivo para entradas/créditos." 
                },
                category: { 
                  type: Type.STRING, 
                  description: "Categoria resumida (1-2 palavras)" 
                }
              },
              required: ["date", "description", "amount", "category"]
            }
          }
        },
        required: ["transactions"]
      }
    }
  });

  if (!response.text) {
    throw new Error("Não foi possível extrair dados do PDF.");
  }

  try {
    const data = JSON.parse(response.text) as ExtractedData;
    return data;
  } catch (e) {
    console.error("Failed to parse JSON", e);
    throw new Error("Erro ao processar a resposta da IA.");
  }
};