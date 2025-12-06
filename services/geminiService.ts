import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const ELI5_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    mainObject: {
      type: Type.STRING,
      description: "The name of the main object identified in the image.",
    },
    summary: {
      type: Type.STRING,
      description: "A fun, simple 1-2 sentence explanation of what this object does, written for a 5-year-old.",
    },
    parts: {
      type: Type.ARRAY,
      description: "A list of key interesting parts of the object (3 to 5 parts).",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "A unique short identifier for the part (e.g., 'wheel', 'screen').",
          },
          name: {
            type: Type.STRING,
            description: "The simple name of the part.",
          },
          explanation: {
            type: Type.STRING,
            description: "A fun, simple 1-sentence explanation of what this specific part does, for a 5-year-old.",
          },
          box_2d: {
            type: Type.ARRAY,
            description: "The bounding box of the part in the format [ymin, xmin, ymax, xmax] on a scale of 0 to 1000.",
            items: {
              type: Type.INTEGER,
            },
          },
        },
        required: ["id", "name", "explanation", "box_2d"],
      },
    },
  },
  required: ["mainObject", "summary", "parts"],
};

export const analyzeImage = async (base64Image: string): Promise<AnalysisResult> => {
  try {
    const cleanBase64 = base64Image.split(',')[1];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg", 
              data: cleanBase64,
            },
          },
          {
            text: "You are 'Professor Sparkle', a magical robot who explains the world to 5-year-olds. Analyze this image. Identify the main object and its most interesting parts. Be super enthusiastic! Use simple words, emojis, and fun comparisons. Ensure the bounding boxes are accurate.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: ELI5_SCHEMA,
        systemInstruction: "Always speak in a fun, wondering, and simple tone. Avoid complex jargon. Use analogies a child would understand. Add an emoji to every explanation.",
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as AnalysisResult;
    } else {
      throw new Error("No text response from Gemini");
    }
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    throw error;
  }
};

export const askQuestion = async (base64Image: string, base64Audio: string, mimeType: string): Promise<string> => {
  try {
    const cleanImageBase64 = base64Image.split(',')[1];
    // Audio usually comes in as data url as well from FileReader
    const cleanAudioBase64 = base64Audio.split(',')[1] || base64Audio;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanImageBase64,
            },
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanAudioBase64,
            }
          },
          {
            text: "You are Professor Sparkle. The child has just sent you an audio question about this image. Listen to their question and answer it in a text format. Keep the answer short (max 2 sentences), very simple, funny, and educational for a 5-year-old. Use emojis!",
          },
        ],
      },
    });

    return response.text || "Oops! I couldn't hear that properly. Can you ask again? 🙉";
  } catch (error) {
    console.error("Gemini Q&A Failed:", error);
    return "Oh no! My robot ears are clogged. Try again! 🤖";
  }
};

export const speakText = async (text: string): Promise<ArrayBuffer> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: {
        parts: [{ text: text }],
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' }, // 'Puck' is mischievous/fun, perfect for kids app
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data received");

    // Convert base64 to ArrayBuffer manually
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    console.error("TTS Failed:", error);
    throw error;
  }
};