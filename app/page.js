"use client";

import {Box, Button, Stack, TextField, Typography} from "@mui/material";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import {bold} from "next/dist/lib/picocolors";
import Image from "next/legacy/image";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Custom hook for Firebase initialization
function useFirebase() {
  const [firebase, setFirebase] = useState(null);

  useEffect(() => {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    setFirebase({ app, auth, db });
  }, []);

  return firebase;
}

export default function Home() {
  const firebase = useFirebase();
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
          "Hey there, welcome to the NextStep CS Dashboard! \n\n The dashboard will be available soon. Don't forget to join the waitlist to get early access and updates. \n\n In the meantime, I can help you with any questions you have about breaking into tech. *Just ask!* ",
    },
  ]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);

  const handleSignIn = async () => {
    if (!firebase) return;
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(firebase.auth, provider);
      setUser(result.user);
      loadChatHistory(result.user.uid);
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  const handleSignOut = async () => {
    if (!firebase) return;
    try {
      await signOut(firebase.auth);
      setUser(null);
      setMessages([
        {
          role: "assistant",
          content:
            "Hey there, welcome to the NextStep CS Dashboard! \n\n The dashboard will be available soon. Don't forget to join the waitlist to get early access and updates. \n\n In the meantime, I can help you with any questions you have about breaking into tech. Just ask!",
        },
      ]);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const loadChatHistory = async (uid) => {
    if (!firebase) return;
    try {
      const chatDoc = await getDoc(doc(firebase.db, "chats", uid));
      if (chatDoc.exists()) {
        setMessages(chatDoc.data().messages);
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  };

  const saveChatHistory = async (messages) => {
    if (!firebase || !user) return;
    try {
      await setDoc(doc(firebase.db, "chats", user.uid), { messages });
    } catch (error) {
      console.error("Error saving chat history:", error);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || isLoading) return;
    setIsLoading(true);

    setMessage("");
    const updatedMessages = [
      ...messages,
      { role: "user", content: message },
      { role: "assistant", content: "" },
    ];
    setMessages(updatedMessages);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedMessages.slice(0, -1)),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        setMessages((messages) => {
          let lastMessage = messages[messages.length - 1];
          let otherMessages = messages.slice(0, messages.length - 1);
          const updatedMessages = [
            ...otherMessages,
            { ...lastMessage, content: lastMessage.content + text },
          ];
          saveChatHistory(updatedMessages);
          return updatedMessages;
        });
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((messages) => {
        const updatedMessages = [
          ...messages,
          {
            role: "assistant",
            content: "Oops, something went wrong. Please try again later.",
          },
        ];
        saveChatHistory(updatedMessages);
        return updatedMessages;
      });
    }
    setIsLoading(false);
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <Box
        bgcolor="#dcefff"
      width="100vw"
      height="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      position="relative"
    >
      {user && (
        <Button

          variant="contained"
          onClick={handleSignOut}
          style={{ position: "absolute", top: 20, right: 20 }}
        >
          Sign Out
        </Button>
      )}

      {!user ? (
        <Button variant="contained" onClick={handleSignIn} disabled={!firebase} style={{position: "absolute", top: 300, right: 250}}>
          Sign in with Google
        </Button>
      ) : (
        <Stack
            bgcolor="#f5f5f5"
          direction={"column"}
          width="400px"
          height="500px"
          border="2px solid black"
          borderRadius={6}
          p={2}
          spacing={3}
          style={{position: "absolute", bottom: 20, right: 20}}
        >
          <Stack
            direction={"column"}
            spacing={2}
            flexGrow={1}
            overflow="auto"
            maxHeight="100%"
          >
            {messages.map((message, index) => (
              <Box
                key={index}
                display="flex"
                justifyContent={
                  message.role === "assistant" ? "flex-start" : "flex-end"
                }
              >
                <Box
                  bgcolor={
                    message.role === "assistant"
                      ? "primary.main"
                      : "secondary.main"
                  }
                  color="#FFF"
                  borderRadius={10}
                  p={3}
                  sx={{ whiteSpace: "pre-wrap" }}
                >
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </Box>
              </Box>
            ))}
            <div ref={messagesEndRef} />
          </Stack>
          <Stack direction={"row"} spacing={2}>
            <TextField
              label="Message"
              fullWidth
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
            <Button
              variant="contained"
              onClick={sendMessage}
              disabled={isLoading}
            >
              {isLoading ? "Sending..." : "Send"}
            </Button>
          </Stack>
        </Stack>
      )}
      <Box
          bgcolor="#1976d2"
          borderRadius={2}
        p={2}
        position="absolute" top={10} bottom={10} left={20}
        height="98%"
        textAlign="center"
        fontWeight="bold"
        fontFamily={"Poppins, sans"}
        maxWidth="47%"
      >
        <Stack
            direction={"column"}
            spacing={2}
            height="100%"
        >
          <Typography variant={"h2"} align="center" color={"#fff"} textTransform={"uppercase"}>
            Welcome to NextStep CS
          </Typography>
          <br/>
          <Typography variant="h5" align="center" color={"#fff"} width={"95%"}>
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            We're building something amazing.
          </Typography>
          <br/>
          <br/>
          <br/>
          <Typography variant="h5" align="center" color={"#000"} width={"95%"}>
            Your all-in-one dashboard for career guidance, technical skill development, resume building, and offer
            negotiation tips.
          </Typography>
          <br/>
          <br/><br/>
          <Typography variant="h5" align="center" color={"#000"} width={"95%"}>
            Learn how to land your dream job in tech.
          </Typography>
          <br/>
          <br/>
          <Typography variant="h6" align="center" color={"#000"} width={"95%"}>
            Build your resume, practice your interview skills, and get personalized career advice.
            <br/>
          </Typography>
          <br/>
          <br/>
          <Typography variant="h6" align="center" color={"#fff"} width={"95%"}>
            Sign up for early access today!
          </Typography>
          <form>
            <TextField
                label="Email"
                fullWidth
                variant="outlined"
                size="large"
                color="secondary"
            />
            <br/>
            <Button variant="contained" color="secondary" size="large" fullWidth>
              Sign Up for Early Access
            </Button>
          </form>
        </Stack>
      </Box>
    </Box>
  );
}
