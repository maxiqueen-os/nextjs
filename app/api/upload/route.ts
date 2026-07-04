import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import * as mammoth from "mammoth";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';
// Subimos a 30 segundos para evitar Timeouts procesando archivos pesados o Base64 extensos
export const maxDuration = 30; 

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { headers: cors });
}

// NOTA: Si estás en Vercel Serverless, el límite real de la plataforma es 4.5MB. 
// Ajustamos a 4.5MB para evitar que Vercel rompa la app de forma externa.
const MAX_FILE_SIZE = 4.5 * 1024 * 1024; 
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
        error: `El archivo supera el límite permitido de 4.5MB para procesamiento estable.` 
      }, { status: 413, headers: cors });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();
    let text = "";
    
    const isImage = name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp");

    if (name.endsWith(".pdf")) {
      try {
        // Importación dinámica limpia
        const pdfParseModule = await import("pdf-parse");
        // Algunas versiones requieren acceder a .default, otras directo al módulo
        const pdfParse = pdfParseModule.default || pdfParseModule;
        
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
      try {
        const wb = XLSX.read(buffer, { type: "buffer" });
        text = wb.SheetNames
          .map((n: string) => `### Hoja: ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`)
          .join("\n\n");
      } catch (xlsxError: any) {
        console.error("Error en XLSX:", xlsxError);
        return NextResponse.json({ error: 'Error al procesar el archivo Excel.', details: xlsxError.message }, { status: 500, headers: cors });
      }
    } 
    else if (name.endsWith(".docx")) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } catch (docxError: any) {
        console.error("Error en DOCX:", docxError);
        return NextResponse.json({ error: 'Error al procesar el archivo Word.', details: docxError.message }, { status: 500, headers: cors });
      }
    }
    else if (name.endsWith(".txt")) {
      text = buffer.toString('utf-8');
    }
    else if (isImage) {
      // Extracción limpia y segura de la extensión real
      const extension = name.split('.').pop();
      let mimeType = 'image/jpeg'; // Fallback por defecto

      if (extension === 'png') mimeType = 'image/png';
      else if (extension === 'webp') mimeType = 'image/webp';
      else if (extension === 'jpg' || extension === 'jpeg') mimeType = 'image/jpeg';
      
      const base64Data = buffer.toString("base64");
      text = `data:${mimeType};base64,${base64Data}`;
    }
    else {
      return NextResponse.json({ 
        error: 'Formato no soportado. Usa PDF, XLSX, XLS, DOCX, TXT, PNG, JPG o WEBP.' 
      }, { status: 415, headers: cors });
    }

    // Respuesta unificada garantizando estabilidad absoluta
    return NextResponse.json({ 
      success: true,
      filename: file.name,
      // Si es imagen, enviamos el Base64 completo intacto, de lo contrario aplicamos el límite de texto
      text: isImage ? text : text.slice(0, MAX_TEXT_LENGTH),
      truncated: isImage ? false : text.length > MAX_TEXT_LENGTH,
      isImage: isImage
    }, { headers: cors });
    
  } catch (e: any) {
    console.error('Error general de parseo:', e);
    return NextResponse.json({ 
      error: 'Error crítico al procesar el archivo', 
      details: e.message 
    }, { status: 500, headers: cors });
  }
}
