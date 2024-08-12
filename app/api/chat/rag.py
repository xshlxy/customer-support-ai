from langchain_community.document_loaders import WebBaseLoader, YoutubeLoader, DirectoryLoader, TextLoader, PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_pinecone import PineconeVectorStore
from langchain_openai import OpenAIEmbeddings
from pinecone import Pinecone
from openai import OpenAI
from dotenv import load_dotenv
import tiktoken
import os

# %%
# Env. Variables
load_dotenv()
pinecone_api_key = os.getenv('PINECONE_API_KEY')
openai_api_key = os.getenv("OPENAI_API_KEY")
# %% md
### initialize Pinecone and OpenAI
# %%
embeddings = OpenAIEmbeddings()
embed_model = "text-embedding-3-small"
openai_client = OpenAI()
# %%
vectorstore = PineconeVectorStore(index_name=os.getenv('PINECONE_INDEX_NAMES'), embedding=embeddings)
index_name = os.getenv('PINECONE_INDEX_NAME')
namespace = os.getenv('PINECONE_NAMESPACE')
# Initialize Pinecone
pc = Pinecone(api_key=pinecone_api_key)
# Connect to your Pinecone index
pinecone_index = pc.Index(index_name)
# %% md
### initialize text splitter
# %%
tokenizer = tiktoken.get_encoding('p50k_base')


# create the length function
def tiktoken_len(text):
    tokens = tokenizer.encode(
        text,
        disallowed_special=()
    )
    return len(tokens)


text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=tiktoken_len,
    separators=["\n\n", "\n", " ", ""]
)
# %% md
### get career tips data
# %%
# Load in a YouTube video's transcript
urls = [
    "https://wiki.colorstack.org/the-colorstack-family/career-development/career-center/catalinas-corner/resumes"
    "/bulletpoints",
    "https://wiki.colorstack.org/the-colorstack-family/career-development/career-center/catalinas-corner/interviews",
    "https://wiki.colorstack.org/the-colorstack-family/career-development/career-center/catalinas-corner/negotiation",
    "https://wiki.colorstack.org/the-colorstack-family/career-development/career-center/catalinas-corner/corporate"
    "-communication",
    "https://wiki.colorstack.org/the-colorstack-family/career-development/career-center/catalinas-corner/mindset-and"
    "-time-management",
    "https://wiki.colorstack.org/the-colorstack-family/career-development/career-center/how-to-speak-to-recruiters"
    "/linkedin-outreach",
    "https://wiki.colorstack.org/the-colorstack-family/career-development/career-center/how-to-speak-to-recruiters"
    "/offer-negotiation",
    "https://wiki.colorstack.org/the-colorstack-family/career-development/career-center/catalinas-corner/resumes"
    "/sections-and-orders",
    "https://wiki.colorstack.org/the-colorstack-family/career-development/career-center/catalinas-corner/resumes/dos"
    "-and-dont-s",
]

loader = WebBaseLoader(urls)
data = loader.load()
# %%
texts = text_splitter.split_documents(data)
# %% md
### Data -> Pinecone
# %%
for document in texts:
    print("\n\n\n\n----")

    print(document.metadata, document.page_content)

    print('\n\n\n\n----')
# %%
vectorstore_from_texts = PineconeVectorStore.from_texts([f"Source: {t.metadata['source']}, Title: {t
                                                        .metadata['title']} \n\nContent: {t.page_content}" for t in
                                                         texts], embeddings, index_name=index_name,
                                                        namespace=namespace)
# %% md
### Perform RAG
# %%
# Initialize Pinecone
pc = Pinecone(api_key=pinecone_api_key)

# Connect to your Pinecone index
pinecone_index = pc.Index(index_name)
# %%
query = "What are some tips for resume building?"


# %%
def perform_rag(query):
    raw_query_embedding = openai_client.embeddings.create(
        input=[query],
        model="text-embedding-3-small"
    )
    query_embedding = raw_query_embedding.data[0].embedding

    top_matches = pinecone_index.query(vector=query_embedding, top_k=10, include_metadata=True, namespace=namespace)

    # Get the list of retrieved texts
    contexts = [item['metadata']['text'] for item in top_matches['matches']]

    augmented_query = "<CONTEXT>\n" + "\n\n-------\n\n".join(contexts[
                                                             : 10]) + "\n-------\n</CONTEXT>\n\n\n\nMY QUESTION:\n" + query

    # Modify the prompt below as need to improve the response quality
    system_prompt = f"""`You are an AI assistant for a university's Computer Science department. Your role is to help students understand which tech careers are available to them with a Computer Science degree. Here’s how you should interact:
  
  Overview: Start by explaining the app’s purpose and key features. Show how it can help users grow professionally.
  
  Information and Guidance: Ask the user if they want to find out about their career options, or if they need help building a resume or cover letter. Help users write their resume and cover letter by asking about their experience and then writing options for bullet points of sentences they can include in their documents.
  
  Career Advice: Offer tips on becoming more competitive in tech roles, including skill enhancement and industry trends.
  
  Support and Assistance: Explain best practices for job searching, technical skill development, and submitting applications. Be friendly and encouraging.
  
  User Engagement: Encourage users to sign up for the waitlist to get early access to a full Computer Science career-readiness dashboard. Users can sign up for the waitlist at https://www.example.com. Keep users engaged by offering to answer questions and provide guidance. Encourage a conversational tone by limiting responses to 7 sentences or less. Use bullet points to break up text and make it easier to read. Limit responses to 10 bullet points or less, each with no more than 90 characters.
  
  Professional Tone: Keep your responses professional and helpful, ensuring they are actionable and relevant to tech professionals. Don't use special characters.`,

    """

    res = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": augmented_query}
        ],
        stream=True
    )

    for chunk in res:
        if chunk.choices[0].delta.content is not None:
            yield chunk.choices[0].delta.content
        else:
            print('empty chunk received', file=sys.stderr)

# %%
perform_rag(query)