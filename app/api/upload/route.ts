import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import * as mammoth from "mammoth";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';
export const maxDuration = 10; 

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { headers: cors });
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_LENGTH = 12000;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No se cargó ningún archivo' }, { status: 400, headers: cors });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `El archivo supera el límite de 10MB.` 
      }, { status: 413, headers: cors });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();
    let text = "";
    
    // Detectamos si es una imagen para gestionar el comportamiento al final del flujo
    const isImage = name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp");

    if (name.endsWith(".pdf")) {
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const parsed = await pdfParse(buffer);
        text = parsed.text || "";
      } catch (pdfError: any) {
        console.error("Error específico parseando PDF:", pdfError);
        return NextResponse.json({ 
          error: 'Error interno al procesar el formato PDF en el servidor.',
          details: pdfError.message 
        }, { status: 500, headers: cors });
      }
    } 
    else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const wb = XLSX.read(buffer, { type: "buffer" });
      text = wb.SheetNames
        .map((n: string) => `### Hoja: ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`)
        .join("\n\n");
    } 
    else if (name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    }
    else if (name.endsWith(".txt")) {
      text = buffer.toString('utf-8');
    }
    // ==========================================
    // NUEVA SECCIÓN: SOPORTE DE IMÁGENES INTEGRADO
    // ==========================================
    else if (isImage) {
      const extension = name.split('.').pop();
      const mimeType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
      const base64Data = buffer.toString("base64");
      
      // Construimos el Data URL puro listo para usar en el frontend o enviar a la IA
      text = `data:${mimeType};base64,${base64Data}`;
    }
    else {
      return NextResponse.json({ 
        error: 'Formato no soportado. Usa PDF, XLSX, XLS, DOCX, TXT, PNG, JPG o WEBP.' 
      }, { status: 415, headers: cors });
    }

    return NextResponse.json({ 
      success: true,
      filename: file.name,
      // Si es imagen, NO recortamos los datos; si es texto ordinario, aplicamos tu límite habitual
      text: isImage ? text : text.slice(0, MAX_TEXT_LENGTH),
      truncated: isImage ? false : text.length > MAX_TEXT_LENGTH,
      isImage: isImage
    }, { headers: cors });
    
  } catch (e: any) {
    console.error('Error general de parseo:', e);
    return NextResponse.json({ 
      error: 'Error al procesar el archivo', 
      details: e.message 
    }, { status: 500, headers: cors });
  }
}
