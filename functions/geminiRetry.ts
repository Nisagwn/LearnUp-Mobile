import { HttpsError } from "firebase-functions/v2/https";

/**
 * Executes a Gemini API call with retry logic.
 *
 * Requirements met:
 * - Retry max 3 times if request fails
 * - Wait 1 second between retries
 * - If all retries fail, return a proper error
 * - Use async/await
 * - Use TypeScript
 *
 * @param apiCall - An async function containing the Gemini API call to execute.
 * @returns The result of the successful API call.
 * @throws {HttpsError} If the call fails after the maximum number of retries.
 */
export const callGeminiWithRetry = async <T>(
  apiCall: () => Promise<T>
): Promise<T> => {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 1000; // 1 second

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Attempt the API call
      return await apiCall();
    } catch (error: any) {
      // If we've exhausted all retries, return a proper error
      if (attempt === MAX_RETRIES) {
        throw new HttpsError(
          "internal",
          `Gemini API call failed after ${MAX_RETRIES} attempts. Last error: ${
            error?.message || "Unknown error"
          }`
        );
      }

      // Wait 1 second before the next retry
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  // Fallback to satisfy TypeScript compiler
  throw new Error("Unreachable");
};

// --- Example Usage ---
/*
import { GoogleGenerativeAI } from "@google/generative-ai";
import { onRequest } from "firebase-functions/v2/https";

export const generateContentWithRetry = onRequest(async (req, res) => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  try {
    const prompt = req.body.prompt || "Hello!";
    
    // Wrap the Gemini API call with the retry logic
    const result = await callGeminiWithRetry(async () => {
      return await model.generateContent(prompt);
    });

    res.status(200).json({ text: result.response.text() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
*/
