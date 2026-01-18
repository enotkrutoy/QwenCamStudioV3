
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
      text: `## ИНСТРУКЦИЯ ДЛЯ МОДЕЛИ (IDENTITY PRESERVATION ENGINE V8) ##

ФАЗА 1: ГЛУБОКИЙ СТРУКТУРНЫЙ АНАЛИЗ
Проанализируй изображение и зафиксируй ВСЕ элементы сцены:
- СУБЪЕКТ: черты лица, пропорции, одежда.
- ВЗАИМОДЕЙСТВИЕ: зафиксируй любые предметы в руках (документы, карты, гаджеты). Это КРИТИЧЕСКИЕ элементы сцены.
- ОКРУЖЕНИЕ: фон, освещение, тени.
*ЗАПРЕТ:* Не игнорировать и не удалять мелкие объекты. Если человек держит документ — этот документ является частью его идентичности в данной сцене.

ФАЗА 2: РЕКОНСТРУКЦИЯ С СОХРАНЕНИЕМ ЦЕЛОСТНОСТИ
Выполни трансформацию ракурса: "${cameraPrompt}".

ПРОТОКОЛ SCENE_INTEGRITY_LOCK:
1. СОХРАНЕНИЕ ОБЪЕКТОВ: Все предметы, которые субъект держит в руках (карточки, документы, аксессуары), ДОЛЖНЫ остаться в кадре и быть четко прорисованы. Удаление или обрезание этих объектов считается критической ошибкой рендеринга.
2. БЕЗ КРОПА: Не изменять границы кадра так, чтобы важные детали (руки с предметами) оказались за пределами видимости.
3. ИДЕНТИЧНОСТЬ: Лицо, волосы, возраст и внешность должны соответствовать оригиналу на 100%.
4. ТЕХНИЧЕСКАЯ ЧИСТОТА: Убрать шумы и пиксели, но сохранить текст или структуру на предметах в руках (сделать их более читаемыми, но не менять их содержание).

Цель: Получить технически совершенную версию оригинала в новом ракурсе, ГДЕ ВСЕ ЭЛЕМЕНТЫ (включая документы в руках) СОХРАНЕНЫ И УЛУЧШЕНЫ.

КОНТЕКСТ: ${settings.creativeContext || "Максимальная реалистичность."}
SEED: ${settings.seed}`
    };

    const config: any = {
      imageConfig: { 
        aspectRatio: "1:1",
        imageSize: settings.quality === 'pro' ? (settings.imageSize || '1K') : undefined
      }
    };

    if (settings.quality === 'pro') {
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
      throw new Error("ОШИБКА_V8: Нарушена целостность сцены. ИИ попытался удалить ключевой объект.");
    }

    return { 
      imageUrl, 
      groundingChunks: candidate?.groundingMetadata?.groundingChunks as GroundingChunk[] 
    };
  }
}

export const geminiService = new GeminiService();
