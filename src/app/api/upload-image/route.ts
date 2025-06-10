import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { 
  uploadImageWithRetry, 
  validateImageFile,
  type UploadImageResult 
} from '@/lib/s3-service';

// Note: File size validation is handled in the S3 service layer

export async function POST(request: NextRequest) {
  try {
    // Get user session for user ID (or use local dev user)
    let userId: string | undefined;
    
    if (process.env.LOCAL_DEV_MODE === 'true') {
      userId = process.env.LOCAL_DEV_USER_ID || 'local-dev-user';
      console.log('🔧 Local dev mode: using dev user ID:', userId);
    } else {
      const session = await getServerSession(authOptions);
      userId = session?.user?.id;
    }

    console.log('📤 Image upload request received for user:', userId);

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      console.error('❌ No image file provided in request');
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    console.log('📁 File details:', {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    console.log('🔍 Validating file...');
    // Validate the file
    const validation = validateImageFile(buffer, file.type, file.name);
    if (!validation.valid) {
      console.error('❌ File validation failed:', validation.error);
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    console.log('✅ File validation passed');

    console.log('☁️ Uploading to S3...');
    // Upload to S3
    const uploadResult: UploadImageResult = await uploadImageWithRetry(
      buffer,
      file.name,
      file.type,
      userId
    );

    if (!uploadResult.success) {
      console.error('❌ S3 upload failed:', uploadResult.error);
      return NextResponse.json(
        { error: uploadResult.error || 'Failed to upload image' },
        { status: 500 }
      );
    }

    console.log('✅ S3 upload successful:', uploadResult.imageUrl);

    // Return success response
    return NextResponse.json({
      success: true,
      imageUrl: uploadResult.imageUrl,
      key: uploadResult.key,
      metadata: {
        originalName: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Upload API error:', error);
    
    // Handle specific error types
    if (error instanceof Error && error.message.includes('File too large')) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 413 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error during upload' },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}