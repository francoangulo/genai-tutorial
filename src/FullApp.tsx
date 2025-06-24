import React, { useState } from "react";
import { useRecording } from "./hooks/useRecording";
import {
  createPartFromUri,
  createUserContent,
  GoogleGenAI,
  Type,
} from "@google/genai";
const API_KEY = import.meta.env.VITE_GENAI_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });

export const FullApp = () => {
  const [prompt, setPrompt] = useState("");
  const { recording, stopRecording, startRecording, audioUrl, recordedFile } =
    useRecording();

  const transcriptAudio = async () => {
    if (!recordedFile) {
      return;
    }
    try {
      const myfile = await ai.files.upload({
        file: recordedFile,
        config: { mimeType: "audio/m4a" },
      });

      if (!myfile || !myfile.uri || !myfile.mimeType) {
        throw new Error("File upload failed or returned invalid data.");
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: createUserContent([
          createPartFromUri(myfile.uri, myfile.mimeType),
          "Just transcribe the audio file.",
        ]),
      });

      if (!response || !response.text) {
        throw new Error("No transcription text returned from the AI model.");
      }

      sendRequest(response.text); // we will create this function
    } catch (error) {
      console.error("There was an error transcribing the audio:", error);
    }
  };

  async function handleTypedSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Handle the prompt submission here
    console.log("Submitted prompt:", prompt);

    try {
      sendRequest(prompt);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }

  const sendRequest = async (speech: string) => {
    try {
      const createUserFunctionDeclaration = {
        name: "create_user",
        description: "Creates a user based on the data provided.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: "The name of the user.",
            },
            email: {
              type: Type.STRING,
              description: "The email of the user. Should be all lowercase.",
            },
            password: {
              type: Type.STRING,
              description: "The password of the user. Should be all lowercase.",
            },
          },
          required: ["name", "email", "password"],
        },
      };

      const getUsersFunctionDeclaration = {
        name: "get_users",
        description: "Retrieves all the users from the db.",
        parameters: {
          type: Type.OBJECT,
          properties: {}, // No input needed
        },
      };

      // Send request with function declarations
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `${speech}.`,
        config: {
          tools: [
            {
              functionDeclarations: [
                createUserFunctionDeclaration,
                getUsersFunctionDeclaration,
              ],
            },
          ],
        },
      });

      const functionCall =
        response.candidates?.[0]?.content?.parts?.[0]?.functionCall;

      if (!functionCall) {
        console.warn("No function call was returned");
        return;
      }

      const args = functionCall.args;

      let res;
      // The AI made use of our create_user function
      if (functionCall.name === "create_user") {
        if (!args || !args.name || !args.email || !args.password) {
          throw new Error(
            "Missing required parameters for create_user function"
          );
        }

        // If we have the complete data, we send the
        // request to the API we are trying to reach

        res = await fetch("http://localhost:3000/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args), // <-- important to stringify the body
        });
      } else if (functionCall.name === "get_users") {
        // If the AI called the get_users function, we fetch the users
        // from the API we are trying to reach
        res = await fetch("http://localhost:3000/api/users", {
          method: "GET",
        });
      }
      const data = await res?.json();
      console.log("Users response:", data);
    } catch (error) {
      console.error("Error sending request:", error);
    }
  };

  return (
    <div>
      <form className="form-wrapper" onSubmit={handleTypedSubmit}>
        <h2>Typed prompt</h2>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your AI prompt"
          className="prompt-input"
        />
        <button type="submit">Submit</button>

        <h2>Audio prompt</h2>
        <div className="record-button-wrapper">
          {recording && <div className="recording-dot" />}
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
          >
            {recording ? "Stop Recording" : "Start Recording"}
          </button>
        </div>

        <button type="button" onClick={transcriptAudio}>
          Transcript & Send
        </button>

        {audioUrl && (
          <div>
            <h3>Preview:</h3>
            <audio controls src={audioUrl} />
            <a href={audioUrl} download="recording.webm">
              Download
            </a>
          </div>
        )}
      </form>
    </div>
  );
};
