import {NextResponse} from 'next/server';
import {Pinecone} from '@pinecone-database/pinecone';
import {PineconeStore} from '@langchain/pinecone';
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";

const embeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: process.env["HF_TOKEN"]
});

import {setTimeout} from 'timers/promises';

async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

      const response = await fetchWithRetry(url, {...options, signal: controller.signal});
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed. Error: ${error.message}`);
      if (i === maxRetries - 1) throw error;
      await setTimeout(1000 * Math.pow(2, i)); // Exponential backoff
    }
  }
}

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

// Initialize PineconeStore
let vectorStore;

async function initVectorStore() {
  if (!vectorStore) {
    vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
      namespace: process.env.PINECONE_NAMESPACE,
    });
  }
}

async function retrieveRelevantContext(query) {
  await initVectorStore();
  const results = await vectorStore.similaritySearch(query, 5);
  return results.map(result => result.pageContent).join('\n\n');
}

export async function POST(req) {

  const systemPrompt = {
    role: 'system',
    content: `You are an AI assistant for a university's Computer Science department. Your role is to help graduating student users build their resume and cover letters for their job search. Here's how you should interact:
      Overview: Start by mentioning that the tech hiring season is coming up. Stress the importance of getting experience even while you're still in school because the tech industry is copmetitive. Ask the user if they want to work on building a resume or a cover letter. 
      Information and Guidance: Provide clear details on what format and what type of information the user should consider using for each section of their resume. Help users draft their resume by offering sample bullet points and statements for their cover letters.
      Career Advice: Offer tips on becoming more competitive in tech roles, including skill enhancement and industry trends. Ask the student which industry they are intersted in and tailor your guidance towards standards for that industry.
      Support and Assistance: Answer questions about the computer science industry and job readiness. Be friendly and encouraging.
      User Engagement: Encourage users to sign up for the CS Dashboard waitlist at https://www.templink.com to get early access to a full dashboard where they can learn more about career development and strengthen their coding skills. Keep users engaged by offering brief responses no longer than 5-7 sentences.
      Upbeat, Professional Tone: Keep your responses professional and helpful, but stay engaging and friendly. Users should feel like you are a peer who is very knowledgeable. Keep responses targeted, succinct, and actionable. Don't use special characters.`
  };

  try {
    const requestData = await req.json();
    const userMessage = requestData[requestData.length - 1].content;
    const relevantContext = await retrieveRelevantContext(userMessage);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPEN_ROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "meta-llama/llama-3.1-8b-instruct:free",
        "messages": [
            systemPrompt,
            ...requestData.slice(0, - 1),
          {"role": "user", "content": {userMessage}},
        ],
      })
    });

    const responseData = await response.json();
    const assistantResponse = responseData.choices[0]?.message?.content || 'No response from assistant';

    const formattedResponse = assistantResponse
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    return NextResponse.json(formattedResponse);
  } catch (error) {
    console.error('Detailed error:', error);
    return NextResponse.json({error: 'An error occurred while processing your request. Please try again later.'}, {status: 500});


  }
}
