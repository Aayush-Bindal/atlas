import { atlasAPI, AtlasAPIError } from "../api/client";
import {
  processImages,
  ProcessedImage,
  validateProcessedImages,
} from "./imagePipeline";
import {
  ImageUpload,
  ValidatedCaption,
  GlobalAnswers,
  StoryResponse,
  StoryRequest,
} from "../types";

export interface WorkflowState {
  images: ProcessedImage[];
  captions: ValidatedCaption[];
  globalAnswers: GlobalAnswers;
  story?: StoryResponse;
  isProcessing: boolean;
  isGeneratingCaptions: boolean;
  isGeneratingStory: boolean;
  error?: string;
  progress: {
    imagesProcessed: number;
    totalImages: number;
    captionsGenerated: number;
  };
}

export type WorkflowStep =
  | "idle"
  | "processing"
  | "captions"
  | "story"
  | "complete"
  | "error";

/**
 * Complete ATLAS workflow orchestrator
 * Manages the entire process from file upload to story generation
 */
export class AtlasWorkflow {
  private state: WorkflowState = {
    images: [],
    captions: [],
    globalAnswers: { purpose: "", mood: "" },
    isProcessing: false,
    isGeneratingCaptions: false,
    isGeneratingStory: false,
    progress: {
      imagesProcessed: 0,
      totalImages: 0,
      captionsGenerated: 0,
    },
  };

  private listeners: ((state: WorkflowState) => void)[] = [];

  // State management
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener({ ...this.state }));
  }

  subscribe(listener: (state: WorkflowState) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  getState(): WorkflowState {
    return { ...this.state };
  }

  getCurrentStep(): WorkflowStep {
    if (this.state.error) return "error";
    if (this.state.story) return "complete";
    if (this.state.isGeneratingStory) return "story";
    if (this.state.isGeneratingCaptions) return "captions";
    if (this.state.isProcessing) return "processing";
    return "idle";
  }

  // Step 1: Process uploaded files
  async processFiles(files: File[]): Promise<void> {
    if (files.length === 0) {
      throw new Error("No files provided");
    }

    if (files.length > 15) {
      throw new Error("Maximum 15 images allowed");
    }

    this.state.isProcessing = true;
    this.state.error = undefined;
    this.state.progress.totalImages = files.length;
    this.state.progress.imagesProcessed = 0;
    this.notifyListeners();

    try {
      this.state.images = await processImages(files, (completed) => {
        this.state.progress.imagesProcessed = completed;
        this.notifyListeners();
      });

      // Validate processed images
      const validation = validateProcessedImages(this.state.images);
      if (!validation.valid) {
        throw new Error(
          `Image validation failed: ${validation.errors.join(", ")}`,
        );
      }
    } catch (error) {
      this.state.error =
        error instanceof Error ? error.message : "Failed to process images";
      throw error;
    } finally {
      this.state.isProcessing = false;
      this.notifyListeners();
    }
  }

  // Step 2: Generate captions for all images
  async generateCaptions(): Promise<void> {
    if (this.state.images.length === 0) {
      throw new Error("No images to generate captions for");
    }

    this.state.isGeneratingCaptions = true;
    this.state.error = undefined;
    this.state.progress.captionsGenerated = 0;
    this.notifyListeners();

    try {
      const imageUploads: ImageUpload[] = this.state.images.map((img) => ({
        orderIndex: img.orderIndex,
        base64: img.base64,
        metadata: img.metadata,
      }));

      const captionResponses = await atlasAPI.generateCaptions(imageUploads);

      this.state.captions = captionResponses.map((response) => ({
        orderIndex: response.orderIndex,
        text: response.caption,
      }));

      this.state.progress.captionsGenerated = this.state.captions.length;
    } catch (error) {
      if (error instanceof AtlasAPIError) {
        this.state.error = `Caption generation failed: ${error.message}`;
      } else {
        this.state.error =
          error instanceof Error
            ? error.message
            : "Failed to generate captions";
      }
      throw error;
    } finally {
      this.state.isGeneratingCaptions = false;
      this.notifyListeners();
    }
  }

  // Step 3: Generate final story
  async generateStory(): Promise<void> {
    if (this.state.images.length === 0) {
      throw new Error("No images for story generation");
    }

    if (this.state.captions.length === 0) {
      throw new Error("No captions available for story generation");
    }

    if (!this.state.globalAnswers.purpose || !this.state.globalAnswers.mood) {
      throw new Error("Global context (purpose and mood) is required");
    }

    this.state.isGeneratingStory = true;
    this.state.error = undefined;
    this.notifyListeners();

    try {
      const request: StoryRequest = {
        images: this.state.images.map((img) => ({
          orderIndex: img.orderIndex,
          base64: img.base64,
          metadata: img.metadata,
        })),
        contexts: this.state.captions,
        globalAnswers: this.state.globalAnswers,
      };

      this.state.story = await atlasAPI.generateStory(request);
    } catch (error) {
      if (error instanceof AtlasAPIError) {
        this.state.error = `Story generation failed: ${error.message}`;
      } else {
        this.state.error =
          error instanceof Error ? error.message : "Failed to generate story";
      }
      throw error;
    } finally {
      this.state.isGeneratingStory = false;
      this.notifyListeners();
    }
  }

  // Utility methods
  setGlobalAnswers(answers: GlobalAnswers): void {
    this.state.globalAnswers = { ...answers };
    this.notifyListeners();
  }

  updateCaption(orderIndex: number, text: string): void {
    const caption = this.state.captions.find(
      (c) => c.orderIndex === orderIndex,
    );
    if (caption) {
      caption.text = text;
      this.notifyListeners();
    }
  }

  reset(): void {
    this.state = {
      images: [],
      captions: [],
      globalAnswers: { purpose: "", mood: "" },
      isProcessing: false,
      isGeneratingCaptions: false,
      isGeneratingStory: false,
      progress: {
        imagesProcessed: 0,
        totalImages: 0,
        captionsGenerated: 0,
      },
    };
    this.notifyListeners();
  }

  // Convenience methods
  canGenerateCaptions(): boolean {
    return this.state.images.length > 0 && !this.state.isProcessing;
  }

  canGenerateStory(): boolean {
    return (
      this.state.images.length > 0 &&
      this.state.captions.length > 0 &&
      Boolean(
        this.state.globalAnswers.purpose && this.state.globalAnswers.mood,
      ) &&
      !this.state.isGeneratingCaptions
    );
  }

  hasStory(): boolean {
    return Boolean(this.state.story);
  }
}
