
import { Service } from "../types";

// Lazy-load @google/genai to keep it out of the initial bundle. The module is only
// imported when this function is called (e.g., when the user requests AI generation).
export const generateCampaignIdea = async (services: Service[], location: string): Promise<{name: string, description: string}> => {
  // Dynamically import the GenAI client
  const genai = await import('@google/genai');
  const { GoogleGenAI, Type } = genai as any;

  // Initialize with the API key from env (Vite replace at build time)
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const serviceNames = services.map(s => `${s.name} (${s.type})`).join(', ');

  const prompt = `Generate a creative advertising campaign idea for the following eMobility services in ${location}: ${serviceNames}. The campaign should be appealing and concise. Provide a catchy name and a short description.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'A catchy name for the campaign.' },
            description: { type: Type.STRING, description: 'A short, appealing description of the campaign.' },
          },
          required: ['name', 'description'],
        },
      }
    });

    const parsed = JSON.parse(response.text);
    if (parsed.name && parsed.description) {
      return { name: parsed.name, description: parsed.description };
    }
    throw new Error("Invalid JSON structure from Gemini API");
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return { name: "Summer Mobility Fest", description: `Enjoy special discounts on ${serviceNames} in ${location} all summer long!` };
  }
};
