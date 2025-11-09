import { NextRequest, NextResponse } from "next/server";
import { extractText } from "unpdf";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Handle TXT files
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      const text = await file.text();
      return NextResponse.json({ text });
    } 
    // Handle PDF files
    else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      const result = await extractText(uint8Array) as any;
      let text: string = "";
      
      // Handle different result types from unpdf
      if (result?.text) {
        // unpdf returns text as string or string[] depending on version/format
        text = Array.isArray(result.text) 
          ? result.text.join('\n\n') 
          : typeof result.text === 'string' 
            ? result.text 
            : String(result.text);
      } else if (result) {
        text = String(result);
      }
      
      const trimmedText = typeof text === 'string' ? text.trim() : '';
      
      if (!trimmedText || trimmedText.length === 0) {
        return NextResponse.json(
          { error: "Could not extract text from PDF. The file might be scanned/image-based. Please copy and paste the text instead." },
          { status: 400 }
        );
      }
      
      return NextResponse.json({ text: trimmedText });
    } 
    else {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload PDF or TXT." },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error parsing document:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to parse document";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}


