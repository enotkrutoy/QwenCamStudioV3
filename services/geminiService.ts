
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ImageData, GenerationSettings, GroundingChunk } from "../types";
import { MODELS } from "../constants";

export class GeminiService {
  async generateImage(
    sourceImage: ImageData,
    cameraPrompt: string,
    settings: GenerationSettings
  ): Promise<{ imageUrl: string; groundingChunks?: GroundingChunk[] }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelName = settings.quality === 'pro' ? MODELS.pro : MODELS.flash;
    
    const imagePart = {
      inlineData: {
        mimeType: sourceImage.mimeType,
        data: sourceImage.base64.split(',')[1],
      },
    };

    const textPart = {
      text: `[SYSTEM_KERNEL: IDENTITY_PRESERVATION_ENGINE_V6]
Strict operational guidelines for high-fidelity spatial reconstruction.

PHASE 0: NEUTRAL_VISUAL_REGISTRATION
Analyze the source image with zero bias. Register the primary subject's anatomical structure.
- Generate a latent anchor of the subject's identity.
- Do not modify age, ethnicity, or core character traits.

PHASE 1: IDENTITY_LOCK (CRITICAL)
- Lock biometric parameters: pupillary distance, bone structure, nasal architecture, hairline.
- PROHIBITED: "Enhancement", retouching, or facial modifications. 
- Transfer 100% of skin texture, moles, and micro-details to the reconstructed frame.

PHASE 2: SPATIAL_TRANSFORMATION
- Execute 3D perspective shift: ${cameraPrompt}
- Scene context: ${settings.creativeContext || "Maintain original lighting and environment materials"}

CONSTRAINTS:
- PERSPECTIVE: Recalculate all vanishing points relative to NEW camera position.
- FIDELITY: Maintain consistent lighting on the subject's face during rotation.
- SEED: ${settings.seed}
- OUTPUT: One high-resolution cinematic reconstruction.`
    };

    const config: any = {
      imageConfig: { aspectRatio: "1:1" }
    };

    if (settings.quality === 'pro') {
      config.imageConfig.imageSize = settings.imageSize || '1K';
      config.tools = [{ googleSearch: {} }];
    }

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: { parts: [imagePart, textPart] },
      config
    });

    let imageUrl = '';
    const candidate = response.candidates?.[0];
    
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!imageUrl) {
      throw new Error("RECONSTRUCTION_FAULT: Identity lock failed. Try a different source.");
    }

    const groundingChunks = candidate?.groundingMetadata?.groundingChunks as GroundingChunk[];
    return { imageUrl, groundingChunks };
  }
}

export const geminiService = new GeminiService();
