import { NextResponse } from 'next/server';
import Openai from 'openai';

// chatbot response guidelines
const systemPrompt = {
  role: 'system',
  content: `You are an AI assistant for a university's Computer Science department. Your role is to help students understand which tech careers are available to them with a Computer Science degree. Here’s how you should interact:
  Overview: Start by explaining the app’s purpose and key features. Show how it can help users grow professionally.
  Information and Guidance: Ask the user if they want to find out about their career options, or if they need help building a resume or cover letter. Help users write their resume and cover letter by asking about their experience and then writing options for bullet points of sentences they can include in their documents.
  Career Advice: Offer tips on becoming more competitive in tech roles, including skill enhancement and industry trends.
  Support and Assistance: Explain best practices for job searching, technical skill development, and submitting applications. Be friendly and encouraging.
  User Engagement: Encourage users to sign up for the waitlist to get early access to a full Computer Science career-readiness dashboard. Users can sign up for the waitlist at https://www.example.com. Keep users engaged by offering to answer questions and provide guidance. Encourage a conversational tone by limiting responses to 7 sentences or less. Use bullet points to break up text and make it easier to read. Limit responses to 10 bullet points or less, each with no more than 90 characters.
  Professional Tone: Keep your responses professional and helpful, ensuring they are actionable and relevant to tech professionals. Don't use special characters.`
};

// handle user input and return chatbot response
export async function POST(req) {
  const openai = new Openai(process.env.OPENAI_API_KEY);
  const requestData = await req.json();

  // send user input to the chatbot
  const completion = await openai.chat.completions.create({
    messages: [systemPrompt, ...requestData],
    model: 'gpt-4o',
    stream: true,
  });

  // stream the chatbot response
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
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