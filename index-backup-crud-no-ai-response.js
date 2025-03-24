require("dotenv").config();
const express = require("express");
const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");


// Initialize Firebase Admin SDK

const serviceAccount = require(process.env.FIREBASE_CREDENTIALS);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const app = express();
app.use(express.json());

// Create a new chat
app.post("/chat", async (req, res) => {
  try {
    const chatId = uuidv4();
    await db.collection("chats").doc(chatId).set({ createdAt: admin.firestore.Timestamp.now() });
    res.status(201).json({ chatId, message: "Chat created successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all chat IDs
app.get("/chats", async (req, res) => {
  try {
    const chatsSnapshot = await db.collection("chats").get();
    const chatIds = chatsSnapshot.docs.map(doc => doc.id);
    res.status(200).json({ chatIds });
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

// Send a message to a chat
app.post("/chat/:chatId/message", async (req, res) => {
  try {
    const { chatId } = req.params;
    const { sender, message } = req.body;
    const timestamp = admin.firestore.Timestamp.now();

    await db.collection("chats").doc(chatId).collection("messages").add({
      sender,
      message,
      timestamp,
    });
    res.status(201).json({ message: "Message sent successfully" });
  } catch (error) {
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



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
