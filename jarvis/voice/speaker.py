import asyncio
import edge_tts
import pygame
import os

class JarvisSpeaker:
    def __init__(self):
        self.voice = "pt-BR-AntonioNeural" # Voz masculina brasileira premium
        self.output_file = "jarvis_speech.mp3"
        pygame.mixer.init()

    async def _generate_and_play(self, text):
        communicate = edge_tts.Communicate(text, self.voice)
        await communicate.save(self.output_file)
        
        pygame.mixer.music.load(self.output_file)
        pygame.mixer.music.play()
        
        while pygame.mixer.music.get_busy():
            await asyncio.sleep(0.1)
        
        pygame.mixer.music.unload()
        try:
            os.remove(self.output_file)
        except:
            pass

    def speak(self, text):
        print(f"[JARVIS] {text}")
        asyncio.run(self._generate_and_play(text))

if __name__ == "__main__":
    s = JarvisSpeaker()
    s.speak("Sistemas online, Comandante. Como posso ajudar?")
