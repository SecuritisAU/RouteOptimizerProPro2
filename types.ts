export interface Stop {
  id: string;
  address: string;
}

export interface OptimizedStop extends Stop {
  travelTimeToNextStop?: string;
  streetViewUrl?: string;
  isStart?: boolean;
  isEnd?: boolean;
}

// Structure expected from Gemini API in JSON format
export interface GeminiStopData {
  address: string;
  travelTimeToNextStop?: string;
  streetViewUrl?: string;
}

export interface GeminiOptimizationResponse {
  optimizedRoute: GeminiStopData[];
  overallRouteUrl?: string;
}

// For @google/genai models.generateContent response type
// This is a simplified version. The actual SDK might have more complex types.
export interface GenerateContentResponse {
    text: string; // Assuming text is directly available
    // Add other properties if needed based on actual SDK response structure
    // candidates?: any[]; 
    // promptFeedback?: any;
}


export interface RadioStationLink {
  name: string;
  url: string;
}
