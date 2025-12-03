import { GoogleGenAI, Type } from "@google/genai";
import { PDFDocument } from "pdf-lib";
import { ExtractedData, Transaction } from "../types";

// Reduced to 3 pages per chunk to prevent output token limit truncation (JSON parse errors)
const PAGES_PER_CHUNK = 3;

const cleanJsonResponse = (text: string): string => {
  let cleaned = text.trim();
  // Remove markdown code blocks common in LLM responses
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned;
};

// Helper to extract text from a specific PDF chunk
const processPdfChunk = async (base64Chunk: string, ai: GoogleGenAI): Promise<any> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Chunk
          }
        },
        {
          text: `Extract transactions.`
        }
      ]
    },
    config: {
      // Instrução otimizada para velocidade e precisão em formatos BR (PagBank, Uber, Digio, etc)
      systemInstruction: `You are an expert JSON extractor for Brazilian bank statements.
      Target Banks: PagBank, Uber Conta, Digio, Nubank, Inter, Itaú, Bradesco.
      
      Output STRICT JSON. No markdown.
      Dates: YYYY-MM-DD.
      Values: Float (use '.' for decimal).
      
      CRITICAL RULES FOR VALUES:
      1. Detect sign based on context and columns.
      2. NEGATIVE (Expense): 
         - Words in description/type: 'Débito', 'Saída', 'Envio', 'Pagamento', 'Compra', 'Tarifa', 'Retirada', 'Pix Enviado'.
         - Symbols: '-' before 'R$' or before number.
         - Columns labeled 'Débito' or 'Saída'.
      3. POSITIVE (Income): 
         - Words in description/type: 'Crédito', 'Entrada', 'Recebimento', 'Estorno', 'Depósito', 'Transferência recebida', 'Pix Recebido', 'Ganhos'.
      4. IGNORE: 'Saldo', 'Total', 'Subtotal', 'A aplicar', 'Saldo Anterior'.
      5. PagBank/Digital Banks Specific: 'Envio de Pix' is Negative. 'Recebimento de Pix' is Positive.
      
      Schema Keys: 
      b=bank_name (string), 
      h=holder_name (string), 
      tx=transactions (array of objects: d=date, t=desc, v=val, c=cat).`,
      responseMimeType: "application/json",
      temperature: 0,
      topP: 0.1,
      topK: 1,
      thinkingConfig: { thinkingBudget: 0 },
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          b: { type: Type.STRING, nullable: true },
          h: { type: Type.STRING, nullable: true },
          tx: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                d: { type: Type.STRING, description: "Date YYYY-MM-DD" },
                t: { type: Type.STRING, description: "Description" },
                v: { type: Type.NUMBER, description: "Value. Negative for expenses." },
                c: { type: Type.STRING, description: "Category (e.g. Pix, Boleto, Taxa)" }
              },
              required: ["d", "t", "v", "c"]
            }
          }
        },
        required: ["tx"]
      }
    }
  });

  if (!response.text) {
    throw new Error("Empty response from AI");
  }

  const cleanedText = cleanJsonResponse(response.text);
  return JSON.parse(cleanedText);
};

export const analyzeBankStatement = async (file: File): Promise<ExtractedData> => {
  if (!process.env.API_KEY) {
    throw new Error("Chave de API não configurada. Por favor, adicione a variável de ambiente API_KEY nas configurações do Vercel.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const totalPages = pdfDoc.getPageCount();
    
    let allTransactions: Transaction[] = [];
    let bankName = "";
    let accountHolder = "";

    // Determine chunks
    const chunkPromises = [];
    
    // If file is small, process as one. If large, split.
    if (totalPages <= PAGES_PER_CHUNK) {
       // Single chunk processing (optimization for small files)
       const base64 = await pdfDoc.saveAsBase64();
       chunkPromises.push(processPdfChunk(base64, ai));
    } else {
       // Split into chunks
       for (let i = 0; i < totalPages; i += PAGES_PER_CHUNK) {
         const subDoc = await PDFDocument.create();
         const pageIndices = [];
         // Calculate pages for this chunk
         for (let j = 0; j < PAGES_PER_CHUNK && (i + j) < totalPages; j++) {
           pageIndices.push(i + j);
         }
         
         const copiedPages = await subDoc.copyPages(pdfDoc, pageIndices);
         copiedPages.forEach(page => subDoc.addPage(page));
         
         const base64Chunk = await subDoc.saveAsBase64();
         chunkPromises.push(processPdfChunk(base64Chunk, ai));
       }
    }

    // Process all chunks in parallel
    const results = await Promise.all(chunkPromises);

    // Merge results
    results.forEach((data) => {
        if (data.tx && Array.isArray(data.tx)) {
            const mappedTransactions = data.tx.map((item: any) => ({
                date: item.d,
                description: item.t,
                amount: item.v,
                category: item.c
            }));
            allTransactions = [...allTransactions, ...mappedTransactions];
        }
        
        // Capture metadata from the first chunk that has it
        if (!bankName && data.b) bankName = data.b;
        if (!accountHolder && data.h) accountHolder = data.h;
    });

    return {
        bankName: bankName || "Banco não identificado",
        accountHolder: accountHolder || "Titular não identificado",
        transactions: allTransactions
    };

  } catch (e: any) {
    console.error("Erro na análise do extrato:", e);
    // Repassa a mensagem de erro se for específica (ex: chave api), senão genérica
    const message = e.message || "Falha ao processar o arquivo. Verifique se é um PDF válido e tente novamente.";
    throw new Error(message);
  }
};