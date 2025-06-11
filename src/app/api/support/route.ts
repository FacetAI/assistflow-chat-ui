import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { InputValidator } from "@/lib/input-validation"
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"

interface SupportRequest {
  userId?: string;
  threadId?: string | null;
  description: string;
  url: string;
  timestamp: string;
}

class SupportEmailService {
  private sesClient: SESClient

  constructor() {
    this.sesClient = new SESClient({
      region: process.env.AWS_REGION || "eu-west-1",
    })
  }

  async sendSupportEmail(request: SupportRequest): Promise<boolean> {
    try {
      const supportEmail = process.env.SUPPORT_EMAIL || "support@facetai.com"
      const fromEmail = process.env.FROM_EMAIL || "noreply@facetai.com"

      const emailBody = `
New Support Request

User ID: ${request.userId || 'Unknown'}
Thread ID: ${request.threadId || 'N/A'}
Timestamp: ${request.timestamp}
URL: ${request.url}

Description:
${request.description}

---
This is an automated message from the FacetAI support system.
      `.trim()

      const command = new SendEmailCommand({
        Source: fromEmail,
        Destination: {
          ToAddresses: [supportEmail],
        },
        Message: {
          Subject: {
            Data: `Support Request - ${request.userId ? `User ${request.userId}` : 'Anonymous'}`,
            Charset: "UTF-8",
          },
          Body: {
            Text: {
              Data: emailBody,
              Charset: "UTF-8",
            },
          },
        },
      })

      await this.sesClient.send(command)
      
      console.log("Support email sent successfully:", {
        userId: request.userId,
        threadId: request.threadId,
        timestamp: request.timestamp,
      })

      return true
    } catch (error) {
      console.error("Failed to send support email:", error)
      
      // Fallback: Log detailed request for manual processing
      console.log("SUPPORT REQUEST (EMAIL FAILED):", {
        userId: request.userId,
        threadId: request.threadId,
        timestamp: request.timestamp,
        url: request.url,
        description: request.description,
      })

      return false
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body: SupportRequest = await req.json();

    console.log("Support request received:", {
      hasDescription: !!body.description,
      descriptionLength: body.description?.length,
      userId: body.userId,
      threadId: body.threadId,
      url: body.url
    });

    // Validate description
    if (!body.description || typeof body.description !== 'string') {
      console.log("Description validation failed: missing or invalid description");
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    const descriptionValidation = InputValidator.validateSupportDescription(body.description);
    if (!descriptionValidation.isValid) {
      console.log("Description validation failed:", descriptionValidation.error);
      return NextResponse.json(
        { error: descriptionValidation.error },
        { status: 400 }
      );
    }

    // Validate thread ID if provided
    if (body.threadId && !InputValidator.validateThreadId(body.threadId)) {
      return NextResponse.json(
        { error: "Invalid thread ID format" },
        { status: 400 }
      );
    }

    const supportRequest: SupportRequest = {
      userId: body.userId || session?.user?.id,
      threadId: body.threadId,
      description: descriptionValidation.sanitized,
      url: body.url,
      timestamp: body.timestamp || new Date().toISOString(),
    };

    const emailService = new SupportEmailService();
    const success = await emailService.sendSupportEmail(supportRequest);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to send support request" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: "Support request submitted successfully" 
    });

  } catch (error) {
    console.error("Error processing support request:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}