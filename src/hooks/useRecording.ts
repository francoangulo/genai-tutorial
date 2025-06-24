import { useRef, useState } from "react";

export const useRecording = () => {
  const [recording, setRecording] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recordedFile, setRecordedFile] = useState<File>();

  const startRecording = async () => {
    try {
      // Ensure the browser has permission to access the microphone
      const stream: MediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!stream) {
        throw new Error("Unable to access microphone");
      }

      // Create a MediaRecorder instance with the audio stream
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Set up event handlers for the MediaRecorder
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          // Push the audio data into the chunks array
          audioChunksRef.current.push(event.data);
        }
      };

      // When the recording stops, create a Blob from the audio chunks
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        // Convert Blob to File and set the recorded file state
        // we need this for GenAI file upload
        const file = blobToFile(audioBlob, "recording.webm");
        setRecordedFile(file);
        // In case you want to use the audio URL for playback
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };

      // Start recording audio
      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
    // Stop the MediaRecorder if it exists
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  return {
    recording,
    stopRecording,
    startRecording,
    audioUrl,
    recordedFile,
  };
};

// Helper function to convert Blob to File
// This is necessary for uploading to GenAI as a file
const blobToFile = (blob: Blob, filename: string): File => {
  return new File([blob], filename, { type: blob.type });
};
