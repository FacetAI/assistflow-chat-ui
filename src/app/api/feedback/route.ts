import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { InputValidator } from "@/lib/input-validation";

interface FeedbackData {
  threadId: string;
  userId: string;
  rating: "positive" | "negative";
  timestamp: string;
  feedbackText?: string;
  ipAddress?: string;
}

interface FeedbackRecord {
  threadId: string;
  userId: string;
  rating: "positive" | "negative";
  feedbackText?: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
  lastUpdated: string;
}

class FeedbackService {
  private client: DynamoDBDocumentClient;
  private tableName = "Assistflow-Feedback";

  constructor() {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || "eu-west-1",
    });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
  }

  async storeFeedback(feedback: FeedbackData): Promise<boolean> {
    try {
      const currentTimestamp = new Date().toISOString();
      
      const feedbackRecord: FeedbackRecord = {
        threadId: feedback.threadId,
        userId: feedback.userId,
        rating: feedback.rating,
        feedbackText: feedback.feedbackText,
        timestamp: feedback.timestamp,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
        lastUpdated: currentTimestamp,
      };

      const command = new PutCommand({
        TableName: this.tableName,
        Item: feedbackRecord,
        ConditionExpression: "attribute_not_exists(threadId) AND attribute_not_exists(userId)",
      });

      await this.client.send(command);
      
      console.log("Feedback stored successfully:", {
        threadId: feedback.threadId,
        userId: feedback.userId,
        rating: feedback.rating,
      });
      
      return true;
    } catch (error) {
      console.error("Failed to store feedback in DynamoDB:", error);
      return false;
    }
  }

  async checkExistingFeedback(userId: string, threadId: string): Promise<boolean> {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
        FilterExpression: "userId = :userId AND threadId = :threadId",
        ExpressionAttributeValues: {
          ":userId": userId,
          ":threadId": threadId,
        },
        Limit: 1,
      });

      const result = await this.client.send(command);
      return (result.Items?.length || 0) > 0;
    } catch (error) {
      console.error("Failed to check existing feedback:", error);
      return false;
    }
  }

  async getAllFeedback(): Promise<FeedbackRecord[]> {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
      });

      const result = await this.client.send(command);
      return result.Items as FeedbackRecord[] || [];
    } catch (error) {
      console.error("Failed to retrieve feedback:", error);
      return [];
    }
  }
}


export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body: FeedbackData = await req.json();

    // Validate thread ID
    if (!body.threadId || !InputValidator.validateThreadId(body.threadId)) {
      return NextResponse.json(
        { error: "Valid thread ID is required" },
        { status: 400 }
      );
    }

    // Validate rating
    if (!InputValidator.validateRating(body.rating)) {
      return NextResponse.json(
        { error: "Invalid rating. Must be 'positive' or 'negative'" },
        { status: 400 }
      );
    }

    // Validate user ID
    const userId = body.userId || session?.user?.id;
    if (!userId || !InputValidator.validateUserId(userId)) {
      return NextResponse.json(
        { error: "Valid user ID is required" },
        { status: 401 }
      );
    }

    // Validate optional feedback text
    let sanitizedFeedbackText: string | undefined;
    if (body.feedbackText) {
      const textValidation = InputValidator.validateFeedbackText(body.feedbackText);
      if (!textValidation.isValid) {
        return NextResponse.json(
          { error: textValidation.error },
          { status: 400 }
        );
      }
      sanitizedFeedbackText = textValidation.sanitized;
    }

    const feedbackService = new FeedbackService();
    
    // Check if feedback already exists
    const existing = await feedbackService.checkExistingFeedback(userId, body.threadId);
    if (existing) {
      return NextResponse.json(
        { error: "Feedback already submitted for this conversation" },
        { status: 409 }
      );
    }

    const feedbackData: FeedbackData = {
      threadId: body.threadId,
      userId,
      rating: body.rating,
      timestamp: body.timestamp || new Date().toISOString(),
      feedbackText: sanitizedFeedbackText,
    };

    const success = await feedbackService.storeFeedback(feedbackData);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to store feedback" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: "Feedback submitted successfully" 
    });

  } catch (error) {
    console.error("Error processing feedback:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const feedbackService = new FeedbackService();
    const allFeedback = await feedbackService.getAllFeedback();

    return NextResponse.json({ 
      feedback: allFeedback,
      count: allFeedback.length 
    });

  } catch (error) {
    console.error("Error retrieving feedback:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}