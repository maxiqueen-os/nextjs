import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs'; 
export const dynamic = 'force-dynamic';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { headers: cors });
}

// SYSTEM_PROMPT optimizado para Módulo 2 con Visión Estratégica Total
const SYSTEM_PROMPT = `Eres el "Consultor de Negocios V1", un motor de estrategia comercial, diagnóstico multimodal e inteligencia analítica integrado dentro de MaxiQueen OS. Eres el asistente avanzado de César Julio Bedoya Barragán, Cúcuta, Colombia. ORCID 0009-0004-4946-1374.

Tu enfoque principal es el procesamiento de documentos de texto estructurados e imágenes analíticas para la consultoría de modelos de negocio. Conviertes ideas, planes, métricas e historias en activos digitales altamente rentables.

Planes:
- Starter $49/mes – Landing + 5 guiones + hosting
- Pro $99/mes – Web + 15 guiones + automatización + voz + PDF/Excel/Word
- Elite $199/mes – Sistema completo + automatización avanzada + soporte prioritario

Pagos:
- Hotmart: https://pay.hotmart.com/P103285828N
- Oferta 40%: https://go.hotmart.com/P103285828N?dp=1
- Comunidad: https://app.hotmart.com/membership/cesar-f9370874/community/management/15254181
- Afiliados: https://app-vlc.hotmart.com/affiliate-recruiting/view/6489M103285849
- Mercado Pago COP $49.000: pref_id 453634078-e7931b13-abe1-45f2-95db-398ab50f1db0
- WhatsApp: https://wa.me/573016625921

Módulos del Ecosistema:
OS v1 https://maxiqueen-os.vercel.app
OS v2 https://maxiqueen-os-v2.vercel.app
System https://system-maxi-queen-os.vercel.app
App https://maxiqueen-os-app.vercel.app
Backend https://backend-maxi-queen-os.vercel.app
Ver https://maxiqueen-ver.vercel.app
Juegos https://juegos-maxi-queen-os.vercel.app
Framework PRO https://maxiqueen-os-framework.vercel.app

Redes: TikTok @cesarbedoya9, Instagram @maxiqueen_store, Facebook /share/1DVm7tXTEm/, YouTube @cesarbedoya2288

Reglas de respuesta del Consultor de Negocios:
- Responde en español, con tono corporativo, estratégico, humano y directo.
- Si preguntan por comprar, redirecciona de inmediato a WhatsApp o Hotmart.
- Visión / Documentos de Negocios:
    * SÍ procesas imágenes. Analiza gráficos de barras, embudos de venta, capturas de métricas, organigramas, lienzos Canvas o diagramas de flujos comerciales que el usuario adjunte.
    * Extrae los datos críticos de la imagen/documento de forma literal y precisa. No inventes totales ni proyecciones si no están explícitas.
    * Genera siempre un informe de consultoría táctico y estructurado evaluando: viabilidad comercial, riesgos del mercado analizado, optimización de monetización y pasos clave para escalar el activo digital.
`;

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter(Boolean) as string[];

const GEMINI_MODELS = [
  'gemini-2.0-flash-exp',
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash-latest',
  'gemini-pro'
];

const GROQ_KEY = process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY;

// Mapeador Restaurado: Extrae y procesa los datos base64 de las imágenes para Gemini
function toGeminiContents(messages: any[]) {
  return messages.map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: Array.isArray(m.content)
      ? m.content.map((c: any) => {
          if (c.type === 'text') {
            return { text: c.text };
          } else {
            const hasComma = c.image_url?.url?.includes(',');
            const base64Data = hasComma ? c.image_url.url.split(',')[1] : c.image_url?.url || '';
            return {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Data
              }
            };
          }
        })
      : [{ text: String(m.content || '') }]
  }));
}

function toGroqMessages(messages: any[]) {
  return messages.map((m: any) => ({
    role: m.role === 'system' ? 'system' : (m.role === 'assistant' ? 'assistant' : 'user'),
    content: typeof m.content === 'string'
      ? m.content
      : m.content.find((c: any) => c.type === 'text')?.text || 'Analiza la imagen de negocio adjunta'
  }));
}

async function tryGemini(model: string, apiKey: string, cleanMessages: any[]) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      contents: toGeminiContents(cleanMessages),
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      }
    })
  });

  if (!res.ok) throw new Error(`Gemini ${model} ${res.status}`);
  return res;
}

// tryGroq Restaurado: Alterna inteligentemente a Vision Preview si detecta payloads visuales
async function tryGroq(messages: any[], hasVision: boolean) {
  const model = hasVision
    ? 'llama-3.2-11b-vision-preview'
    : 'llama-3.3-70b-versatile';

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: toGroqMessages(messages),
      stream: true,
      temperature: hasVision ? 0.4 : 0.6,
    })
  });

  if (!res.ok) throw new Error(`Groq ${res.status}`);
  return res;
}

export async function POST(req: Request) {
  try {
    const bodyData = await req.json().catch(() => ({}));
    const { message, imageUrlData, history, messages } = bodyData;

    let incomingMessages = Array.isArray(messages) ? [...messages] : (Array.isArray(history) ? [...history] : []);
    
    // Inyección de imagen directa desde el frontend restaurada por completo
    if (message || imageUrlData) {
      if (imageUrlData) {
        incomingMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: message || 'Analiza la imagen adjunta' },
            { type: 'image_url', image_url: { url: imageUrlData } }
          ]
        });
      } else {
        incomingMessages.push({ role: 'user', content: message });
      }
    }

    // Limpieza estructural manteniendo intactos los bloques de tipo image_url
    const cleanMessages = incomingMessages
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant'))
      .map((m: any) => {
        let content = m.content;
        if (Array.isArray(content)) {
          content = content.filter((c: any) => c && (c.type === 'text' || c.type === 'image_url'));
        }
        return { role: m.role, content };
      })
      .filter((m: any) =>
        typeof m.content === 'string' ||
        (Array.isArray(m.content) && m.content.length > 0)
      );

    // Activación dinámica del sensor de visión
    const hasVision = cleanMessages.some((m: any) =>
      Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image_url')
    );

    const messagesWithSystemForGroq = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...cleanMessages
    ];

    // 1. Cascada jerárquica total Gemini
    for (const model of GEMINI_MODELS) {
      for (const apiKey of GEMINI_KEYS) {
        try {
          const geminiRes = await tryGemini(model, apiKey, cleanMessages);

          if (!geminiRes.body) {
            console.log(`[FAIL] ${model} sin cuerpo de respuesta.`);
            continue;
          }

          const reader = geminiRes.body.getReader();
          const decoder = new TextDecoder();

          const stream = new ReadableStream({
            async start(controller) {
              let buffer = '';
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  
                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split('\n');
                  buffer = lines.pop() || '';

                  for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') continue;
                    
                    try {
                      const json = JSON.parse(data);
                      const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                      if (text) {
                        const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
                        controller.enqueue(new TextEncoder().encode(chunk));
                      }
                    } catch {}
                  }
                }
                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
              } catch (streamError) {
                console.error("Error leyendo el stream multimodal de Gemini:", streamError);
              } finally {
                controller.close();
              }
            }
          });

          return new Response(stream, {
            headers: {
              ...cors,
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              'Connection': 'keep-alive',
            }
          });

        } catch (e) {
          console.log(`[FAIL] ${model} falló la ejecución con la clave actual:`, e);
          continue;
        }
      }
    }

    // 2. Fallback de contingencia a Groq (Conmutación dinámica a Llama Vision si es requerido)
    if (GROQ_KEY) {
      try {
        const groqRes = await tryGroq(messagesWithSystemForGroq, hasVision);
        if (groqRes.body) {
          return new Response(groqRes.body, {
            headers: {
              ...cors,
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
            }
          });
        }
      } catch (e) {
        console.log('[FAIL] Fallback de Groq en Consultoría también falló:', e);
      }
    }

    return NextResponse.json({ error: 'Todos los modelos e infraestructura de Consultoría Estratégica fallaron' }, { status: 500, headers: cors });

  } catch (e: any) {
    console.error("Crash global detectado en la ruta de Consultoría Multimodal:", e);
    return NextResponse.json({ error: 'Error interno en motor de estrategia', details: e.message || String(e) }, { status: 500, headers: cors });
  }
}
