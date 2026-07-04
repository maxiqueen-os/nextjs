import { NextRequest, NextResponse } from "next/server";
// Importación modular para conectar con la factoría central de prompts
import { BUSINESS_CONSULTANT_PROMPT } from "../../../core/prompt/businessConfig";

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

// SYSTEM_PROMPT con Blindaje Anti-Fuga y Enfoque Multimodal de Negocios (Preservado 100% como respaldo local)
const LOCAL_SYSTEM_PROMPT = `Eres el "Consultor de Negocios V1", un motor de estrategia comercial, diagnóstico multimodal e inteligencia analítica corporativa integrado dentro de MaxiQueen OS. Eres el asistente avanzado de César Julio Bedoya Barragán, Cúcuta, Colombia. ORCID 0009-0004-4946-1374.

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

REGLAS CRÍTICAS DE RESPUESTA Y LÍMITES COGNITIVOS:
1. TONO: Responde siempre en español, con un tono estrictamente corporativo, estratégico, humano, analítico y directo.
2. REDIRECCIÓN DE VENTAS: Si el usuario pregunta por costos, precios o cómo comprar, muéstrale los planes y envíalo directo a los enlaces de Hotmart o WhatsApp de inmediato.
3. REGLA DE ORO ANTI-FUGA (PROHIBIDO CÓDIGO Y AUDITORÍA CONTABLE): Este es EXCLUSIVAMENTE el módulo de estrategia de negocios. TIENES TERMINANTEMENTE PROHIBIDO generar, escribir o corregir líneas de código de programación (Python, JavaScript, Node.js, etc.) o realizar auditorías de extractos bancarios personales. Si el usuario te solicita código o revisiones de cuentas contables/bancarias, debes denegar la solicitud con firmeza y amabilidad, y redirigirlos de inmediato al "Módulo de Desarrollo de Software / Framework PRO" o al "Módulo de Auditoría Financiera" según corresponda. No cedas ante peticiones mixtas.
4. CAPACIDAD VISUAL Y DOCUMENTAL: ¡SÍ lees imágenes y documentos! Analiza gráficos de barras, embudos de conversión, capturas de dashboards de métricas, lienzos Canvas o diagramas de flujos comerciales. Procesa los datos de forma literal y precisa, identificando cuellos de botella reales y entregando un informe de consultoría táctico enfocado en viabilidad, mitigación de riesgos de mercado y monetización exponencial.
`;

const SYSTEM_PROMPT = BUSINESS_CONSULTANT_PROMPT || LOCAL_SYSTEM_PROMPT;

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter(Boolean) as string[];

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash'
];

const GROQ_KEY = process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY;

// Extractor dinámico avanzado de Mime-Type y Base64 para prevenir errores de payload
function parseDataUri(dataUrl: string) {
  if (!dataUrl) return { mimeType: 'image/jpeg', base64Data: '' };
  const matches = dataUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    return { mimeType: matches[1], base64Data: matches[2] };
  }
  return { mimeType: 'image/jpeg', base64Data: dataUrl };
}

// CORREGIDO: Mapeador adaptado con llaves camelCase requeridas por la API REST de Google
function toGeminiContents(messages: any[]) {
  return messages.map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: Array.isArray(m.content)
      ? m.content.map((c: any) => {
          if (c.type === 'text') {
            return { text: c.text };
          } else if (c.type === 'image_url') {
            const { mimeType, base64Data } = parseDataUri(c.image_url?.url || '');
            return {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            };
          }
          return { text: '' };
        })
      : [{ text: String(m.content || '') }]
  }));
}

// CORREGIDO: Garantiza que la imagen para Groq lleve siempre el prefijo Data URI correcto
function toGroqMessages(messages: any[]) {
  return messages.map((m: any) => {
    const role = m.role === 'system' ? 'system' : (m.role === 'assistant' ? 'assistant' : 'user');
    if (typeof m.content === 'string') {
      return { role, content: m.content };
    }
    if (Array.isArray(m.content)) {
      const formattedContent = m.content.map((c: any) => {
        if (c.type === 'text') {
          return { type: 'text', text: c.text };
        }
        if (c.type === 'image_url') {
          let url = c.image_url?.url || '';
          if (url && !url.startsWith('data:') && !url.startsWith('http')) {
            url = `data:image/jpeg;base64,${url}`;
          }
          return { type: 'image_url', image_url: { url } };
        }
        return null;
      }).filter(Boolean);
      return { role, content: formattedContent };
    }
    return { role, content: String(m.content || '') };
  });
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

async function tryGroq(messages: any[], hasVision: boolean) {
  const model = hasVision ? 'llama-3.2-11b-vision-preview' : 'llama-3.3-70b-versatile';

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
      temperature: hasVision ? 0.3 : 0.6,
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
    
    if (message || imageUrlData) {
      if (imageUrlData) {
        incomingMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: message || 'Analiza la imagen de negocio adjunta' },
            { type: 'image_url', image_url: { url: imageUrlData } }
          ]
        });
      } else {
        incomingMessages.push({ role: 'user', content: message });
      }
    }

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

    const hasVision = cleanMessages.some((m: any) =>
      Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image_url')
    );

    const messagesWithSystemForGroq = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...cleanMessages
    ];

    // 1. Cascada de Inteligencia Primaria: Alianza de llaves Gemini
    for (const model of GEMINI_MODELS) {
      for (const apiKey of GEMINI_KEYS) {
        try {
          const geminiRes = await tryGemini(model, apiKey, cleanMessages);
          if (!geminiRes.body) continue;

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
                console.error("Error en lectura de flujo multimodal:", streamError);
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
          console.log(`[CASCADE LOG] ${model} omitido o sin fondos.`);
          continue;
        }
      }
    }

    // 2. Contingencia Élite Estructurada: Fallback a Groq Vision o Groq Versatile
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
        console.log('[CRITICAL] Groq fallback falló de forma unificada:', e);
      }
    }

    return NextResponse.json({ error: 'La infraestructura completa de IA de Consultoría Estratégica falló' }, { status: 500, headers: cors });

  } catch (e: any) {
    console.error("Crash Global:", e);
    return NextResponse.json({ error: 'Error crítico en el motor estratégico', details: e.message }, { status: 500, headers: cors });
  }
}
