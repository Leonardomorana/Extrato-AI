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
          // Prompt reduzido ao absoluto necessário. O Schema guia a extração.
          text: `JSON`
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      // Configurações de amostragem para velocidade máxima (Greedy Decoding)
      temperature: 0,
      topP: 0.1,
      topK: 1,
      // Desabilita thinking para resposta imediata
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
                  description: "YYYY-MM-DD" 
                },
                description: { type: Type.STRING },
                amount: { 
                  type: Type.NUMBER, 
                  description: "Float. Negativo=saída." 
                },
                category: { 
                  type: Type.STRING, 
                  description: "Categoria simples" 
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