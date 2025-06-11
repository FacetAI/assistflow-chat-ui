export class InputValidator {
  static sanitizeText(input: string): string {
    if (typeof input !== "string") {
      throw new Error("Input must be a string");
    }

    return input
      .trim()
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
      .replace(/\s+/g, " ") // Normalize whitespace
      .substring(0, 10000); // Reasonable max length
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateThreadId(threadId: string): boolean {
    if (!threadId || typeof threadId !== "string") {
      return false;
    }
    
    // Basic UUID-like pattern validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(threadId) || threadId.length <= 100;
  }

  static validateUserId(userId: string): boolean {
    if (!userId || typeof userId !== "string") {
      return false;
    }
    
    return userId.length > 0 && userId.length <= 100;
  }

  static validateFeedbackText(text: string): { isValid: boolean; error?: string; sanitized: string } {
    try {
      if (!text || typeof text !== "string") {
        return {
          isValid: false,
          error: "Feedback text is required",
          sanitized: "",
        };
      }

      const sanitized = this.sanitizeText(text);
      
      if (sanitized.length === 0) {
        return {
          isValid: false,
          error: "Feedback text cannot be empty",
          sanitized,
        };
      }

      if (sanitized.length > 1000) {
        return {
          isValid: false,
          error: "Feedback text must be less than 1000 characters",
          sanitized: sanitized.substring(0, 1000),
        };
      }

      return {
        isValid: true,
        sanitized,
      };
    } catch {
      return {
        isValid: false,
        error: "Invalid input format",
        sanitized: "",
      };
    }
  }

  static validateSupportDescription(description: string): { isValid: boolean; error?: string; sanitized: string } {
    try {
      if (!description || typeof description !== "string") {
        return {
          isValid: false,
          error: "Description is required",
          sanitized: "",
        };
      }

      const sanitized = this.sanitizeText(description);
      
      console.log("Support description validation:", {
        original: description,
        originalLength: description.length,
        sanitized: sanitized,
        sanitizedLength: sanitized.length
      });
      
      if (sanitized.length === 0) {
        return {
          isValid: false,
          error: "Description cannot be empty",
          sanitized,
        };
      }

      if (sanitized.length < 3) {
        return {
          isValid: false,
          error: "Description must be at least 3 characters",
          sanitized,
        };
      }

      if (sanitized.length > 1000) {
        return {
          isValid: false,
          error: "Description must be less than 1000 characters",
          sanitized: sanitized.substring(0, 1000),
        };
      }

      return {
        isValid: true,
        sanitized,
      };
    } catch {
      return {
        isValid: false,
        error: "Invalid input format",
        sanitized: "",
      };
    }
  }

  static validateRating(rating: string): boolean {
    return rating === "positive" || rating === "negative";
  }

  static preventXSS(input: string): string {
    return input
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;");
  }
}