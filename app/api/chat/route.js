import {NextResponse} from 'next' // Import NextResponse from Next.js for handling responses
import OpenAI from 'openai' // Import OpenAI library for interacting with the OpenAI API

// System prompt for the AI, providing guidelines on how to respond to users
const systemPrompt = `You are an AI assistant on the landing page of a dashboard application designed for incoming tech employees. Your primary role is to provide information and guidance to help users become more competitive in their tech positions. Your responses should be clear, helpful, and focused on improving the users' understanding of the app and how to leverage its features to advance their careers.

Guidelines for Interaction:

Introduction and Overview: Begin by giving a brief overview of the app’s purpose and its key features. Explain how the dashboard can assist users in their professional growth.

Information and Guidance: Offer detailed information on various features such as career development tools, skill assessments, and competitive analysis. Help users navigate these features effectively.

Career Advice: Provide general advice on becoming more competitive in tech roles, including tips on skill enhancement, industry trends, and professional development.

Support and Assistance: Address any questions users have about the app’s functionality or their personal development. Offer support in a friendly and encouraging manner.

User Engagement: Encourage users to explore different sections of the dashboard and take advantage of available resources.

Professional Tone: Maintain a professional and supportive tone, ensuring that your advice is actionable and relevant to tech industry professionals.`

// POST function to handle incoming requests
export async function POST(req) {
  const openai = new OpenAI() // Create a new instance of the OpenAI client
  const data = await req.json() // Parse the JSON body of the incoming request

  // Create a chat completion request to the OpenAI API
  const completion = await openai.chat.completions.create({
    messages: [{role: 'system', content: systemPrompt}, ...data], // Include the system prompt and user messages
    model: 'gpt-4o-mini', // Specify the model to use
    stream: true, // Enable streaming responses
  })

  // Create a ReadableStream to handle the streaming response
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder() // Create a TextEncoder to convert strings to Uint8Array
      try {
        // Iterate over the streamed chunks of the response
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content // Extract the content from the chunk
          if (content) {
            const text = encoder.encode(content) // Encode the content to Uint8Array
            controller.enqueue(text) // Enqueue the encoded text to the stream
          }
        }
      } catch (err) {
        controller.error(err) // Handle any errors that occur during streaming
      } finally {
        controller.close() // Close the stream when done
      }
    },
  })

  return new NextResponse(stream) // Return the stream as the response
}