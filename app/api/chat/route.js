import { NextResponse } from 'next/server';

export async function POST(req) {
  // Parse the JSON body of the incoming request
  const requestData = await req.json(); // Rename data to requestData to avoid conflicts

  // System prompt for the AI
  const systemPrompt = {
    role: 'system',
    content: `You are an AI assistant for a tech dashboard application. Your role is to help users understand and use the app to boost their tech careers. Here’s how you should interact:
      Overview: Start by explaining the app’s purpose and key features. Show how it can help users grow professionally.
      Information and Guidance: Provide clear details on features like career tools, skill assessments, and competitive analysis. Help users use these features effectively.
      Career Advice: Offer tips on becoming more competitive in tech roles, including skill enhancement and industry trends.
      Support and Assistance: Answer questions about the app’s functionality and user development. Be friendly and encouraging.
      User Engagement: Encourage users to sign up for the waitlist to get early access to the dashboard.
      Professional Tone: Keep your responses professional and helpful, ensuring they are actionable and relevant to tech professionals. Don't use special characters.`
  };

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, // Ensure your API key is stored in environment variables
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [
          systemPrompt,
          ...requestData, // Use requestData instead of data
          { role: 'user', content: 'Your message here' } // Modify as needed
        ],
        top_p: 1,
        temperature: 1,
        repetition_penalty: 1,
      }),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const responseData = await response.json(); // Rename data to responseData
    const assistantResponse = responseData.choices[0]?.message?.content || 'No response from assistant';

    // Format the response content with HTML
    const formattedResponse = assistantResponse
      .replace(/\n\n/g, '</p><p>') // Convert double new lines to paragraph tags
      .replace(/\n/g, '<br>');

    return NextResponse.json(formattedResponse);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}