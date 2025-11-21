import axios, { AxiosInstance, AxiosError } from "axios";
import {
  ImageUpload,
  CaptionRequest,
  CaptionResponse,
  StoryRequest,
  StoryResponse,
  HealthResponse,
} from "../types";

export class AtlasAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any,
  ) {
    super(message);
    this.name = "AtlasAPIError";
  }
}

export class AtlasAPI {
  private client: AxiosInstance;

  constructor(baseURL = "/api") {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data as any;

          if (data?.error) {
            throw new AtlasAPIError(data.message || data.error, status, data);
          }

          throw new AtlasAPIError(
            `Request failed with status ${status}`,
            status,
            data,
          );
        }

        if (error.request) {
          throw new AtlasAPIError(
            "Network error - please check your connection",
            undefined,
            error,
          );
        }

        throw new AtlasAPIError(
          error.message || "Unknown error occurred",
          undefined,
          error,
        );
      },
    );
  }

  /**
   * Generate a caption for a single image
   */
  async generateCaption(imageData: ImageUpload): Promise<CaptionResponse> {
    const request: CaptionRequest = { image: imageData };
    const response = await this.client.post<CaptionResponse>(
      "/caption",
      request,
    );
    return response.data;
  }

  /**
   * Generate captions for multiple images in parallel
   */
  async generateCaptions(images: ImageUpload[]): Promise<CaptionResponse[]> {
    const promises = images.map((img) => this.generateCaption(img));
    return Promise.all(promises);
  }

  /**
   * Generate a complete story from images and captions
   */
  async generateStory(request: StoryRequest): Promise<StoryResponse> {
    const response = await this.client.post<StoryResponse>("/atlas", request);
    return response.data;
  }

  /**
   * Check API health and connectivity
   */
  async healthCheck(): Promise<HealthResponse> {
    const response = await this.client.get<HealthResponse>("/health");
    return response.data;
  }

  /**
   * Test API connectivity with a simple request
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const atlasAPI = new AtlasAPI();
