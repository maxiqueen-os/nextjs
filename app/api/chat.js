import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// Configuración global de cabeceras CORS para App Router
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 1. Manejador para peticiones preparatorias (Preflight)
export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

// 2. Manejador Principal del Flujo de Inteligencia Artificial
export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch (parseError) {
    return NextResponse.json(
      { error: 'Cuerpo de petición JSON inválido o vacío' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // NORMALIZAR NOMBRES (Acepta filename o file_name)
  const {
    message,
    session_id: clientSession,
    image_base64,
    document_text,
    file_type,
    file_name,
    filename
  } = body || {};

  const finalFileName = file_name || filename || null;
  const finalFileType = file_type || 'image/jpeg';
  const session_id = clientSession || randomUUID();
  const userMsg = (message || 'hola').toString().substring(0, 2000);

  const GROQ_KEY = process.env.GROQ_API_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY_3 || process.env.GEMINI_API_KEY;
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Función interna de persistencia para el ecosistema de logs de MaxiQueen OS
  const guardar = async (contenido: string, role: string, tipo = 'chat') => {
    try {
      if (!SUPABASE_URL || !SUPABASE_KEY) return;
      await fetch(`${SUPABASE_URL}/rest/v1/maxiqueen_chat`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          contenido: String(contenido || '').substring(0, 4000),
          session_id,
          role,
          message_type: tipo
        })
      });
    } catch (e: any) { 
      console.error('Supabase error:', e.message); 
    }
  };

  const tipoEntrada = image_base64 ? 'vision' : document_text ? 'doc' : 'chat';
  const userContent = finalFileName ? `${userMsg} [${finalFileName}]` : userMsg;
  
  // Guardar de forma asíncrona la entrada del usuario
  await guardar(userContent, 'user', tipoEntrada);

  let reply = '', engine = '', groqErr = null, geminiErr = null;

  // ==========================================
  // BLOQUE 1: GEMINI VISION (Solo imágenes)
  // ==========================================
  if (image_base64 && GEMINI_KEY) {
    try {
      const parts: any[] = [{ text: userMsg || 'Analiza esto' }];
      parts.push({
        inlineData: {
          mimeType: finalFileType,
          data: image_base64
        }
      });

      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      });
      
      const j = await r.json();
      if (r.ok && j.candidates?.[0]?.content?.parts?.[0]?.text) {
        reply = j.candidates[0].content.parts[0].text;
        engine = 'gemini-vision';
      } else {
        geminiErr = j.error?.message || 'Respuesta vacía o estructura errónea en Gemini Vision';
      }
    } catch (e: any) { 
      geminiErr = e.message; 
      console.error('Error en bloque Gemini Vision:', e); 
    }
  }

  // ==========================================
  // BLOQUE 2: GROQ PARA DOCUMENTOS EXTRÁIDOS
  // ==========================================
  if (!reply && document_text && GROQ_KEY) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'Eres MaxiBot de MQ NEXUS. Responde en español, directo y estratégico.' },
            { role: 'user', content: `${userMsg}\n\nDOCUMENTO [${finalFileName}]:\n${document_text.substring(0, 7000)}` }
          ],
          max_tokens: 1000,
          temperature: 0.7
        })
      });
      
      const j = await r.json();
      if (r.ok && j.choices?.[0]?.message?.content) {
        reply = j.choices[0].message.content;
        engine = 'groq-doc';
      } else { 
        groqErr = j.error?.message || 'Error en estructura de respuesta Groq Documentos'; 
      }
    } catch (e: any) { 
      groqErr = e.message; 
    }
  }

  // ==========================================
  // BLOQUE 3: FALLBACK DE VISIÓN CON GROQ
  // ==========================================
  if (!reply && image_base64 && GROQ_KEY) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.2-11b-vision-preview',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: userMsg || 'Analiza la imagen' },
              { type: 'image_url', image_url: { url: `data:${finalFileType};base64,${image_base64}` } }
            ]
          }],
          max_tokens: 800
        })
      });
      
      const j = await r.json();
      if (r.ok && j.choices?.[0]?.message?.content) {
        reply = j.choices[0].message.content;
        engine = 'groq-vision';
      } else { 
        groqErr = j.error?.message || 'Error en estructura de respuesta Groq Vision'; 
      }
    } catch (e: any) { 
      groqErr = e.message; 
    }
  }

  // ==========================================
  // BLOQUE 4: GROQ (Solo Texto Estándar)
  // ==========================================
  if (!reply && !image_base64 && !document_text && GROQ_KEY) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'Eres MaxiBot de MQ NEXUS. Responde en español, directo y estratégico.' },
            { role: 'user', content: userMsg }
          ],
          max_tokens: 800,
          temperature: 0.7
        })
      });
      
      const j = await r.json();
      if (r.ok && j.choices?.[0]?.message?.content) {
        reply = j.choices[0].message.content;
        engine = 'groq';
      } else { 
        groqErr = j.error?.message || 'Error en estructura de respuesta Groq Texto'; 
      }
    } catch (e: any) { 
      groqErr = e.message; 
      console.error('Error en bloque Groq Texto:', e); 
    }
  }

  // ==========================================
  // BLOQUE 5: GEMINI TEXTO (Último recurso Fallback)
  // ==========================================
  if (!reply && GEMINI_KEY && !image_base64) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: userMsg }] }] })
      });
      
      const j = await r.json();
      if (r.ok) {
        reply = j.candidates?.[0]?.content?.parts?.[0]?.text || '';
        engine = 'gemini';
      } else { 
        geminiErr = j.error?.message || 'Error en estructura de respuesta Gemini Fallback'; 
      }
    } catch (e: any) { 
      geminiErr = e.message; 
    }
  }

  // ==========================================
  // MANEJO DE CAÍDA CRÍTICA GLOBAL
  // ==========================================
  if (!reply) {
    console.error('FALLO TOTAL DE ORQUESTACIÓN IA:', { groqErr, geminiErr, hasGroq: !!GROQ_KEY, hasGemini: !!GEMINI_KEY });
    return NextResponse.json(
      {
        error: 'La infraestructura completa de IA de Consultoría Estratégica falló',
        detalle_groq: groqErr,
        detalle_gemini: geminiErr,
        keys: { groq: !!GROQ_KEY, gemini: !!GEMINI_KEY }
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  // Guardar la respuesta final generada por la IA y retornar datos limpìos
  await guardar(reply, 'assistant', tipoEntrada);

  return NextResponse.json(
    { reply, engine, session_id, tipo: tipoEntrada },
    { status: 200, headers: CORS_HEADERS }
  );
}
