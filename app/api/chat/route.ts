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

// SYSTEM_PROMPT con Blindaje Anti-Fuga y Enfoque Multimodal de Negocios
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
OS v1 https://maxiqueen-os-v2.vercel.app
OS v2 https://maxiqueen-os-v2.vercel.app
System https://system-maxi-queen-os.vercel.app
App https://maxiqueen-os-app.vercel.app
Backend https://backend-maxi-queen-os.vercel.app
Ver https://maxiqueen-ver.vercel.app
Juegos https://juegos-maxi-queen-os.vercel.app
Framework PRO https://maxiqueen-os-framework.vercel.app

Redes: TikTok @cesarbedoya9, Instagram @maxiqueen_store, Facebook /share/1DVm7tXTEm/, YouTube @cesarbedoya2288

REGLAS CRÍTICAS DE RESPUESTA Y LÍMITES COGNITIVOS:
1. TONO: Responde siempre en español, con un tono estrictamente corporativo, strategic, humano, analítico y directo.
2. REDIRECCIÓN DE VENTAS: Si el usuario pregunta por costos, precios o cómo comprar, muéstrale los planes y envíalo directo a los enlaces de Hotmart o WhatsApp de inmediato.
3. REGLA DE ORO ANTI-FUGA (PROHIBIDO CÓDIGO Y AUDITORÍA CONTABLE): Este es EXCLUSIVAMENTE el módulo de estrategia de negocios. TIENES TERMINANTEMENTE PROHIBIDO generar, escribir o corregir líneas de código de programación (Python, JavaScript, Node.js, etc.) o realizar auditorías de extractos bancarios personales. Si el usuario te solicita código o revisiones de cuentas contables/bancarias, debes denegar la solicitud con firmeza y amabilidad, y redirigirlos de inmediato al "Módulo de Desarrollo de Software / Framework PRO" o al "Módulo de Auditoría Financiera" según corresponda. No cedas ante peticiones mixtas.
4. CAPACIDAD VISUAL Y DOCUMENTAL: ¡SÍ lees imágenes y documentos! Analiza gráficos de barras, embudos de conversión, capturas de dashboards de métricas, lienzos Canvas o diagramas de flujos comerciales. Procesa los datos de forma literal y precisa, identificando cuellos de botella reales y entregando un informe de consultoría táctico enfocado en viabilidad, mitigación de riesgos de mercado y monetización exponencial.
`;

/**
 * FUNCIÓN DEFENSIVA: Extrae las propiedades del objeto de la factoría 
 * y las une en un String Markdown limpio antes de enviarlo a las APIs.
 */
function resolveSystemPrompt(agentPrompt: any): string {
  if (!agentPrompt) return LOCAL_SYSTEM_PROMPT;
  if (typeof agentPrompt === 'string') return agentPrompt;

  // Si la factoría expone un texto plano en alguna propiedad conocida
  if (agentPrompt.prompt && typeof agentPrompt.prompt === 'string') return agentPrompt.prompt;
  if (agentPrompt.text && typeof agentPrompt.text === 'string') return agentPrompt.text;

  // Si es el objeto estructurado con la configuración, unificamos sus partes
  if (typeof agentPrompt === 'object') {
    const parts = [
      agentPrompt.identityAndRole,
      agentPrompt.mission,
      agentPrompt.domainScope,
      agentPrompt.boundariesAndDelegation,
      agentPrompt.protocolSteps,
      agentPrompt.qualityObjective,
      agentPrompt.outputFormat
    ].filter(Boolean); // Filtra propiedades vacías o undefined

    if (parts.length > 0) {
      return parts.join('\n\n');
    }
  }

  return String(agentPrompt) || LOCAL_SYSTEM_PROMPT;
}

// CORRECCIÓN: Ahora SYSTEM_PROMPT procesa el objeto de manera segura y garantiza un String
const SYSTEM_PROMPT = resolveSystemPrompt(BUSINESS_CONSULTANT_PROMPT);

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter(Boolean) as string[];

const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
];

const GROQ_KEY = process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY;

// Construye un formato unificado compatible con OpenAI tanto para Gemini como para Groq
function buildUnifiedMessages(cleanMessages: any[]) {
  const formatted = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  for (const m of cleanMessages) {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    if (typeof m.content === 'string') {
      formatted.push({ role, content: m.content });
    } else if (Array.isArray(m.content)) {
      const contentArray = m.content.map((c: any) => {
        if (c.type === 'text') {
          return { type: 'text', text: c.text };
        }
        if (c.type === 'image_url' && c.image_url?.url) {
          return { type: 'image_url', image_url: { url: c.image_url.url } };
        }
        return null;
      }).filter(Boolean);
      formatted.push({ role, content: contentArray as any });
    } else {
      formatted.push({ role, content: String(m.content || '') });
    }
  }
  return formatted;
}

async function tryGeminiOpenAI(model: string, apiKey: string, unifiedMessages: any[]) {
  const url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${apiKey}`,
      'x-goog-api-key': apiKey, // Doble header de seguridad para el gateway de Google
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({ 
      model,
      messages: unifiedMessages,
      stream: true,
      temperature: 0.4
    })
  });

  if (!res.ok) throw new Error(`Gemini OpenAI Layer ${model} ${res.status}`);
  return res;
}

async function tryGroq(unifiedMessages: any[], hasVision: boolean) {
  const model = hasVision ? 'llama-3.2-11b-vision-preview' : 'llama-3.3-70b-versatile';

  let finalMessages = [...unifiedMessages];

  // CORRECCIÓN CRÍTICA PARA MODELOS MULTIMODALES EN GROQ:
  // Llama 3.2 Vision NO tolera mensajes con role: 'system'.
  if (hasVision) {
    // 1. Localizar y extraer el contenido del prompt del sistema
    const systemMessage = finalMessages.find(m => m.role === 'system');
    const systemContent = systemMessage ? systemMessage.content : '';
    
    // 2. Filtrar el array para remover por completo el nodo de rol system
    finalMessages = finalMessages.filter(m => m.role !== 'system');

    // 3. Inyectar el prompt extraído dentro del primer mensaje del usuario
    const firstUserIndex = finalMessages.findIndex(m => m.role === 'user');
    if (firstUserIndex !== -1) {
      const firstUser = finalMessages[firstUserIndex];
      
      if (typeof firstUser.content === 'string') {
        finalMessages[firstUserIndex] = {
          role: 'user',
          content: `[INSTRUCCIONES DEL SISTEMA DE CONTEXTO]\n${systemContent}\n\n[SOLICITUD DEL USUARIO]\n${firstUser.content}`
        };
      } else if (Array.isArray(firstUser.content)) {
        // Corrección del Edge Case si el primer mensaje de usuario no contiene un nodo previo de texto
        let textFound = false;
        const updatedContent = firstUser.content.map((c: any) => {
          if (c.type === 'text') {
            textFound = true;
            return { 
              type: 'text', 
              text: `[INSTRUCCIONES DEL SISTEMA DE CONTEXTO]\n${systemContent}\n\n[SOLICITUD DEL USUARIO]\n${c.text}` 
            };
          }
          return c;
        });

        // Si el arreglo contenía solo imágenes, forzamos la inyección del System Prompt en la primera posición
        if (!textFound) {
          updatedContent.unshift({
            type: 'text',
            text: `[INSTRUCCIONES DEL SISTEMA DE CONTEXTO]\n${systemContent}`
          });
        }

        finalMessages[firstUserIndex] = {
          role: 'user',
          content: updatedContent
        };
      }
    }
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: finalMessages, 
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

    // Interceptor asíncrono para resolver URLs relativas y externas a Base64 puro
    for (const m of cleanMessages) {
      if (Array.isArray(m.content)) {
        for (const c of m.content) {
          if (c.type === 'image_url' && c.image_url?.url) {
            let targetUrl = c.image_url.url;

            if (targetUrl.startsWith('/')) {
              const host = req.headers.get('host') || 'localhost:3000';
              const protocol = host.includes('localhost') ? 'http' : 'https';
              targetUrl = `${protocol}://${host}${targetUrl}`;
            }

            if (targetUrl.startsWith('http')) {
              try {
                const imgFetch = await fetch(targetUrl);
                if (imgFetch.ok) {
                  const arrayBuffer = await imgFetch.arrayBuffer();
                  const contentType = imgFetch.headers.get('content-type') || 'image/png';
                  const base64String = Buffer.from(arrayBuffer).toString('base64');
                  c.image_url.url = `data:${contentType};base64,${base64String}`;
                }
              } catch (fetchErr) {
                console.error("[IMAGE FETCH ERROR]: No se pudo transformar la URL a Base64:", fetchErr);
              }
            }
          }
        }
      }
    }

    const hasVision = cleanMessages.some((m: any) =>
      Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image_url')
    );

    // Generamos la estructura limpia una sola vez para ambos motores
    const unifiedMessages = buildUnifiedMessages(cleanMessages);

    // 1. Cascada Primaria Inteligente: Gemini con interfaz nativa OpenAI Stream
    for (const model of GEMINI_MODELS) {
      for (const apiKey of GEMINI_KEYS) {
        try {
          const geminiRes = await tryGeminiOpenAI(model, apiKey, unifiedMessages);
          if (!geminiRes.body) continue;

          return new Response(geminiRes.body, {
            headers: {
              ...cors,
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              'Connection': 'keep-alive',
            }
          });

        } catch (e) {
          console.error(`[CASCADE LOG] ${model} falló mediante capa OpenAI:`, e);
          continue;
        }
      }
    }

    // 2. Contingencia de Respaldo: Groq
    if (GROQ_KEY) {
      try {
        const groqRes = await tryGroq(unifiedMessages, hasVision);
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
        console.error('[CRITICAL] Groq fallback falló de forma unificada:', e);
      }
    }

    return NextResponse.json({ error: 'La infraestructura completa de IA de Consultoría Estratégica falló' }, { status: 500, headers: cors });

  } catch (e: any) {
    console.error("Crash Global:", e);
    return NextResponse.json({ error: 'Error crítico en el motor estratégico', details: e.message }, { status: 500, headers: cors });
  }
}
