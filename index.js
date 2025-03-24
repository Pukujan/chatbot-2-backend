require("dotenv").config();
const express = require("express");
const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");
const OpenAI = require("openai");
const cors = require("cors");

// Initialize Firebase Admin SDK
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const app = express();

app.use(cors({ origin: "http://localhost:5173" })); 
app.use(express.json());

// Initialize OpenRouter (Using OpenAI SDK)
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY, // Store your API key in .env
});

// Create a new chat
app.post("/chat", async (req, res) => {
  try {
    const chatId = uuidv4();
    const chatData = {
      chatId, // Including chatId in document for easier access
      chatName: "New Chat", // Default chat name
      createdAt: admin.firestore.Timestamp.now()
    };
    
    await db.collection("chats").doc(chatId).set(chatData);
    res.status(201).json(chatData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send a message and get AI response
app.post("/chat/:chatId/message", async (req, res) => {
  try {
    const { chatId } = req.params;
    const { sender, message } = req.body;
    const timestamp = admin.firestore.Timestamp.now();

    // Store user message
    await db.collection("chats").doc(chatId).collection("messages").add({
      sender,
      message,
      timestamp,
    });

    // Send message to OpenRouter AI
    const aiResponse = await openai.chat.completions.create({
      model: "rekaai/reka-flash-3:free",
      messages: [{ role: "user", content: message }],
    });

    // Debugging: Log the full response
    console.log("AI Response:", aiResponse);

    // Check if choices exist
    if (!aiResponse.choices || aiResponse.choices.length === 0) {
      throw new Error("Invalid response from OpenRouter API");
    }

    const botReply = aiResponse.choices[0].message.content;

    // Store AI response
    await db.collection("chats").doc(chatId).collection("messages").add({
      sender: "AI",
      message: botReply,
      timestamp: admin.firestore.Timestamp.now(),
    });

    res.status(201).json({ message: botReply });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Retrieve chat messages
app.get("/chat/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;
    const messagesSnapshot = await db.collection("chats").doc(chatId).collection("messages").orderBy("timestamp").get();
    const messages = messagesSnapshot.docs.map(doc => doc.data());
    res.status(200).json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all chat IDs and names
app.get("/chats", async (req, res) => {
  try {
    const chatsSnapshot = await db.collection("chats").get();
    const chats = chatsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        chatId: doc.id,
        chatName: data.chatName || "New Chat" // Fallback to "New Chat" if name doesn't exist
      };
    });
    res.status(200).json({ chats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update chat name
app.put("/chat/:chatId/name", async (req, res) => {
  try {
    const { chatId } = req.params;
    const { chatName } = req.body;
    
    if (!chatName || typeof chatName !== 'string') {
      return res.status(400).json({ error: "Invalid chat name" });
    }

    await db.collection("chats").doc(chatId).update({ chatName });
    res.status(200).json({ message: "Chat name updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// edit Chat Name
app.put('/chat/:chatId/name', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { chatName } = req.body;
    
    if (!chatName || typeof chatName !== 'string') {
      return res.status(400).json({ error: "Invalid chat name" });
    }

    await db.collection("chats").doc(chatId).update({ chatName });
    res.status(200).json({ message: "Chat name updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a chat
app.delete("/chat/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;
    const messagesRef = db.collection("chats").doc(chatId).collection("messages");
    const messagesSnapshot = await messagesRef.get();

    // Delete all messages first
    const batch = db.batch();
    messagesSnapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // Delete chat document
    await db.collection("chats").doc(chatId).delete();
    res.status(200).json({ message: "Chat deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});