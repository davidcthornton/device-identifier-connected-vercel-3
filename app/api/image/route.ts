import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();

    // Collect uploaded files from the "images" field
    const files = formData
      .getAll("images")
      .filter((v): v is File => v instanceof File);

    if (files.length === 0) {
      return Response.json(
        { reply: "Please select or capture at least one image." },
        { status: 400 }
      );
    }

    // Build the exact same "input" structure as your Express server
    const input: any[] = [
      {
        role: "user",
        content: [] as any[],
      },
    ];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Skip any zero-byte files
      if (buffer.length === 0) {
        console.warn("Skipping empty file:", {
          name: file.name,
          type: file.type,
          size: (file as any).size,
        });
        continue;
      }

      const base64Image = buffer.toString("base64");

      // Also guard against somehow-empty base64
      if (!base64Image) {
        console.warn("Skipping file with empty base64:", {
          name: file.name,
          type: file.type,
          size: (file as any).size,
        });
        continue;
      }

      const dataUrl = `data:image/jpeg;base64,${base64Image}`;

      (input[0].content as any[]).push({
        type: "input_image",
        image_url: dataUrl,
      });
    }

    // If all files were empty for some reason, bail early
    if ((input[0].content as any[]).length === 0) {
      return Response.json(
        { reply: "Please select or capture at least one non-empty image." },
        { status: 400 }
      );
    }

    // Debug: log the shape so you can compare with your old server if needed
    console.log("--- Next.js OpenAI input (shape only) ---");
    console.log(
      JSON.stringify(
        input.map((msg) => ({
          role: msg.role,
          content: msg.content.map((c: any) => ({
            type: c.type,
            image_url_preview:
              typeof c.image_url === "string"
                ? c.image_url.slice(0, 80) + "...(truncated)"
                : c.image_url,
          })),
        })),
        null,
        2
      )
    );


    const response = await openai.responses.create({
      model: "gpt-5.6",
      reasoning: {
        effort: "medium",
      },
      max_output_tokens: 1000,
      instructions:
        'This GPT assists law enforcement officers in identifying electronic devices based on uploaded images. When provided with a photo of a device, it analyzes visual cues to determine the device type (e.g., smartphone, laptop, router) and, if possible, the specific model number and manufacturer. The GPT is optimized for accuracy and objectivity and avoids speculation. If identification is not possible, it clearly states this. It is not intended to provide legal advice or perform forensic analysis. It stays concise, professional, and focused strictly on the task of visual identification of electronics.  The GPT prioritizes clear and actionable feedback. It does not generate hypothetical scenarios or engage in conversation beyond device identification. It avoids making assumptions and refrains from guessing when visual information is insufficient.  It communicates in a neutral, precise tone appropriate for professional law enforcement contexts. It avoids jargon and keeps responses brief and direct.  It is prepared to interpret images showing partial views of devices and should highlight any identifiable features such as logos, button placement, screen type, or ports when making assessments.  Format your reply in the following style: "This device appears to be: Device: <manufacturer and model or brief description>, Type: <deviceType>."  Here are the only possible values for deviceType: desktop, laptop, smartphone, tablet, externaldrive, removablemedia, router, or other.',
      tools: [{ type: "web_search_preview" }],
      tool_choice: "auto",
      // 👇 this is the key bit: same "input" shape as Express
      input: input as any,
    });

    // Mirror your original response parsing
    const output: any[] = (response as any).output ?? [];
    const messageOutputs = output.filter((o) => o.type === "message");

    const reply =
      messageOutputs.length > 0
        ? messageOutputs[0].content[0].text
        : "No message output returned";

    return Response.json({ reply });
  } catch (err: any) {
    console.error("Error in /api/image:", JSON.stringify(err, null, 2));
    return Response.json({ reply: "error 500" }, { status: 500 });
  }
}
